<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $invoice_id
 * @property string $description
 * @property int $amount
 */
class InvoiceItem extends Model
{
    public $timestamps = false;

    protected $fillable = ['invoice_id', 'description', 'amount'];

    protected function casts(): array
    {
        return ['amount' => 'integer'];
    }
}
