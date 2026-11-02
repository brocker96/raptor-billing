<?php

namespace App\Http\Controllers\Client;

use App\Billing\Invoices;
use App\Billing\Orders;
use App\Billing\PanelClient;
use App\Billing\Present;
use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class ShopController extends Controller
{
    public function index(Request $request): Response
    {
        $currency = $this->currency($request);
        $plans = Plan::query()->with('prices')->where('active', true)->orderBy('sort')->orderBy('id')->get()
            ->filter(fn (Plan $plan) => $plan->prices->contains('currency', $currency));

        return Inertia::render('shop', [
            'currency' => $currency,
            'currencies' => Setting::currencies(),
            'plans' => $plans->map(fn (Plan $plan) => Present::plan($plan, $currency) + ['in_stock' => $this->inStock($plan)])->values(),
        ]);
    }


    /**
     * Price check for the order form, with the promo code applied.
     */
    public function quote(Request $request, Plan $plan, Orders $orders): array
    {
        $data = $request->validate(['period' => 'required|integer', 'promo' => 'nullable|string|max:64']);
        $quote = $orders->quote($plan->load('prices'), $request->user()->currency, (int) $data['period'], $data['promo'] ?? null);
        $currency = $request->user()->currency;

        return [
            'price' => Present::money($quote['price'], $currency),
            'discount' => Present::money($quote['discount'], $currency),
            'total' => Present::money($quote['total'], $currency),
        ];
    }

    public function place(Request $request, Plan $plan, Orders $orders): RedirectResponse
    {
        $data = $request->validate([
            'period' => 'required|integer|in:1,3,6,12',
            'name' => 'required|string|min:2|max:64',
            'promo' => 'nullable|string|max:64',
            'terms' => 'accepted',
        ]);

        $invoice = $orders->place($request->user(), $plan->load('prices'), (int) $data['period'], trim($data['name']), $data['promo'] ?? null);
        app(Invoices::class)->settle($invoice);

        return redirect()->route('invoices.show', $invoice)->with('success', $invoice->refresh()->status === 'paid'
            ? 'Замовлення сплачено з балансу, сервер створюється.'
            : 'Замовлення оформлено. Сплатіть рахунок, щоб запустити сервер.');
    }

    private function currency(Request $request): string
    {
        $currencies = Setting::currencies();
        $wanted = $request->user()?->currency ?? $request->query('currency', $request->cookie('currency'));

        return in_array($wanted, $currencies, true) ? $wanted : $currencies[0];
    }

    /**
     * Whether the panel has room for the plan, cached for a few minutes so the shop stays fast.
     */
    private function inStock(Plan $plan): bool
    {
        return Cache::remember('stock:'.$plan->panel_package, now()->addMinutes(5), function () use ($plan) {
            try {
                return (bool) (app(PanelClient::class)->availability($plan->panel_package)['available'] ?? true);
            } catch (\Throwable) {
                return true;
            }
        });
    }
}
