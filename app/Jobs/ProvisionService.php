<?php

namespace App\Jobs;

use App\Billing\PanelClient;
use App\Billing\Provisioner;
use App\Models\Service;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Creates the server of a paid order in Raptor Panel. Retried for about an hour when the panel
 * is down or has no room; the error is shown in the admin area.
 */
class ProvisionService implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 6;

    public function __construct(public int $serviceId) {}

    public function uniqueId(): string
    {
        return (string) $this->serviceId;
    }

    public function backoff(): array
    {
        return [30, 120, 300, 900, 1800];
    }

    public function handle(Provisioner $provisioner): void
    {
        $service = Service::query()->find($this->serviceId);
        if (! $service || $service->status !== 'provisioning') {
            return;
        }

        try {
            $provisioner->provision($service);
        } catch (\Throwable $exception) {
            $service->forceFill(['last_error' => PanelClient::error($exception)])->save();

            throw $exception;
        }
    }

    public function failed(\Throwable $exception): void
    {
        Service::query()->whereKey($this->serviceId)->update(['status' => 'failed', 'last_error' => PanelClient::error($exception)]);
    }
}
