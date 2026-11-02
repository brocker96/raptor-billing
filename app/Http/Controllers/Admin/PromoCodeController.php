<?php

namespace App\Http\Controllers\Admin;

use App\Billing\Currency;
use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\PromoCode;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PromoCodeController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/promo-codes', [
            'codes' => PromoCode::query()->latest('id')->get()->map(fn (PromoCode $c) => [
                'id' => $c->id,
                'code' => $c->code,
                'type' => $c->type,
                'value' => $c->type === 'percent' ? $c->value : $c->value / 100,
                'currency' => $c->currency,
                'max_uses' => $c->max_uses,
                'uses' => $c->uses,
                'plan_ids' => $c->plan_ids ?? [],
                'expires_at' => $c->expires_at?->format('Y-m-d'),
                'active' => $c->active,
            ]),
            'plans' => Plan::query()->orderBy('sort')->get(['id', 'name']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        PromoCode::query()->create($this->validated($request));

        return back()->with('success', 'Промокод створено.');
    }

    public function update(Request $request, PromoCode $code): RedirectResponse
    {
        $code->update($this->validated($request, $code));

        return back()->with('success', 'Промокод збережено.');
    }

    public function destroy(PromoCode $code): RedirectResponse
    {
        $code->delete();

        return back()->with('success', 'Промокод видалено.');
    }

    private function validated(Request $request, ?PromoCode $code = null): array
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:64', 'regex:/^[A-Za-z0-9_-]+$/', Rule::unique('promo_codes', 'code')->ignore($code?->id)],
            'type' => 'required|in:percent,fixed',
            'value' => 'required|numeric|min:0.01',
            'currency' => ['nullable', 'required_if:type,fixed', Rule::in(Currency::codes())],
            'max_uses' => 'nullable|integer|min:1',
            'plan_ids' => 'array',
            'plan_ids.*' => 'integer|exists:plans,id',
            'expires_at' => 'nullable|date',
            'active' => 'boolean',
        ]);
        $data['code'] = mb_strtoupper($data['code']);
        $data['value'] = $data['type'] === 'percent' ? min(100, (int) $data['value']) : (int) round($data['value'] * 100);
        $data['currency'] = $data['type'] === 'fixed' ? $data['currency'] : null;

        return $data;
    }
}
