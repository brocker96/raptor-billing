import { Head } from '@inertiajs/react';
import { Pagination } from '@/components/pagination';
import { PageHeader, Panel } from '@/lib/billing';
import { PaymentsTable } from '@/components/billing';
import type { Paginated, PaymentRow } from '@/types/billing';

export default function Payments({
    payments,
}: {
    payments: Paginated<PaymentRow>;
}) {
    return (
        <>
            <Head title="Платежі" />
            <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Платежі"
                    description="Усі спроби оплати через MonoPay, включно з автооплатою карткою."
                />
                <Panel flush>
                    <PaymentsTable payments={payments.data} />
                    <Pagination page={payments} />
                </Panel>
            </div>
        </>
    );
}

Payments.layout = {
    breadcrumbs: [{ title: 'Платежі', href: '/admin/payments' }],
};
