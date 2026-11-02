<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A card saved at MonoPay for automatic payments. Only the token is stored.
 *
 * @property int $id
 * @property int $user_id
 * @property string $token
 * @property string $masked_pan
 * @property bool $autopay
 * @property Carbon|null $last_failed_at
 */
class Card extends Model
{
    protected $fillable = ['user_id', 'token', 'masked_pan', 'autopay', 'last_failed_at'];

    protected $hidden = ['token'];

    protected function casts(): array
    {
        return ['autopay' => 'boolean', 'last_failed_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
