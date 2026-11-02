<?php

namespace App\Http\Controllers\Admin;

use App\Billing\Activity;
use App\Billing\MonoPay;
use App\Billing\PanelClient;
use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Updates\ReleaseFeed;
use App\Updates\UpdateException;
use App\Updates\Updater;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin → System: installed version, releases, updates with progress, backups, and whether
 * everything billing depends on is working.
 */
class UpdateController extends Controller
{
    public function __construct(private ReleaseFeed $feed, private Updater $updater) {}

    public function index(): Response
    {
        return Inertia::render('admin/updates', [
            'current' => $this->feed->current(),
            'development' => $this->feed->isDevelopmentBuild(),
            'repository' => $this->feed->repository(),
            'settings' => [
                'channel' => $this->feed->channel(),
                'auto_check' => (bool) Setting::get('update_auto_check'),
                'auto_install' => (bool) Setting::get('update_auto_install'),
                'hour' => Setting::int('update_hour'),
            ],
            'state' => $this->updater->state(),
            'log' => $this->updater->log(),
            'backups' => $this->updater->backups(),
            'history' => $this->updater->history(),
            'releases' => Inertia::defer(fn () => $this->releases(false)),
            'health' => $this->health(),
            'services' => Inertia::defer(fn () => $this->services()),
        ]);
    }

    /**
     * Polled while an update runs, also answered in maintenance mode.
     */
    public function status(): JsonResponse
    {
        return new JsonResponse(['version' => $this->feed->current(), 'state' => $this->updater->state(), 'log' => $this->updater->log()]);
    }

    public function check(): RedirectResponse
    {
        $releases = $this->releases(true);

        return back()->with($releases['error'] ? 'error' : 'success', $releases['error'] ?? ($releases['update_available'] ? 'Є нова версія: '.$releases['latest']['tag'] : 'Встановлено найновішу версію.'));
    }

    public function settings(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'channel' => ['required', Rule::in(ReleaseFeed::CHANNELS)],
            'auto_check' => 'required|boolean',
            'auto_install' => 'required|boolean',
            'hour' => 'required|integer|between:0,23',
        ]);
        Setting::put([
            'update_channel' => $data['channel'],
            'update_auto_check' => $data['auto_check'] ? '1' : '',
            'update_auto_install' => $data['auto_install'] ? '1' : '',
            'update_hour' => (string) $data['hour'],
        ]);
        Cache::forget(ReleaseFeed::CACHE_KEY);

        return back()->with('success', 'Налаштування оновлень збережено.');
    }

    public function install(Request $request): RedirectResponse
    {
        $version = $request->validate(['version' => 'required|string|max:64'])['version'];
        $release = $this->feed->find($version);
        if (! $release || ! $release['archive']) {
            return back()->with('error', 'Цього релізу немає або в ньому немає архіву billing.tar.gz.');
        }

        Activity::log('admin.update', 'Запит на оновлення до '.$release['tag'], null);

        return $this->queue(fn () => $this->updater->request('install', $release['version'], $request->user()->email), 'Оновлення до '.$release['tag'].' поставлено в чергу.');
    }

    public function rollback(Request $request): RedirectResponse
    {
        $backup = $request->validate(['backup' => 'required|string|max:128'])['backup'];
        if (! collect($this->updater->backups())->contains('id', $backup)) {
            return back()->with('error', 'Такої резервної копії немає.');
        }

        Activity::log('admin.rollback', 'Запит на відкат до копії '.$backup, null);

        return $this->queue(fn () => $this->updater->request('rollback', $backup, $request->user()->email), 'Відкат поставлено в чергу.');
    }

    public function cancel(): RedirectResponse
    {
        return $this->queue(fn () => $this->updater->cancel(), 'Оновлення скасовано.');
    }

    private function queue(callable $action, string $message): RedirectResponse
    {
        try {
            $action();
        } catch (UpdateException $exception) {
            return back()->with('error', $exception->getMessage());
        }

        return back()->with('success', $message);
    }

    private function releases(bool $fresh): array
    {
        try {
            $releases = $this->feed->releases($fresh);
            $latest = $this->feed->latest();
        } catch (\Throwable $exception) {
            return ['error' => 'GitHub недоступний: '.strtok($exception->getMessage(), "\n"), 'latest' => null, 'update_available' => false, 'list' => []];
        }

        return [
            'error' => null,
            'latest' => $latest,
            'update_available' => $latest !== null && $this->feed->isNewer($latest),
            'list' => array_slice($releases, 0, 10),
        ];
    }

    /**
     * Checks that need no network, shown right away.
     */
    private function health(): array
    {
        $ago = fn (?string $at, int $minutes) => $at && Carbon::parse($at)->gt(now()->subMinutes($minutes));
        $automation = Cache::get('health:automation');
        $free = (int) @disk_free_space(base_path());
        $mailer = (string) config('mail.default');

        return [
            ['key' => 'scheduler', 'label' => 'Планувальник (cron)', 'ok' => $ago(Cache::get('health:scheduler'), 3), 'detail' => $this->when(Cache::get('health:scheduler'), 'Додайте cron: * * * * * php '.base_path('artisan').' schedule:run')],
            ['key' => 'queue', 'label' => 'Обробник черги', 'ok' => $ago(Cache::get('health:queue'), 12), 'detail' => $this->when(Cache::get('health:queue'), 'Запустіть: php artisan queue:work (systemd-служба з інсталятора)')],
            ['key' => 'automation', 'label' => 'Автоматика білінгу', 'ok' => $ago($automation['at'] ?? null, 130), 'detail' => $automation ? $this->when($automation['at'], '').' · '.collect($automation['stats'] ?? [])->filter()->map(fn ($v, $k) => "$k: $v")->implode(', ') : 'Ще не запускалась'],
            ['key' => 'mail', 'label' => 'Пошта', 'ok' => ! in_array($mailer, ['log', 'array'], true), 'detail' => in_array($mailer, ['log', 'array'], true) ? 'Листи пишуться в лог. Вкажіть SMTP у .env (MAIL_*)' : 'Через '.$mailer],
            ['key' => 'disk', 'label' => 'Вільне місце', 'ok' => $free === 0 || $free > 1024 ** 3, 'detail' => $free ? round($free / 1024 ** 3, 1).' ГБ' : 'невідомо'],
            ['key' => 'debug', 'label' => 'Режим налагодження', 'ok' => ! config('app.debug') || app()->environment('local'), 'detail' => config('app.debug') ? 'Увімкнено, вимкніть APP_DEBUG у продакшені' : 'Вимкнено'],
            ['key' => 'php', 'label' => 'PHP / Laravel', 'ok' => true, 'detail' => PHP_VERSION.' · Laravel '.app()->version().' · '.DB::connection()->getDriverName()],
        ];
    }

    /**
     * Checks that call other services, loaded after the page.
     */
    private function services(): array
    {
        $panel = ['key' => 'panel', 'label' => 'Raptor Panel', 'ok' => false, 'detail' => 'Не налаштовано'];
        if (app(PanelClient::class)->configured()) {
            try {
                $ping = app(PanelClient::class)->ping();
                $panel = ['ok' => true, 'detail' => $ping['panel']['name'].' '.$ping['panel']['version'].' · пакетів: '.$ping['packages']] + $panel;
            } catch (\Throwable $exception) {
                $panel['detail'] = PanelClient::error($exception);
            }
        }

        $mono = ['key' => 'monopay', 'label' => 'plata by mono', 'ok' => false, 'detail' => 'Токен не вказано'];
        if (Setting::get('monopay_token')) {
            try {
                $details = Http::baseUrl(MonoPay::BASE)->timeout(8)->withHeaders(['X-Token' => (string) Setting::get('monopay_token')])->get('/api/merchant/details')->throw()->json();
                $mono = ['ok' => true, 'detail' => $details['merchantName'] ?? 'Підключено'] + $mono;
            } catch (\Throwable $exception) {
                $mono['detail'] = MonoPay::error($exception);
            }
        }

        return [$panel, $mono];
    }

    private function when(?string $at, string $missing): string
    {
        return $at ? 'Останній сигнал '.Carbon::parse($at)->locale('uk')->diffForHumans() : $missing;
    }
}
