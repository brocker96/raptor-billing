import { Link } from '@inertiajs/react';
import {
    CreditCard,
    KeyRound,
    LogIn,
    Server,
    ShieldAlert,
    ShoppingCart,
    UserPlus,
    Wrench,
} from 'lucide-react';
import { date } from '@/lib/billing';
import { cn } from '@/lib/utils';

export type ActivityEntry = {
    id: number;
    event: string;
    description: string;
    ip: string | null;
    created_at: string;
    user: { id: number; name: string; email: string } | null;
    actor: { id: number; name: string; admin: boolean } | null;
};

const icons: [string, React.ComponentType<{ className?: string }>, string][] = [
    ['auth.failed', ShieldAlert, 'bg-rose-500/10 text-rose-500'],
    ['auth.password', KeyRound, 'bg-sky-500/10 text-sky-500'],
    ['auth.', LogIn, 'bg-muted text-muted-foreground'],
    ['account.', UserPlus, 'bg-primary/10 text-primary'],
    ['order.', ShoppingCart, 'bg-sky-500/10 text-sky-500'],
    ['payment.', CreditCard, 'bg-primary/10 text-primary'],
    ['service.', Server, 'bg-amber-500/10 text-amber-500'],
    ['admin.', Wrench, 'bg-violet-500/10 text-violet-500'],
];

export function ActivityList({
    entries,
    showUser = true,
}: {
    entries: ActivityEntry[];
    showUser?: boolean;
}) {
    if (entries.length === 0) {
        return (
            <p className="px-5 py-6 text-sm text-muted-foreground">
                Записів ще немає.
            </p>
        );
    }

    return (
        <ul className="divide-y">
            {entries.map((e) => {
                const [, Icon, tone] =
                    icons.find(([prefix]) => e.event.startsWith(prefix)) ??
                    icons[2];
                const byAdmin = e.actor?.admin && e.actor.id !== e.user?.id;

                return (
                    <li
                        key={e.id}
                        className="flex items-start gap-3 px-5 py-3 text-sm"
                    >
                        <span
                            className={cn(
                                'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full',
                                tone,
                            )}
                        >
                            <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block break-words">
                                {e.description}
                            </span>
                            <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                                <span>{date(e.created_at, true)}</span>
                                {showUser && e.user && (
                                    <Link
                                        href={`/admin/clients/${e.user.id}`}
                                        className="hover:text-primary"
                                    >
                                        {e.user.email}
                                    </Link>
                                )}
                                {byAdmin && <span>адмін {e.actor!.name}</span>}
                                {!e.actor && <span>автоматично</span>}
                                {e.ip && (
                                    <span className="font-mono">{e.ip}</span>
                                )}
                            </span>
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
