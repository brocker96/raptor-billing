<?php

namespace App\Http\Controllers\Admin;

use App\Billing\Activity;
use App\Billing\Invoices;
use App\Billing\Present;
use App\Billing\Wallet;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ClientController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search'));

        return Inertia::render('admin/clients/index', [
            'search' => $search,
            'clients' => User::query()->withCount(['services' => fn ($q) => $q->whereIn('status', ['active', 'suspended', 'provisioning'])])
                ->when($search, fn ($q) => $q->where(fn ($q) => $q->where('email', 'like', "%$search%")->orWhere('name', 'like', "%$search%")->orWhere('id', $search)))
                ->latest('id')->paginate(25)->withQueryString()
                ->through(fn (User $u) => Present::user($u) + ['services_count' => $u->services_count]),
        ]);
    }

    public function show(User $user): Response
    {
        return Inertia::render('admin/clients/show', [
            'client' => Present::user($user),
            'services' => $user->services()->with(['plan', 'nextPlan'])->latest('id')->get()->map(fn ($s) => Present::service($s)),
            'invoices' => $user->invoices()->with('service')->latest('id')->limit(30)->get()->map(fn ($i) => Present::invoice($i)),
            'activity' => ActivityLog::query()->with(['user', 'actor'])->where('user_id', $user->id)->latest('id')->limit(15)->get()->map(fn ($e) => ActivityController::present($e)),
            'transactions' => $user->transactions()->with('invoice')->latest('id')->limit(30)->get()->map(fn ($t) => Present::transaction($t)),
        ]);
    }

    /**
     * Credits or debits the balance by hand, with a reason in the ledger.
     */
    public function adjust(Request $request, User $user, Wallet $wallet, Invoices $invoices): RedirectResponse
    {
        $data = $request->validate(['amount' => 'required|numeric|not_in:0|between:-1000000,1000000', 'description' => 'required|string|max:191']);
        $wallet->change($user, (int) round($data['amount'] * 100), 'adjustment', $data['description'], ['admin_id' => $request->user()->id], true);
        $invoices->settleAll($user);

        Activity::log('admin.balance', 'Баланс змінено на '.$data['amount'].' '.$user->currency.': '.$data['description'], $user);

        return back()->with('success', 'Баланс змінено.');
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate(['is_admin' => 'boolean']);
        abort_if($user->is($request->user()) && isset($data['is_admin']) && ! $data['is_admin'], 422, 'Не можна зняти права адміністратора з себе.');
        $user->forceFill($data)->save();

        Activity::log('admin.client', isset($data['is_admin']) ? ($data['is_admin'] ? 'Надано права адміністратора' : 'Знято права адміністратора') : 'Змінено дані клієнта', $user);

        return back()->with('success', 'Збережено.');
    }
}
