<?php

namespace App\Billing;

use App\Models\Transaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * The balance of a customer. Every change locks the user row and writes a ledger line, so
 * the balance always equals the sum of the ledger.
 */
class Wallet
{
    /**
     * @param  array{invoice_id?: int|null, payment_id?: int|null, admin_id?: int|null}  $refs
     */
    public function change(User $user, int $amount, string $type, string $description, array $refs = [], bool $allowNegative = false): Transaction
    {
        return DB::transaction(function () use ($user, $amount, $type, $description, $refs, $allowNegative) {
            /** @var User $locked */
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $balance = $locked->balance + $amount;

            if ($balance < 0 && ! $allowNegative) {
                throw new RuntimeException('Insufficient balance.');
            }

            $locked->forceFill(['balance' => $balance])->save();
            $user->balance = $balance;

            return Transaction::query()->create([
                'user_id' => $user->id,
                'currency' => $locked->currency,
                'amount' => $amount,
                'balance_after' => $balance,
                'type' => $type,
                'description' => $description,
            ] + $refs);
        });
    }
}
