<?php

namespace App\Billing;

use App\Models\Setting;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Plata by mono (monobank acquiring), https://api.monobank.ua. Amounts are minor units,
 * currencies ISO 4217 numeric codes.
 */
class MonoPay
{
    public const BASE = 'https://api.monobank.ua';

    public function configured(): bool
    {
        return Setting::get('monopay_token') !== '';
    }

    /**
     * @param  array{reference: string, destination: string, redirectUrl: string, webHookUrl: string, saveCard?: bool, walletId?: string|null, validity?: int}  $options
     * @return array{invoiceId: string, pageUrl: string}
     */
    public function createInvoice(int $amount, Currency $currency, array $options): array
    {
        $body = [
            'amount' => $amount,
            'ccy' => $currency->iso(),
            'merchantPaymInfo' => ['reference' => $options['reference'], 'destination' => $options['destination']],
            'redirectUrl' => $options['redirectUrl'],
            'webHookUrl' => $options['webHookUrl'],
            'validity' => $options['validity'] ?? 86400,
            'paymentType' => 'debit',
        ];
        if (! empty($options['saveCard'])) {
            $body['saveCardData'] = array_filter(['saveCard' => true, 'walletId' => $options['walletId'] ?? null]);
        }

        return $this->http()->post('/api/merchant/invoice/create', $body)->throw()->json();
    }

    public function status(string $invoiceId): array
    {
        return $this->http()->get('/api/merchant/invoice/status', ['invoiceId' => $invoiceId])->throw()->json();
    }

    /**
     * Charges a saved card without the customer, for automatic renewals.
     */
    public function chargeCard(string $cardToken, int $amount, Currency $currency, string $reference, string $destination, string $webHookUrl): array
    {
        return $this->http()->post('/api/merchant/wallet/payment', [
            'cardToken' => $cardToken,
            'amount' => $amount,
            'ccy' => $currency->iso(),
            'initiationKind' => 'merchant',
            'merchantPaymInfo' => ['reference' => $reference, 'destination' => $destination],
            'webHookUrl' => $webHookUrl,
            'paymentType' => 'debit',
        ])->throw()->json();
    }

    /**
     * @return list<array{cardToken: string, maskedPan: string, country?: string}>
     */
    public function cards(string $walletId): array
    {
        return $this->http()->get('/api/merchant/wallet', ['walletId' => $walletId])->throw()->json('wallet') ?? [];
    }

    public function deleteCard(string $cardToken): void
    {
        $this->http()->delete('/api/merchant/wallet/card?cardToken='.rawurlencode($cardToken))->throw();
    }

    /**
     * Checks the x-sign header: a base64 DER ECDSA signature over the SHA-256 of the raw body,
     * made with the key from /api/merchant/pubkey. The key is cached and fetched again once
     * when it no longer verifies, in case monobank rotated it.
     */
    public function verify(string $body, string $signature): bool
    {
        $signature = base64_decode($signature, true);
        if ($signature === false || $signature === '') {
            return false;
        }

        foreach ([false, true] as $fresh) {
            $key = $this->publicKey($fresh);
            if ($key && openssl_verify($body, $signature, $key, OPENSSL_ALGO_SHA256) === 1) {
                return true;
            }
        }

        return false;
    }

    private function publicKey(bool $fresh): ?string
    {
        if ($fresh) {
            Cache::forget('monopay:pubkey');
        }

        return Cache::remember('monopay:pubkey', now()->addDay(), function () {
            $key = $this->http()->get('/api/merchant/pubkey')->throw()->json('key');

            return $key ? base64_decode($key) : null;
        });
    }

    private function http(): PendingRequest
    {
        if (! $this->configured()) {
            throw new RuntimeException('MonoPay is not configured, see Admin → Settings.');
        }

        return Http::baseUrl(self::BASE)
            ->withHeaders(['X-Token' => (string) Setting::get('monopay_token'), 'X-Cms' => 'Raptor Billing'])
            ->acceptJson()
            ->timeout(20)
            ->connectTimeout(10);
    }

    public static function error(\Throwable $exception): string
    {
        if ($exception instanceof RequestException) {
            return $exception->response->json('errText') ?? $exception->response->json('errorDescription') ?? 'MonoPay answered HTTP '.$exception->response->status();
        }

        return $exception->getMessage();
    }
}
