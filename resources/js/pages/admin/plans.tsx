import { Deferred, Head, router, useForm } from '@inertiajs/react';
import { Download, Link2, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader, Panel, Pill } from '@/lib/billing';
import type { Plan } from '@/types/billing';
import { Switch, Field } from '@/components/billing';

type Package = { slug: string; name: string; active: boolean };
type Props = {
    plans: Plan[];
    currencies: string[];
    periods: { months: number; label: string }[];
    packages?: Package[];
};

export default function Plans({ plans, currencies, periods, packages }: Props) {
    const [editing, setEditing] = useState<Plan | 'new' | null>(null);

    return (
        <>
            <Head title="Тарифи" />
            <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Тарифи"
                    description="Кожен тариф — це пакет у Raptor Panel плюс ціни. Ціну 0 або порожню не показуємо."
                    actions={
                        <>
                            <Button
                                variant="outline"
                                onClick={() =>
                                    router.post('/admin/plans/import')
                                }
                            >
                                <Download className="size-4" /> Імпорт з панелі
                            </Button>
                            <Button onClick={() => setEditing('new')}>
                                <Plus className="size-4" /> Новий тариф
                            </Button>
                        </>
                    }
                />

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {plans.map((plan) => (
                        <Panel
                            key={plan.id}
                            className={plan.active ? '' : 'opacity-60'}
                        >
                            <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 font-semibold">
                                        {plan.name}{' '}
                                        {plan.featured && (
                                            <Star className="size-4 fill-primary text-primary" />
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {plan.category} · пакет{' '}
                                        <span className="font-mono">
                                            {plan.panel_package}
                                        </span>
                                    </div>
                                </div>
                                {!plan.active && <Pill>приховано</Pill>}
                            </div>
                            <ul className="mt-4 space-y-1 text-sm">
                                {plan.prices.map((p) => (
                                    <li
                                        key={`${p.currency}${p.period_months}`}
                                        className="flex justify-between"
                                    >
                                        <span className="text-muted-foreground">
                                            {p.period}
                                        </span>
                                        <span>{p.formatted}</span>
                                    </li>
                                ))}
                                {plan.prices.length === 0 && (
                                    <li className="text-amber-500">
                                        Ціни не задані
                                    </li>
                                )}
                            </ul>
                            <div className="mt-4 flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditing(plan)}
                                >
                                    <Pencil className="size-3.5" /> Змінити
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    title="Посилання на оплату для вашого сайту"
                                    onClick={() =>
                                        navigator.clipboard
                                            .writeText(
                                                `${window.location.origin}/checkout/${plan.slug}?period=1`,
                                            )
                                            .then(() =>
                                                toast.success(
                                                    'Посилання скопійовано. Період можна змінити: ?period=3, 6 або 12',
                                                ),
                                            )
                                    }
                                >
                                    <Link2 className="size-3.5" /> Посилання
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                        confirm(`Видалити ${plan.name}?`) &&
                                        router.delete(`/admin/plans/${plan.id}`)
                                    }
                                >
                                    <Trash2 className="size-3.5" />
                                </Button>
                            </div>
                        </Panel>
                    ))}
                </div>
            </div>

            <Dialog
                open={editing !== null}
                onOpenChange={(open) => !open && setEditing(null)}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    {editing && (
                        <Deferred
                            data="packages"
                            fallback={
                                <PlanForm
                                    plan={editing === 'new' ? null : editing}
                                    currencies={currencies}
                                    periods={periods}
                                    packages={[]}
                                    onDone={() => setEditing(null)}
                                />
                            }
                        >
                            <PlanForm
                                plan={editing === 'new' ? null : editing}
                                currencies={currencies}
                                periods={periods}
                                packages={packages ?? []}
                                onDone={() => setEditing(null)}
                            />
                        </Deferred>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function PlanForm({
    plan,
    currencies,
    periods,
    packages,
    onDone,
}: {
    plan: Plan | null;
    currencies: string[];
    periods: Props['periods'];
    packages: Package[];
    onDone: () => void;
}) {
    const prices = currencies.flatMap((currency) =>
        periods.map((p) => ({
            currency,
            period_months: p.months,
            amount: String(
                (plan?.prices.find(
                    (x) =>
                        x.currency === currency && x.period_months === p.months,
                )?.amount ?? 0) / 100 || '',
            ),
        })),
    );
    const form = useForm({
        name: plan?.name ?? '',
        slug: plan?.slug ?? '',
        category: plan?.category ?? 'Game servers',
        description: plan?.description ?? '',
        features: (plan?.features ?? []).join('\n'),
        panel_package: plan?.panel_package ?? '',
        active: plan?.active ?? true,
        featured: plan?.featured ?? false,
        sort: plan?.sort ?? 0,
        prices,
    });

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                form.transform((data) => ({
                    ...data,
                    features: data.features
                        .split('\n')
                        .map((f) => f.trim())
                        .filter(Boolean),
                }));
                const options = { preserveScroll: true, onSuccess: onDone };
                if (plan) {
                    form.put(`/admin/plans/${plan.id}`, options);
                } else {
                    form.post('/admin/plans', options);
                }
            }}
            className="space-y-4"
        >
            <DialogHeader>
                <DialogTitle>{plan ? plan.name : 'Новий тариф'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Назва" error={form.errors.name}>
                    <Input
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                    />
                </Field>
                <Field
                    label="Slug (адреса в магазині)"
                    error={form.errors.slug}
                >
                    <Input
                        value={form.data.slug}
                        placeholder="minecraft-4gb"
                        onChange={(e) =>
                            form.setData('slug', e.target.value.toLowerCase())
                        }
                    />
                </Field>
                <Field label="Пакет у панелі" error={form.errors.panel_package}>
                    <Input
                        list="packages"
                        value={form.data.panel_package}
                        onChange={(e) =>
                            form.setData('panel_package', e.target.value)
                        }
                    />
                    <datalist id="packages">
                        {packages.map((p) => (
                            <option key={p.slug} value={p.slug}>
                                {p.name}
                            </option>
                        ))}
                    </datalist>
                </Field>
                <Field label="Категорія" error={form.errors.category}>
                    <Input
                        value={form.data.category}
                        onChange={(e) =>
                            form.setData('category', e.target.value)
                        }
                    />
                </Field>
            </div>
            <Field label="Опис" error={form.errors.description}>
                <Input
                    value={form.data.description}
                    onChange={(e) =>
                        form.setData('description', e.target.value)
                    }
                />
            </Field>
            <Field
                label="Переваги, по одній на рядок"
                error={form.errors.features}
            >
                <textarea
                    rows={4}
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    value={form.data.features}
                    onChange={(e) => form.setData('features', e.target.value)}
                />
            </Field>

            <div>
                <Label>Ціни</Label>
                <div className="mt-2 overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b text-xs text-muted-foreground">
                                <th className="px-3 py-2 text-left font-medium">
                                    Валюта
                                </th>
                                {periods.map((p) => (
                                    <th
                                        key={p.months}
                                        className="px-2 py-2 text-left font-medium"
                                    >
                                        {p.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {currencies.map((currency) => (
                                <tr key={currency}>
                                    <td className="px-3 py-2 font-medium">
                                        {currency}
                                    </td>
                                    {periods.map((p) => {
                                        const index =
                                            form.data.prices.findIndex(
                                                (x) =>
                                                    x.currency === currency &&
                                                    x.period_months ===
                                                        p.months,
                                            );

                                        return (
                                            <td
                                                key={p.months}
                                                className="px-2 py-2"
                                            >
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min={0}
                                                    className="h-8 min-w-20"
                                                    value={
                                                        form.data.prices[index]
                                                            .amount
                                                    }
                                                    onChange={(e) =>
                                                        form.setData(
                                                            'prices',
                                                            form.data.prices.map(
                                                                (x, i) =>
                                                                    i === index
                                                                        ? {
                                                                              ...x,
                                                                              amount: e
                                                                                  .target
                                                                                  .value,
                                                                          }
                                                                        : x,
                                                            ),
                                                        )
                                                    }
                                                />
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex flex-wrap gap-6 text-sm">
                <label className="flex items-center gap-2">
                    <Switch
                        checked={form.data.active}
                        onChange={(v) => form.setData('active', v)}
                    />{' '}
                    Показувати в магазині
                </label>
                <label className="flex items-center gap-2">
                    <Switch
                        checked={form.data.featured}
                        onChange={(v) => form.setData('featured', v)}
                    />{' '}
                    Популярний
                </label>
                <label className="flex items-center gap-2">
                    Порядок{' '}
                    <Input
                        type="number"
                        className="h-8 w-20"
                        value={form.data.sort}
                        onChange={(e) =>
                            form.setData('sort', Number(e.target.value))
                        }
                    />
                </label>
            </div>

            <DialogFooter>
                <Button disabled={form.processing}>Зберегти</Button>
            </DialogFooter>
        </form>
    );
}

Plans.layout = { breadcrumbs: [{ title: 'Тарифи', href: '/admin/plans' }] };
