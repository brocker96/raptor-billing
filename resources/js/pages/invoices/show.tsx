import { Head, Link, usePage, useForm } from '@inertiajs/react';
import {
    CheckCircle2,
    CreditCard,
    Loader2,
    Printer,
    Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { date, InvoiceStatusPill, invoiceType, Panel } from '@/lib/billing';
import type { Invoice, Money } from '@/types/billing';

export default function ShowInvoice({
    invoice,
    balance,
    missing,
    has_card,
}: {
    invoice: Invoice;
    balance: Money;
    missing: Money;
    has_card: boolean;
}) {
    const { name, auth } = usePage<{
        name: string;
        auth: { user: { name: string; email: string } };
    }>().props;
    const form = useForm({ save_card: !has_card });
    const fromBalance = missing.amount === 0;

    return (
        <>
            <Head title={`Рахунок ${invoice.number}`} />
            <div className="mx-auto grid w-full max-w-5xl gap-6 p-4 md:p-6 lg:grid-cols-[1fr_320px]">
                <Panel className="print:border-0 print:shadow-none">
                    <div className="flex flex-wrap items-start gap-4">
                        <div className="flex-1">
                            <div className="text-sm text-muted-foreground">
                                {invoiceType[invoice.type]}
                            </div>
                            <h1 className="text-2xl font-semibold tracking-tight">
                                Рахунок {invoice.number}
                            </h1>
                        </div>
                        <InvoiceStatusPill status={invoice.status} />
                    </div>

                    <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
                        <div>
                            <dt className="text-xs text-muted-foreground">
                                Виконавець
                            </dt>
                            <dd className="mt-0.5 font-medium">{name}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">
                                Клієнт
                            </dt>
                            <dd className="mt-0.5 font-medium">
                                {auth.user.name}
                            </dd>
                            <dd className="text-muted-foreground">
                                {auth.user.email}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">
                                {invoice.paid_at ? 'Сплачено' : 'Сплатити до'}
                            </dt>
                            <dd className="mt-0.5 font-medium">
                                {date(
                                    invoice.paid_at ?? invoice.due_at,
                                    !!invoice.paid_at,
                                )}
                            </dd>
                            <dd className="text-muted-foreground">
                                виставлено {date(invoice.created_at)}
                            </dd>
                        </div>
                    </dl>

                    <table className="mt-8 w-full text-sm">
                        <thead>
                            <tr className="border-b text-left text-xs text-muted-foreground">
                                <th className="pb-2 font-medium">Опис</th>
                                <th className="pb-2 text-right font-medium">
                                    Сума
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {invoice.items?.map((item, i) => (
                                <tr key={i}>
                                    <td className="py-3 pr-4">
                                        {item.description}
                                    </td>
                                    <td className="py-3 text-right whitespace-nowrap">
                                        {item.formatted}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t text-sm">
                            {invoice.discount.amount > 0 && (
                                <>
                                    <tr>
                                        <td className="pt-3 text-muted-foreground">
                                            Разом
                                        </td>
                                        <td className="pt-3 text-right">
                                            {invoice.subtotal.formatted}
                                        </td>
                                    </tr>
                                    <tr className="text-primary">
                                        <td className="pt-1">Знижка</td>
                                        <td className="pt-1 text-right">
                                            −{invoice.discount.formatted}
                                        </td>
                                    </tr>
                                </>
                            )}
                            <tr className="text-base font-semibold">
                                <td className="pt-3">До сплати</td>
                                <td className="pt-3 text-right">
                                    {invoice.total.formatted}
                                </td>
                            </tr>
                        </tfoot>
                    </table>

                    {invoice.service && (
                        <p className="mt-8 text-sm text-muted-foreground">
                            Сервер:{' '}
                            <Link
                                href={`/services/${invoice.service.id}`}
                                className="text-foreground hover:text-primary"
                            >
                                {invoice.service.name}
                            </Link>
                        </p>
                    )}
                </Panel>

                <aside className="space-y-4 print:hidden">
                    {invoice.status === 'unpaid' ? (
                        <Panel title="Оплата">
                            <dl className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground">
                                        Рахунок
                                    </dt>
                                    <dd>{invoice.total.formatted}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground">
                                        На балансі
                                    </dt>
                                    <dd>{balance.formatted}</dd>
                                </div>
                                {!fromBalance && (
                                    <div className="flex justify-between border-t pt-2 font-semibold">
                                        <dt>Доплатити карткою</dt>
                                        <dd>{missing.formatted}</dd>
                                    </div>
                                )}
                            </dl>
                            {!fromBalance && (
                                <label className="mt-4 flex items-start gap-2 text-sm">
                                    <Checkbox
                                        checked={form.data.save_card}
                                        onCheckedChange={(v) =>
                                            form.setData(
                                                'save_card',
                                                v === true,
                                            )
                                        }
                                        className="mt-0.5"
                                    />
                                    <span>
                                        Зберегти картку для автоматичного
                                        продовження
                                    </span>
                                </label>
                            )}
                            <Button
                                className="mt-4 w-full"
                                size="lg"
                                disabled={form.processing}
                                onClick={() =>
                                    form.post(`/invoices/${invoice.id}/pay`)
                                }
                            >
                                {form.processing ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : fromBalance ? (
                                    <Wallet className="size-4" />
                                ) : (
                                    <CreditCard className="size-4" />
                                )}
                                {fromBalance
                                    ? 'Сплатити з балансу'
                                    : `Сплатити ${missing.formatted}`}
                            </Button>
                            {!fromBalance && (
                                <p className="mt-3 text-center text-xs text-muted-foreground">
                                    Visa, Mastercard, Apple Pay, Google Pay
                                    через plata by mono
                                </p>
                            )}
                        </Panel>
                    ) : (
                        invoice.status === 'paid' && (
                            <Panel>
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 className="size-8 text-primary" />
                                    <div>
                                        <div className="font-medium">
                                            Рахунок сплачено
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {date(invoice.paid_at, true)}
                                        </div>
                                    </div>
                                </div>
                            </Panel>
                        )
                    )}
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => window.print()}
                    >
                        <Printer className="size-4" /> Друк / PDF
                    </Button>
                </aside>
            </div>
        </>
    );
}

ShowInvoice.layout = { breadcrumbs: [{ title: 'Рахунки', href: '/invoices' }] };
