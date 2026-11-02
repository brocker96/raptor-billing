<?php

namespace App\Billing;

/**
 * Billing periods in months, with the label shown to customers.
 */
final class Period
{
    public const MONTHS = [1, 3, 6, 12];

    public static function label(int $months): string
    {
        return match ($months) {
            1 => 'Місяць',
            3 => '3 місяці',
            6 => '6 місяців',
            12 => 'Рік',
            default => $months.' міс.',
        };
    }
}
