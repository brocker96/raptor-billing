<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;

/**
 * Dispatched by the scheduler, proves that a queue worker is running.
 */
class Heartbeat implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        Cache::forever('health:queue', now()->toAtomString());
    }
}
