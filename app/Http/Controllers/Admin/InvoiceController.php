<?php

namespace App\Http\Controllers\Admin;

use App\Billing\Invoices;
use App\Billing\Present;
use App\Billing\Wallet;
use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class InvoiceController extends Controller
{
    public function index(Request $request): Response
    {
        $status = (string) $request->query('status');

        return Inertia::render('admin/invoices/index', [
            'filters' => ['status' => $status],
            'invoices' => Invoice::query()->with(['user', 'service'])->when($status, fn ($q) => $q->where('status', $status))
                ->latest('id')->paginate(30)->withQueryString()->through(fn ($i) => Present::invoice($i)),
        ]);
    }

    /**
     * For money that arrived outside MonoPay (bank transfer, cash): credits the balance with
     * the amount and pays the invoice from it, so the ledger stays complete.
     */
    public function markPaid(Request $request, Invoice $invoice, Wallet $wallet, Invoices $invoices): RedirectResponse
    {
        abort_unless($invoice->status === 'unpaid', 422);
        $missing = max(0, $invoice->total - max(0, $invoice->user->balance));
        if ($missing > 0) {
            $wallet->change($invoice->user, $missing, 'adjustment', 'Оплата рахунку '.$invoice->number.' поза MonoPay', ['invoice_id' => $invoice->id, 'admin_id' => $request->user()->id]);
        }
        $invoices->settle($invoice);

        return back()->with('success', 'Рахунок позначено як сплачений.');
    }

    public function cancel(Invoice $invoice, Invoices $invoices): RedirectResponse
    {
        $invoices->cancel($invoice);

        return back()->with('success', 'Рахунок скасовано.');
    }

    public function payments(): Response
    {
        return Inertia::render('admin/payments', [
            'payments' => Payment::query()->with(['user', 'invoice'])->latest('id')->paginate(30)->through(fn ($p) => Present::payment($p)),
        ]);
    }
}
