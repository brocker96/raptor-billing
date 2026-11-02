<?php

namespace App\Billing;

use App\Models\Card;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Notifications\PaymentReceived;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Money comes in through MonoPay and always lands on the balance first. Unpaid invoices are
 * then paid from the balance, so a payment that arrives late or twice can never be lost or
 * counted twice.
 */
class Payments
{
    public function __construct(private MonoPay $mono, private Wallet $wallet, private Invoices $invoices) {}

    /**
     * Starts a top-up on the MonoPay page. With an invoice, the missing amount is topped up and
     * the invoice paid right after.
     */
    public function start(User $user, int $amount, ?Invoice $invoice = null, bool $saveCard = false): Payment
    {
        if ($saveCard && ! $user->wallet_id) {
            $user->forceFill(['wallet_id' => 'rb-'.$user->id.'-'.Str::lower(Str::random(12))])->save();
        }

        $payment = Payment::query()->create([
            'user_id' => $user->id,
            'invoice_id' => $invoice?->id,
            'method' => 'page',
            'status' => 'created',
            'currency' => $user->currency,
            'amount' => $amount,
            'save_card' => $saveCard,
        ]);

        $result = $this->mono->createInvoice($amount, $user->money(), [
            'reference' => 'payment-'.$payment->id,
            'destination' => $invoice ? 'Оплата рахунку '.$invoice->number : 'Поповнення балансу, клієнт #'.$user->id,
            'redirectUrl' => route('payments.return', $payment),
            'webHookUrl' => route('webhooks.monopay'),
            'saveCard' => $saveCard,
            'walletId' => $user->wallet_id,
        ]);

        $payment->forceFill(['provider_id' => $result['invoiceId'], 'page_url' => $result['pageUrl']])->save();

        return $payment;
    }

    /**
     * Charges a saved card for an amount, used by automatic renewals.
     */
    public function chargeCard(Card $card, int $amount, ?Invoice $invoice): Payment
    {
        $user = $card->user;
        $payment = Payment::query()->create([
            'user_id' => $user->id,
            'invoice_id' => $invoice?->id,
            'method' => 'card',
            'status' => 'created',
            'currency' => $user->currency,
            'amount' => $amount,
        ]);

        $result = $this->mono->chargeCard($card->token, $amount, $user->money(), 'payment-'.$payment->id,
            $invoice ? 'Автооплата рахунку '.$invoice->number : 'Автопоповнення балансу', route('webhooks.monopay'));

        $payment->forceFill(['provider_id' => $result['invoiceId'] ?? null])->save();
        if (isset($result['status'])) {
            $this->apply($payment, $result);
        }

        return $payment;
    }

    /**
     * Applies a status from a webhook or from polling. Statuses can arrive out of order, the one
     * with the newest modifiedDate wins.
     */
    public function apply(Payment $payment, array $data): void
    {
        $credited = DB::transaction(function () use ($payment, $data) {
            /** @var Payment $locked */
            $locked = Payment::query()->whereKey($payment->id)->lockForUpdate()->firstOrFail();
            $modified = isset($data['modifiedDate']) ? Carbon::parse($data['modifiedDate']) : now();

            if ($locked->provider_modified_at && $modified->lt($locked->provider_modified_at)) {
                return false;
            }

            $locked->forceFill([
                'status' => $data['status'] ?? $locked->status,
                'failure_reason' => $data['failureReason'] ?? null,
                'provider_modified_at' => $modified,
                'payload' => $data,
            ])->save();

            if ($locked->status !== 'success' || $locked->credited) {
                return false;
            }

            // finalAmount is what was actually charged, it can differ for holds.
            $amount = (int) ($data['finalAmount'] ?? $data['amount'] ?? $locked->amount);
            $locked->forceFill(['credited' => true])->save();
            $this->wallet->change($locked->user, $amount, 'topup', 'Поповнення через MonoPay', ['payment_id' => $locked->id]);

            if (! empty($data['walletData']['cardToken'])) {
                $this->rememberCard($locked->user, $data);
            }

            return true;
        });

        $payment->refresh();
        if ($credited) {
            $payment->user->notify(new PaymentReceived($payment));
            if ($payment->invoice) {
                $this->invoices->settle($payment->invoice);
            }
            $this->invoices->settleAll($payment->user);
        }
    }

    /**
     * Asks MonoPay for the status, for the return page and payments without a webhook.
     */
    public function sync(Payment $payment): void
    {
        if ($payment->provider_id && ! in_array($payment->status, ['success', 'failure', 'reversed', 'expired'], true)) {
            $this->apply($payment, $this->mono->status($payment->provider_id));
        }
    }

    private function rememberCard(User $user, array $data): void
    {
        $token = $data['walletData']['cardToken'];
        Card::query()->firstOrCreate(['token' => $token], [
            'user_id' => $user->id,
            'masked_pan' => $data['paymentInfo']['maskedPan'] ?? '•••• ••••',
            'autopay' => true,
        ]);
    }
}
