import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowDownLeft,
    ArrowRight,
    ArrowUpRight,
    Copy,
    CreditCard,
    ExternalLink,
    Plus,
    Receipt,
    Server,
    ShieldCheck,
    TriangleAlert,
    Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Announcement } from '@/components/announcement';
import { Button } from '@/components/ui/button';
import {
    date,
    daysLeft,
    Empty,
    invoiceType,
    Panel,
    ServiceStatusPill,
} from '@/lib/billing';
import { cn } from '@/lib/utils';
import type { Invoice, Money, Service, Transaction } from '@/types/billing';

type Props = {
    balance: Money;
    services: Service[];
    unpaid: Invoice[];
    transactions: Transaction[];
    has_card: boolean;
};

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

export default function Dashboard({
    balance,
    services,
    unpaid,
    transactions,
    has_card,
}: Props) {
    const { auth } = usePage<{ auth: { user: { name: string } } }>().props;
    const active = services.filter((s) => s.status === 'active');
    const next = services
        .filter((s) => s.next_due_at && s.auto_renew && s.status === 'active')
        .sort((a, b) => (a.next_due_at! < b.next_due_at! ? -1 : 1))[0];
    const suspended = services.filter((s) => s.status === 'suspended');
    const shortfall = next && next.price.amount > balance.amount && !has_card;

    return (
        <>
            <Head title="Огляд" />
            <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
                <Announcement />

                <section className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm md:p-8">
                    <div className="pointer-events-none absolute -top-32 -right-20 size-96 rounded-full bg-primary/15 blur-3xl" />
                    <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
                        <div>
                            <p className="text-sm text-muted-foreground">
                                {greeting()}, {auth.user.name.split(' ')[0]}
                            </p>
                            <div className="mt-4 text-sm text-muted-foreground">
                                На балансі
                            </div>
                            <div className="text-4xl font-semibold tracking-tight tabular-nums md:text-5xl">
                                {balance.formatted}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                {next ? (
                                    <span>
                                        Наступне списання{' '}
                                        <b className="text-foreground">
                                            {next.price.formatted}
                                        </b>{' '}
                                        · {date(next.next_due_at)}
                                    </span>
                                ) : (
                                    <span>Запланованих списань немає</span>
                                )}
                                {has_card && (
                                    <span className="inline-flex items-center gap-1">
                                        <ShieldCheck className="size-3.5 text-primary" />{' '}
                                        автооплата з картки
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button asChild size="lg">
                                <Link href="/balance">
                                    <Wallet className="size-4" /> Поповнити
                                </Link>
                            </Button>
                            <Button asChild size="lg" variant="outline">
                                <Link href="/">
                                    <Plus className="size-4" /> Новий сервер
                                </Link>
                            </Button>
                        </div>
                    </div>
                    <div className="relative mt-6 grid grid-cols-3 gap-3 border-t pt-5 text-sm">
                        <Mini label="Працюють" value={active.length} />
                        <Mini
                            label="Рахунки до сплати"
                            value={unpaid.length}
                            tone={unpaid.length ? 'text-amber-500' : undefined}
                        />
                        <Mini
                            label="Днів до списання"
                            value={
                                next
                                    ? Math.max(
                                          0,
                                          daysLeft(next.next_due_at) ?? 0,
                                      )
                                    : '—'
                            }
                        />
                    </div>
                </section>

                {(unpaid.length > 0 || suspended.length > 0 || shortfall) && (
                    <section className="space-y-3">
                        {unpaid.map((invoice) => (
                            <Action
                                key={invoice.id}
                                icon={Receipt}
                                title={`${invoiceType[invoice.type]}${invoice.service ? ` · ${invoice.service.name}` : ''}`}
                                text={`Рахунок ${invoice.number} на ${invoice.total.formatted}, сплатити до ${date(invoice.due_at)}`}
                                href={`/invoices/${invoice.id}`}
                                button={`Сплатити ${invoice.total.formatted}`}
                            />
                        ))}
                        {shortfall && (
                            <Action
                                icon={CreditCard}
                                tone="sky"
                                title="Щоб сервер не зупинився"
                                text={`Для продовження «${next.name}» ${date(next.next_due_at)} на балансі не вистачає. Поповніть або збережіть картку для автооплати.`}
                                href="/balance"
                                button="Поповнити"
                            />
                        )}
                    </section>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <section className="min-w-0">
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="font-semibold">Мої сервери</h2>
                            {services.length > 0 && (
                                <Link
                                    href="/services"
                                    className="text-sm text-primary hover:underline"
                                >
                                    Усі
                                </Link>
                            )}
                        </div>
                        {services.length === 0 ? (
                            <Panel>
                                <Empty icon={Server} title="Ще немає серверів">
                                    Оберіть тариф — сервер буде готовий за
                                    хвилину після оплати.
                                    <Button asChild className="mt-4">
                                        <Link href="/">Обрати тариф</Link>
                                    </Button>
                                </Empty>
                            </Panel>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {services.map((s) => (
                                    <ServerCard key={s.id} service={s} />
                                ))}
                            </div>
                        )}
                    </section>

                    <Panel
                        title="Останні операції"
                        flush
                        actions={
                            <Link
                                href="/balance"
                                className="text-sm text-primary hover:underline"
                            >
                                Історія
                            </Link>
                        }
                    >
                        {transactions.length === 0 ? (
                            <p className="px-5 py-6 text-sm text-muted-foreground">
                                Операцій ще немає.
                            </p>
                        ) : (
                            <ul className="divide-y">
                                {transactions.map((t) => {
                                    const income = t.amount.amount > 0;

                                    return (
                                        <li
                                            key={t.id}
                                            className="flex items-center gap-3 px-5 py-3 text-sm"
                                        >
                                            <span
                                                className={cn(
                                                    'grid size-8 shrink-0 place-items-center rounded-full',
                                                    income
                                                        ? 'bg-primary/10 text-primary'
                                                        : 'bg-muted text-muted-foreground',
                                                )}
                                            >
                                                {income ? (
                                                    <ArrowDownLeft className="size-4" />
                                                ) : (
                                                    <ArrowUpRight className="size-4" />
                                                )}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate">
                                                    {t.description}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {date(t.created_at)}
                                                </span>
                                            </span>
                                            <span
                                                className={cn(
                                                    'font-medium whitespace-nowrap tabular-nums',
                                                    income && 'text-primary',
                                                )}
                                            >
                                                {income && '+'}
                                                {t.amount.formatted}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Panel>
                </div>
            </div>
        </>
    );
}

function ServerCard({ service: s }: { service: Service }) {
    const left = daysLeft(s.next_due_at);
    const total = s.period_months * 30;
    const used =
        left === null
            ? 0
            : Math.min(100, Math.max(0, ((total - left) / total) * 100));
    const soon = left !== null && left <= 3;
    const live = s.status === 'active' || s.status === 'suspended';

    return (
        <article className="group flex flex-col rounded-xl border bg-card p-5 shadow-sm transition hover:border-primary/40">
            <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 font-semibold text-primary ring-1 ring-primary/20 ring-inset">
                    {s.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                    <Link
                        href={`/services/${s.id}`}
                        className="block truncate font-semibold hover:text-primary"
                    >
                        {s.name}
                    </Link>
                    <div className="truncate text-sm text-muted-foreground">
                        {s.plan.name}
                    </div>
                </div>
                <ServiceStatusPill status={s.status} />
            </div>

            <div className="mt-4">
                {s.address ? (
                    <button
                        className="inline-flex max-w-full items-center gap-2 rounded-md bg-muted/60 px-2.5 py-1 font-mono text-sm hover:text-primary"
                        onClick={() =>
                            navigator.clipboard
                                .writeText(s.address!)
                                .then(() => toast.success('Адресу скопійовано'))
                        }
                    >
                        <span className="truncate">{s.address}</span>{' '}
                        <Copy className="size-3.5 shrink-0" />
                    </button>
                ) : (
                    <span className="text-sm text-muted-foreground">
                        {s.status === 'pending'
                            ? 'Запуститься після оплати'
                            : 'Адреса з’явиться після створення'}
                    </span>
                )}
            </div>

            {s.status === 'suspended' && (
                <div className="mt-3 flex items-center gap-2 text-sm text-rose-500">
                    <TriangleAlert className="size-4" /> Призупинено, сплатіть
                    рахунок
                </div>
            )}

            {s.next_due_at && (
                <div className="mt-4">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Сплачено до {date(s.next_due_at)}</span>
                        <span
                            className={cn(soon && 'font-medium text-amber-500')}
                        >
                            {left !== null && left >= 0
                                ? `${left} дн.`
                                : 'прострочено'}
                        </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                            className={cn(
                                'h-full rounded-full',
                                soon ? 'bg-amber-500' : 'bg-primary',
                            )}
                            style={{ width: `${used}%` }}
                        />
                    </div>
                </div>
            )}

            <div className="mt-auto flex gap-2 pt-5">
                {live && (
                    <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => router.post(`/services/${s.id}/panel`)}
                    >
                        <ExternalLink className="size-3.5" /> Панель
                    </Button>
                )}
                <Button size="sm" variant="outline" className="flex-1" asChild>
                    <Link href={`/services/${s.id}`}>
                        Керувати <ArrowRight className="size-3.5" />
                    </Link>
                </Button>
            </div>
        </article>
    );
}

function Mini({
    label,
    value,
    tone,
}: {
    label: string;
    value: string | number;
    tone?: string;
}) {
    return (
        <div>
            <div className={cn('text-xl font-semibold tabular-nums', tone)}>
                {value}
            </div>
            <div className="text-xs text-muted-foreground">{label}</div>
        </div>
    );
}

function Action({
    icon: Icon,
    title,
    text,
    href,
    button,
    tone = 'amber',
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    text: string;
    href: string;
    button: string;
    tone?: 'amber' | 'sky';
}) {
    return (
        <div
            className={cn(
                'flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:gap-4',
                tone === 'amber'
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-sky-500/30 bg-sky-500/5',
            )}
        >
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                <span
                    className={cn(
                        'grid size-10 shrink-0 place-items-center rounded-full',
                        tone === 'amber'
                            ? 'bg-amber-500/15 text-amber-500'
                            : 'bg-sky-500/15 text-sky-500',
                    )}
                >
                    <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="font-medium">{title}</div>
                    <div className="text-sm text-muted-foreground">{text}</div>
                </div>
            </div>
            <Button asChild className="w-full sm:w-auto">
                <Link href={href}>{button}</Link>
            </Button>
        </div>
    );
}

Dashboard.layout = { breadcrumbs: [{ title: 'Огляд', href: '/dashboard' }] };
