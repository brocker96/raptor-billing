<?php

namespace App\Http\Controllers\Client;

use App\Billing\Invoices;
use App\Billing\MonoPay;
use App\Billing\Orders;
use App\Billing\Payments;
use App\Billing\PanelClient;
use App\Billing\Present;
use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\Setting;
use App\Models\User;
use App\Notifications\AccountCreated;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * One page from "I want this plan" to the payment form. Links from any website land here:
 * /checkout/{plan}?period=3&promo=CODE&currency=USD. Guests get an account on the way.
 */
class CheckoutController extends Controller
{
    public function show(Request $request, Plan $plan): Response|RedirectResponse
    {
        if (! $plan->active) {
            return redirect()->route('shop');
        }
        $user = $request->user();
        $currency = $this->currency($request);
        $plan->load('prices');

        return Inertia::render('checkout', [
            'plan' => Present::plan($plan, $currency),
            'currency' => $currency,
            'currencies' => $user ? [] : array_values(array_filter(Setting::currencies(), fn ($c) => $plan->prices->contains('currency', $c))),
            'period' => (int) $request->query('period', 0),
            'promo' => (string) $request->query('promo', ''),
            'in_stock' => Cache::remember('stock:'.$plan->panel_package, now()->addMinutes(5), function () use ($plan) {
                try {
                    return (bool) (app(PanelClient::class)->availability($plan->panel_package)['available'] ?? true);
                } catch (\Throwable) {
                    return true;
                }
            }),
            'customer' => $user ? ['name' => $user->name, 'email' => $user->email, 'phone' => $user->phone] : null,
            'balance' => $user ? Present::money($user->balance, $user->currency) : null,
        ]);
    }

    public function quote(Request $request, Plan $plan, Orders $orders): array
    {
        $data = $request->validate(['period' => 'required|integer', 'promo' => 'nullable|string|max:64']);
        $currency = $this->currency($request);
        $quote = $orders->quote($plan->load('prices'), $currency, (int) $data['period'], $data['promo'] ?? null);

        return [
            'price' => Present::money($quote['price'], $currency),
            'discount' => Present::money($quote['discount'], $currency),
            'total' => Present::money($quote['total'], $currency),
        ];
    }

    public function store(Request $request, Plan $plan, Orders $orders, Invoices $invoices, Payments $payments): HttpResponse
    {
        abort_unless($plan->active, 404);
        $user = $request->user();
        $data = $request->validate([
            'period' => 'required|integer|in:1,3,6,12',
            'promo' => 'nullable|string|max:64',
            'server_name' => 'nullable|string|min:2|max:64',
            'save_card' => 'boolean',
            'terms' => 'accepted',
        ] + ($user && $user->phone ? [] : ['phone' => ['required', 'string', 'regex:/^\+?[\d\s()-]{10,20}$/']]) + ($user ? [] : [
            'name' => ['required', 'string', 'max:191', 'regex:/^\S+\s+\S+/u'],
            'email' => 'required|email:rfc|max:191',
            'currency' => 'nullable|in:'.implode(',', Setting::currencies()),
        ]), [
            'name.regex' => 'Вкажіть прізвище та ім\'я.',
            'phone.regex' => 'Вкажіть номер у форматі +380 XX XXX XX XX.',
            'terms.accepted' => 'Потрібно погодитися з умовами.',
        ]);

        if (! $user) {
            if (User::query()->where('email', $data['email'])->exists()) {
                // Never let a checkout act on someone else's account; log in and come back here.
                $request->session()->put('url.intended', $request->headers->get('referer') ?: route('checkout', $plan));

                throw ValidationException::withMessages(['email' => 'Ця пошта вже зареєстрована. Увійдіть, і замовлення продовжиться.']);
            }
        }

        $phone = isset($data['phone']) ? '+'.ltrim(preg_replace('/[^\d+]/', '', $data['phone']), '+') : null;
        $created = false;

        $invoice = DB::transaction(function () use (&$user, &$created, $data, $phone, $plan, $orders, $request) {
            if (! $user) {
                $user = new User;
                $user->forceFill([
                    'name' => trim(preg_replace('/\s+/u', ' ', $data['name'])),
                    'email' => mb_strtolower($data['email']),
                    'phone' => $phone,
                    'currency' => $this->currency($request),
                    'password' => Hash::make(Str::random(40)),
                ])->save();
                $created = true;
            } elseif ($phone && ! $user->phone) {
                $user->forceFill(['phone' => $phone])->save();
            }

            return $orders->place($user, $plan->load('prices'), (int) $data['period'], trim($data['server_name'] ?? '') ?: $plan->name, $data['promo'] ?? null);
        });

        if ($created) {
            Auth::login($user, true);
            $request->session()->regenerate();
            $user->notify(new AccountCreated(Password::broker()->createToken($user)));
        }

        if ($invoices->settle($invoice)) {
            return redirect()->route('invoices.show', $invoice)->with('success', 'Оплачено з балансу. Сервер уже створюється!');
        }

        try {
            $user->refresh();
            $payment = $payments->start($user, $invoice->total - max(0, $user->balance), $invoice, (bool) ($data['save_card'] ?? true));

            return Inertia::location($payment->page_url);
        } catch (\Throwable $exception) {
            report($exception);

            return redirect()->route('invoices.show', $invoice)->with('error', 'Не вдалося відкрити оплату: '.MonoPay::error($exception).' Спробуйте ще раз.');
        }
    }

    private function currency(Request $request): string
    {
        $currencies = Setting::currencies();
        $wanted = $request->user()?->currency ?? $request->input('currency', $request->query('currency', $request->cookie('currency')));

        return in_array($wanted, $currencies, true) ? $wanted : $currencies[0];
    }
}
