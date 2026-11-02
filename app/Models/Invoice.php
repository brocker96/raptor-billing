<?php

namespace App\Models;

use App\Billing\Currency;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $number
 * @property int $user_id
 * @property int|null $service_id
 * @property int|null $promo_code_id
 * @property string $type order|renewal|upgrade|topup
 * @property string $status unpaid|paid|cancelled
 * @property string $currency
 * @property int $subtotal
 * @property int $discount
 * @property int $total
 * @property array<string, mixed>|null $meta
 * @property Carbon|null $due_at
 * @property Carbon|null $paid_at
 * @property Carbon $created_at
 * @property User $user
 * @property Service|null $service
 */
class Invoice extends Model
{
    protected $fillable = ['number', 'user_id', 'service_id', 'promo_code_id', 'type', 'status', 'currency', 'subtotal', 'discount', 'total', 'meta', 'due_at', 'paid_at'];

    protected function casts(): array
    {
        return [
            'subtotal' => 'integer',
            'discount' => 'integer',
            'total' => 'integer',
            'meta' => 'array',
            'due_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function money(): Currency
    {
        return Currency::from($this->currency);
    }
}
