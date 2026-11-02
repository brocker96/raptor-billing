<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One line of the balance ledger. Positive amounts add money, negative ones spend it.
 *
 * @property int $id
 * @property int $user_id
 * @property string $currency
 * @property int $amount
 * @property int $balance_after
 * @property string $type topup|charge|refund|adjustment
 * @property string $description
 * @property int|null $invoice_id
 * @property int|null $payment_id
 * @property int|null $admin_id
 */
class Transaction extends Model
{
    protected $fillable = ['user_id', 'currency', 'amount', 'balance_after', 'type', 'description', 'invoice_id', 'payment_id', 'admin_id'];

    protected function casts(): array
    {
        return ['amount' => 'integer', 'balance_after' => 'integer'];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
