<?php

namespace App\Billing;

use App\Models\Invoice;
use App\Models\Plan;
use App\Models\PromoCode;
use App\Models\Service;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Turns a plan in the cart into a service and its first invoice.
 */
class Orders
{
    public function __construct(private Invoices $invoices) {}

    /**
     * Price, discount and total of a plan for a period.
     *
     * @return array{price: int, discount: int, total: int, promo: PromoCode|null}
     */
    public function quote(Plan $plan, string $currency, int $months, ?string $code = null): array
    {
        $price = $plan->price($currency, $months);
        if (! $price || ! $plan->active) {
            throw ValidationException::withMessages(['period' => 'Цей тариф недоступний для обраного періоду або валюти.']);
        }

        $promo = null;
        $discount = 0;
        if ($code !== null && trim($code) !== '') {
            $promo = PromoCode::query()->where('code', mb_strtoupper(trim($code)))->first();
            $discount = $promo?->discountFor($price->amount, $currency, $plan->id);
            if ($discount === null) {
                throw ValidationException::withMessages(['promo' => 'Промокод недійсний для цього замовлення.']);
            }
        }

        return ['price' => $price->amount, 'discount' => $discount, 'total' => $price->amount - $discount, 'promo' => $promo];
    }

    public function place(User $user, Plan $plan, int $months, string $name, ?string $code = null): Invoice
    {
        return DB::transaction(function () use ($user, $plan, $months, $name, $code) {
            $quote = $this->quote($plan, $user->currency, $months, $code);

            $service = Service::query()->create([
                'user_id' => $user->id,
                'plan_id' => $plan->id,
                'name' => $name,
                'status' => 'pending',
                'currency' => $user->currency,
                'amount' => $plan->price($user->currency, $months)->amount,
                'period_months' => $months,
            ]);

            $invoice = $this->invoices->create($user, 'order', [
                ['description' => $plan->name.' · '.$name.' · '.Period::label($months), 'amount' => $quote['price']],
            ], [
                'service_id' => $service->id,
                'promo_code_id' => $quote['promo']?->id,
                'discount' => $quote['discount'],
                'due_at' => now()->addDays(3),
            ]);

            $quote['promo']?->increment('uses');

            return $invoice;
        });
    }
}
