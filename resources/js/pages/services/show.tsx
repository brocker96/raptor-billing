import { Deferred, Head, Link, router, useForm } from '@inertiajs/react';
import {
    Copy,
    ExternalLink,
    Gauge,
    Loader2,
    Pencil,
    RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
    date,
    daysLeft,
    InvoiceStatusPill,
    invoiceType,
    PageHeader,
    Panel,
    ServiceStatusPill,
} from '@/lib/billing';
import { bytes, uptime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Invoice, Plan, Service } from '@/types/billing';
import { Notice, Switch } from '@/components/billing';

type Resources = {
    state: string;
    cpu: number;
    memory_bytes: number;
    memory_limit_bytes: number;
    disk_bytes: number;
    network_rx_bytes: number;
    network_tx_bytes: number;
    uptime_ms: number;
} | null;

export default function ShowService({
    service,
    invoices,
    plans,
    resources,
}: {
    service: Service;
    invoices: Invoice[];
    plans: Plan[];
    resources?: Resources;
}) {
    const [renaming, setRenaming] = useState(false);
    const [opening, setOpening] = useState(false);
    const rename = useForm({ name: service.name });
    const left = daysLeft(service.next_due_at);
    const live = service.status === 'active' || service.status === 'suspended';

    return (
        <>
            <Head title={service.name} />
            <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
                <PageHeader
                    title={service.name}
                    description={
                        <span className="inline-flex flex-wrap items-center gap-2">
                            <ServiceStatusPill status={service.status} />{' '}
                            {service.plan.name}
                        </span>
                    }
                    actions={
                        <>
                            <Button
                                variant="outline"
                                onClick={() => setRenaming(true)}
                            >
                                <Pencil className="size-4" /> Перейменувати
                            </Button>
                            {live && (
                                <Button
                                    disabled={opening}
                                    onClick={() =>
                                        router.post(
                                            `/services/${service.id}/panel`,
                                            {},
                                            {
                                                onStart: () => setOpening(true),
                                                onFinish: () =>
                                                    setOpening(false),
                                            },
                                        )
                                    }
                                >
                                    {opening ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <ExternalLink className="size-4" />
                                    )}{' '}
                                    Відкрити в панелі
                                </Button>
                            )}
                        </>
                    }
                />

                {service.status === 'suspended' && (
                    <Notice tone="red">
                        Сервер призупинено через неоплачений рахунок. Сплатіть
                        його — сервер увімкнеться автоматично.
                    </Notice>
                )}
                {service.status === 'pending' && (
                    <Notice tone="amber">
                        Сервер буде створено одразу після оплати рахунку.
                    </Notice>
                )}
                {service.status === 'provisioning' && (
                    <Notice tone="blue">
                        Сервер створюється на вузлі, це займає до кількох
                        хвилин.
                    </Notice>
                )}
                {service.status === 'failed' && (
                    <Notice tone="red">
                        Не вдалося створити сервер. Ми вже бачимо проблему і
                        вирішимо її, гроші не втрачено.
                    </Notice>
                )}

                <div className="grid gap-6 lg:grid-cols-3">
                    <Panel title="Підключення" className="lg:col-span-2">
                        <dl className="grid gap-4 sm:grid-cols-2">
                            <Field label="Адреса">
                                {service.address ? (
                                    <button
                                        className="inline-flex items-center gap-2 font-mono hover:text-primary"
                                        onClick={() =>
                                            navigator.clipboard
                                                .writeText(service.address!)
                                                .then(() =>
                                                    toast.success(
                                                        'Адресу скопійовано',
                                                    ),
                                                )
                                        }
                                    >
                                        {service.address}{' '}
                                        <Copy className="size-3.5" />
                                    </button>
                                ) : (
                                    '—'
                                )}
                            </Field>
                            <Field label="Ідентифікатор">
                                {service.identifier ? (
                                    <span className="font-mono">
                                        {service.identifier}
                                    </span>
                                ) : (
                                    '—'
                                )}
                            </Field>
                            <Field label="Створено">
                                {date(
                                    service.activated_at ?? service.created_at,
                                )}
                            </Field>
                            <Field label="Тариф">
                                {service.plan.name}
                                {service.next_plan && (
                                    <span className="block text-xs text-muted-foreground">
                                        з наступного періоду:{' '}
                                        {service.next_plan.name}
                                    </span>
                                )}
                            </Field>
                        </dl>

                        {service.status === 'active' && (
                            <div className="mt-6 border-t pt-5">
                                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                                    <Gauge className="size-4 text-primary" />{' '}
                                    Навантаження зараз
                                    <button
                                        className="ml-auto text-muted-foreground hover:text-foreground"
                                        onClick={() =>
                                            router.reload({
                                                only: ['resources'],
                                            })
                                        }
                                        aria-label="Оновити"
                                    >
                                        <RefreshCw className="size-3.5" />
                                    </button>
                                </div>
                                <Deferred
                                    data="resources"
                                    fallback={
                                        <Skeleton className="h-16 w-full" />
                                    }
                                >
                                    <Usage resources={resources ?? null} />
                                </Deferred>
                            </div>
                        )}
                    </Panel>

                    <Panel title="Оплата">
                        <div className="text-2xl font-semibold">
                            {service.price.formatted}
                        </div>
                        <div className="text-sm text-muted-foreground">
                            за {service.period.toLowerCase()}
                        </div>
                        <dl className="mt-4 space-y-3 text-sm">
                            <Field label="Сплачено до">
                                <span
                                    className={cn(
                                        left !== null &&
                                            left <= 3 &&
                                            'text-amber-500',
                                    )}
                                >
                                    {date(service.next_due_at)}
                                    {left !== null &&
                                        left >= 0 &&
                                        ` (${left} дн.)`}
                                </span>
                            </Field>
                        </dl>
                        <label className="mt-4 flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                            <span>
                                <span className="block font-medium">
                                    Автопродовження
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {service.auto_renew
                                        ? 'Рахунок сплатиться з балансу або картки'
                                        : 'Сервер видалиться після оплаченого періоду'}
                                </span>
                            </span>
                            <Switch
                                checked={service.auto_renew}
                                onChange={(v) =>
                                    router.patch(
                                        `/services/${service.id}`,
                                        { auto_renew: v },
                                        { preserveScroll: true },
                                    )
                                }
                            />
                        </label>
                    </Panel>
                </div>

                {service.status === 'active' && plans.length > 0 && (
                    <Panel
                        title="Змінити тариф"
                        description="Більший тариф діє одразу, доплата лише за дні, що залишилися. Менший — з наступного періоду."
                    >
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {plans.map((plan) => {
                                const price = plan.prices.find(
                                    (p) =>
                                        p.period_months ===
                                        service.period_months,
                                )!;
                                const up = price.amount > service.price.amount;

                                return (
                                    <div
                                        key={plan.id}
                                        className="flex flex-col rounded-lg border p-4"
                                    >
                                        <div className="font-medium">
                                            {plan.name}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {price.formatted} /{' '}
                                            {service.period.toLowerCase()}
                                        </div>
                                        <ul className="mt-2 flex-1 space-y-0.5 text-xs text-muted-foreground">
                                            {plan.features
                                                .slice(0, 3)
                                                .map((f) => (
                                                    <li key={f}>{f}</li>
                                                ))}
                                        </ul>
                                        <Button
                                            size="sm"
                                            variant={up ? 'default' : 'outline'}
                                            className="mt-3"
                                            onClick={() =>
                                                router.post(
                                                    `/services/${service.id}/plan`,
                                                    { plan_id: plan.id },
                                                    { preserveScroll: true },
                                                )
                                            }
                                        >
                                            {up
                                                ? 'Перейти зараз'
                                                : 'З наступного періоду'}
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    </Panel>
                )}

                <Panel title="Рахунки сервера" flush>
                    <ul className="divide-y">
                        {invoices.map((invoice) => (
                            <li key={invoice.id}>
                                <Link
                                    href={`/invoices/${invoice.id}`}
                                    className="flex items-center gap-4 px-5 py-3 text-sm hover:bg-muted/40"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-medium">
                                            {invoice.number}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {invoiceType[invoice.type]} ·{' '}
                                            {date(invoice.created_at)}
                                        </span>
                                    </span>
                                    <span className="font-medium">
                                        {invoice.total.formatted}
                                    </span>
                                    <InvoiceStatusPill
                                        status={invoice.status}
                                    />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </Panel>
            </div>

            <Dialog open={renaming} onOpenChange={setRenaming}>
                <DialogContent>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            rename.patch(`/services/${service.id}`, {
                                onSuccess: () => setRenaming(false),
                            });
                        }}
                    >
                        <DialogHeader>
                            <DialogTitle>Назва сервера</DialogTitle>
                            <DialogDescription>
                                Назва зміниться і в кабінеті, і в панелі.
                            </DialogDescription>
                        </DialogHeader>
                        <Input
                            className="my-4"
                            value={rename.data.name}
                            maxLength={64}
                            onChange={(e) =>
                                rename.setData('name', e.target.value)
                            }
                        />
                        <DialogFooter>
                            <Button disabled={rename.processing}>
                                Зберегти
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

function Usage({ resources }: { resources: Resources }) {
    if (!resources) {
        return (
            <p className="text-sm text-muted-foreground">
                Вузол зараз не відповідає, дані з’являться пізніше.
            </p>
        );
    }
    const memory = resources.memory_limit_bytes
        ? (resources.memory_bytes / resources.memory_limit_bytes) * 100
        : 0;

    return (
        <div className="grid gap-4 sm:grid-cols-4">
            <Meter
                label="CPU"
                value={`${resources.cpu.toFixed(1)}%`}
                percent={Math.min(100, resources.cpu)}
            />
            <Meter
                label="RAM"
                value={`${bytes(resources.memory_bytes)} / ${bytes(resources.memory_limit_bytes)}`}
                percent={memory}
            />
            <Meter label="Диск" value={bytes(resources.disk_bytes)} />
            <Meter
                label="Аптайм"
                value={
                    resources.state === 'running'
                        ? uptime(resources.uptime_ms)
                        : 'вимкнено'
                }
            />
        </div>
    );
}

function Meter({
    label,
    value,
    percent,
}: {
    label: string;
    value: string;
    percent?: number;
}) {
    return (
        <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-0.5 text-sm font-medium">{value}</div>
            {percent !== undefined && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                        className={cn(
                            'h-full rounded-full',
                            percent > 85 ? 'bg-rose-500' : 'bg-primary',
                        )}
                        style={{ width: `${percent}%` }}
                    />
                </div>
            )}
        </div>
    );
}

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5">{children}</dd>
        </div>
    );
}

ShowService.layout = {
    breadcrumbs: [{ title: 'Мої сервери', href: '/services' }],
};
