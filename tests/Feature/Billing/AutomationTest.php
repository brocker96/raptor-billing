<?php

namespace Tests\Feature\Billing;

use App\Billing\Automation;
use App\Billing\Invoices;
use App\Billing\Wallet;
use App\Models\Card;
use App\Models\Invoice;
use App\Models\Service;
use App\Models\User;

class AutomationTest extends BillingTestCase
{
    private function activeService(User $user, string $due): Service
    {
        $service = Service::query()->create([
            'user_id' => $user->id, 'plan_id' => $this->plan->id, 'name' => 'Srv', 'status' => 'active',
            'currency' => 'UAH', 'amount' => 20000, 'period_months' => 1, 'next_due_at' => now()->modify($due),
        ]);
        $service->forceFill(['panel_server_id' => 7, 'activated_at' => now()->subMonth()])->save();

        return $service;
    }

    public function test_renewal_is_paid_from_the_balance_and_extends_the_service(): void
    {
        $user = $this->customer(['balance' => 30000]);
        $service = $this->activeService($user, '+3 days');
        $due = $service->next_due_at->copy();

        $stats = app(Automation::class)->run();

        $this->assertSame(1, $stats['invoiced']);
        $this->assertSame('paid', Invoice::query()->sole()->status);
        $this->assertSame(10000, $user->fresh()->balance);
        $this->assertTrue($service->fresh()->next_due_at->equalTo($due->addMonth()));

        // Running again does not invoice twice.
        $this->assertSame(0, app(Automation::class)->run()['invoiced']);
    }

    public function test_saved_card_pays_what_the_balance_does_not_cover(): void
    {
        $user = $this->customer(['balance' => 5000]);
        Card::query()->create(['user_id' => $user->id, 'token' => 'tok', 'masked_pan' => '4444', 'autopay' => true]);
        $service = $this->activeService($user, '-1 hour');

        app(Automation::class)->run();

        $this->assertSame('paid', Invoice::query()->sole()->status);
        $this->assertSame(0, $user->fresh()->balance);
        $this->assertTrue($service->fresh()->next_due_at->isFuture());
    }

    public function test_unpaid_services_are_suspended_then_terminated(): void
    {
        $user = $this->customer();
        $service = $this->activeService($user, '-2 days');

        app(Automation::class)->run();
        $this->assertSame('suspended', $service->fresh()->status);
        $suspend = collect($this->panelCalls)->first(fn ($c) => str_ends_with($c['url'], '/suspend'));
        $this->assertStringContainsString(Invoice::query()->sole()->number, $suspend['body']['reason']);
        $this->assertStringContainsString('/invoices/', $suspend['body']['payment_url']);

        // Paying unsuspends it.
        $this->actingAs($user);
        app(Wallet::class)->change($user, 20000, 'adjustment', 'test');
        app(Invoices::class)->settleAll($user->fresh());
        $this->assertSame('active', $service->fresh()->status);

        // A later period that stays unpaid ends with termination.
        $service->forceFill(['next_due_at' => now()->subDays(20)])->save();
        Invoice::query()->update(['status' => 'paid']);
        app(Automation::class)->run();
        Invoice::query()->where('status', 'unpaid')->update(['due_at' => now()->subDays(20)]);
        app(Automation::class)->run();

        $this->assertSame('terminated', $service->fresh()->status);
        $this->assertTrue(collect($this->panelCalls)->contains(fn ($c) => $c['method'] === 'DELETE'));
    }

    public function test_cancelled_services_end_with_the_paid_period(): void
    {
        $user = $this->customer(['balance' => 100000]);
        $service = $this->activeService($user, '-1 minute');
        $service->forceFill(['auto_renew' => false])->save();

        app(Automation::class)->run();

        $this->assertSame('terminated', $service->fresh()->status);
        $this->assertSame(100000, $user->fresh()->balance);
    }

    public function test_panel_webhooks_update_the_service(): void
    {
        $user = $this->customer();
        $service = $this->activeService($user, '+20 days');
        $service->forceFill(['status' => 'provisioning'])->save();
        $body = json_encode(['event' => 'server.installed', 'data' => ['server' => ['external_id' => 'svc-'.$service->id, 'id' => 9, 'identifier' => 'ffff0000', 'address' => ['display' => '1.2.3.4:25565']]]]);
        $t = time();

        $this->call('POST', '/webhooks/raptor', [], [], [], ['HTTP_X_RAPTOR_SIGNATURE' => "t=$t,v1=".hash_hmac('sha256', "$t.$body", 'whsec_test'), 'CONTENT_TYPE' => 'application/json'], $body)->assertOk();
        $this->assertSame('active', $service->fresh()->status);
        $this->assertSame('1.2.3.4:25565', $service->fresh()->panel_address);

        $this->call('POST', '/webhooks/raptor', [], [], [], ['HTTP_X_RAPTOR_SIGNATURE' => "t=$t,v1=bad", 'CONTENT_TYPE' => 'application/json'], $body)->assertStatus(400);
    }

    public function test_only_admins_reach_the_admin_area(): void
    {
        $this->actingAs($this->customer())->get('/admin')->assertNotFound();
        $this->actingAs($this->customer(['is_admin' => true]))->get('/admin/settings')->assertOk();
    }
}
