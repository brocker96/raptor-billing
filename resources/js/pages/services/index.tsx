import { Head, Link } from '@inertiajs/react';
import { Plus, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Empty, PageHeader, Panel } from '@/lib/billing';
import { ServiceList } from '@/components/billing';
import type { Service } from '@/types/billing';

export default function Services({ services }: { services: Service[] }) {
    const current = services.filter(
        (s) => !['terminated', 'cancelled'].includes(s.status),
    );
    const past = services.filter((s) =>
        ['terminated', 'cancelled'].includes(s.status),
    );

    return (
        <>
            <Head title="Мої сервери" />
            <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Мої сервери"
                    actions={
                        <Button asChild>
                            <Link href="/">
                                <Plus className="size-4" /> Новий сервер
                            </Link>
                        </Button>
                    }
                />
                <Panel flush>
                    {current.length ? (
                        <ServiceList services={current} />
                    ) : (
                        <Empty icon={Server} title="Немає активних серверів" />
                    )}
                </Panel>
                {past.length > 0 && (
                    <Panel title="Архів" flush>
                        <ServiceList services={past} />
                    </Panel>
                )}
            </div>
        </>
    );
}

Services.layout = {
    breadcrumbs: [{ title: 'Мої сервери', href: '/services' }],
};
