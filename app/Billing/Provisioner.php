<?php

namespace App\Billing;

use App\Models\Plan;
use App\Models\Service;
use App\Notifications\ServiceReady;
use App\Notifications\ServiceSuspended;
use App\Notifications\ServiceTerminated;

/**
 * Keeps the server in Raptor Panel in step with the service: creates it, suspends,
 * unsuspends, switches packages and deletes it.
 */
class Provisioner
{
    public function __construct(private PanelClient $panel) {}

    /**
     * Creates the server. Safe to run again: the panel returns the existing server for the
     * same external id.
     */
    public function provision(Service $service): void
    {
        $user = $service->user;
        $result = $this->panel->createServer([
            'package' => $service->plan->panel_package,
            'external_id' => $service->externalId(),
            'name' => $service->name,
            'user' => [
                'email' => $user->email,
                'external_id' => $user->externalId(),
                'first_name' => $user->name,
            ],
        ], 'provision-'.$service->externalId());

        $this->remember($service, $result['server'] ?? []);
        $service->forceFill([
            'status' => 'active',
            'activated_at' => $service->activated_at ?? now(),
            'last_error' => null,
        ])->save();

        $user->notify(new ServiceReady($service));
        Activity::log('service.ready', 'Сервер «'.$service->name.'» створено в панелі', $user);
    }

    public function suspend(Service $service, string $reason, ?string $paymentUrl): void
    {
        $this->panel->suspend($service->externalId(), $reason, $paymentUrl);
        $service->forceFill(['status' => 'suspended', 'suspended_at' => now()])->save();
        $service->user->notify(new ServiceSuspended($service, $reason, $paymentUrl));
        Activity::log('service.suspended', 'Сервер «'.$service->name.'» призупинено: '.$reason, $service->user_id);
    }

    public function unsuspend(Service $service): void
    {
        $this->panel->unsuspend($service->externalId());
        $service->forceFill(['status' => 'active', 'suspended_at' => null])->save();
    }

    public function terminate(Service $service, bool $notify = true): void
    {
        if ($service->panel_server_id || $service->status !== 'pending') {
            $this->panel->delete($service->externalId());
        }
        $service->forceFill(['status' => 'terminated', 'terminated_at' => now(), 'auto_renew' => false])->save();

        if ($notify) {
            $service->user->notify(new ServiceTerminated($service));
            Activity::log('service.terminated', 'Сервер «'.$service->name.'» видалено', $service->user_id);
        }
    }

    /**
     * Moves the service to another plan, in the panel too when the server exists.
     */
    public function switchPlan(Service $service, int $planId, int $amount): void
    {
        $plan = Plan::query()->findOrFail($planId);
        if (in_array($service->status, Service::LIVE, true)) {
            $this->remember($service, $this->panel->changePackage($service->externalId(), $plan->panel_package));
        }

        $service->forceFill(['plan_id' => $plan->id, 'amount' => $amount, 'next_plan_id' => null])->save();
    }

    public function refresh(Service $service): void
    {
        $this->remember($service, $this->panel->server($service->externalId()));
        $service->save();
    }

    private function remember(Service $service, array $server): void
    {
        if (! $server) {
            return;
        }

        $service->forceFill([
            'panel_server_id' => $server['id'] ?? $service->panel_server_id,
            'panel_identifier' => $server['identifier'] ?? $service->panel_identifier,
            'panel_address' => $server['address']['display'] ?? $service->panel_address,
        ]);
    }
}
