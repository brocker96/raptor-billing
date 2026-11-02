import { Link } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import type { Paginated } from '@/types/billing';

export function Pagination({ page }: { page: Paginated<unknown> }) {
    if (page.last_page <= 1) {
        return null;
    }

    return (
        <nav className="flex flex-wrap items-center justify-center gap-1 border-t px-5 py-3">
            {page.links.map((link, i) => {
                const label =
                    i === 0
                        ? '‹'
                        : i === page.links.length - 1
                          ? '›'
                          : link.label;

                return link.url ? (
                    <Link
                        key={i}
                        href={link.url}
                        preserveScroll
                        className={cn(
                            'grid h-8 min-w-8 place-items-center rounded-md px-2 text-sm',
                            link.active
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted',
                        )}
                    >
                        {label}
                    </Link>
                ) : (
                    <span
                        key={i}
                        className="grid h-8 min-w-8 place-items-center px-2 text-sm text-muted-foreground/50"
                    >
                        {label}
                    </span>
                );
            })}
        </nav>
    );
}
