<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A MonoPay payment that tops up the balance.
 *
 * @property int $id
 * @property int $user_id
 * @property int|null $invoice_id the invoice paid right after the top-up
 * @property string $provider
 * @property string|null $provider_id MonoPay invoiceId
 * @property string $method page|card
 * @property string $status created|processing|hold|success|failure|reversed|expired
 * @property string $currency
 * @property int $amount
 * @property string|null $page_url
 * @property bool $save_card
 * @property bool $credited
 * @property string|null $failure_reason
 * @property Carbon|null $provider_modified_at
 * @property array<string, mixed>|null $payload
 * @property User $user
 * @property Invoice|null $invoice
 */
class Payment extends Model
{
    protected $fillable = ['user_id', 'invoice_id', 'provider', 'provider_id', 'method', 'status', 'currency', 'amount', 'page_url', 'save_card', 'failure_reason', 'provider_modified_at', 'payload'];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'save_card' => 'boolean',
            'credited' => 'boolean',
            'provider_modified_at' => 'datetime',
            'payload' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
