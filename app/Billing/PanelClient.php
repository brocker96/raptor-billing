<?php

namespace App\Billing;

use App\Models\Setting;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Talks to the Raptor API of Raptor Panel (/api/raptor/v1).
 */
class PanelClient
{
    public function configured(): bool
    {
        return Setting::get('panel_url') !== '' && Setting::get('panel_key') !== '';
    }

    public function ping(): array
    {
        return $this->send('get', '/');
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function packages(): array
    {
        return $this->send('get', '/packages')['data'] ?? [];
    }

    public function availability(string $package): array
    {
        return $this->send('get', '/packages/'.rawurlencode($package).'/availability');
    }

    public function server(string $externalId): array
    {
        return $this->send('get', '/servers/ext:'.rawurlencode($externalId));
    }

    public function createServer(array $body, string $idempotencyKey): array
    {
        return $this->send('post', '/servers', $body, $idempotencyKey);
    }

    public function suspend(string $externalId, string $reason, ?string $paymentUrl): array
    {
        return $this->send('post', '/servers/ext:'.rawurlencode($externalId).'/suspend', array_filter([
            'reason' => $reason,
            'payment_url' => $paymentUrl,
        ]));
    }

    public function unsuspend(string $externalId): array
    {
        return $this->send('post', '/servers/ext:'.rawurlencode($externalId).'/unsuspend');
    }

    public function changePackage(string $externalId, string $package): array
    {
        return $this->send('put', '/servers/ext:'.rawurlencode($externalId).'/package', ['package' => $package]);
    }

    public function rename(string $externalId, string $name): array
    {
        return $this->send('patch', '/servers/ext:'.rawurlencode($externalId), ['name' => $name]);
    }

    public function delete(string $externalId): void
    {
        try {
            $this->send('delete', '/servers/ext:'.rawurlencode($externalId));
        } catch (RequestException $exception) {
            // Already gone is what we wanted.
            if ($exception->response->status() !== 404) {
                throw $exception;
            }
        }
    }

    public function resources(string $externalId): array
    {
        return $this->send('get', '/servers/ext:'.rawurlencode($externalId).'/resources');
    }

    public function loginLink(string $userExternalId, string $redirect = '/'): array
    {
        return $this->send('post', '/users/ext:'.rawurlencode($userExternalId).'/login-link', ['redirect' => $redirect]);
    }

    public function updateUser(string $userExternalId, array $fields): array
    {
        return $this->send('patch', '/users/ext:'.rawurlencode($userExternalId), $fields);
    }

    private function http(): PendingRequest
    {
        if (! $this->configured()) {
            throw new RuntimeException('Raptor Panel is not connected, see Admin → Settings.');
        }

        return Http::baseUrl(rtrim((string) Setting::get('panel_url'), '/').'/api/raptor/v1')
            ->withToken((string) Setting::get('panel_key'))
            ->acceptJson()
            ->timeout(30)
            ->connectTimeout(10);
    }

    private function send(string $method, string $path, array $body = [], ?string $idempotencyKey = null): array
    {
        $request = $this->http();
        if ($idempotencyKey) {
            $request = $request->withHeaders(['Idempotency-Key' => $idempotencyKey]);
        }

        /** @var Response $response */
        $response = $method === 'get' ? $request->get($path, $body) : $request->{$method}($path, $body);

        return $response->throw()->json() ?? [];
    }

    /**
     * A readable message out of a failed panel call.
     */
    public static function error(\Throwable $exception): string
    {
        if ($exception instanceof RequestException) {
            return $exception->response->json('errors.0.detail') ?? 'Raptor Panel answered HTTP '.$exception->response->status();
        }

        return $exception->getMessage();
    }
}
