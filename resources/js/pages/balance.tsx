import { Head, router, useForm } from '@inertiajs/react';
import {
    ArrowDownLeft,
    ArrowUpRight,
    CreditCard,
    Loader2,
    Trash2,
    Wallet,
} from 'lucide-react';
import { Pagination } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import InputError from '@/components/input-error';
import { date, Empty, PageHeader, Panel } from '@/lib/billing';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/billing';
import type { Card, Money, Paginated, Transaction } from '@/types/billing';

const presets: Record<string, number[]> = {
    UAH: [100, 250, 500, 1000],
    USD: [5, 10, 25, 50],
    EUR: [5, 10, 25, 50],
};
const types: Record<Transaction['type'], string> = {
    topup: 'Поповнення',
    charge: 'Списання',
    refund: 'Повернення',
    adjustment: 'Коригування',
};

type Props = {
    balance: Money;
    currency: string;
    currencies: string[];
    can_change_currency: boolean;
    cards: Card[];
    transactions: Paginated<Transaction>;
};

export default function Balance({
    balance,
    currency,
    currencies,
    can_change_currency,
    cards,
    transactions,
}: Props) {
    const form = useForm({
        amount: String(presets[currency]?.[1] ?? 100),
        save_card: cards.length === 0,
    });

    return (
        <>
            <Head title="Баланс" />
            <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Баланс"
                    description="З балансу сплачуються замовлення та продовження. Поповнення — миттєво через plata by mono."
                />

                <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                    <Panel>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Wallet className="size-4" /> Доступно
                        </div>
                        <div className="mt-1 text-4xl font-semibold tracking-tight">
                            {balance.formatted}
                        </div>
                        <form
                            className="mt-6 space-y-4"
                            onSubmit={(e) => {
                                e.preventDefault();
                                form.post('/balance/topup');
                            }}
                        >
                            <div className="flex flex-wrap gap-2">
                                {(presets[currency] ?? presets.UAH).map(
                                    (value) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() =>
                                                form.setData(
                                                    'amount',
                                                    String(value),
                                                )
                                            }
                                            className={cn(
                                                'h-9 rounded-md border px-3 text-sm transition',
                                                Number(form.data.amount) ===
                                                    value
                                                    ? 'border-primary bg-primary/10 text-primary'
                                                    : 'hover:border-foreground/30',
                                            )}
                                        >
                                            {value} {currency}
                                        </button>
                                    ),
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    min={1}
                                    step="0.01"
                                    value={form.data.amount}
                                    onChange={(e) =>
                                        form.setData('amount', e.target.value)
                                    }
                                />
                                <Button disabled={form.processing}>
                                    {form.processing ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <CreditCard className="size-4" />
                                    )}{' '}
                                    Поповнити
                                </Button>
                            </div>
                            <InputError message={form.errors.amount} />
                            <label className="flex items-center gap-2 text-sm">
                                <Checkbox
                                    checked={form.data.save_card}
                                    onCheckedChange={(v) =>
                                        form.setData('save_card', v === true)
                                    }
                                />
                                Зберегти картку для автоматичного продовження
                            </label>
                        </form>
                    </Panel>

                    <Panel
                        title="Збережені картки"
                        description="Якщо на балансі не вистачає, рахунок за продовження спишеться з картки з автооплатою."
                    >
                        {cards.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Карток ще немає. Поставте галочку «Зберегти
                                картку» під час оплати.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {cards.map((card) => (
                                    <li
                                        key={card.id}
                                        className="flex items-center gap-3 rounded-lg border p-3"
                                    >
                                        <span className="grid h-8 w-12 place-items-center rounded-md bg-gradient-to-br from-zinc-700 to-zinc-900 text-[10px] font-semibold text-white">
                                            {card.masked_pan.startsWith('4')
                                                ? 'VISA'
                                                : 'MC'}
                                        </span>
                                        <span className="flex-1 font-mono text-sm">
                                            {card.masked_pan}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            Автооплата
                                        </span>
                                        <Switch
                                            checked={card.autopay}
                                            onChange={(v) =>
                                                router.patch(
                                                    `/cards/${card.id}`,
                                                    { autopay: v },
                                                    { preserveScroll: true },
                                                )
                                            }
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label="Видалити картку"
                                            onClick={() =>
                                                confirm('Видалити картку?') &&
                                                router.delete(
                                                    `/cards/${card.id}`,
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

                        {can_change_currency && currencies.length > 1 && (
                            <div className="mt-6 border-t pt-4">
                                <div className="text-sm font-medium">
                                    Валюта рахунку
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Змінити можна лише до першого замовлення.
                                </p>
                                <div className="mt-3 flex gap-2">
                                    {currencies.map((c) => (
                                        <Button
                                            key={c}
                                            size="sm"
                                            variant={
                                                c === currency
                                                    ? 'default'
                                                    : 'outline'
                                            }
                                            onClick={() =>
                                                router.patch(
                                                    '/balance/currency',
                                                    { currency: c },
                                                )
                                            }
                                        >
                                            {c}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Panel>
                </div>

                <Panel title="Історія операцій" flush>
                    {transactions.data.length === 0 ? (
                        <Empty icon={Wallet} title="Операцій ще немає" />
                    ) : (
                        <ul className="divide-y">
                            {transactions.data.map((t) => {
                                const income = t.amount.amount > 0;

                                return (
                                    <li
                                        key={t.id}
                                        className="flex items-center gap-4 px-5 py-3 text-sm"
                                    >
                                        <span
                                            className={cn(
                                                'grid size-8 place-items-center rounded-full',
                                                income
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'bg-muted text-muted-foreground',
                                            )}
                                        >
                                            {income ? (
                                                <ArrowDownLeft className="size-4" />
                                            ) : (
                                                <ArrowUpRight className="size-4" />
                                            )}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate">
                                                {t.description}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {types[t.type]} ·{' '}
                                                {date(t.created_at, true)}
                                            </span>
                                        </span>
                                        <span className="text-right">
                                            <span
                                                className={cn(
                                                    'block font-medium whitespace-nowrap',
                                                    income && 'text-primary',
                                                )}
                                            >
                                                {income ? '+' : ''}
                                                {t.amount.formatted}
                                            </span>
                                            <span className="text-xs whitespace-nowrap text-muted-foreground">
                                                {t.balance_after.formatted}
                                            </span>
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    <Pagination page={transactions} />
                </Panel>
            </div>
        </>
    );
}

Balance.layout = { breadcrumbs: [{ title: 'Баланс', href: '/balance' }] };
