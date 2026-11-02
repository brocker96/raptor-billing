<?php

namespace App\Http\Controllers\Client;

use App\Billing\Invoices;
use App\Billing\PanelClient;
use App\Billing\Period;
use App\Billing\Present;
use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\Service;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class ServiceController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('services/index', [
            'services' => $request->user()->services()->with(['plan', 'nextPlan'])->latest('id')->get()->map(fn ($s) => Present::service($s)),
        ]);
    }

    public function show(Request $request, Service $service, PanelClient $panel): Response
    {
        $this->authorizeOwner($request, $service);
        $service->load(['plan', 'nextPlan']);

        $plans = Plan::query()->with('prices')->where('active', true)->where('id', '!=', $service->plan_id)->orderBy('sort')->get()
            ->filter(fn (Plan $p) => $p->price($service->currency, $service->period_months))
            ->map(fn (Plan $p) => Present::plan($p, $service->currency))->values();

        return Inertia::render('services/show', [
            'service' => Present::service($service),
            'invoices' => $service->invoices()->latest('id')->limit(20)->get()->map(fn ($i) => Present::invoice($i)),
            'plans' => $plans,
            'resources' => Inertia::defer(function () use ($service, $panel) {
                try {
                    return $service->status === 'active' ? $panel->resources($service->externalId()) : null;
                } catch (\Throwable) {
                    return null;
                }
            }),
        ]);
    }

    public function update(Request $request, Service $service, PanelClient $panel): RedirectResponse
    {
        $this->authorizeOwner($request, $service);
        $data = $request->validate(['name' => 'sometimes|string|min:2|max:64', 'auto_renew' => 'sometimes|boolean']);

        if (isset($data['name']) && $data['name'] !== $service->name && in_array($service->status, Service::LIVE, true)) {
            try {
                $panel->rename($service->externalId(), $data['name']);
            } catch (\Throwable) {
                // The name in the shop still changes, the panel catches up on the next sync.
            }
        }
        $service->forceFill($data)->save();

        return back()->with('success', isset($data['auto_renew'])
            ? ($data['auto_renew'] ? 'Автопродовження увімкнено.' : 'Послугу буде завершено після оплаченого періоду.')
            : 'Збережено.');
    }

    /**
     * Opens the server in Raptor Panel without a second password.
     */
    public function panel(Request $request, Service $service, PanelClient $panel): HttpResponse
    {
        $this->authorizeOwner($request, $service);

        try {
            $link = $panel->loginLink($request->user()->externalId(), $service->panel_identifier ? '/server/'.$service->panel_identifier : '/');

            return Inertia::location($link['url']);
        } catch (\Throwable $exception) {
            return back()->with('error', 'Не вдалося відкрити панель: '.PanelClient::error($exception));
        }
    }

    /**
     * Upgrades are paid right away for the rest of the period, downgrades start with the next one.
     */
    public function changePlan(Request $request, Service $service, Invoices $invoices): RedirectResponse
    {
        $this->authorizeOwner($request, $service);
        abort_unless($service->status === 'active', 422, 'Змінити тариф можна лише для активного сервера.');

        $plan = Plan::query()->with('prices')->where('active', true)->findOrFail($request->validate(['plan_id' => 'required|integer'])['plan_id']);
        $price = $plan->price($service->currency, $service->period_months);
        abort_unless($price !== null, 422, 'Цей тариф недоступний для вашого періоду.');

        if ($price->amount <= $service->amount) {
            $service->forceFill(['next_plan_id' => $plan->id])->save();

            return back()->with('success', 'Тариф '.$plan->name.' почне діяти з наступного періоду.');
        }

        $daysLeft = max(0, now()->diffInDays($service->next_due_at, false));
        $daysTotal = max(1, $service->next_due_at->copy()->subMonths($service->period_months)->diffInDays($service->next_due_at));
        $charge = (int) round(($price->amount - $service->amount) * min(1, $daysLeft / $daysTotal));

        $invoice = $invoices->create($request->user(), 'upgrade', [
            ['description' => 'Перехід на '.$plan->name.' до '.$service->next_due_at->format('d.m.Y').' ('.Period::label($service->period_months).')', 'amount' => max(1, $charge)],
        ], ['service_id' => $service->id, 'meta' => ['plan_id' => $plan->id, 'amount' => $price->amount]]);
        $invoices->settle($invoice);

        return redirect()->route('invoices.show', $invoice);
    }

    private function authorizeOwner(Request $request, Service $service): void
    {
        abort_unless($service->user_id === $request->user()->id, 404);
    }
}
