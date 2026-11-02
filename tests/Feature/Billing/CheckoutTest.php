<?php

namespace Tests\Feature\Billing;

use App\Jobs\ProvisionService;
use App\Models\ActivityLog;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use App\Notifications\AccountCreated;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;

class CheckoutTest extends BillingTestCase
{
    public function test_guest_opens_checkout_from_an_outside_link(): void
    {
        $this->get('/checkout/mc-4gb?period=3')->assertOk()
            ->assertInertia(fn ($page) => $page->component('checkout')->where('period', 3)->where('customer', null));
    }

    public function test_guest_checkout_creates_the_account_and_opens_payment(): void
    {
        Queue::fake([ProvisionService::class]);
        Notification::fake();

        $this->post('/checkout/mc-4gb', [
            'period' => 1, 'name' => 'Шевченко Тарас Григорович', 'phone' => '+380 (50) 123-45-67', 'email' => 'Taras@Example.com', 'terms' => true, 'save_card' => true,
        ])->assertRedirect('https://pay.mbnk.biz/test');

        $user = User::query()->where('email', 'taras@example.com')->sole();
        $this->assertSame('+380501234567', $user->phone);
        $this->assertSame('Шевченко Тарас Григорович', $user->name);
        $this->assertAuthenticatedAs($user);
        Notification::assertSentTo($user, AccountCreated::class);

        $this->assertSame('pending', Service::query()->sole()->status);
        $this->assertSame('unpaid', Invoice::query()->sole()->status);
        $this->assertSame(20000, Payment::query()->sole()->amount);
        $this->assertNotNull($user->wallet_id);
    }

    public function test_guest_checkout_never_uses_an_existing_account(): void
    {
        $this->customer(['email' => 'taken@example.com']);

        $this->post('/checkout/mc-4gb', ['period' => 1, 'name' => 'Іван Петренко', 'phone' => '+380501234567', 'email' => 'taken@example.com', 'terms' => true])
            ->assertSessionHasErrors('email');
        $this->assertGuest();
        $this->assertSame(0, Invoice::query()->count());
    }

    public function test_guest_must_give_full_name_and_phone(): void
    {
        $this->post('/checkout/mc-4gb', ['period' => 1, 'name' => 'Іван', 'phone' => '123', 'email' => 'a@example.com', 'terms' => true])
            ->assertSessionHasErrors(['name', 'phone']);
    }

    public function test_signed_in_customer_pays_from_balance(): void
    {
        $user = $this->customer(['balance' => 50000, 'phone' => '+380501234567']);

        $this->actingAs($user)->post('/checkout/mc-4gb', ['period' => 1, 'terms' => true])->assertRedirect();

        $this->assertSame('active', Service::query()->sole()->status);
        $this->assertSame(30000, $user->fresh()->balance);
    }

    public function test_activity_is_logged_and_shown_to_admins(): void
    {
        Queue::fake([ProvisionService::class]);
        Notification::fake();
        $this->post('/checkout/mc-4gb', ['period' => 1, 'name' => 'Іван Петренко', 'phone' => '+380501234567', 'email' => 'ivan@example.com', 'terms' => true]);

        $user = User::query()->where('email', 'ivan@example.com')->sole();
        $events = ActivityLog::query()->where('user_id', $user->id)->pluck('event')->all();
        $this->assertContains('account.created', $events);
        $this->assertContains('order.placed', $events);

        $admin = $this->customer(['is_admin' => true]);
        $this->actingAs($admin)->get('/admin/activity?group=order')->assertOk()
            ->assertInertia(fn ($page) => $page->component('admin/activity')->where('entries.total', 1));
    }
}
