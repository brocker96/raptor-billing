<?php

namespace App\Http\Controllers\Client;

use App\Billing\Invoices;
use App\Billing\MonoPay;
use App\Billing\Payments;
use App\Billing\Present;
use App\Http\Controllers\Controller;
use App\Models\Invoice;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class InvoiceController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('invoices/index', [
            'invoices' => $request->user()->invoices()->with('service')->latest('id')->paginate(20)->through(fn ($i) => Present::invoice($i)),
        ]);
    }

    public function show(Request $request, Invoice $invoice): Response
    {
        $this->authorizeOwner($request, $invoice);
        $user = $request->user();

        return Inertia::render('invoices/show', [
            'invoice' => Present::invoice($invoice->load(['items', 'service']), true),
            'balance' => Present::money($user->balance, $user->currency),
            'missing' => Present::money(max(0, $invoice->total - $user->balance), $invoice->currency),
            'has_card' => $user->cards()->exists(),
        ]);
    }

    /**
     * Pays from the balance when it covers the invoice, otherwise opens MonoPay for the missing
     * part. The payment lands on the balance and pays the invoice from there.
     */
    public function pay(Request $request, Invoice $invoice, Invoices $invoices, Payments $payments): HttpResponse
    {
        $this->authorizeOwner($request, $invoice);
        abort_unless($invoice->status === 'unpaid', 422, 'Цей рахунок уже не потребує оплати.');
        $data = $request->validate(['save_card' => 'boolean']);

        if ($invoices->settle($invoice)) {
            return back()->with('success', 'Рахунок сплачено з балансу.');
        }

        try {
            $payment = $payments->start($request->user(), $invoice->total - max(0, $request->user()->balance), $invoice, (bool) ($data['save_card'] ?? false));

            return Inertia::location($payment->page_url);
        } catch (\Throwable $exception) {
            report($exception);

            return back()->with('error', 'Не вдалося створити платіж: '.MonoPay::error($exception));
        }
    }

    private function authorizeOwner(Request $request, Invoice $invoice): void
    {
        abort_unless($invoice->user_id === $request->user()->id, 404);
    }
}
