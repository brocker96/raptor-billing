<?php

namespace App\Http\Controllers\Admin;

use App\Billing\Currency;
use App\Billing\PanelClient;
use App\Billing\Period;
use App\Billing\Present;
use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PlanController extends Controller
{
    public function index(PanelClient $panel): Response
    {
        return Inertia::render('admin/plans', [
            'plans' => Plan::query()->with('prices')->withCount(['prices'])->orderBy('sort')->orderBy('id')->get()->map(fn ($p) => Present::plan($p)),
            'currencies' => Setting::currencies(),
            'periods' => array_map(fn ($m) => ['months' => $m, 'label' => Period::label($m)], Period::MONTHS),
            'packages' => Inertia::defer(function () use ($panel) {
                try {
                    return collect($panel->packages())->map(fn ($p) => ['slug' => $p['slug'], 'name' => $p['name'], 'active' => $p['active']])->values();
                } catch (\Throwable) {
                    return [];
                }
            }),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->save(new Plan, $this->validated($request));

        return back()->with('success', 'Тариф створено.');
    }

    public function update(Request $request, Plan $plan): RedirectResponse
    {
        $this->save($plan, $this->validated($request, $plan));

        return back()->with('success', 'Тариф збережено.');
    }

    public function destroy(Plan $plan): RedirectResponse
    {
        if ($plan->services()->exists()) {
            $plan->forceFill(['active' => false])->save();

            return back()->with('success', 'Тариф має послуги, тому його приховано, а не видалено.');
        }
        $plan->delete();

        return back()->with('success', 'Тариф видалено.');
    }

    /**
     * Creates hidden plans for panel packages that have none yet, prices are set afterwards.
     */
    public function import(PanelClient $panel): RedirectResponse
    {
        try {
            $packages = $panel->packages();
        } catch (\Throwable $exception) {
            return back()->with('error', PanelClient::error($exception));
        }

        $added = 0;
        foreach ($packages as $package) {
            if (Plan::query()->where('panel_package', $package['slug'])->exists()) {
                continue;
            }
            Plan::query()->create([
                'name' => $package['name'],
                'slug' => Str::slug($package['slug']),
                'description' => $package['description'] ?? null,
                'features' => array_values(array_filter([
                    ($package['limits']['memory'] ?? 0) ? round($package['limits']['memory'] / 1024, 1).' ГБ RAM' : null,
                    ($package['limits']['disk'] ?? 0) ? round($package['limits']['disk'] / 1024).' ГБ SSD' : null,
                    ($package['limits']['cpu'] ?? 0) ? $package['limits']['cpu'].'% CPU' : null,
                    ($package['feature_limits']['backups'] ?? 0) ? $package['feature_limits']['backups'].' бекапів' : null,
                ])),
                'panel_package' => $package['slug'],
                'active' => false,
                'sort' => $package['sort'] ?? 0,
            ]);
            $added++;
        }

        return back()->with('success', $added ? "Імпортовано пакетів: $added. Задайте ціни та увімкніть тарифи." : 'Нових пакетів у панелі немає.');
    }

    private function validated(Request $request, ?Plan $plan = null): array
    {
        return $request->validate([
            'name' => 'required|string|max:191',
            'slug' => ['required', 'string', 'max:191', 'regex:/^[a-z0-9-]+$/', Rule::unique('plans', 'slug')->ignore($plan?->id)],
            'category' => 'required|string|max:64',
            'description' => 'nullable|string|max:2000',
            'features' => 'array',
            'features.*' => 'string|max:191',
            'panel_package' => 'required|string|max:191',
            'active' => 'boolean',
            'featured' => 'boolean',
            'sort' => 'integer|min:0',
            'prices' => 'array',
            'prices.*.currency' => ['required', Rule::in(Currency::codes())],
            'prices.*.period_months' => ['required', Rule::in(Period::MONTHS)],
            'prices.*.amount' => 'required|numeric|min:0',
        ]);
    }

    private function save(Plan $plan, array $data): void
    {
        DB::transaction(function () use ($plan, $data) {
            $plan->fill(collect($data)->except('prices')->all())->save();
            $plan->prices()->delete();
            foreach ($data['prices'] ?? [] as $price) {
                if ((float) $price['amount'] > 0) {
                    $plan->prices()->create([
                        'currency' => $price['currency'],
                        'period_months' => (int) $price['period_months'],
                        'amount' => (int) round($price['amount'] * 100),
                    ]);
                }
            }
        });
    }
}
