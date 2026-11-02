import { cn } from '@/lib/utils';
import type { Invoice, ServiceStatus } from '@/types/billing';

const tones = {
    green: 'bg-primary/10 text-primary ring-primary/25',
    yellow: 'bg-amber-500/10 text-amber-500 ring-amber-500/25 dark:text-amber-300',
    red: 'bg-rose-500/10 text-rose-500 ring-rose-500/25 dark:text-rose-300',
    blue: 'bg-sky-500/10 text-sky-600 ring-sky-500/25 dark:text-sky-300',
    gray: 'bg-muted text-muted-foreground ring-border',
};

export function Pill({
    tone = 'gray',
    dot,
    children,
    className,
}: {
    tone?: keyof typeof tones;
    dot?: boolean;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
                tones[tone],
                className,
            )}
        >
            {dot && <span className="size-1.5 rounded-full bg-current" />}
            {children}
        </span>
    );
}

const serviceStatus: Record<ServiceStatus, [string, keyof typeof tones]> = {
    pending: ['Очікує оплати', 'yellow'],
    provisioning: ['Створюється', 'blue'],
    active: ['Активний', 'green'],
    suspended: ['Призупинено', 'red'],
    terminated: ['Видалено', 'gray'],
    cancelled: ['Скасовано', 'gray'],
    failed: ['Помилка створення', 'red'],
};

export function ServiceStatusPill({ status }: { status: ServiceStatus }) {
    const [label, tone] = serviceStatus[status];

    return (
        <Pill
            tone={tone}
            dot={status === 'active' || status === 'provisioning'}
        >
            {label}
        </Pill>
    );
}

const invoiceStatus: Record<Invoice['status'], [string, keyof typeof tones]> = {
    unpaid: ['Не сплачено', 'yellow'],
    paid: ['Сплачено', 'green'],
    cancelled: ['Скасовано', 'gray'],
};

export function InvoiceStatusPill({ status }: { status: Invoice['status'] }) {
    const [label, tone] = invoiceStatus[status];

    return <Pill tone={tone}>{label}</Pill>;
}

export const invoiceType: Record<Invoice['type'], string> = {
    order: 'Замовлення',
    renewal: 'Продовження',
    upgrade: 'Зміна тарифу',
    topup: 'Поповнення',
};

export function date(
    value: string | null | undefined,
    withTime = false,
): string {
    if (!value) {
        return '—';
    }

    return new Intl.DateTimeFormat(
        'uk-UA',
        withTime
            ? { dateStyle: 'medium', timeStyle: 'short' }
            : { dateStyle: 'medium' },
    ).format(new Date(value));
}

export function daysLeft(value: string | null): number | null {
    return value
        ? Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000)
        : null;
}

export function PageHeader({
    title,
    description,
    actions,
}: {
    title: string;
    description?: React.ReactNode;
    actions?: React.ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                    {title}
                </h1>
                {description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
    );
}

export function Panel({
    title,
    description,
    actions,
    children,
    className,
    flush,
}: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    flush?: boolean;
}) {
    return (
        <section
            className={cn(
                'rounded-xl border bg-card text-card-foreground shadow-sm',
                className,
            )}
        >
            {(title || actions) && (
                <header className="flex flex-wrap items-start gap-3 px-5 pt-5">
                    <div className="min-w-0 flex-1">
                        {title && <h2 className="font-semibold">{title}</h2>}
                        {description && (
                            <p className="mt-0.5 text-sm text-muted-foreground">
                                {description}
                            </p>
                        )}
                    </div>
                    {actions}
                </header>
            )}
            <div
                className={
                    flush ? cn((title || actions) && 'mt-4 border-t') : 'p-5'
                }
            >
                {children}
            </div>
        </section>
    );
}

export function Empty({
    icon: Icon,
    title,
    children,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    children?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 ring-1 ring-primary/20 ring-inset">
                <Icon className="size-5 text-primary" />
            </span>
            <p className="mt-4 font-medium">{title}</p>
            {children && (
                <div className="mt-1 max-w-sm text-sm text-muted-foreground">
                    {children}
                </div>
            )}
        </div>
    );
}
