import { Head, Link } from '@inertiajs/react';
import { Receipt } from 'lucide-react';
import { Pagination } from '@/components/pagination';
import {
    date,
    Empty,
    InvoiceStatusPill,
    invoiceType,
    PageHeader,
    Panel,
} from '@/lib/billing';
import type { Invoice, Paginated } from '@/types/billing';

export default function Invoices({
    invoices,
}: {
    invoices: Paginated<Invoice>;
}) {
    return (
        <>
            <Head title="Рахунки" />
            <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Рахунки"
                    description="Замовлення, продовження та зміни тарифів."
                />
                <Panel flush>
                    {invoices.data.length === 0 ? (
                        <Empty icon={Receipt} title="Рахунків ще немає" />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left text-xs text-muted-foreground">
                                    <tr className="border-b">
                                        <th className="px-5 py-3 font-medium">
                                            Номер
                                        </th>
                                        <th className="px-5 py-3 font-medium">
                                            Призначення
                                        </th>
                                        <th className="hidden px-5 py-3 font-medium md:table-cell">
                                            Дата
                                        </th>
                                        <th className="px-5 py-3 text-right font-medium">
                                            Сума
                                        </th>
                                        <th className="px-5 py-3 font-medium">
                                            Статус
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {invoices.data.map((invoice) => (
                                        <tr
                                            key={invoice.id}
                                            className="hover:bg-muted/40"
                                        >
                                            <td className="px-5 py-3 font-medium whitespace-nowrap">
                                                <Link
                                                    href={`/invoices/${invoice.id}`}
                                                    className="hover:text-primary"
                                                >
                                                    {invoice.number}
                                                </Link>
                                            </td>
                                            <td className="px-5 py-3">
                                                {invoiceType[invoice.type]}
                                                {invoice.service && (
                                                    <span className="text-muted-foreground">
                                                        {' '}
                                                        · {invoice.service.name}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="hidden px-5 py-3 text-muted-foreground md:table-cell">
                                                {date(invoice.created_at)}
                                            </td>
                                            <td className="px-5 py-3 text-right font-medium whitespace-nowrap">
                                                {invoice.total.formatted}
                                            </td>
                                            <td className="px-5 py-3">
                                                <InvoiceStatusPill
                                                    status={invoice.status}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <Pagination page={invoices} />
                </Panel>
            </div>
        </>
    );
}

Invoices.layout = { breadcrumbs: [{ title: 'Рахунки', href: '/invoices' }] };
