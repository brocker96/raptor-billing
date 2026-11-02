<?php

namespace App\Billing;

/**
 * Currencies the shop can sell in. MonoPay wants the ISO 4217 numeric code.
 */
enum Currency: string
{
    case UAH = 'UAH';
    case USD = 'USD';
    case EUR = 'EUR';

    public function iso(): int
    {
        return match ($this) {
            self::UAH => 980,
            self::USD => 840,
            self::EUR => 978,
        };
    }

    public function symbol(): string
    {
        return match ($this) {
            self::UAH => '₴',
            self::USD => '$',
            self::EUR => '€',
        };
    }

    /**
     * Formats minor units: 12345 UAH becomes "123,45 ₴".
     */
    public function format(int $minor): string
    {
        $value = number_format(abs($minor) / 100, 2, ',', ' ');

        return ($minor < 0 ? '−' : '').match ($this) {
            self::UAH => $value.' ₴',
            default => $this->symbol().$value,
        };
    }

    /**
     * @return list<string>
     */
    public static function codes(): array
    {
        return array_map(fn (self $c) => $c->value, self::cases());
    }
}
