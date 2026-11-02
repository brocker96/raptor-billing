import { Head, Link } from '@inertiajs/react';
import { Users } from 'lucide-react';
import { Filters } from '@/components/filters';
import { Pagination } from '@/components/pagination';
import { date, Empty, PageHeader, Panel, Pill } from '@/lib/billing';
import type { Client, Paginated } from '@/types/billing';

export default function Clients({
    clients,
    search,
}: {
    clients: Paginated<Client>;
    search: string;
}) {
    return (
        <>
            <Head title="Клієнти" />
            <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Клієнти"
                    description={`Усього: ${clients.total}`}
                />
                <Filters
                    url="/admin/clients"
                    query={{ search }}
                    searchKey="search"
                    placeholder="Email, ім'я або ID"
                />
                <Panel flush>
                    {clients.data.length === 0 ? (
                        <Empty icon={Users} title="Нікого не знайдено" />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left text-xs text-muted-foreground">
                                    <tr className="border-b">
                                        <th className="px-5 py-3 font-medium">
                                            Клієнт
                                        </th>
                                        <th className="px-5 py-3 font-medium">
                                            Сервери
                                        </th>
                                        <th className="px-5 py-3 text-right font-medium">
                                            Баланс
                                        </th>
                                        <th className="hidden px-5 py-3 font-medium md:table-cell">
                                            Реєстрація
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {clients.data.map((c) => (
                                        <tr
                                            key={c.id}
                                            className="hover:bg-muted/40"
                                        >
                                            <td className="px-5 py-3">
                                                <Link
                                                    href={`/admin/clients/${c.id}`}
                                                    className="font-medium hover:text-primary"
                                                >
                                                    {c.name}
                                                </Link>
                                                {c.is_admin && (
                                                    <Pill
                                                        tone="blue"
                                                        className="ml-2"
                                                    >
                                                        адмін
                                                    </Pill>
                                                )}
                                                <div className="text-muted-foreground">
                                                    {c.email}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3">
                                                {c.services_count}
                                            </td>
                                            <td
                                                className={`px-5 py-3 text-right font-medium whitespace-nowrap ${c.balance.amount < 0 ? 'text-rose-500' : ''}`}
                                            >
                                                {c.balance.formatted}
                                            </td>
                                            <td className="hidden px-5 py-3 text-muted-foreground md:table-cell">
                                                {date(c.created_at)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <Pagination page={clients} />
                </Panel>
            </div>
        </>
    );
}

Clients.layout = {
    breadcrumbs: [{ title: 'Клієнти', href: '/admin/clients' }],
};
