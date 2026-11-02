<?php

namespace App\Http\Controllers\Admin;

use App\Billing\Present;
use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(): Response
    {
        $mrr = Service::query()->whereIn('status', ['active', 'suspended'])->get(['currency', 'amount', 'period_months'])
            ->groupBy('currency')->map(fn ($s, $currency) => Present::money((int) $s->sum(fn ($x) => intdiv($x->amount, $x->period_months)), $currency))->values();

        $revenue = Payment::query()->where('status', 'success')->where('created_at', '>=', now()->subDays(30))->get(['currency', 'amount'])
            ->groupBy('currency')->map(fn ($p, $currency) => Present::money((int) $p->sum('amount'), $currency))->values();

        $daily = Payment::query()->where('status', 'success')->where('created_at', '>=', now()->subDays(29)->startOfDay())->get(['amount', 'currency', 'created_at'])
            ->groupBy(fn ($p) => $p->created_at->format('Y-m-d'));

        return Inertia::render('admin/dashboard', [
            'stats' => [
                'clients' => User::query()->count(),
                'active' => Service::query()->where('status', 'active')->count(),
                'suspended' => Service::query()->where('status', 'suspended')->count(),
                'failed' => Service::query()->whereIn('status', ['failed'])->orWhere(fn ($q) => $q->where('status', 'provisioning')->whereNotNull('last_error'))->count(),
                'unpaid' => Invoice::query()->where('status', 'unpaid')->count(),
            ],
            'mrr' => $mrr,
            'revenue' => $revenue,
            'chart' => collect(range(29, 0))->map(fn ($d) => [
                'day' => now()->subDays($d)->format('d.m'),
                'total' => (int) ($daily->get(now()->subDays($d)->format('Y-m-d'))?->sum('amount') ?? 0),
            ])->values(),
            'attention' => Service::query()->with(['user', 'plan', 'nextPlan'])->where(fn ($q) => $q->where('status', 'failed')->orWhere(fn ($q) => $q->where('status', 'provisioning')->whereNotNull('last_error')))->latest('id')->limit(10)->get()->map(fn ($s) => Present::service($s)),
            'payments' => Payment::query()->with(['user', 'invoice'])->latest('id')->limit(8)->get()->map(fn ($p) => Present::payment($p)),
        ]);
    }
}
