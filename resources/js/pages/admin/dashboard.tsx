import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowDownRight,
    ArrowRight,
    ArrowUpRight,
    CalendarClock,
    CheckCircle2,
    Circle,
    Sparkles,
    TrendingUp,
    Users,
    Wallet,
} from 'lucide-react';
import { PaymentsTable } from '@/components/billing';
import { AreaChart, BarList, SegmentBar } from '@/components/charts';
import { Empty, Panel, ServiceStatusPill } from '@/lib/billing';
import { cn } from '@/lib/utils';
import type { Money, PaymentRow, Service } from '@/types/billing';

type Props = {
    currency: string;
    kpi: {
        revenue: Money;
        revenue_change: number | null;
        mrr: Money;
        arpu: Money;
        clients: number;
        clients_new: number;
        clients_change: number;
        renewals: Money;
        renewals_count: number;
        unpaid: Money;
        unpaid_count: number;
    };
    other_revenue: Money[];
    chart: { date: string; total: number }[];
    statuses: Record<
        'active' | 'suspended' | 'provisioning' | 'pending' | 'failed',
        number
    >;
    plans: { name: string; count: number; mrr: Money }[];
    attention: Service[];
    payments: PaymentRow[];
    update: string | null;
    setup: { panel: boolean; monopay: boolean; plans: boolean };
};

const symbol: Record<string, string> = { UAH: '₴', USD: '$', EUR: '€' };

function greeting() {
    const h = new Date().getHours();

    return h < 5
        ? 'Доброї ночі'
        : h < 12
          ? 'Доброго ранку'
          : h < 18
            ? 'Доброго дня'
            : 'Доброго вечора';
}

export default function AdminDashboard({
    currency,
    kpi,
    other_revenue,
    chart,
    statuses,
    plans,
    attention,
    payments,
    update,
    setup,
}: Props) {
    const { auth } = usePage<{ auth: { user: { name: string } } }>().props;
    const money = (minor: number) =>
        `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(minor / 100)} ${symbol[currency] ?? currency}`;
    const setupDone = setup.panel && setup.monopay && setup.plans;
    const live = statuses.active + statuses.suspended;

    return (
        <>
            <Head title="Адміністрування" />
            <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex-1">
                        <p className="text-sm text-muted-foreground">
                            {new Intl.DateTimeFormat('uk-UA', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                            }).format(new Date())}
                        </p>
                        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                            {greeting()}, {auth.user.name.split(' ')[0]}
                        </h1>
                    </div>
                    {update && (
                        <Link
                            href="/admin/updates"
                            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-sm text-primary hover:bg-primary/15"
                        >
                            <Sparkles className="size-4" /> Доступна {update}
                        </Link>
                    )}
                </div>

                {!setupDone && <Setup setup={setup} />}

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <Kpi
                        icon={Wallet}
                        label="Надходження, 30 днів"
                        value={kpi.revenue.formatted}
                        change={kpi.revenue_change}
                        hint={
                            other_revenue.map((m) => m.formatted).join(' · ') ||
                            undefined
                        }
                        highlight
                    />
                    <Kpi
                        icon={TrendingUp}
                        label="Регулярний дохід / міс."
                        value={kpi.mrr.formatted}
                        hint={`≈ ${kpi.arpu.formatted} на клієнта`}
                    />
                    <Kpi
                        icon={Users}
                        label="Клієнти"
                        value={String(kpi.clients)}
                        hint={`+${kpi.clients_new} за 30 днів`}
                        change={
                            kpi.clients_change
                                ? Math.round(
                                      ((kpi.clients_new - kpi.clients_change) /
                                          kpi.clients_change) *
                                          100,
                                  )
                                : null
                        }
                        href="/admin/clients"
                    />
                    <Kpi
                        icon={CalendarClock}
                        label="Продовження за 7 днів"
                        value={kpi.renewals.formatted}
                        hint={`${kpi.renewals_count} серв. · борг ${kpi.unpaid.formatted}`}
                        href="/admin/invoices?status=unpaid"
                    />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <Panel
                        title="Надходження"
                        description={`Успішні оплати в ${currency} за останні 30 днів`}
                        className="lg:col-span-2"
                    >
                        {chart.some((c) => c.total > 0) ? (
                            <AreaChart
                                data={chart}
                                format={money}
                                height={
                                    typeof window !== 'undefined' &&
                                    window.innerWidth < 640
                                        ? 240
                                        : 360
                                }
                                label="Надходження по днях"
                            />
                        ) : (
                            <div className="grid h-[360px] place-items-center text-sm text-muted-foreground">
                                Тут з’явиться графік після перших оплат
                            </div>
                        )}
                    </Panel>

                    <Panel
                        title="Сервери"
                        description={`${live} працюють або чекають оплати`}
                    >
                        <SegmentBar
                            label="Сервери за станом"
                            segments={[
                                {
                                    key: 'active',
                                    label: 'Активні',
                                    value: statuses.active,
                                    className: 'bg-primary',
                                },
                                {
                                    key: 'suspended',
                                    label: 'Призупинені',
                                    value: statuses.suspended,
                                    className: 'bg-amber-500',
                                },
                                {
                                    key: 'provisioning',
                                    label: 'Створюються',
                                    value: statuses.provisioning,
                                    className: 'bg-sky-500',
                                },
                                {
                                    key: 'pending',
                                    label: 'Не сплачені',
                                    value: statuses.pending,
                                    className: 'bg-zinc-400 dark:bg-zinc-500',
                                },
                                {
                                    key: 'failed',
                                    label: 'Помилки',
                                    value: statuses.failed,
                                    className: 'bg-rose-500',
                                },
                            ]}
                        />
                        <div className="mt-6 border-t pt-5">
                            <div className="mb-3 text-sm font-medium">
                                Тарифи за доходом
                            </div>
                            {plans.length ? (
                                <BarList
                                    items={plans.map((p) => ({
                                        label: p.name,
                                        value: p.mrr.amount,
                                        display: p.mrr.formatted,
                                        hint: `${p.count} серв.`,
                                    }))}
                                />
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Ще немає активних серверів.
                                </p>
                            )}
                        </div>
                    </Panel>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <Panel
                        title="Останні платежі"
                        flush
                        className="lg:col-span-2"
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
                    <Panel
                        title="Потребують уваги"
                        flush
                        actions={
                            attention.length > 0 && (
                                <span className="grid size-6 place-items-center rounded-full bg-rose-500/15 text-xs font-semibold text-rose-500">
                                    {attention.length}
                                </span>
                            )
                        }
                    >
                        {attention.length === 0 ? (
                            <Empty icon={CheckCircle2} title="Усе працює">
                                Сервери створюються без помилок.
                            </Empty>
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
                                            <div className="mt-1 line-clamp-2 text-xs text-rose-500">
                                                {s.last_error ?? 'Без деталей'}
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>
            </div>
        </>
    );
}

function Kpi({
    icon: Icon,
    label,
    value,
    hint,
    change,
    href,
    highlight,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    hint?: string;
    change?: number | null;
    href?: string;
    highlight?: boolean;
}) {
    const body = (
        <>
            {highlight && (
                <div className="pointer-events-none absolute -top-12 -right-12 size-40 rounded-full bg-primary/15 blur-2xl" />
            )}
            <div className="relative flex items-center gap-2 text-xs text-muted-foreground">
                <span
                    className={cn(
                        'grid size-7 place-items-center rounded-lg',
                        highlight ? 'bg-primary/15 text-primary' : 'bg-muted',
                    )}
                >
                    <Icon className="size-3.5" />
                </span>
                {label}
            </div>
            <div className="relative mt-3 flex flex-wrap items-baseline gap-x-2">
                <span className="text-2xl font-semibold tracking-tight tabular-nums">
                    {value}
                </span>
                {change !== null && change !== undefined && (
                    <span
                        className={cn(
                            'inline-flex items-center text-xs font-medium',
                            change >= 0 ? 'text-primary' : 'text-rose-500',
                        )}
                    >
                        {change >= 0 ? (
                            <ArrowUpRight className="size-3.5" />
                        ) : (
                            <ArrowDownRight className="size-3.5" />
                        )}
                        {Math.abs(change)}%
                    </span>
                )}
            </div>
            {hint && (
                <div className="relative mt-1 truncate text-xs text-muted-foreground">
                    {hint}
                </div>
            )}
        </>
    );
    const className =
        'relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm md:p-5';

    return href ? (
        <Link
            href={href}
            className={cn(className, 'transition hover:border-primary/40')}
        >
            {body}
        </Link>
    ) : (
        <div className={className}>{body}</div>
    );
}

function Setup({ setup }: { setup: Props['setup'] }) {
    const steps = [
        {
            done: setup.panel,
            title: 'Підключіть Raptor Panel',
            text: 'Адреса, API-ключ і секрет вебхука',
            href: '/admin/settings',
        },
        {
            done: setup.monopay,
            title: 'Додайте токен plata by mono',
            text: 'Щоб клієнти могли платити карткою',
            href: '/admin/settings',
        },
        {
            done: setup.plans,
            title: 'Увімкніть тарифи',
            text: 'Імпорт пакетів з панелі й ціни',
            href: '/admin/plans',
        },
    ];
    const done = steps.filter((s) => s.done).length;

    return (
        <section className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-5 md:p-6">
            <div className="flex flex-wrap items-center gap-3">
                <h2 className="flex-1 text-lg font-semibold">
                    Ще кілька кроків до першого продажу
                </h2>
                <span className="text-sm text-muted-foreground">
                    {done} з {steps.length}
                </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
                {steps.map((step) => (
                    <Link
                        key={step.title}
                        href={step.href}
                        className={cn(
                            'group flex items-start gap-3 rounded-xl border bg-card/80 p-4 transition hover:border-primary/40',
                            step.done && 'opacity-60',
                        )}
                    >
                        {step.done ? (
                            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
                        ) : (
                            <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1">
                            <span
                                className={cn(
                                    'block font-medium',
                                    step.done && 'line-through',
                                )}
                            >
                                {step.title}
                            </span>
                            <span className="text-sm text-muted-foreground">
                                {step.text}
                            </span>
                        </span>
                        {!step.done && (
                            <ArrowRight className="mt-0.5 size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                        )}
                    </Link>
                ))}
            </div>
        </section>
    );
}

AdminDashboard.layout = { breadcrumbs: [{ title: 'Огляд', href: '/admin' }] };
