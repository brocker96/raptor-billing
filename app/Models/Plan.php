<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A plan of the shop, sold as a Raptor Panel package.
 *
 * @property int $id
 * @property string $name
 * @property string $slug
 * @property string $category
 * @property string|null $description
 * @property list<string>|null $features
 * @property string $panel_package
 * @property bool $active
 * @property bool $featured
 * @property int $sort
 */
class Plan extends Model
{
    protected $fillable = ['name', 'slug', 'category', 'description', 'features', 'panel_package', 'active', 'featured', 'sort'];

    protected function casts(): array
    {
        return ['features' => 'array', 'active' => 'boolean', 'featured' => 'boolean', 'sort' => 'integer'];
    }

    public function prices(): HasMany
    {
        return $this->hasMany(PlanPrice::class);
    }

    public function services(): HasMany
    {
        return $this->hasMany(Service::class);
    }

    public function price(string $currency, int $months): ?PlanPrice
    {
        return $this->prices->first(fn (PlanPrice $p) => $p->currency === $currency && $p->period_months === $months);
    }
}
