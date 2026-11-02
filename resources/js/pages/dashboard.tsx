import { Head, Link } from '@inertiajs/react';
import {
    ArrowRight,
    CreditCard,
    Plus,
    Receipt,
    Server,
    Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { date, Empty, invoiceType, PageHeader, Panel } from '@/lib/billing';
import type { Invoice, Money, Service } from '@/types/billing';
import { ServiceList } from '@/components/billing';

export default function Dashboard({
    balance,
    services,
    unpaid,
}: {
    balance: Money;
    services: Service[];
    unpaid: Invoice[];
}) {
    const active = services.filter((s) => s.status === 'active').length;
    const next = services
        .filter((s) => s.next_due_at && s.auto_renew)
        .sort((a, b) => (a.next_due_at! < b.next_due_at! ? -1 : 1))[0];
    const debt = unpaid.reduce((sum, i) => sum + i.total.amount, 0);

    return (
        <>
            <Head title="Огляд" />
            <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Огляд"
                    description="Ваші сервери, рахунки та баланс в одному місці."
                    actions={
                        <Button asChild>
                            <Link href="/">
                                <Plus className="size-4" /> Новий сервер
                            </Link>
                        </Button>
                    }
                />

                <div className="grid gap-4 sm:grid-cols-3">
                    <Stat
                        icon={Wallet}
                        label="Баланс"
                        value={balance.formatted}
                        href="/balance"
                        action="Поповнити"
                    />
                    <Stat
                        icon={Server}
                        label="Активні сервери"
                        value={String(active)}
                        href="/services"
                        action="Усі сервери"
                    />
                    <Stat
                        icon={CreditCard}
                        label="Наступне списання"
                        value={next ? next.price.formatted : '—'}
                        hint={
                            next
                                ? `${next.name}, ${date(next.next_due_at)}`
                                : 'Немає запланованих'
                        }
                    />
                </div>

                {unpaid.length > 0 && (
                    <Panel
                        title="Сплатіть, щоб сервер запрацював"
                        description={`Разом ${new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2 }).format(debt / 100)} ${unpaid[0].total.currency}`}
                        className="border-amber-500/30"
                        flush
                    >
                        <ul className="divide-y">
                            {unpaid.map((invoice) => (
                                <li key={invoice.id}>
                                    <Link
                                        href={`/invoices/${invoice.id}`}
                                        className="flex items-center gap-4 px-5 py-3 hover:bg-muted/40"
                                    >
                                        <Receipt className="size-4 text-amber-500" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block font-medium">
                                                {invoice.number}
                                            </span>
                                            <span className="text-sm text-muted-foreground">
                                                {invoiceType[invoice.type]}
                                                {invoice.service &&
                                                    ` · ${invoice.service.name}`}{' '}
                                                · до {date(invoice.due_at)}
                                            </span>
                                        </span>
                                        <span className="font-semibold">
                                            {invoice.total.formatted}
                                        </span>
                                        <span className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
                                            Сплатити
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </Panel>
                )}

                <Panel
                    title="Мої сервери"
                    flush
                    actions={
                        services.length > 0 && (
                            <Button asChild variant="ghost" size="sm">
                                <Link href="/services">Усі</Link>
                            </Button>
                        )
                    }
                >
                    {services.length === 0 ? (
                        <Empty icon={Server} title="Ще немає серверів">
                            Оберіть тариф у магазині — сервер з'явиться тут за
                            хвилину після оплати.
                            <Button asChild className="mt-4">
                                <Link href="/">Обрати тариф</Link>
                            </Button>
                        </Empty>
                    ) : (
                        <ServiceList services={services} />
                    )}
                </Panel>
            </div>
        </>
    );
}

function Stat({
    icon: Icon,
    label,
    value,
    hint,
    href,
    action,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    hint?: string;
    href?: string;
    action?: string;
}) {
    return (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="size-4" /> {label}
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">
                {value}
            </div>
            {hint && (
                <div className="mt-1 truncate text-sm text-muted-foreground">
                    {hint}
                </div>
            )}
            {href && (
                <Link
                    href={href}
                    className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                    {action} <ArrowRight className="size-3.5" />
                </Link>
            )}
        </div>
    );
}

Dashboard.layout = { breadcrumbs: [{ title: 'Огляд', href: '/dashboard' }] };
