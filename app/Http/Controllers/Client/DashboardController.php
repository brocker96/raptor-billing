<?php

namespace App\Http\Controllers\Client;

use App\Billing\Present;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('dashboard', [
            'balance' => Present::money($user->balance, $user->currency),
            'services' => $user->services()->with(['plan', 'nextPlan'])->whereNotIn('status', ['terminated', 'cancelled'])->latest('id')->get()->map(fn ($s) => Present::service($s)),
            'unpaid' => $user->invoices()->with('service')->where('status', 'unpaid')->latest('id')->get()->map(fn ($i) => Present::invoice($i)),
        ]);
    }
}
