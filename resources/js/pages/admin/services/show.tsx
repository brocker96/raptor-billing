import { Head, Link, router, useForm } from '@inertiajs/react';
import { Pause, Play, RefreshCw, Rocket, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    date,
    InvoiceStatusPill,
    invoiceType,
    PageHeader,
    Panel,
    ServiceStatusPill,
} from '@/lib/billing';
import { Notice, Switch } from '@/components/billing';
import type { Invoice, Service } from '@/types/billing';

export default function AdminService({
    service,
    invoices,
}: {
    service: Service;
    invoices: Invoice[];
}) {
    const [busy, setBusy] = useState<string | null>(null);
    const form = useForm({
        next_due_at: service.next_due_at?.slice(0, 10) ?? '',
        amount: String(service.price.amount / 100),
    });
    const run = (action: string, extra: Record<string, string> = {}) =>
        router.post(
            `/admin/services/${service.id}/action`,
            { action, ...extra },
            {
                preserveScroll: true,
                onStart: () => setBusy(action),
                onFinish: () => setBusy(null),
            },
        );

    return (
        <>
            <Head title={service.name} />
            <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
                <PageHeader
                    title={service.name}
                    description={
                        <span className="inline-flex flex-wrap items-center gap-2">
                            <ServiceStatusPill status={service.status} />
                            <span className="font-mono">svc-{service.id}</span>
                            {service.user && (
                                <Link
                                    href={`/admin/clients/${service.user.id}`}
                                    className="hover:text-primary"
                                >
                                    {service.user.email}
                                </Link>
                            )}
                        </span>
                    }
                    actions={
                        <>
                            <Button
                                variant="outline"
                                disabled={!!busy}
                                onClick={() => run('sync')}
                            >
                                <RefreshCw className="size-4" /> Синхронізувати
                            </Button>
                            {['pending', 'failed', 'provisioning'].includes(
                                service.status,
                            ) && (
                                <Button
                                    disabled={!!busy}
                                    onClick={() => run('provision')}
                                >
                                    <Rocket className="size-4" /> Створити в
                                    панелі
                                </Button>
                            )}
                            {service.status === 'active' && (
                                <Button
                                    variant="outline"
                                    disabled={!!busy}
                                    onClick={() => {
                                        const reason = prompt(
                                            'Причина (побачить клієнт)',
                                            'Призупинено адміністратором.',
                                        );
                                        if (reason !== null)
                                            run('suspend', { reason });
                                    }}
                                >
                                    <Pause className="size-4" /> Призупинити
                                </Button>
                            )}
                            {service.status === 'suspended' && (
                                <Button
                                    disabled={!!busy}
                                    onClick={() => run('unsuspend')}
                                >
                                    <Play className="size-4" /> Відновити
                                </Button>
                            )}
                            {!['terminated', 'cancelled'].includes(
                                service.status,
                            ) && (
                                <Button
                                    variant="destructive"
                                    disabled={!!busy}
                                    onClick={() =>
                                        confirm(
                                            'Видалити сервер у панелі назавжди?',
                                        ) && run('terminate')
                                    }
                                >
                                    <Trash2 className="size-4" /> Видалити
                                </Button>
                            )}
                        </>
                    }
                />

                {service.last_error && (
                    <Notice tone="red">
                        Остання помилка панелі: {service.last_error}
                    </Notice>
                )}

                <div className="grid gap-6 lg:grid-cols-3">
                    <Panel title="У панелі" className="lg:col-span-2">
                        <dl className="grid gap-4 text-sm sm:grid-cols-3">
                            <Item label="Адреса" mono>
                                {service.address}
                            </Item>
                            <Item label="Ідентифікатор" mono>
                                {service.identifier}
                            </Item>
                            <Item label="Тариф">
                                {service.plan.name}
                                {service.next_plan &&
                                    ` → ${service.next_plan.name}`}
                            </Item>
                            <Item label="Замовлено">
                                {date(service.created_at, true)}
                            </Item>
                            <Item label="Створено в панелі">
                                {date(service.activated_at, true)}
                            </Item>
                            <Item label="Період">{service.period}</Item>
                        </dl>
                    </Panel>
                    <Panel title="Оплата">
                        <form
                            className="space-y-3"
                            onSubmit={(e) => {
                                e.preventDefault();
                                form.patch(`/admin/services/${service.id}`, {
                                    preserveScroll: true,
                                });
                            }}
                        >
                            <div className="grid gap-1.5">
                                <Label>Сплачено до</Label>
                                <Input
                                    type="date"
                                    value={form.data.next_due_at}
                                    onChange={(e) =>
                                        form.setData(
                                            'next_due_at',
                                            e.target.value,
                                        )
                                    }
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <Label>
                                    Ціна за період, {service.price.currency}
                                </Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={form.data.amount}
                                    onChange={(e) =>
                                        form.setData('amount', e.target.value)
                                    }
                                />
                            </div>
                            <Button
                                className="w-full"
                                disabled={form.processing}
                            >
                                Зберегти
                            </Button>
                        </form>
                        <label className="mt-4 flex items-center justify-between text-sm">
                            Автопродовження
                            <Switch
                                checked={service.auto_renew}
                                onChange={(v) =>
                                    router.patch(
                                        `/admin/services/${service.id}`,
                                        { auto_renew: v },
                                        { preserveScroll: true },
                                    )
                                }
                            />
                        </label>
                    </Panel>
                </div>

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
                                <span className="font-medium">
                                    {i.total.formatted}
                                </span>
                                <InvoiceStatusPill status={i.status} />
                            </li>
                        ))}
                    </ul>
                </Panel>
            </div>
        </>
    );
}

function Item({
    label,
    mono,
    children,
}: {
    label: string;
    mono?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className={mono ? 'mt-0.5 font-mono' : 'mt-0.5'}>
                {children || '—'}
            </dd>
        </div>
    );
}

AdminService.layout = {
    breadcrumbs: [{ title: 'Сервери', href: '/admin/services' }],
};
