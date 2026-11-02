import { Head } from '@inertiajs/react';
import { ActivityList } from '@/components/activity-list';
import type { ActivityEntry } from '@/components/activity-list';
import { Filters } from '@/components/filters';
import { Pagination } from '@/components/pagination';
import { PageHeader, Panel } from '@/lib/billing';
import type { Paginated } from '@/types/billing';

const tabs: [string, string][] = [
    ['', 'Усе'],
    ['auth', 'Входи'],
    ['order', 'Замовлення'],
    ['payment', 'Оплати'],
    ['service', 'Сервери'],
    ['admin', 'Дії адмінів'],
];

export default function Activity({
    entries,
    filters,
}: {
    entries: Paginated<ActivityEntry>;
    filters: { group: string; search: string };
}) {
    return (
        <>
            <Head title="Журнал" />
            <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Журнал дій"
                    description="Хто, що і коли: входи, замовлення, оплати, зміни серверів і дії адміністраторів."
                />
                <Filters
                    url="/admin/activity"
                    query={filters}
                    tabs={tabs}
                    tabKey="group"
                    searchKey="search"
                    placeholder="Email, текст або IP"
                />
                <Panel flush>
                    <ActivityList entries={entries.data} />
                    <Pagination page={entries} />
                </Panel>
            </div>
        </>
    );
}

Activity.layout = {
    breadcrumbs: [{ title: 'Журнал', href: '/admin/activity' }],
};
