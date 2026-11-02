<?php

namespace App\Http\Controllers\Admin;

use App\Billing\PanelClient;
use App\Billing\Present;
use App\Billing\Provisioner;
use App\Http\Controllers\Controller;
use App\Jobs\ProvisionService;
use App\Models\Service;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ServiceController extends Controller
{
    public function index(Request $request): Response
    {
        $status = (string) $request->query('status');
        $search = trim((string) $request->query('search'));

        return Inertia::render('admin/services/index', [
            'filters' => ['status' => $status, 'search' => $search],
            'services' => Service::query()->with(['user', 'plan', 'nextPlan'])
                ->when($status, fn ($q) => $q->where('status', $status))
                ->when($search, fn ($q) => $q->where(fn ($q) => $q->where('name', 'like', "%$search%")->orWhere('panel_address', 'like', "%$search%")->orWhereHas('user', fn ($u) => $u->where('email', 'like', "%$search%"))))
                ->latest('id')->paginate(25)->withQueryString()->through(fn ($s) => Present::service($s)),
        ]);
    }

    public function show(Service $service): Response
    {
        return Inertia::render('admin/services/show', [
            'service' => Present::service($service->load(['user', 'plan', 'nextPlan'])),
            'invoices' => $service->invoices()->latest('id')->get()->map(fn ($i) => Present::invoice($i)),
        ]);
    }

    public function action(Request $request, Service $service, Provisioner $provisioner): RedirectResponse
    {
        $action = $request->validate(['action' => 'required|in:provision,suspend,unsuspend,terminate,sync'])['action'];

        try {
            match ($action) {
                'provision' => (function () use ($service) {
                    $service->forceFill(['status' => 'provisioning', 'last_error' => null])->save();
                    ProvisionService::dispatch($service->id);
                })(),
                'suspend' => $provisioner->suspend($service, (string) $request->input('reason', 'Призупинено адміністратором.'), null),
                'unsuspend' => $provisioner->unsuspend($service),
                'terminate' => $provisioner->terminate($service),
                'sync' => $provisioner->refresh($service),
            };
        } catch (\Throwable $exception) {
            return back()->with('error', PanelClient::error($exception));
        }

        return back()->with('success', 'Готово.');
    }

    public function update(Request $request, Service $service): RedirectResponse
    {
        $data = $request->validate([
            'next_due_at' => 'sometimes|date',
            'amount' => 'sometimes|numeric|min:0',
            'auto_renew' => 'sometimes|boolean',
        ]);
        if (isset($data['amount'])) {
            $data['amount'] = (int) round($data['amount'] * 100);
        }
        $service->forceFill($data)->save();

        return back()->with('success', 'Збережено.');
    }
}
