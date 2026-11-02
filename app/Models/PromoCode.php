<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $code
 * @property string $type percent|fixed
 * @property int $value percent, or minor units for fixed
 * @property string|null $currency
 * @property int|null $max_uses
 * @property int $uses
 * @property bool $first_period_only
 * @property list<int>|null $plan_ids
 * @property Carbon|null $expires_at
 * @property bool $active
 */
class PromoCode extends Model
{
    protected $fillable = ['code', 'type', 'value', 'currency', 'max_uses', 'uses', 'first_period_only', 'plan_ids', 'expires_at', 'active'];

    protected function casts(): array
    {
        return [
            'value' => 'integer',
            'max_uses' => 'integer',
            'uses' => 'integer',
            'first_period_only' => 'boolean',
            'plan_ids' => 'array',
            'expires_at' => 'datetime',
            'active' => 'boolean',
        ];
    }

    /**
     * The discount for an amount, or null when the code does not apply.
     */
    public function discountFor(int $amount, string $currency, int $planId): ?int
    {
        if (! $this->active
            || ($this->expires_at && $this->expires_at->isPast())
            || ($this->max_uses !== null && $this->uses >= $this->max_uses)
            || (! empty($this->plan_ids) && ! in_array($planId, $this->plan_ids, true))
            || ($this->type === 'fixed' && $this->currency !== $currency)) {
            return null;
        }

        $discount = $this->type === 'percent' ? intdiv($amount * min($this->value, 100), 100) : $this->value;

        return min($discount, $amount);
    }
}
