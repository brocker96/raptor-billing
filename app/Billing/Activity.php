<?php

namespace App\Billing;

use App\Models\ActivityLog;
use App\Models\User;

/**
 * Writes the activity log. Logging never breaks the action it describes.
 */
class Activity
{
    public static function log(string $event, string $description, User|int|null $user = null, ?User $actor = null): void
    {
        rescue(function () use ($event, $description, $user, $actor) {
            $request = app()->runningInConsole() ? null : request();
            $actor ??= $request?->user();

            ActivityLog::query()->create([
                'user_id' => $user instanceof User ? $user->id : ($user ?? $actor?->id),
                'actor_id' => $actor?->id,
                'event' => $event,
                'description' => mb_substr($description, 0, 255),
                'ip' => $request?->ip(),
            ]);
        }, null, false);
    }
}
