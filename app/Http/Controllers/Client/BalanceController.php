<?php

namespace App\Http\Controllers\Client;

use App\Billing\MonoPay;
use App\Billing\Payments;
use App\Billing\Present;
use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\Payment;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class BalanceController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('balance', [
            'balance' => Present::money($user->balance, $user->currency),
            'currency' => $user->currency,
            'currencies' => Setting::currencies(),
            'can_change_currency' => $user->balance === 0 && ! $user->services()->exists() && ! $user->invoices()->exists(),
            'cards' => $user->cards()->latest('id')->get()->map(fn (Card $c) => Present::card($c)),
            'transactions' => $user->transactions()->with('invoice')->latest('id')->paginate(25)->through(fn ($t) => Present::transaction($t)),
        ]);
    }

    public function topup(Request $request, Payments $payments): HttpResponse
    {
        $data = $request->validate(['amount' => 'required|numeric|min:1|max:100000', 'save_card' => 'boolean']);

        try {
            $payment = $payments->start($request->user(), (int) round($data['amount'] * 100), null, (bool) ($data['save_card'] ?? false));

            return Inertia::location($payment->page_url);
        } catch (\Throwable $exception) {
            report($exception);

            return back()->with('error', 'Не вдалося створити платіж: '.MonoPay::error($exception));
        }
    }

    /**
     * Where MonoPay sends the customer back. The status is checked here too, so the page is
     * right even when the webhook is late.
     */
    public function return(Request $request, Payment $payment, Payments $payments): RedirectResponse
    {
        abort_unless($payment->user_id === $request->user()->id, 404);

        try {
            $payments->sync($payment);
        } catch (\Throwable $exception) {
            report($exception);
        }
        $payment->refresh();

        $target = $payment->invoice ? redirect()->route('invoices.show', $payment->invoice) : redirect()->route('balance');

        return match ($payment->status) {
            'success' => $target->with('success', 'Оплату отримано, дякуємо!'),
            'failure', 'expired', 'reversed' => $target->with('error', 'Оплата не пройшла'.($payment->failure_reason ? ': '.$payment->failure_reason : '.')),
            default => $target->with('success', 'Оплата обробляється, баланс оновиться за кілька секунд.'),
        };
    }

    public function currency(Request $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validate(['currency' => 'required|in:'.implode(',', Setting::currencies())]);
        abort_unless($user->balance === 0 && ! $user->services()->exists() && ! $user->invoices()->exists(), 422, 'Валюту можна змінити лише до першого замовлення.');

        $user->forceFill(['currency' => $data['currency']])->save();

        return back()->with('success', 'Валюту рахунку змінено.');
    }

    public function updateCard(Request $request, Card $card): RedirectResponse
    {
        abort_unless($card->user_id === $request->user()->id, 404);
        $card->forceFill(['autopay' => $request->boolean('autopay')])->save();

        return back()->with('success', $card->autopay ? 'Автооплату увімкнено.' : 'Автооплату вимкнено.');
    }

    public function deleteCard(Request $request, Card $card, MonoPay $mono): RedirectResponse
    {
        abort_unless($card->user_id === $request->user()->id, 404);

        try {
            $mono->deleteCard($card->token);
        } catch (\Throwable $exception) {
            report($exception);
        }
        $card->delete();

        return back()->with('success', 'Картку видалено.');
    }
}
