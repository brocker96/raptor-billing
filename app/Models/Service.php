<?php

namespace App\Models;

use App\Billing\Currency;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A server a customer pays for.
 *
 * @property int $id
 * @property int $user_id
 * @property int $plan_id
 * @property int|null $next_plan_id
 * @property string $name
 * @property string $status pending|provisioning|active|suspended|terminated|cancelled|failed
 * @property string $currency
 * @property int $amount price per period, minor units
 * @property int $period_months
 * @property bool $auto_renew
 * @property Carbon|null $next_due_at
 * @property int|null $panel_server_id
 * @property string|null $panel_identifier
 * @property string|null $panel_address
 * @property string|null $last_error
 * @property Carbon|null $activated_at
 * @property Carbon|null $suspended_at
 * @property Carbon|null $terminated_at
 * @property User $user
 * @property Plan $plan
 * @property Plan|null $nextPlan
 */
class Service extends Model
{
    public const LIVE = ['provisioning', 'active', 'suspended'];

    protected $fillable = ['user_id', 'plan_id', 'next_plan_id', 'name', 'status', 'currency', 'amount', 'period_months', 'auto_renew', 'next_due_at'];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'period_months' => 'integer',
            'auto_renew' => 'boolean',
            'next_due_at' => 'datetime',
            'activated_at' => 'datetime',
            'suspended_at' => 'datetime',
            'terminated_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function nextPlan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'next_plan_id');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    /**
     * The id the panel knows this service by.
     */
    public function externalId(): string
    {
        return 'svc-'.$this->id;
    }

    public function money(): Currency
    {
        return Currency::from($this->currency);
    }
}
