<?php

return [
    /*
    | Replaced with the tag by the release workflow. Installations from a git branch stay
    | "canary" and are offered every release.
    */
    'version' => 'canary',

    'updates' => [
        'repository' => env('BILLING_UPDATE_REPOSITORY', 'brocker96/raptor-billing'),
        // Optional mirror returning the same JSON as the GitHub releases API.
        'feed' => env('BILLING_UPDATE_FEED'),
        // Number of pre-update backups kept for rollbacks.
        'keep_backups' => (int) env('BILLING_UPDATE_KEEP_BACKUPS', 3),
    ],
];
