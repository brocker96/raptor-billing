<?php

use App\Billing\Automation;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('billing:run', function (Automation $automation) {
    $stats = $automation->run();
    $this->info(collect($stats)->map(fn ($v, $k) => "$k: $v")->implode(', '));
})->purpose('Renewal invoices, automatic payments, suspension and termination of unpaid services');

Artisan::command('billing:admin {email}', function (string $email) {
    $user = User::query()->where('email', $email)->first();
    if (! $user) {
        $this->error('No user with this e-mail, register first.');

        return 1;
    }
    $user->forceFill(['is_admin' => true, 'email_verified_at' => $user->email_verified_at ?? now()])->save();
    $this->info("$email is an administrator now.");
})->purpose('Give a registered user access to the admin area');

Schedule::command('billing:run')->hourly()->withoutOverlapping();
