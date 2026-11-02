import { Link } from '@inertiajs/react';
import { Receipt, Server, TriangleAlert } from 'lucide-react';
import InputError from '@/components/input-error';
import { Label } from '@/components/ui/label';
import { date, daysLeft, Empty, Pill, ServiceStatusPill } from '@/lib/billing';
import { cn } from '@/lib/utils';
import type { PaymentRow, Service } from '@/types/billing';

export const paymentStatus: Record<
    string,
    ['green' | 'yellow' | 'red' | 'gray', string]
> = {
    success: ['green', 'Успішно'],
    created: ['gray', 'Створено'],
    processing: ['yellow', 'Обробка'],
    hold: ['yellow', 'Холд'],
    failure: ['red', 'Відхилено'],
    reversed: ['red', 'Повернено'],
    expired: ['gray', 'Прострочено'],
};

export function Notice({
    tone,
    children,
}: {
    tone: 'red' | 'amber' | 'blue';
    children: React.ReactNode;
}) {
    const tones = {
        red: 'border-rose-500/30 bg-rose-500/10 text-rose-500',
        amber: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
        blue: 'border-sky-500/30 bg-sky-500/10 text-sky-500',
    };

    return (
        <div
            className={cn(
                'flex items-start gap-3 rounded-xl border p-4 text-sm',
                tones[tone],
            )}
        >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span className="text-foreground">{children}</span>
        </div>
    );
}

export function Switch({
    checked,
    onChange,
    disabled,
}: {
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50',
                checked ? 'bg-primary' : 'bg-muted-foreground/30',
            )}
        >
            <span
                className={cn(
                    'absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition',
                    checked && 'translate-x-5',
                )}
            />
        </button>
    );
}

export function ServiceList({ services }: { services: Service[] }) {
    return (
        <ul className="divide-y">
            {services.map((s) => {
                const left = daysLeft(s.next_due_at);

                return (
                    <li key={s.id}>
                        <Link
                            href={`/services/${s.id}`}
                            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-muted/40"
                        >
                            <span className="grid size-10 place-items-center rounded-lg bg-primary/10 ring-1 ring-primary/20 ring-inset">
                                <Server className="size-4 text-primary" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">
                                    {s.name}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                    {s.plan.name} ·{' '}
                                    {s.address ??
                                        'адреса з’явиться після створення'}
                                </span>
                            </span>
                            <span className="hidden text-right text-sm sm:block">
                                <span className="block">
                                    {s.price.formatted} /{' '}
                                    {s.period.toLowerCase()}
                                </span>
                                <span
                                    className={
                                        left !== null && left <= 3
                                            ? 'text-amber-500'
                                            : 'text-muted-foreground'
                                    }
                                >
                                    {s.next_due_at
                                        ? `до ${date(s.next_due_at)}`
                                        : '—'}
                                </span>
                            </span>
                            <ServiceStatusPill status={s.status} />
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
}

export function PaymentsTable({ payments }: { payments: PaymentRow[] }) {
    if (payments.length === 0) {
        return <Empty icon={Receipt} title="Платежів ще немає" />;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b">
                        <th className="px-5 py-3 font-medium">Клієнт</th>
                        <th className="px-5 py-3 font-medium">Рахунок</th>
                        <th className="hidden px-5 py-3 font-medium 2xl:table-cell">
                            Спосіб
                        </th>
                        <th className="hidden px-5 py-3 font-medium md:table-cell">
                            Дата
                        </th>
                        <th className="px-5 py-3 text-right font-medium">
                            Сума
                        </th>
                        <th className="px-5 py-3 font-medium">Статус</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {payments.map((p) => {
                        const [tone, label] = paymentStatus[p.status] ?? [
                            'gray',
                            p.status,
                        ];

                        return (
                            <tr key={p.id}>
                                <td className="px-5 py-3">
                                    {p.user ? (
                                        <Link
                                            href={`/admin/clients/${p.user.id}`}
                                            className="hover:text-primary"
                                        >
                                            {p.user.email}
                                        </Link>
                                    ) : (
                                        '—'
                                    )}
                                </td>
                                <td className="px-5 py-3 whitespace-nowrap">
                                    {p.invoice?.number ?? (
                                        <span className="text-muted-foreground">
                                            поповнення
                                        </span>
                                    )}
                                </td>
                                <td className="hidden px-5 py-3 text-muted-foreground 2xl:table-cell">
                                    {p.method === 'card'
                                        ? 'Автооплата карткою'
                                        : 'Сторінка оплати'}
                                </td>
                                <td className="hidden px-5 py-3 whitespace-nowrap text-muted-foreground md:table-cell">
                                    {new Intl.DateTimeFormat('uk-UA', {
                                        day: 'numeric',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    }).format(new Date(p.created_at))}
                                </td>
                                <td className="px-5 py-3 text-right font-medium whitespace-nowrap">
                                    {p.amount.formatted}
                                </td>
                                <td className="px-5 py-3">
                                    <Pill tone={tone}>{label}</Pill>
                                    {p.failure_reason && (
                                        <div className="mt-1 text-xs text-muted-foreground">
                                            {p.failure_reason}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export function Field({
    label,
    error,
    children,
}: {
    label: string;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="grid gap-1.5">
            <Label>{label}</Label>
            {children}
            <InputError message={error} />
        </div>
    );
}
