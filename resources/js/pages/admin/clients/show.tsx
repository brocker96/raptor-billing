import { Head, Link, router, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import InputError from '@/components/input-error';
import {
    date,
    InvoiceStatusPill,
    invoiceType,
    PageHeader,
    Panel,
    ServiceStatusPill,
} from '@/lib/billing';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/billing';
import type { Client, Invoice, Service, Transaction } from '@/types/billing';

export default function ShowClient({
    client,
    services,
    invoices,
    transactions,
}: {
    client: Client;
    services: Service[];
    invoices: Invoice[];
    transactions: Transaction[];
}) {
    const adjust = useForm({ amount: '', description: '' });

    return (
        <>
            <Head title={client.name} />
            <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
                <PageHeader
                    title={client.name}
                    description={`${client.email} · клієнт з ${date(client.created_at)} · ID ${client.id}`}
                />

                <div className="grid gap-6 lg:grid-cols-3">
                    <Panel title="Баланс">
                        <div
                            className={cn(
                                'text-3xl font-semibold',
                                client.balance.amount < 0 && 'text-rose-500',
                            )}
                        >
                            {client.balance.formatted}
                        </div>
                        <form
                            className="mt-4 space-y-2"
                            onSubmit={(e) => {
                                e.preventDefault();
                                adjust.post(
                                    `/admin/clients/${client.id}/balance`,
                                    {
                                        preserveScroll: true,
                                        onSuccess: () => adjust.reset(),
                                    },
                                );
                            }}
                        >
                            <Input
                                type="number"
                                step="0.01"
                                placeholder={`Сума в ${client.currency}, мінус — списати`}
                                value={adjust.data.amount}
                                onChange={(e) =>
                                    adjust.setData('amount', e.target.value)
                                }
                            />
                            <Input
                                placeholder="Причина (видно клієнту)"
                                value={adjust.data.description}
                                onChange={(e) =>
                                    adjust.setData(
                                        'description',
                                        e.target.value,
                                    )
                                }
                            />
                            <InputError
                                message={
                                    adjust.errors.amount ??
                                    adjust.errors.description
                                }
                            />
                            <Button
                                className="w-full"
                                disabled={adjust.processing}
                            >
                                Змінити баланс
                            </Button>
                        </form>
                    </Panel>

                    <Panel title="Доступ" className="lg:col-span-2">
                        <dl className="grid gap-4 text-sm sm:grid-cols-3">
                            <div>
                                <dt className="text-xs text-muted-foreground">
                                    Email
                                </dt>
                                <dd>
                                    {client.email_verified
                                        ? 'підтверджено'
                                        : 'не підтверджено'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground">
                                    Валюта
                                </dt>
                                <dd>{client.currency}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground">
                                    У панелі
                                </dt>
                                <dd className="font-mono">
                                    client-{client.id}
                                </dd>
                            </div>
                        </dl>
                        <label className="mt-6 flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                            <span>
                                <span className="block font-medium">
                                    Адміністратор білінгу
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    Повний доступ до цього розділу
                                </span>
                            </span>
                            <Switch
                                checked={client.is_admin}
                                onChange={(v) =>
                                    router.patch(
                                        `/admin/clients/${client.id}`,
                                        { is_admin: v },
                                        { preserveScroll: true },
                                    )
                                }
                            />
                        </label>
                    </Panel>
                </div>

                <Panel title="Сервери" flush>
                    <ul className="divide-y">
                        {services.map((s) => (
                            <li key={s.id}>
                                <Link
                                    href={`/admin/services/${s.id}`}
                                    className="flex items-center gap-4 px-5 py-3 text-sm hover:bg-muted/40"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-medium">
                                            {s.name}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {s.plan.name} · {s.price.formatted}{' '}
                                            / {s.period.toLowerCase()} · до{' '}
                                            {date(s.next_due_at)}
                                        </span>
                                    </span>
                                    <ServiceStatusPill status={s.status} />
                                </Link>
                            </li>
                        ))}
                        {services.length === 0 && (
                            <li className="px-5 py-6 text-sm text-muted-foreground">
                                Серверів немає
                            </li>
                        )}
                    </ul>
                </Panel>

                <div className="grid gap-6 lg:grid-cols-2">
                    <Panel title="Рахунки" flush>
                        <ul className="divide-y">
                            {invoices.map((i) => (
                                <li
                                    key={i.id}
                                    className="flex items-center gap-3 px-5 py-3 text-sm"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-medium">
                                            {i.number}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {invoiceType[i.type]} ·{' '}
                                            {date(i.created_at)}
                                        </span>
                                    </span>
                                    <span className="font-medium whitespace-nowrap">
                                        {i.total.formatted}
                                    </span>
                                    <InvoiceStatusPill status={i.status} />
                                </li>
                            ))}
                        </ul>
                    </Panel>
                    <Panel title="Операції з балансом" flush>
                        <ul className="divide-y">
                            {transactions.map((t) => (
                                <li
                                    key={t.id}
                                    className="flex items-center gap-3 px-5 py-3 text-sm"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate">
                                            {t.description}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {date(t.created_at, true)}
                                        </span>
                                    </span>
                                    <span
                                        className={cn(
                                            'font-medium whitespace-nowrap',
                                            t.amount.amount > 0 &&
                                                'text-primary',
                                        )}
                                    >
                                        {t.amount.amount > 0 && '+'}
                                        {t.amount.formatted}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </Panel>
                </div>
            </div>
        </>
    );
}

ShowClient.layout = {
    breadcrumbs: [{ title: 'Клієнти', href: '/admin/clients' }],
};
