<?php

namespace App\Http\Controllers\Admin;

use App\Billing\Currency;
use App\Billing\MonoPay;
use App\Billing\PanelClient;
use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function edit(): Response
    {
        $values = [];
        foreach (array_keys(Setting::DEFAULTS) as $key) {
            // Secrets are never sent to the browser, only whether they are set.
            $values[$key] = in_array($key, Setting::SECRETS, true) ? (Setting::get($key) !== '' ? '••••••••' : '') : Setting::get($key);
        }

        return Inertia::render('admin/settings', [
            'values' => $values,
            'currencies' => Currency::codes(),
            'webhooks' => ['monopay' => route('webhooks.monopay'), 'raptor' => route('webhooks.raptor')],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'company_name' => 'required|string|max:191',
            'company_details' => 'nullable|string|max:2000',
            'support_email' => 'nullable|email|max:191',
            'currencies' => 'required|array|min:1',
            'currencies.*' => 'in:'.implode(',', Currency::codes()),
            'panel_url' => 'nullable|url:https,http|max:500',
            'panel_key' => 'nullable|string|max:500',
            'panel_webhook_secret' => 'nullable|string|max:500',
            'monopay_token' => 'nullable|string|max:500',
            'invoice_days_before' => 'required|integer|between:0,30',
            'suspend_after_days' => 'required|integer|between:0,30',
            'terminate_after_days' => 'required|integer|between:1,90',
            'invoice_prefix' => 'required|string|max:8|regex:/^[A-Z0-9]+$/',
        ]);
        $data['currencies'] = implode(',', $data['currencies']);

        // The masked placeholder means "keep the secret as it is".
        foreach (Setting::SECRETS as $secret) {
            if (($data[$secret] ?? null) === '••••••••') {
                unset($data[$secret]);
            }
        }
        Setting::put(array_map(fn ($v) => $v ?? '', $data));

        return back()->with('success', 'Налаштування збережено.');
    }

    public function testPanel(PanelClient $panel): RedirectResponse
    {
        try {
            $ping = $panel->ping();

            return back()->with('success', 'Панель підключена: '.$ping['panel']['name'].' '.$ping['panel']['version'].', пакетів: '.$ping['packages'].'.');
        } catch (\Throwable $exception) {
            return back()->with('error', 'Панель недоступна: '.PanelClient::error($exception));
        }
    }

    public function testMonoPay(): RedirectResponse
    {
        try {
            $details = Http::baseUrl(MonoPay::BASE)->withHeaders(['X-Token' => (string) Setting::get('monopay_token')])
                ->get('/api/merchant/details')->throw()->json();

            return back()->with('success', 'MonoPay підключено: '.($details['merchantName'] ?? 'мерчант').'.');
        } catch (\Throwable $exception) {
            return back()->with('error', 'MonoPay не відповідає: '.MonoPay::error($exception));
        }
    }
}
