<?php

namespace App\Http\Controllers\Webhooks;

use App\Billing\MonoPay;
use App\Billing\Payments;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

/**
 * Status changes of MonoPay invoices. Answers 200 for everything with a valid signature so
 * monobank stops retrying, the status itself is always applied by its modifiedDate.
 */
class MonoPayController extends Controller
{
    public function __invoke(Request $request, MonoPay $mono, Payments $payments): Response
    {
        $body = $request->getContent();
        if (! $mono->verify($body, (string) $request->header('x-sign'))) {
            Log::warning('MonoPay webhook with an invalid signature from '.$request->ip());

            return response('invalid signature', 400);
        }

        $data = json_decode($body, true) ?: [];
        $payment = Payment::query()->where('provider_id', $data['invoiceId'] ?? '')->first();
        if ($payment) {
            $payments->apply($payment, $data);
        }

        return response('ok');
    }
}
