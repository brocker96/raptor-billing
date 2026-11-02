<?php

namespace App\Http\Controllers\Webhooks;

use App\Http\Controllers\Controller;
use App\Models\Service;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Webhooks from Raptor Panel. Keeps services in step with what happened in the panel, also
 * when an administrator acted there directly.
 */
class RaptorController extends Controller
{
    public function __invoke(Request $request): Response
    {
        if (! $this->signed($request)) {
            return response('invalid signature', 400);
        }

        $event = (string) $request->input('event');
        $server = (array) $request->input('data.server', []);
        $external = (string) ($server['external_id'] ?? '');
        if (! str_starts_with($external, 'svc-')) {
            return response('ignored');
        }

        $service = Service::query()->find((int) substr($external, 4));
        if (! $service) {
            return response('unknown');
        }

        $service->forceFill([
            'panel_server_id' => $server['id'] ?? $service->panel_server_id,
            'panel_identifier' => $server['identifier'] ?? $service->panel_identifier,
            'panel_address' => $server['address']['display'] ?? $service->panel_address,
        ]);

        match ($event) {
            'server.installed' => $service->status === 'provisioning' ? $service->forceFill(['status' => 'active', 'activated_at' => now()]) : null,
            'server.install_failed' => $service->forceFill(['last_error' => 'Встановлення сервера в панелі завершилося помилкою.']),
            'server.deleted' => in_array($service->status, Service::LIVE, true) ? $service->forceFill(['status' => 'terminated', 'terminated_at' => now()]) : null,
            'server.suspended' => $service->status === 'active' ? $service->forceFill(['status' => 'suspended', 'suspended_at' => now()]) : null,
            'server.unsuspended' => $service->status === 'suspended' ? $service->forceFill(['status' => 'active', 'suspended_at' => null]) : null,
            default => null,
        };
        $service->save();

        return response('ok');
    }

    /**
     * X-Raptor-Signature: t=<time>,v1=<HMAC-SHA256 of "t.body">, at most five minutes old.
     */
    private function signed(Request $request): bool
    {
        $secret = (string) Setting::get('panel_webhook_secret');
        parse_str(str_replace(',', '&', (string) $request->header('X-Raptor-Signature')), $parts);
        if ($secret === '' || empty($parts['t']) || empty($parts['v1']) || abs(time() - (int) $parts['t']) > 300) {
            return false;
        }

        return hash_equals(hash_hmac('sha256', $parts['t'].'.'.$request->getContent(), $secret), (string) $parts['v1']);
    }
}
