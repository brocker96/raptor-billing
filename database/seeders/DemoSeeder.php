<?php

namespace Database\Seeders;

use App\Billing\Invoices;
use App\Billing\Wallet;
use App\Models\ActivityLog;
use App\Models\Card;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\PromoCode;
use App\Models\Service;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Sample shop for a first look: php artisan db:seed --class=DemoSeeder
 * Logins: admin@example.com / client@example.com, password "password".
 */
class DemoSeeder extends Seeder
{
    public function run(Wallet $wallet, Invoices $invoices): void
    {
        $plans = [
            ['Minecraft Start', 'minecraft-2gb', 'Minecraft', 'Для друзів і невеликих спільнот', ['2 ГБ RAM', '15 ГБ NVMe', '100% CPU', '3 бекапи', 'Захист від DDoS'], 99, false],
            ['Minecraft Pro', 'minecraft-4gb', 'Minecraft', 'Paper, Forge, Fabric, модпаки', ['4 ГБ RAM', '30 ГБ NVMe', '200% CPU', '5 бекапів', 'Захист від DDoS'], 189, true],
            ['Minecraft Ultra', 'minecraft-8gb', 'Minecraft', 'Великі модпаки і мережі', ['8 ГБ RAM', '60 ГБ NVMe', '400% CPU', '10 бекапів', 'Виділена IP'], 349, false],
            ['Rust', 'rust-8gb', 'Інші ігри', 'Оксид, плагіни, вайпи за розкладом', ['8 ГБ RAM', '40 ГБ NVMe', '300% CPU', '5 бекапів'], 399, false],
            ['CS2', 'cs2-4gb', 'Інші ігри', '128 tick, SourceMod', ['4 ГБ RAM', '40 ГБ NVMe', '200% CPU'], 229, false],
            ['Discord-бот', 'bot-1gb', 'Боти', 'Node.js або Python, працює 24/7', ['1 ГБ RAM', '5 ГБ NVMe', '50% CPU'], 49, false],
        ];
        $discount = [1 => 1, 3 => 0.95, 6 => 0.9, 12 => 0.8];
        foreach ($plans as $i => [$name, $slug, $category, $description, $features, $uah, $featured]) {
            $plan = Plan::query()->create(compact('name', 'slug', 'category', 'description', 'features', 'featured') + ['panel_package' => $slug, 'sort' => $i]);
            foreach ($discount as $months => $k) {
                $plan->prices()->create(['currency' => 'UAH', 'period_months' => $months, 'amount' => (int) round($uah * $months * $k) * 100]);
                $plan->prices()->create(['currency' => 'USD', 'period_months' => $months, 'amount' => (int) round($uah / 41 * $months * $k * 100)]);
            }
        }
        PromoCode::query()->create(['code' => 'RAPTOR10', 'type' => 'percent', 'value' => 10, 'max_uses' => 100, 'uses' => 17]);
        PromoCode::query()->create(['code' => 'LAUNCH', 'type' => 'fixed', 'value' => 5000, 'currency' => 'UAH', 'expires_at' => now()->addMonth()]);

        $admin = $this->user('Raptor Admin', 'admin@example.com');
        $admin->forceFill(['is_admin' => true])->save();

        $client = $this->user('Олена Коваль', 'client@example.com');
        $this->topup($wallet, $client, 120000, 'Поповнення через plata by mono', 40);
        Card::query()->create(['user_id' => $client->id, 'token' => Str::random(24), 'masked_pan' => '537541******1234', 'autopay' => true]);

        $pro = Plan::query()->where('slug', 'minecraft-4gb')->first();
        $this->service($invoices, $client, $pro, 'Survival SMP', 'active', 3, now()->addDays(64), '185.12.44.10:25565', 30);
        $this->service($invoices, $client, Plan::query()->where('slug', 'bot-1gb')->first(), 'Музичний бот', 'active', 1, now()->addDays(3), '185.12.44.11:3001', 20);
        $s = $this->service($invoices, $client, Plan::query()->where('slug', 'cs2-4gb')->first(), 'CS2 Retake', 'pending', 1, null, null, 0);

        foreach (['Андрій Шевчук', 'Марія Бондар', 'Tom Becker', 'Іван Мельник', 'Sofia Nowak', 'Дмитро Ткач', 'Kateryna Lysenko'] as $n => $name) {
            $user = $this->user($name, Str::slug(Str::ascii($name), '.').'@example.com');
            $this->topup($wallet, $user, [50000, 80000, 20000, 150000, 40000, 30000, 70000][$n], 'Поповнення через plata by mono', 28 - $n * 4);
            $plan = Plan::query()->skip($n % 6)->first();
            $status = $n === 3 ? 'suspended' : ($n === 5 ? 'failed' : 'active');
            $svc = $this->service($invoices, $user, $plan, ['Lobby', 'Creative', 'Rust Main', 'Hardcore', 'Arena', 'Модпак', 'Bot'][$n], $status, 1, $status === 'suspended' ? now()->subDays(2) : now()->addDays(10 + $n * 3), '185.12.44.'.(20 + $n).':25565', 25 - $n * 3);
            if ($status === 'failed') {
                $svc->forceFill(['last_error' => 'No node with 8192 MB free memory in locations 1, 2.'])->save();
            }
        }
        // A month of payments for the revenue chart, growing a little towards today.
        $users = User::query()->where('is_admin', false)->pluck('id');
        foreach (range(29, 0) as $day) {
            foreach (range(1, rand(0, 3) + (30 - $day > 20 ? 1 : 0)) as $n) {
                $p = Payment::query()->create(['user_id' => $users->random(), 'provider' => 'monopay', 'provider_id' => 'demo-'.Str::random(12), 'method' => rand(0, 3) ? 'page' : 'card', 'status' => 'success', 'currency' => 'UAH', 'amount' => [4900, 9900, 18900, 34900, 22900, 53900][rand(0, 5)]]);
                $p->forceFill(['created_at' => now()->subDays($day)->setTime(rand(8, 23), rand(0, 59)), 'credited' => true])->save();
            }
        }
        foreach ([[$client, 'auth.login', 'Вхід у кабінет', 0], [$client, 'order.placed', 'Замовлення CS2 «CS2 Retake», рахунок HMC-2026-000003', 0], [$client, 'payment.received', 'Оплата 1 200,00 ₴ через plata by mono', 40], [$client, 'service.ready', 'Сервер «Survival SMP» створено в панелі', 30]] as [$u, $event, $text, $days]) {
            ActivityLog::query()->create(['user_id' => $u->id, 'actor_id' => str_starts_with($event, 'service') ? null : $u->id, 'event' => $event, 'description' => $text, 'ip' => '93.170.12.'.rand(2, 250), 'created_at' => now()->subDays($days)->subMinutes(rand(1, 600))]);
        }
        ActivityLog::query()->create(['user_id' => $client->id, 'actor_id' => $admin->id, 'event' => 'admin.balance', 'description' => 'Баланс змінено на 100 UAH: компенсація за роботи на вузлі', 'ip' => '10.0.0.5', 'created_at' => now()->subDays(3)]);
        Setting::put(['announcement' => 'Знижка 20% на річні тарифи до кінця листопада — промокод LAUNCH', 'announcement_tone' => 'success']);

        Payment::query()->create(['user_id' => $client->id, 'provider' => 'monopay', 'provider_id' => 'demo-failed', 'method' => 'card', 'status' => 'failure', 'currency' => 'UAH', 'amount' => 18900, 'failure_reason' => 'Недостатньо коштів']);
    }

    private function user(string $name, string $email): User
    {
        return User::query()->forceCreate(['name' => $name, 'email' => $email, 'password' => 'password', 'email_verified_at' => now(), 'created_at' => now()->subDays(rand(5, 90))]);
    }

    private function topup(Wallet $wallet, User $user, int $amount, string $description, int $daysAgo): void
    {
        $payment = Payment::query()->create(['user_id' => $user->id, 'provider' => 'monopay', 'provider_id' => 'demo-'.Str::random(10), 'method' => 'page', 'status' => 'success', 'currency' => 'UAH', 'amount' => $amount]);
        $payment->forceFill(['created_at' => now()->subDays($daysAgo)->setTime(rand(9, 22), rand(0, 59)), 'credited' => true])->save();
        $wallet->change($user, $amount, 'topup', $description, ['payment_id' => $payment->id]);
    }

    private function service(Invoices $invoices, User $user, Plan $plan, string $name, string $status, int $months, $due, ?string $address, int $daysAgo): Service
    {
        $price = $plan->price('UAH', $months);
        $service = Service::query()->create(['user_id' => $user->id, 'plan_id' => $plan->id, 'name' => $name, 'status' => 'pending', 'currency' => 'UAH', 'amount' => $price->amount, 'period_months' => $months, 'auto_renew' => true]);
        $invoice = $invoices->create($user, 'order', [['description' => $plan->name.' — '.$name, 'amount' => $price->amount]], ['service_id' => $service->id, 'due_at' => now()->addDays(3)]);
        if ($status !== 'pending') {
            app(Wallet::class)->change($user, -$price->amount, 'charge', 'Оплата рахунку '.$invoice->number, ['invoice_id' => $invoice->id], true);
            $invoice->forceFill(['status' => 'paid', 'paid_at' => now()->subDays($daysAgo)])->save();
        }
        $service->forceFill([
            'status' => $status,
            'next_due_at' => $due,
            'panel_address' => $address,
            'panel_identifier' => $address ? Str::lower(Str::random(8)) : null,
            'activated_at' => $status === 'pending' ? null : now()->subDays($daysAgo),
            'suspended_at' => $status === 'suspended' ? now()->subDay() : null,
        ])->save();

        return $service;
    }
}
