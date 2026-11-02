<?php

namespace Tests\Feature\Billing;

use App\Models\Plan;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

abstract class BillingTestCase extends TestCase
{
    use RefreshDatabase;

    protected Plan $plan;

    /** @var \OpenSSLAsymmetricKey */
    protected $monoKey;

    /** @var list<array{method: string, url: string, body: array}> */
    protected array $panelCalls = [];

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();

        Setting::put([
            'panel_url' => 'https://panel.test',
            'panel_key' => 'ptla_test',
            'panel_webhook_secret' => 'whsec_test',
            'monopay_token' => 'mono_test',
            'currencies' => 'UAH,USD',
        ]);

        $this->plan = Plan::query()->create(['name' => 'Minecraft 4 GB', 'slug' => 'mc-4gb', 'panel_package' => 'minecraft-4gb', 'features' => ['4 GB RAM']]);
        $this->plan->prices()->createMany([
            ['currency' => 'UAH', 'period_months' => 1, 'amount' => 20000],
            ['currency' => 'UAH', 'period_months' => 3, 'amount' => 54000],
            ['currency' => 'USD', 'period_months' => 1, 'amount' => 500],
        ]);

        $this->monoKey = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
        $public = openssl_pkey_get_details($this->monoKey)['key'];

        Http::fake(function ($request) use ($public) {
            $url = $request->url();
            if (str_starts_with($url, 'https://panel.test')) {
                $this->panelCalls[] = ['method' => $request->method(), 'url' => $url, 'body' => $request->data()];
                if (str_ends_with($url, '/servers') && $request->method() === 'POST') {
                    return Http::response(['existing' => false, 'server' => ['id' => 7, 'identifier' => 'abcd1234', 'address' => ['display' => '203.0.113.5:25565']]], 201);
                }
                if (str_contains($url, '/login-link')) {
                    return Http::response(['url' => 'https://panel.test/auth/link/xyz', 'expires_at' => now()->addMinutes(5)->toAtomString()], 201);
                }
                if (str_contains($url, '/availability')) {
                    return Http::response(['available' => true]);
                }

                return Http::response($request->method() === 'DELETE' ? '' : ['ok' => true], $request->method() === 'DELETE' ? 204 : 200);
            }
            if (str_starts_with($url, 'https://api.github.com/')) {
                return Http::response($this->githubReleases);
            }
            if (str_contains($url, '/api/merchant/pubkey')) {
                return Http::response(['key' => base64_encode($public)]);
            }
            if (str_contains($url, '/api/merchant/invoice/create')) {
                return Http::response(['invoiceId' => 'inv_'.substr(md5((string) microtime(true)), 0, 10), 'pageUrl' => 'https://pay.mbnk.biz/test']);
            }
            if (str_contains($url, '/api/merchant/wallet/payment')) {
                return Http::response(['invoiceId' => 'card_'.substr(md5((string) microtime(true)), 0, 10), 'status' => 'success', 'amount' => $request->data()['amount'], 'ccy' => 980, 'modifiedDate' => now()->toIso8601String()]);
            }

            return Http::response([], 404);
        });
    }

    /** What the fake GitHub API answers for the releases list. */
    protected array $githubReleases = [];

    protected function customer(array $attributes = []): User
    {
        return User::factory()->create($attributes + ['currency' => 'UAH']);
    }

    /**
     * Sends a MonoPay webhook signed like monobank does.
     */
    protected function monoWebhook(array $data): TestResponse
    {
        $body = json_encode($data);
        openssl_sign($body, $signature, $this->monoKey, OPENSSL_ALGO_SHA256);

        return $this->call('POST', '/webhooks/monopay', [], [], [], ['HTTP_X_SIGN' => base64_encode($signature), 'CONTENT_TYPE' => 'application/json'], $body);
    }
}
