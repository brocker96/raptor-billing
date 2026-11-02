import { router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Query = Record<string, string>;

function visit(url: string, query: Query) {
    router.get(
        url,
        Object.fromEntries(Object.entries(query).filter(([, v]) => v)),
        { preserveState: true, replace: true },
    );
}

export function Filters({
    url,
    query,
    tabs,
    tabKey = 'status',
    searchKey,
    placeholder,
}: {
    url: string;
    query: Query;
    tabs?: [string, string][];
    tabKey?: string;
    searchKey?: string;
    placeholder?: string;
}) {
    const [search, setSearch] = useState(
        searchKey ? (query[searchKey] ?? '') : '',
    );

    return (
        <div className="flex flex-wrap items-center gap-3">
            {tabs && (
                <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
                    {tabs.map(([value, label]) => (
                        <button
                            key={value}
                            onClick={() =>
                                visit(url, { ...query, [tabKey]: value })
                            }
                            className={cn(
                                'h-8 rounded-md px-3 text-sm transition',
                                (query[tabKey] ?? '') === value
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}
            {searchKey && (
                <form
                    className="relative ml-auto w-full sm:w-72"
                    onSubmit={(e) => {
                        e.preventDefault();
                        visit(url, { ...query, [searchKey]: search });
                    }}
                >
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        className="pl-9"
                        placeholder={placeholder ?? 'Пошук'}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </form>
            )}
        </div>
    );
}
