<?php

namespace App\Billing;

use App\Models\Plan;
use Illuminate\Support\Str;

/**
 * Creates hidden plans for panel packages that have none yet, prices are set afterwards.
 */
class PlanImporter
{
    public function __construct(private PanelClient $panel) {}

    public function import(): int
    {
        $added = 0;
        foreach ($this->panel->packages() as $package) {
            if (Plan::query()->where('panel_package', $package['slug'])->exists()) {
                continue;
            }
            Plan::query()->create([
                'name' => $package['name'],
                'slug' => Str::slug($package['slug']),
                'description' => $package['description'] ?? null,
                'features' => array_values(array_filter([
                    ($package['limits']['memory'] ?? 0) ? round($package['limits']['memory'] / 1024, 1).' ГБ RAM' : null,
                    ($package['limits']['disk'] ?? 0) ? round($package['limits']['disk'] / 1024).' ГБ SSD' : null,
                    ($package['limits']['cpu'] ?? 0) ? $package['limits']['cpu'].'% CPU' : null,
                    ($package['feature_limits']['backups'] ?? 0) ? $package['feature_limits']['backups'].' бекапів' : null,
                ])),
                'panel_package' => $package['slug'],
                'active' => false,
                'sort' => $package['sort'] ?? 0,
            ]);
            $added++;
        }

        return $added;
    }
}
