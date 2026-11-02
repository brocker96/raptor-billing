<?php

namespace App\Http\Controllers\Admin;

use App\Billing\Present;
use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Service;
use App\Models\Setting;
use App\Models\User;
use App\Updates\ReleaseFeed;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(ReleaseFeed $feed): Response
    {
        // Money figures are shown in the main currency, others are listed beside them.
        $currency = Setting::currencies()[0];
        $paid = fn ($from, $to) => (int) Payment::query()->where('status', 'success')->where('currency', $currency)->whereBetween('created_at', [$from, $to])->sum('amount');
        $revenue = $paid(now()->subDays(30), now());
        $previous = $paid(now()->subDays(60), now()->subDays(30));

        $live = Service::query()->with('plan')->whereIn('status', ['active', 'suspended'])->get();
        $monthly = fn ($s) => intdiv($s->amount, max(1, $s->period_months));
        $mrr = (int) $live->where('currency', $currency)->sum($monthly);
        $payers = $live->where('currency', $currency)->pluck('user_id')->unique()->count();

        $daily = Payment::query()->where('status', 'success')->where('currency', $currency)->where('created_at', '>=', now()->subDays(29)->startOfDay())
            ->get(['amount', 'created_at'])->groupBy(fn ($p) => $p->created_at->format('Y-m-d'));

        $clients = fn ($from, $to) => User::query()->whereBetween('created_at', [$from, $to])->count();
        $renewals = Service::query()->where('status', 'active')->where('auto_renew', true)->where('currency', $currency)
            ->whereBetween('next_due_at', [now(), now()->addDays(7)]);

        $releases = Cache::get(ReleaseFeed::CACHE_KEY);
        $latest = is_array($releases) ? collect($releases)->first(fn ($r) => $feed->channel() === 'beta' || ! $r['prerelease']) : null;

        return Inertia::render('admin/dashboard', [
            'currency' => $currency,
            'kpi' => [
                'revenue' => Present::money($revenue, $currency),
                'revenue_change' => $previous ? round(($revenue - $previous) / $previous * 100) : null,
                'mrr' => Present::money($mrr, $currency),
                'arpu' => Present::money($payers ? intdiv($mrr, $payers) : 0, $currency),
                'clients' => User::query()->count(),
                'clients_new' => $clients(now()->subDays(30), now()),
                'clients_change' => $clients(now()->subDays(60), now()->subDays(30)),
                'renewals' => Present::money((int) (clone $renewals)->sum('amount'), $currency),
                'renewals_count' => $renewals->count(),
                'unpaid' => Present::money((int) Invoice::query()->where('status', 'unpaid')->where('currency', $currency)->sum('total'), $currency),
                'unpaid_count' => Invoice::query()->where('status', 'unpaid')->count(),
            ],
            'other_revenue' => Payment::query()->where('status', 'success')->where('currency', '!=', $currency)->where('created_at', '>=', now()->subDays(30))
                ->get(['currency', 'amount'])->groupBy('currency')->map(fn ($p, $c) => Present::money((int) $p->sum('amount'), $c))->values(),
            'chart' => collect(range(29, 0))->map(function ($d) use ($daily) {
                $day = now()->subDays($d);

                return ['date' => $day->format('Y-m-d'), 'total' => (int) ($daily->get($day->format('Y-m-d'))?->sum('amount') ?? 0)];
            })->values(),
            'statuses' => collect(['active', 'suspended', 'provisioning', 'pending', 'failed'])
                ->mapWithKeys(fn ($s) => [$s => Service::query()->where('status', $s)->count()]),
            'plans' => $live->where('currency', $currency)->groupBy('plan_id')->map(fn ($group) => [
                'name' => $group->first()->plan->name,
                'count' => $group->count(),
                'mrr' => Present::money((int) $group->sum($monthly), $currency),
            ])->sortByDesc(fn ($p) => $p['mrr']['amount'])->take(5)->values(),
            'attention' => Service::query()->with(['user', 'plan', 'nextPlan'])->where(fn ($q) => $q->where('status', 'failed')->orWhere(fn ($q) => $q->where('status', 'provisioning')->whereNotNull('last_error')))->latest('id')->limit(6)->get()->map(fn ($s) => Present::service($s)),
            'payments' => Payment::query()->with(['user', 'invoice'])->latest('id')->limit(7)->get()->map(fn ($p) => Present::payment($p)),
            'update' => $latest && $feed->isNewer($latest) && ! $feed->isDevelopmentBuild() ? $latest['tag'] : null,
            'setup' => [
                'panel' => (bool) Setting::get('panel_key'),
                'monopay' => (bool) Setting::get('monopay_token'),
                'plans' => Plan::query()->where('active', true)->whereHas('prices')->exists(),
            ],
        ]);
    }
}
