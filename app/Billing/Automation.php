<?php

namespace App\Billing;

use App\Models\Card;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\Setting;
use App\Notifications\InvoiceCreated;
use Illuminate\Support\Facades\Log;

/**
 * The hourly billing run: renewal invoices, payments from the balance and saved cards,
 * suspension and termination of unpaid services, and clean up of abandoned orders.
 */
class Automation
{
    /** @var array<string, int> */
    public array $stats = ['invoiced' => 0, 'paid' => 0, 'charged' => 0, 'suspended' => 0, 'terminated' => 0, 'cancelled' => 0];

    public function __construct(private Invoices $invoices, private Payments $payments, private Provisioner $provisioner) {}

    public function run(): array
    {
        $this->invoiceRenewals();
        $this->collect();
        $this->suspendOverdue();
        $this->terminate();
        $this->cancelAbandonedOrders();

        return $this->stats;
    }

    private function invoiceRenewals(): void
    {
        $until = now()->addDays(Setting::int('invoice_days_before'));

        Service::query()->with(['user', 'plan.prices', 'nextPlan.prices'])
            ->whereIn('status', ['active', 'suspended'])->where('auto_renew', true)
            ->where('next_due_at', '<=', $until)
            ->whereDoesntHave('invoices', fn ($q) => $q->where('type', 'renewal')->where('status', 'unpaid'))
            ->each(function (Service $service) {
                $plan = $service->nextPlan ?? $service->plan;
                $amount = $service->nextPlan ? ($plan->price($service->currency, $service->period_months)?->amount ?? $service->amount) : $service->amount;

                $invoice = $this->invoices->create($service->user, 'renewal', [
                    ['description' => $plan->name.' · '.$service->name.' · '.Period::label($service->period_months), 'amount' => $amount],
                ], [
                    'service_id' => $service->id,
                    'due_at' => $service->next_due_at,
                    'meta' => $service->nextPlan ? ['plan_id' => $plan->id, 'amount' => $amount] : null,
                ]);
                $this->stats['invoiced']++;

                if ($this->invoices->settle($invoice)) {
                    $this->stats['paid']++;
                } else {
                    $service->user->notify(new InvoiceCreated($invoice));
                }
            });
    }

    /**
     * Unpaid renewals that are due: the balance first, then the saved card for what is missing.
     */
    private function collect(): void
    {
        Invoice::query()->with(['user.cards', 'service'])
            ->where('status', 'unpaid')->where('type', 'renewal')->where('due_at', '<=', now())
            ->each(function (Invoice $invoice) {
                if ($this->invoices->settle($invoice)) {
                    $this->stats['paid']++;

                    return;
                }

                $card = $invoice->user->cards->first(fn (Card $card) => $card->autopay && (! $card->last_failed_at || $card->last_failed_at->lt(now()->subDay())));
                $recent = Payment::query()->where('invoice_id', $invoice->id)->where('method', 'card')->where('created_at', '>', now()->subHours(20))->exists();
                if (! $card || $recent || $invoice->currency !== $invoice->user->currency) {
                    return;
                }

                try {
                    $this->payments->chargeCard($card, max(1, $invoice->total - max(0, $invoice->user->balance)), $invoice);
                    $this->stats['charged']++;
                } catch (\Throwable $exception) {
                    $card->forceFill(['last_failed_at' => now()])->save();
                    Log::warning('Autopay failed for invoice '.$invoice->number.': '.MonoPay::error($exception));
                }
            });
    }

    private function suspendOverdue(): void
    {
        Invoice::query()->with('service')
            ->where('status', 'unpaid')->where('type', 'renewal')
            ->where('due_at', '<=', now()->subDays(Setting::int('suspend_after_days')))
            ->whereHas('service', fn ($q) => $q->where('status', 'active'))
            ->each(function (Invoice $invoice) {
                try {
                    $this->provisioner->suspend($invoice->service, 'Рахунок '.$invoice->number.' не оплачено.', route('invoices.show', $invoice));
                    $this->stats['suspended']++;
                } catch (\Throwable $exception) {
                    Log::warning('Suspending service '.$invoice->service_id.' failed: '.PanelClient::error($exception));
                }
            });
    }

    private function terminate(): void
    {
        // Unpaid for too long.
        Invoice::query()->with('service')
            ->where('status', 'unpaid')->where('type', 'renewal')
            ->where('due_at', '<=', now()->subDays(Setting::int('terminate_after_days')))
            ->whereHas('service', fn ($q) => $q->whereIn('status', ['active', 'suspended']))
            ->each(function (Invoice $invoice) {
                $this->terminateService($invoice->service);
                $this->invoices->cancel($invoice);
            });

        // Cancelled by the customer: ends with the paid period.
        Service::query()->whereIn('status', ['active', 'suspended'])->where('auto_renew', false)
            ->where('next_due_at', '<=', now())
            ->each(fn (Service $service) => $this->terminateService($service));
    }

    private function terminateService(Service $service): void
    {
        try {
            $this->provisioner->terminate($service);
            $service->invoices()->where('status', 'unpaid')->update(['status' => 'cancelled']);
            $this->stats['terminated']++;
        } catch (\Throwable $exception) {
            Log::warning('Terminating service '.$service->id.' failed: '.PanelClient::error($exception));
        }
    }

    private function cancelAbandonedOrders(): void
    {
        Invoice::query()->with('service')->where('status', 'unpaid')->where('type', 'order')
            ->where('created_at', '<=', now()->subDays(7))
            ->each(function (Invoice $invoice) {
                $this->invoices->cancel($invoice);
                $invoice->service?->forceFill(['status' => 'cancelled'])->save();
                $this->stats['cancelled']++;
            });
    }
}
