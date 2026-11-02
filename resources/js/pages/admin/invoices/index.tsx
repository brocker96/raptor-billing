import { Head, Link, router } from '@inertiajs/react';
import { Receipt } from 'lucide-react';
import { Filters } from '@/components/filters';
import { Pagination } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import {
    date,
    Empty,
    InvoiceStatusPill,
    invoiceType,
    PageHeader,
    Panel,
} from '@/lib/billing';
import type { Invoice, Paginated } from '@/types/billing';

const tabs: [string, string][] = [
    ['', 'Усі'],
    ['unpaid', 'Не сплачені'],
    ['paid', 'Сплачені'],
    ['cancelled', 'Скасовані'],
];

export default function AdminInvoices({
    invoices,
    filters,
}: {
    invoices: Paginated<Invoice>;
    filters: { status: string };
}) {
    return (
        <>
            <Head title="Рахунки" />
            <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Рахунки"
                    description={`Знайдено: ${invoices.total}`}
                />
                <Filters url="/admin/invoices" query={filters} tabs={tabs} />
                <Panel flush>
                    {invoices.data.length === 0 ? (
                        <Empty icon={Receipt} title="Рахунків немає" />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left text-xs text-muted-foreground">
                                    <tr className="border-b">
                                        <th className="px-5 py-3 font-medium">
                                            Номер
                                        </th>
                                        <th className="px-5 py-3 font-medium">
                                            Клієнт
                                        </th>
                                        <th className="hidden px-5 py-3 font-medium md:table-cell">
                                            Призначення
                                        </th>
                                        <th className="hidden px-5 py-3 font-medium md:table-cell">
                                            Термін
                                        </th>
                                        <th className="px-5 py-3 text-right font-medium">
                                            Сума
                                        </th>
                                        <th className="px-5 py-3 font-medium">
                                            Статус
                                        </th>
                                        <th className="px-5 py-3" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {invoices.data.map((i) => (
                                        <tr key={i.id}>
                                            <td className="px-5 py-3 font-medium whitespace-nowrap">
                                                {i.number}
                                            </td>
                                            <td className="px-5 py-3">
                                                {i.user && (
                                                    <Link
                                                        href={`/admin/clients/${i.user.id}`}
                                                        className="hover:text-primary"
                                                    >
                                                        {i.user.email}
                                                    </Link>
                                                )}
                                            </td>
                                            <td className="hidden px-5 py-3 md:table-cell">
                                                {invoiceType[i.type]}
                                                {i.service && (
                                                    <Link
                                                        href={`/admin/services/${i.service.id}`}
                                                        className="block text-xs text-muted-foreground hover:text-primary"
                                                    >
                                                        {i.service.name}
                                                    </Link>
                                                )}
                                            </td>
                                            <td className="hidden px-5 py-3 text-muted-foreground md:table-cell">
                                                {date(i.paid_at ?? i.due_at)}
                                            </td>
                                            <td className="px-5 py-3 text-right font-medium whitespace-nowrap">
                                                {i.total.formatted}
                                            </td>
                                            <td className="px-5 py-3">
                                                <InvoiceStatusPill
                                                    status={i.status}
                                                />
                                            </td>
                                            <td className="px-5 py-3 text-right whitespace-nowrap">
                                                {i.status === 'unpaid' && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() =>
                                                                confirm(
                                                                    `Позначити ${i.number} сплаченим? Сума зарахується на баланс клієнта.`,
                                                                ) &&
                                                                router.post(
                                                                    `/admin/invoices/${i.id}/paid`,
                                                                    {},
                                                                    {
                                                                        preserveScroll: true,
                                                                    },
                                                                )
                                                            }
                                                        >
                                                            Сплачено
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() =>
                                                                confirm(
                                                                    `Скасувати ${i.number}?`,
                                                                ) &&
                                                                router.post(
                                                                    `/admin/invoices/${i.id}/cancel`,
                                                                    {},
                                                                    {
                                                                        preserveScroll: true,
                                                                    },
                                                                )
                                                            }
                                                        >
                                                            Скасувати
                                                        </Button>
                                                    </>
                                                )}
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

AdminInvoices.layout = {
    breadcrumbs: [{ title: 'Рахунки', href: '/admin/invoices' }],
};
