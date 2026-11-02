<?php

use App\Billing\Automation;
use App\Billing\PanelClient;
use App\Billing\PlanImporter;
use App\Jobs\Heartbeat;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schedule;

Artisan::command('billing:run', function (Automation $automation) {
    $stats = $automation->run();
    Cache::forever('health:automation', ['at' => now()->toAtomString(), 'stats' => $stats]);
    $this->info(collect($stats)->map(fn ($v, $k) => "$k: $v")->implode(', '));
})->purpose('Renewal invoices, automatic payments, suspension and termination of unpaid services');

Artisan::command('billing:admin {email} {--name=} {--password=}', function (string $email) {
    $user = User::query()->where('email', $email)->first();
    if (! $user && ! $this->option('password')) {
        $this->error('No user with this e-mail. Register first, or pass --name and --password to create one.');

        return 1;
    }
    $user ??= new User(['email' => $email]);
    $user->forceFill(array_filter([
        'name' => $this->option('name') ?: ($user->name ?: 'Administrator'),
        'password' => $this->option('password') ? Hash::make($this->option('password')) : null,
    ]) + ['is_admin' => true, 'email_verified_at' => $user->email_verified_at ?? now()])->save();
    $this->info("$email is an administrator now.");
})->purpose('Give a registered user access to the admin area');

Artisan::command('billing:set {values* : key=value pairs, e.g. company_name="HostMC"}', function (array $values) {
    $pairs = [];
    foreach ($values as $pair) {
        [$key, $value] = array_pad(explode('=', $pair, 2), 2, '');
        if (! array_key_exists($key, Setting::DEFAULTS)) {
            $this->error("Unknown setting $key");

            return 1;
        }
        $pairs[$key] = $value;
    }
    Setting::put($pairs);
    $this->info('Saved: '.implode(', ', array_keys($pairs)));
})->purpose('Change billing settings from the command line');

Artisan::command('billing:connect-panel {--url=} {--key=} {--secret=}', function (PanelClient $panel) {
    Setting::put(array_filter([
        'panel_url' => rtrim((string) $this->option('url'), '/') ?: null,
        'panel_key' => $this->option('key'),
        'panel_webhook_secret' => $this->option('secret'),
    ]));
    try {
        $ping = $panel->ping();
        $this->info('Connected to '.$ping['panel']['name'].' '.$ping['panel']['version'].', packages: '.$ping['packages']);
    } catch (Throwable $exception) {
        $this->warn('Saved, but the panel did not answer: '.PanelClient::error($exception));
    }
})->purpose('Save the Raptor Panel address, API key and webhook secret');

Artisan::command('billing:import-plans', function (PlanImporter $importer) {
    $this->info('Imported packages: '.$importer->import().'. Set prices and switch the plans on in Admin → Plans.');
})->purpose('Create hidden plans for Raptor Panel packages');

Schedule::command('billing:run')->hourly()->withoutOverlapping();

// Picks up updates requested from the admin area, checks for releases and records a heartbeat.
Schedule::command('billing:update --pending')->everyMinute()->withoutOverlapping(120)->runInBackground();
Schedule::job(new Heartbeat)->everyFiveMinutes();
