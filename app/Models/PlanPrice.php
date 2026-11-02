<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $plan_id
 * @property string $currency
 * @property int $period_months
 * @property int $amount minor units
 */
class PlanPrice extends Model
{
    public $timestamps = false;

    protected $fillable = ['plan_id', 'currency', 'period_months', 'amount'];

    protected function casts(): array
    {
        return ['period_months' => 'integer', 'amount' => 'integer'];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }
}
