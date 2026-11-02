import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, Receipt, Server, ServerOff, Users } from 'lucide-react';
import { Empty, PageHeader, Panel, ServiceStatusPill } from '@/lib/billing';
import type { Money, PaymentRow, Service } from '@/types/billing';
import { PaymentsTable } from '@/components/billing';

type Props = {
    stats: {
        clients: number;
        active: number;
        suspended: number;
        failed: number;
        unpaid: number;
    };
    mrr: Money[];
    revenue: Money[];
    chart: { day: string; total: number }[];
    attention: Service[];
    payments: PaymentRow[];
};

export default function AdminDashboard({
    stats,
    mrr,
    revenue,
    chart,
    attention,
    payments,
}: Props) {
    const max = Math.max(1, ...chart.map((c) => c.total));

    return (
        <>
            <Head title="Адміністрування" />
            <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Адміністрування"
                    description="Стан бізнесу за останні 30 днів."
                />

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                    <Tile
                        icon={Users}
                        label="Клієнти"
                        value={stats.clients}
                        href="/admin/clients"
                    />
                    <Tile
                        icon={Server}
                        label="Активні сервери"
                        value={stats.active}
                        href="/admin/services?status=active"
                    />
                    <Tile
                        icon={ServerOff}
                        label="Призупинені"
                        value={stats.suspended}
                        href="/admin/services?status=suspended"
                        tone={stats.suspended ? 'text-amber-500' : undefined}
                    />
                    <Tile
                        icon={AlertTriangle}
                        label="Помилки створення"
                        value={stats.failed}
                        href="/admin/services?status=failed"
                        tone={stats.failed ? 'text-rose-500' : undefined}
                    />
                    <Tile
                        icon={Receipt}
                        label="Несплачені рахунки"
                        value={stats.unpaid}
                        href="/admin/invoices?status=unpaid"
                    />
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    <Panel
                        title="Надходження, 30 днів"
                        className="lg:col-span-2"
                    >
                        <div className="flex flex-wrap gap-x-8 gap-y-2">
                            <Figure label="Оплачено" values={revenue} />
                            <Figure label="MRR" values={mrr} />
                        </div>
                        <div
                            className="mt-6 flex h-40 items-end gap-1"
                            role="img"
                            aria-label="Надходження по днях"
                        >
                            {chart.map((c) => (
                                <div
                                    key={c.day}
                                    className="group relative flex h-full flex-1 items-end"
                                >
                                    <div
                                        className="w-full rounded-t-sm bg-primary/80 transition group-hover:bg-primary"
                                        style={{
                                            height: `${c.total ? Math.max(3, (c.total / max) * 100) : 1}%`,
                                            opacity: c.total ? 1 : 0.25,
                                        }}
                                    />
                                    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded bg-popover px-2 py-1 text-xs whitespace-nowrap shadow ring-1 ring-border group-hover:block">
                                        {c.day}:{' '}
                                        {(c.total / 100).toLocaleString(
                                            'uk-UA',
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                            <span>{chart[0]?.day}</span>
                            <span>{chart.at(-1)?.day}</span>
                        </div>
                    </Panel>

                    <Panel title="Потребують уваги" flush>
                        {attention.length === 0 ? (
                            <Empty icon={Server} title="Усе працює" />
                        ) : (
                            <ul className="divide-y">
                                {attention.map((s) => (
                                    <li key={s.id}>
                                        <Link
                                            href={`/admin/services/${s.id}`}
                                            className="block px-5 py-3 text-sm hover:bg-muted/40"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="flex-1 truncate font-medium">
                                                    {s.name}
                                                </span>
                                                <ServiceStatusPill
                                                    status={s.status}
                                                />
                                            </div>
                                            <div className="mt-1 truncate text-xs text-rose-500">
                                                {s.last_error ?? 'Без деталей'}
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>

                <Panel
                    title="Останні платежі"
                    flush
                    actions={
                        <Link
                            href="/admin/payments"
                            className="text-sm text-primary hover:underline"
                        >
                            Усі
                        </Link>
                    }
                >
                    <PaymentsTable payments={payments} />
                </Panel>
            </div>
        </>
    );
}

function Figure({ label, values }: { label: string; values: Money[] }) {
    return (
        <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold tracking-tight">
                {values.length
                    ? values.map((v) => v.formatted).join(' · ')
                    : '0'}
            </div>
        </div>
    );
}

function Tile({
    icon: Icon,
    label,
    value,
    href,
    tone,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: number;
    href: string;
    tone?: string;
}) {
    return (
        <Link
            href={href}
            className="rounded-xl border bg-card p-4 shadow-sm transition hover:border-primary/40"
        >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="size-4" /> {label}
            </div>
            <div className={`mt-2 text-2xl font-semibold ${tone ?? ''}`}>
                {value}
            </div>
        </Link>
    );
}

AdminDashboard.layout = {
    breadcrumbs: [{ title: 'Адміністрування', href: '/admin' }],
};
