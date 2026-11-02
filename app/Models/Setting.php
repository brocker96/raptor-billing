<?php

namespace App\Models;

use App\Billing\Currency;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;

/**
 * Key-value settings edited in Admin → Settings. Secrets are stored encrypted.
 *
 * @property string $key
 * @property string|null $value
 */
class Setting extends Model
{
    public const SECRETS = ['panel_key', 'panel_webhook_secret', 'monopay_token'];

    public const DEFAULTS = [
        'company_name' => 'HostMC',
        'company_details' => '',
        'company_url' => 'https://hostmc.net.ua',
        'logo_url' => '',
        'support_email' => '',
        'currencies' => 'UAH',
        'panel_url' => '',
        'panel_key' => '',
        'panel_webhook_secret' => '',
        'monopay_token' => '',
        'invoice_days_before' => '5',
        'suspend_after_days' => '1',
        'terminate_after_days' => '14',
        'invoice_prefix' => 'HMC',
    ];

    public $timestamps = false;

    public $incrementing = false;

    protected $primaryKey = 'key';

    protected $keyType = 'string';

    protected $fillable = ['key', 'value'];

    public static function get(string $key, ?string $default = null): ?string
    {
        $all = Cache::rememberForever('billing:settings', fn () => static::query()->pluck('value', 'key')->all());
        $value = $all[$key] ?? null;

        if ($value !== null && in_array($key, self::SECRETS, true)) {
            try {
                $value = Crypt::decryptString($value);
            } catch (\Throwable) {
                $value = null;
            }
        }

        return $value ?? $default ?? self::DEFAULTS[$key] ?? null;
    }

    public static function int(string $key): int
    {
        return (int) static::get($key);
    }

    /**
     * @param  array<string, string|null>  $values
     */
    public static function put(array $values): void
    {
        foreach ($values as $key => $value) {
            if ($value !== null && in_array($key, self::SECRETS, true)) {
                $value = Crypt::encryptString($value);
            }
            static::query()->updateOrCreate(['key' => $key], ['value' => $value]);
        }
        Cache::forget('billing:settings');
    }

    /**
     * Currencies switched on for the shop.
     *
     * @return list<string>
     */
    public static function currencies(): array
    {
        $enabled = array_values(array_intersect(explode(',', (string) static::get('currencies')), Currency::codes()));

        return $enabled ?: ['UAH'];
    }
}
