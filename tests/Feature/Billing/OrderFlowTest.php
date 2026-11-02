<?php

namespace Tests\Feature\Billing;

use App\Jobs\ProvisionService;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PromoCode;
use App\Models\Service;
use Illuminate\Support\Facades\Queue;

class OrderFlowTest extends BillingTestCase
{
    public function test_order_paid_from_balance_provisions_the_server(): void
    {
        $user = $this->customer(['balance' => 50000]);

        $this->actingAs($user)->post('/order/mc-4gb', ['period' => 1, 'name' => 'My SMP', 'terms' => true])->assertRedirect();

        $service = Service::query()->sole();
        $this->assertSame('active', $service->status);
        $this->assertSame('203.0.113.5:25565', $service->panel_address);
        $this->assertSame(30000, $user->fresh()->balance);
        $this->assertSame('paid', Invoice::query()->sole()->status);
        $this->assertTrue($service->next_due_at->between(now()->addMonth()->subMinute(), now()->addMonth()->addMinute()));

        $create = collect($this->panelCalls)->firstWhere('method', 'POST');
        $this->assertSame('svc-'.$service->id, $create['body']['external_id']);
        $this->assertSame('minecraft-4gb', $create['body']['package']);
        $this->assertSame('client-'.$user->id, $create['body']['user']['external_id']);
    }

    public function test_paying_the_missing_part_with_monopay_completes_the_order(): void
    {
        Queue::fake([ProvisionService::class]);
        $user = $this->customer(['balance' => 5000]);
        $this->actingAs($user)->post('/order/mc-4gb', ['period' => 1, 'name' => 'Srv', 'terms' => true]);
        $invoice = Invoice::query()->sole();
        $this->assertSame('unpaid', $invoice->status);

        $this->actingAs($user)->post("/invoices/{$invoice->id}/pay", ['save_card' => true])->assertRedirect('https://pay.mbnk.biz/test');
        $payment = Payment::query()->sole();
        $this->assertSame(15000, $payment->amount);

        // Out of order: success first, then the older processing webhook must not undo it.
        $this->monoWebhook(['invoiceId' => $payment->provider_id, 'status' => 'success', 'amount' => 15000, 'finalAmount' => 15000, 'ccy' => 980,
            'modifiedDate' => '2026-11-02T10:00:05Z', 'walletData' => ['cardToken' => 'tok_1', 'walletId' => $user->fresh()->wallet_id, 'status' => 'created'],
            'paymentInfo' => ['maskedPan' => '444403******1902']])->assertOk();
        $this->monoWebhook(['invoiceId' => $payment->provider_id, 'status' => 'processing', 'amount' => 15000, 'ccy' => 980, 'modifiedDate' => '2026-11-02T10:00:01Z'])->assertOk();
        // The same success again must not credit twice.
        $this->monoWebhook(['invoiceId' => $payment->provider_id, 'status' => 'success', 'amount' => 15000, 'ccy' => 980, 'modifiedDate' => '2026-11-02T10:00:05Z'])->assertOk();

        $this->assertSame('success', $payment->fresh()->status);
        $this->assertSame('paid', $invoice->fresh()->status);
        $this->assertSame(0, $user->fresh()->balance);
        $this->assertSame('provisioning', Service::query()->sole()->status);
        $this->assertSame('444403******1902', $user->cards()->sole()->masked_pan);
        Queue::assertPushed(ProvisionService::class);
    }

    public function test_webhooks_with_a_bad_signature_are_refused(): void
    {
        $this->call('POST', '/webhooks/monopay', [], [], [], ['HTTP_X_SIGN' => base64_encode('nope'), 'CONTENT_TYPE' => 'application/json'], '{"invoiceId":"x","status":"success"}')
            ->assertStatus(400);
    }

    public function test_promo_codes_lower_the_first_invoice(): void
    {
        PromoCode::query()->create(['code' => 'START20', 'type' => 'percent', 'value' => 20, 'max_uses' => 1]);
        $user = $this->customer();

        $this->actingAs($user)->postJson('/order/mc-4gb/quote', ['period' => 1, 'promo' => 'start20'])->assertOk()->assertJsonPath('total.amount', 16000);
        $this->actingAs($user)->post('/order/mc-4gb', ['period' => 1, 'name' => 'Srv', 'promo' => 'START20', 'terms' => true]);

        $this->assertSame(16000, Invoice::query()->sole()->total);
        $this->actingAs($user)->postJson('/order/mc-4gb/quote', ['period' => 1, 'promo' => 'START20'])->assertUnprocessable();
    }

    public function test_customers_cannot_see_each_others_invoices(): void
    {
        $owner = $this->customer();
        $this->actingAs($owner)->post('/order/mc-4gb', ['period' => 1, 'name' => 'Srv', 'terms' => true]);
        $invoice = Invoice::query()->sole();

        $this->actingAs($this->customer())->get("/invoices/{$invoice->id}")->assertNotFound();
        $this->actingAs($this->customer())->post("/invoices/{$invoice->id}/pay")->assertNotFound();
    }
}
