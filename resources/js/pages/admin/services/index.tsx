import { Head, Link } from '@inertiajs/react';
import { Server } from 'lucide-react';
import { Filters } from '@/components/filters';
import { Pagination } from '@/components/pagination';
import {
    date,
    Empty,
    PageHeader,
    Panel,
    ServiceStatusPill,
} from '@/lib/billing';
import type { Paginated, Service } from '@/types/billing';

const tabs: [string, string][] = [
    ['', 'Усі'],
    ['active', 'Активні'],
    ['suspended', 'Призупинені'],
    ['pending', 'Не сплачені'],
    ['provisioning', 'Створюються'],
    ['failed', 'Помилки'],
    ['terminated', 'Видалені'],
];

export default function AdminServices({
    services,
    filters,
}: {
    services: Paginated<Service>;
    filters: { status: string; search: string };
}) {
    return (
        <>
            <Head title="Сервери" />
            <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Сервери"
                    description={`Знайдено: ${services.total}`}
                />
                <Filters
                    url="/admin/services"
                    query={filters}
                    tabs={tabs}
                    searchKey="search"
                    placeholder="Назва, адреса або email"
                />
                <Panel flush>
                    {services.data.length === 0 ? (
                        <Empty icon={Server} title="Нічого не знайдено" />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left text-xs text-muted-foreground">
                                    <tr className="border-b">
                                        <th className="px-5 py-3 font-medium">
                                            Сервер
                                        </th>
                                        <th className="px-5 py-3 font-medium">
                                            Клієнт
                                        </th>
                                        <th className="hidden px-5 py-3 font-medium lg:table-cell">
                                            Тариф
                                        </th>
                                        <th className="px-5 py-3 font-medium">
                                            Сплачено до
                                        </th>
                                        <th className="px-5 py-3 font-medium">
                                            Статус
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {services.data.map((s) => (
                                        <tr
                                            key={s.id}
                                            className="hover:bg-muted/40"
                                        >
                                            <td className="px-5 py-3">
                                                <Link
                                                    href={`/admin/services/${s.id}`}
                                                    className="font-medium hover:text-primary"
                                                >
                                                    {s.name}
                                                </Link>
                                                <div className="font-mono text-xs text-muted-foreground">
                                                    {s.address ?? `svc-${s.id}`}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3">
                                                {s.user && (
                                                    <Link
                                                        href={`/admin/clients/${s.user.id}`}
                                                        className="hover:text-primary"
                                                    >
                                                        {s.user.email}
                                                    </Link>
                                                )}
                                            </td>
                                            <td className="hidden px-5 py-3 lg:table-cell">
                                                {s.plan.name}
                                                <div className="text-xs text-muted-foreground">
                                                    {s.price.formatted} /{' '}
                                                    {s.period.toLowerCase()}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 whitespace-nowrap">
                                                {date(s.next_due_at)}
                                            </td>
                                            <td className="px-5 py-3">
                                                <ServiceStatusPill
                                                    status={s.status}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <Pagination page={services} />
                </Panel>
            </div>
        </>
    );
}

AdminServices.layout = {
    breadcrumbs: [{ title: 'Сервери', href: '/admin/services' }],
};
