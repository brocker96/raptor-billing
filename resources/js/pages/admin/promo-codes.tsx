import { Head, router, useForm } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Empty, PageHeader, Panel, Pill } from '@/lib/billing';
import { Field } from '@/components/billing';
import { Switch } from '@/components/billing';
import { TicketPercent } from 'lucide-react';

type Code = {
    id: number;
    code: string;
    type: 'percent' | 'fixed';
    value: number;
    currency: string | null;
    max_uses: number | null;
    uses: number;
    plan_ids: number[];
    expires_at: string | null;
    active: boolean;
};

const select =
    'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs';

export default function PromoCodes({
    codes,
    plans,
}: {
    codes: Code[];
    plans: { id: number; name: string }[];
}) {
    const form = useForm({
        code: '',
        type: 'percent',
        value: '10',
        currency: 'UAH',
        max_uses: '',
        plan_ids: [] as number[],
        expires_at: '',
        active: true,
    });

    return (
        <>
            <Head title="Промокоди" />
            <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Промокоди"
                    description="Знижка діє на перший період замовлення."
                />

                <Panel title="Новий промокод">
                    <form
                        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6"
                        onSubmit={(e) => {
                            e.preventDefault();
                            form.post('/admin/promo-codes', {
                                preserveScroll: true,
                                onSuccess: () => form.reset(),
                            });
                        }}
                    >
                        <Field label="Код" error={form.errors.code}>
                            <Input
                                value={form.data.code}
                                placeholder="RAPTOR10"
                                onChange={(e) =>
                                    form.setData(
                                        'code',
                                        e.target.value.toUpperCase(),
                                    )
                                }
                            />
                        </Field>
                        <Field label="Тип">
                            <select
                                className={select}
                                value={form.data.type}
                                onChange={(e) =>
                                    form.setData('type', e.target.value)
                                }
                            >
                                <option value="percent">Відсоток</option>
                                <option value="fixed">Сума</option>
                            </select>
                        </Field>
                        <Field
                            label={
                                form.data.type === 'percent'
                                    ? 'Знижка, %'
                                    : 'Знижка'
                            }
                            error={form.errors.value}
                        >
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={form.data.value}
                                    onChange={(e) =>
                                        form.setData('value', e.target.value)
                                    }
                                />
                                {form.data.type === 'fixed' && (
                                    <select
                                        className={`${select} w-24`}
                                        value={form.data.currency}
                                        onChange={(e) =>
                                            form.setData(
                                                'currency',
                                                e.target.value,
                                            )
                                        }
                                    >
                                        {['UAH', 'USD', 'EUR'].map((c) => (
                                            <option key={c}>{c}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </Field>
                        <Field
                            label="Ліміт використань"
                            error={form.errors.max_uses}
                        >
                            <Input
                                type="number"
                                placeholder="без ліміту"
                                value={form.data.max_uses}
                                onChange={(e) =>
                                    form.setData('max_uses', e.target.value)
                                }
                            />
                        </Field>
                        <Field label="Діє до" error={form.errors.expires_at}>
                            <Input
                                type="date"
                                value={form.data.expires_at}
                                onChange={(e) =>
                                    form.setData('expires_at', e.target.value)
                                }
                            />
                        </Field>
                        <Field label="Тарифи">
                            <select
                                multiple
                                className={`${select} h-9 py-1`}
                                value={form.data.plan_ids.map(String)}
                                onChange={(e) =>
                                    form.setData(
                                        'plan_ids',
                                        Array.from(
                                            e.target.selectedOptions,
                                            (o) => Number(o.value),
                                        ),
                                    )
                                }
                            >
                                {plans.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <div className="sm:col-span-2 lg:col-span-6">
                            <Button disabled={form.processing}>
                                <Plus className="size-4" /> Створити
                            </Button>
                        </div>
                    </form>
                </Panel>

                <Panel flush>
                    {codes.length === 0 ? (
                        <Empty
                            icon={TicketPercent}
                            title="Промокодів ще немає"
                        />
                    ) : (
                        <ul className="divide-y">
                            {codes.map((c) => (
                                <li
                                    key={c.id}
                                    className="flex flex-wrap items-center gap-4 px-5 py-3 text-sm"
                                >
                                    <span className="font-mono font-semibold">
                                        {c.code}
                                    </span>
                                    <Pill tone="green">
                                        {c.type === 'percent'
                                            ? `−${c.value}%`
                                            : `−${c.value} ${c.currency}`}
                                    </Pill>
                                    <span className="flex-1 text-muted-foreground">
                                        використано {c.uses}
                                        {c.max_uses ? ` з ${c.max_uses}` : ''}
                                        {c.expires_at &&
                                            ` · до ${c.expires_at}`}
                                        {c.plan_ids.length > 0 &&
                                            ` · ${plans
                                                .filter((p) =>
                                                    c.plan_ids.includes(p.id),
                                                )
                                                .map((p) => p.name)
                                                .join(', ')}`}
                                    </span>
                                    <Switch
                                        checked={c.active}
                                        onChange={(v) =>
                                            router.put(
                                                `/admin/promo-codes/${c.id}`,
                                                {
                                                    ...c,
                                                    max_uses: c.max_uses ?? '',
                                                    expires_at:
                                                        c.expires_at ?? '',
                                                    active: v,
                                                },
                                                { preserveScroll: true },
                                            )
                                        }
                                    />
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        aria-label="Видалити"
                                        onClick={() =>
                                            confirm(`Видалити ${c.code}?`) &&
                                            router.delete(
                                                `/admin/promo-codes/${c.id}`,
                                                { preserveScroll: true },
                                            )
                                        }
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>
        </>
    );
}

PromoCodes.layout = {
    breadcrumbs: [{ title: 'Промокоди', href: '/admin/promo-codes' }],
};
