<?php

namespace App\Http\Middleware;

use App\Billing\Present;
use App\Models\Invoice;
use App\Models\Service;
use App\Models\Setting;
use App\Updates\ReleaseFeed;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => Setting::get('company_name') ?: config('app.name'),
            'company_url' => Setting::get('company_url'),
            'announcement' => Setting::get('announcement') ? ['text' => Setting::get('announcement'), 'tone' => Setting::get('announcement_tone')] : null,
            'logo' => Setting::get('logo_url') ?: '/brand/raptor-icon-128.webp',
            'auth' => [
                'user' => $request->user() ? array_merge($request->user()->only(['id', 'name', 'email', 'phone', 'email_verified_at', 'created_at']), Present::user($request->user())) : null,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
            // Small counters next to the menu items, the update notice only from the cached release list.
            'badges' => fn () => $this->badges($request),
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }

    private function badges(Request $request): array
    {
        $user = $request->user();
        if (! $user) {
            return [];
        }

        $badges = ['/invoices' => $user->invoices()->where('status', 'unpaid')->count() ?: null];
        if ($user->is_admin) {
            $feed = app(ReleaseFeed::class);
            $releases = Cache::get(ReleaseFeed::CACHE_KEY);
            $latest = is_array($releases) ? collect($releases)->first(fn ($r) => $feed->channel() === 'beta' || ! $r['prerelease']) : null;
            $badges['/admin/updates'] = $latest && $feed->isNewer($latest) && ! $feed->isDevelopmentBuild() ? 'нове' : null;
            $badges['/admin/services'] = Service::query()->where('status', 'failed')->count() ?: null;
            $badges['/admin/invoices'] = Invoice::query()->where('status', 'unpaid')->count() ?: null;
        }

        return $badges;
    }
}
