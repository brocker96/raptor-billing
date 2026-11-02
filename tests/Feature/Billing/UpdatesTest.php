<?php

namespace Tests\Feature\Billing;

use App\Models\Setting;
use App\Updates\ReleaseFeed;
use App\Updates\Updater;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;

class UpdatesTest extends BillingTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['billing.version' => '0.1.0']);
        File::deleteDirectory(storage_path('app/updates'));
        $this->githubReleases = [
            ['tag_name' => 'v0.2.0', 'name' => 'v0.2.0', 'draft' => false, 'prerelease' => false, 'published_at' => '2026-11-01T10:00:00Z', 'html_url' => 'https://github.com/x', 'body' => "## v0.2.0\n- Faster", 'assets' => [
                ['name' => 'billing.tar.gz', 'browser_download_url' => 'https://github.com/a/billing.tar.gz'],
                ['name' => 'billing.tar.gz.sha256', 'browser_download_url' => 'https://github.com/a/billing.tar.gz.sha256'],
            ]],
            ['tag_name' => 'v0.3.0-beta.1', 'name' => 'beta', 'draft' => false, 'prerelease' => true, 'assets' => []],
            ['tag_name' => 'v0.9.0', 'draft' => true, 'prerelease' => false, 'assets' => []],
        ];
    }

    protected function tearDown(): void
    {
        File::deleteDirectory(storage_path('app/updates'));
        parent::tearDown();
    }

    public function test_feed_follows_the_channel(): void
    {
        $feed = app(ReleaseFeed::class);
        $this->assertSame('0.2.0', $feed->latest()['version']);
        $this->assertSame('https://github.com/a/billing.tar.gz', $feed->latest()['archive']);

        Setting::put(['update_channel' => 'beta']);
        $this->assertSame('0.3.0-beta.1', $feed->latest(true)['version']);
    }

    public function test_admin_queues_an_update_and_follows_it(): void
    {
        $admin = $this->customer(['is_admin' => true]);

        $this->actingAs($admin)->get('/admin/updates')->assertOk()->assertInertia(fn ($page) => $page->component('admin/updates')->where('current', '0.1.0'));
        $this->actingAs($admin)->post('/admin/updates/install', ['version' => 'v0.2.0'])->assertSessionHas('success');

        $state = app(Updater::class)->state();
        $this->assertSame('queued', $state['status']);
        $this->assertSame('0.2.0', $state['target']);
        $this->assertSame($admin->email, $state['requested_by']);

        // A second request while one is waiting is refused.
        $this->actingAs($admin)->post('/admin/updates/install', ['version' => 'v0.2.0'])->assertSessionHas('error');
        $this->actingAs($admin)->getJson('/admin/updates/status')->assertOk()->assertJsonPath('state.status', 'queued');

        $this->actingAs($admin)->post('/admin/updates/cancel')->assertSessionHas('success');
        $this->assertSame('idle', app(Updater::class)->state()['status']);
    }

    public function test_unknown_release_and_customers_are_refused(): void
    {
        $admin = $this->customer(['is_admin' => true]);
        $this->actingAs($admin)->post('/admin/updates/install', ['version' => '9.9.9'])->assertSessionHas('error');
        $this->actingAs($this->customer())->get('/admin/updates')->assertNotFound();
    }

    public function test_settings_and_scheduler_heartbeat(): void
    {
        $admin = $this->customer(['is_admin' => true]);
        $this->actingAs($admin)->put('/admin/updates/settings', ['channel' => 'beta', 'auto_check' => true, 'auto_install' => true, 'hour' => 3])->assertSessionHas('success');
        $this->assertSame('beta', Setting::get('update_channel'));
        $this->assertSame('3', Setting::get('update_hour'));

        Artisan::call('billing:update', ['--pending' => true]);
        $this->assertNotNull(cache('health:scheduler'));
    }
}
