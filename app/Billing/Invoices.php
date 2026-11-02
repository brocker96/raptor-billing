<?php

namespace App\Billing;

use App\Jobs\ProvisionService;
use App\Models\Invoice;
use App\Models\Service;
use App\Models\Setting;
use App\Models\User;
use App\Notifications\InvoicePaid;
use Illuminate\Support\Facades\DB;

/**
 * Creates invoices and settles them from the balance. Paying an invoice fulfils it: a new
 * order is provisioned, a renewal extends the service, an upgrade switches the plan.
 */
class Invoices
{
    public function __construct(private Wallet $wallet) {}

    /**
     * @param  list<array{description: string, amount: int}>  $items
     * @param  array<string, mixed>  $attributes
     */
    public function create(User $user, string $type, array $items, array $attributes = []): Invoice
    {
        return DB::transaction(function () use ($user, $type, $items, $attributes) {
            $subtotal = array_sum(array_column($items, 'amount'));
            $discount = (int) ($attributes['discount'] ?? 0);

            $invoice = Invoice::query()->create([
                'number' => 'pending-'.uniqid('', true),
                'user_id' => $user->id,
                'type' => $type,
                'status' => 'unpaid',
                'currency' => $user->currency,
                'subtotal' => $subtotal,
                'discount' => $discount,
                'total' => max(0, $subtotal - $discount),
                'due_at' => $attributes['due_at'] ?? now(),
            ] + array_intersect_key($attributes, array_flip(['service_id', 'promo_code_id', 'meta'])));

            // Numbers come from the id, so they are unique and without gaps per year of use.
            $invoice->forceFill(['number' => sprintf('%s-%s-%06d', Setting::get('invoice_prefix'), now()->format('Y'), $invoice->id)])->save();
            $invoice->items()->createMany($items);

            return $invoice;
        });
    }

    /**
     * Pays the invoice from the balance when there is enough money. Returns whether it is paid.
     */
    public function settle(Invoice $invoice): bool
    {
        $paid = DB::transaction(function () use ($invoice) {
            /** @var Invoice $locked */
            $locked = Invoice::query()->whereKey($invoice->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== 'unpaid') {
                return false;
            }

            $user = $locked->user;
            if ($locked->total > 0) {
                if ($user->balance < $locked->total || $user->currency !== $locked->currency) {
                    return false;
                }
                $this->wallet->change($user, -$locked->total, 'charge', 'Оплата рахунку '.$locked->number, ['invoice_id' => $locked->id]);
            }

            $locked->forceFill(['status' => 'paid', 'paid_at' => now()])->save();
            $invoice->setRawAttributes($locked->getAttributes(), true);

            return true;
        });

        if ($paid) {
            $this->fulfil($invoice->refresh());
            $invoice->user->notify(new InvoicePaid($invoice));
        }

        return $paid;
    }

    /**
     * Pays every unpaid invoice of the user the balance covers, oldest first.
     */
    public function settleAll(User $user): void
    {
        $user->invoices()->where('status', 'unpaid')->where('type', '!=', 'topup')->orderBy('id')->get()
            ->each(fn (Invoice $invoice) => $this->settle($invoice));
    }

    public function cancel(Invoice $invoice): void
    {
        if ($invoice->status === 'unpaid') {
            $invoice->forceFill(['status' => 'cancelled'])->save();
        }
    }

    private function fulfil(Invoice $invoice): void
    {
        $service = $invoice->service;
        if (! $service) {
            return;
        }

        match ($invoice->type) {
            'order' => $this->activateOrder($service),
            'renewal' => $this->renew($service, $invoice),
            'upgrade' => $this->upgrade($service, $invoice),
            default => null,
        };
    }

    private function activateOrder(Service $service): void
    {
        $service->forceFill(['status' => 'provisioning', 'next_due_at' => now()->addMonths($service->period_months)])->save();
        ProvisionService::dispatch($service->id);
    }

    private function renew(Service $service, Invoice $invoice): void
    {
        // Renewals extend from the old due date, paying late does not shorten the period.
        $from = $service->next_due_at && $service->next_due_at->isFuture() ? $service->next_due_at : ($service->next_due_at ?? now());
        $service->forceFill(['next_due_at' => $from->copy()->addMonths($service->period_months)]);

        if (($invoice->meta['plan_id'] ?? null) && $invoice->meta['plan_id'] !== $service->plan_id) {
            // A downgrade chosen earlier starts with the new period.
            app(Provisioner::class)->switchPlan($service, (int) $invoice->meta['plan_id'], (int) $invoice->meta['amount']);
        }
        $service->save();

        if ($service->status === 'suspended') {
            app(Provisioner::class)->unsuspend($service);
        }
    }

    private function upgrade(Service $service, Invoice $invoice): void
    {
        app(Provisioner::class)->switchPlan($service, (int) $invoice->meta['plan_id'], (int) $invoice->meta['amount']);
    }
}
