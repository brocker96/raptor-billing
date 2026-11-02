<?php

namespace App\Billing;

use App\Models\Card;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Service;
use App\Models\Transaction;
use App\Models\User;

/**
 * Shapes models for the React pages, with money already formatted.
 */
class Present
{
    public static function money(int $minor, string $currency): array
    {
        return ['amount' => $minor, 'currency' => $currency, 'formatted' => Currency::from($currency)->format($minor)];
    }

    public static function plan(Plan $plan, ?string $currency = null): array
    {
        $prices = $plan->prices->when($currency, fn ($p) => $p->where('currency', $currency))->sortBy('period_months')->values();

        return [
            'id' => $plan->id,
            'name' => $plan->name,
            'slug' => $plan->slug,
            'category' => $plan->category,
            'description' => $plan->description,
            'features' => $plan->features ?? [],
            'panel_package' => $plan->panel_package,
            'active' => $plan->active,
            'featured' => $plan->featured,
            'sort' => $plan->sort,
            'prices' => $prices->map(fn ($p) => [
                'currency' => $p->currency,
                'period_months' => $p->period_months,
                'period' => Period::label($p->period_months),
                'monthly' => self::money(intdiv($p->amount, $p->period_months), $p->currency),
            ] + self::money($p->amount, $p->currency))->all(),
        ];
    }

    public static function service(Service $service): array
    {
        return [
            'id' => $service->id,
            'name' => $service->name,
            'status' => $service->status,
            'plan' => ['id' => $service->plan->id, 'name' => $service->plan->name, 'slug' => $service->plan->slug],
            'next_plan' => $service->nextPlan ? ['id' => $service->nextPlan->id, 'name' => $service->nextPlan->name] : null,
            'price' => self::money($service->amount, $service->currency),
            'period_months' => $service->period_months,
            'period' => Period::label($service->period_months),
            'auto_renew' => $service->auto_renew,
            'next_due_at' => $service->next_due_at?->toAtomString(),
            'address' => $service->panel_address,
            'identifier' => $service->panel_identifier,
            'last_error' => $service->last_error,
            'activated_at' => $service->activated_at?->toAtomString(),
            'created_at' => $service->created_at?->toAtomString(),
            'user' => $service->relationLoaded('user') ? ['id' => $service->user->id, 'name' => $service->user->name, 'email' => $service->user->email] : null,
        ];
    }

    public static function invoice(Invoice $invoice, bool $items = false): array
    {
        return [
            'id' => $invoice->id,
            'number' => $invoice->number,
            'type' => $invoice->type,
            'status' => $invoice->status,
            'subtotal' => self::money($invoice->subtotal, $invoice->currency),
            'discount' => self::money($invoice->discount, $invoice->currency),
            'total' => self::money($invoice->total, $invoice->currency),
            'due_at' => $invoice->due_at?->toAtomString(),
            'paid_at' => $invoice->paid_at?->toAtomString(),
            'created_at' => $invoice->created_at->toAtomString(),
            'service' => $invoice->service ? ['id' => $invoice->service->id, 'name' => $invoice->service->name] : null,
            'user' => $invoice->relationLoaded('user') ? ['id' => $invoice->user->id, 'name' => $invoice->user->name, 'email' => $invoice->user->email] : null,
            'items' => $items ? $invoice->items->map(fn ($i) => ['description' => $i->description] + self::money($i->amount, $invoice->currency))->all() : null,
        ];
    }

    public static function transaction(Transaction $t): array
    {
        return [
            'id' => $t->id,
            'type' => $t->type,
            'description' => $t->description,
            'amount' => self::money($t->amount, $t->currency),
            'balance_after' => self::money($t->balance_after, $t->currency),
            'invoice' => $t->invoice ? ['id' => $t->invoice->id, 'number' => $t->invoice->number] : null,
            'created_at' => $t->created_at->toAtomString(),
        ];
    }

    public static function payment(Payment $p): array
    {
        return [
            'id' => $p->id,
            'method' => $p->method,
            'status' => $p->status,
            'amount' => self::money($p->amount, $p->currency),
            'provider_id' => $p->provider_id,
            'failure_reason' => $p->failure_reason,
            'invoice' => $p->invoice ? ['id' => $p->invoice->id, 'number' => $p->invoice->number] : null,
            'user' => $p->relationLoaded('user') ? ['id' => $p->user->id, 'name' => $p->user->name, 'email' => $p->user->email] : null,
            'created_at' => $p->created_at->toAtomString(),
        ];
    }

    public static function card(Card $card): array
    {
        return ['id' => $card->id, 'masked_pan' => $card->masked_pan, 'autopay' => $card->autopay, 'created_at' => $card->created_at->toAtomString()];
    }

    public static function user(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'is_admin' => $user->is_admin,
            'currency' => $user->currency,
            'balance' => self::money($user->balance, $user->currency),
            'email_verified' => $user->email_verified_at !== null,
            'created_at' => $user->created_at?->toAtomString(),
        ];
    }
}
