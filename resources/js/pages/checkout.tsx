import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    Check,
    ChevronDown,
    Clock,
    Loader2,
    Lock,
    ShieldCheck,
    TicketPercent,
    TriangleAlert,
    Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { postJson } from '@/lib/http';
import { cn } from '@/lib/utils';
import type { Money, Plan } from '@/types/billing';

type Quote = { price: Money; discount: Money; total: Money };
type Customer = { name: string; email: string; phone: string | null };
type Props = {
    plan: Plan;
    currency: string;
    currencies: string[];
    period: number;
    promo: string;
    in_stock: boolean;
    customer: Customer | null;
    balance: Money | null;
};

export default function Checkout({
    plan,
    currency,
    currencies,
    period,
    promo,
    in_stock,
    customer,
    balance,
}: Props) {
    const {
        name: company,
        logo,
        company_url,
    } = usePage<{ name: string; logo?: string; company_url?: string }>().props;
    const initial =
        plan.prices.find((p) => p.period_months === period) ??
        plan.prices.find((p) => p.period_months === 3) ??
        plan.prices[0];
    const form = useForm({
        period: initial?.period_months ?? 1,
        name: '',
        phone: customer?.phone ?? '+380 ',
        email: '',
        currency,
        server_name: '',
        promo: promo,
        save_card: true,
        terms: true,
    });
    const [promoInput, setPromoInput] = useState(promo);
    const [promoError, setPromoError] = useState<string | null>(null);
    const [quote, setQuote] = useState<Quote | null>(null);
    const [checking, setChecking] = useState(false);
    const [extras, setExtras] = useState(Boolean(promo));
    const price = plan.prices.find((p) => p.period_months === form.data.period);
    const base = plan.prices[0];

    useEffect(() => {
        if (!form.data.promo) {
            setQuote(null);

            return;
        }
        setChecking(true);
        postJson<Quote>(`/checkout/${plan.slug}/quote`, {
            period: form.data.period,
            promo: form.data.promo,
            currency,
        })
            .then((q) => {
                setQuote(q);
                setPromoError(null);
            })
            .catch((e: Error) => {
                setPromoError(e.message);
                setQuote(null);
                form.setData('promo', '');
            })
            .finally(() => setChecking(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.data.period, form.data.promo]);

    if (!price) {
        return (
            <div className="grid min-h-screen place-items-center p-6 text-muted-foreground">
                Цей тариф зараз недоступний.
            </div>
        );
    }

    const total = quote?.total ?? price;
    const fromBalance = balance !== null && balance.amount >= total.amount;
    const submit = (e?: React.FormEvent) => {
        e?.preventDefault();
        form.post(`/checkout/${plan.slug}`, { preserveScroll: true });
    };
    const switchCurrency = (value: string) => {
        document.cookie = `currency=${value};path=/;max-age=31536000`;
        router.get(
            `/checkout/${plan.slug}`,
            {
                period: form.data.period,
                currency: value,
                promo: form.data.promo || undefined,
            },
            { preserveScroll: true },
        );
    };
    const payLabel = fromBalance
        ? `Оплатити з балансу · ${total.formatted}`
        : `Оплатити ${total.formatted}`;

    return (
        <>
            <Head title={`${plan.name} — оформлення`} />
            <div className="min-h-screen bg-background pb-28 lg:pb-0">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(50%_70%_at_50%_0%,color-mix(in_oklch,var(--primary)_16%,transparent),transparent)]" />

                <header className="relative mx-auto flex max-w-6xl items-center gap-3 px-4 py-5">
                    <a
                        href={company_url || '/'}
                        className="flex items-center gap-2.5"
                    >
                        <img
                            src={logo ?? '/brand/raptor-icon-128.webp'}
                            alt=""
                            className="size-8"
                        />
                        <span className="font-semibold tracking-tight">
                            {company}
                        </span>
                    </a>
                    <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Lock className="size-3.5" />{' '}
                        <span className="hidden sm:inline">
                            Захищена оплата
                        </span>
                    </span>
                    {customer ? (
                        <Button asChild variant="ghost" size="sm">
                            <Link href="/dashboard">Кабінет</Link>
                        </Button>
                    ) : (
                        <Button asChild variant="ghost" size="sm">
                            <Link href="/login">Увійти</Link>
                        </Button>
                    )}
                </header>

                <form
                    onSubmit={submit}
                    className="relative mx-auto grid max-w-6xl gap-6 px-4 pb-10 lg:grid-cols-[1fr_380px] lg:gap-8"
                >
                    <div className="space-y-5">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                                {plan.name}
                            </h1>
                            <p className="mt-1 text-muted-foreground">
                                {plan.description ?? plan.category}
                            </p>
                        </div>

                        {!in_stock && (
                            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
                                Зараз усі вузли зайняті. Після оплати сервер
                                створиться, щойно звільниться місце, зазвичай
                                протягом доби.
                            </div>
                        )}

                        <Step n={1} title="На скільки?">
                            <div className="grid gap-3 sm:grid-cols-2">
                                {plan.prices.map((p) => {
                                    const saving =
                                        base && p.period_months > 1
                                            ? Math.round(
                                                  (1 -
                                                      p.monthly.amount /
                                                          base.monthly.amount) *
                                                      100,
                                              )
                                            : 0;
                                    const active =
                                        form.data.period === p.period_months;

                                    return (
                                        <button
                                            key={p.period_months}
                                            type="button"
                                            onClick={() =>
                                                form.setData(
                                                    'period',
                                                    p.period_months,
                                                )
                                            }
                                            className={cn(
                                                'relative flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition',
                                                active
                                                    ? 'border-primary ring-2 ring-primary/30'
                                                    : 'hover:border-foreground/25',
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'grid size-5 shrink-0 place-items-center rounded-full border-2',
                                                    active
                                                        ? 'border-primary bg-primary text-primary-foreground'
                                                        : 'border-muted-foreground/40',
                                                )}
                                            >
                                                {active && (
                                                    <Check
                                                        className="size-3"
                                                        strokeWidth={3}
                                                    />
                                                )}
                                            </span>
                                            <span className="flex-1">
                                                <span className="block font-medium">
                                                    {p.period}
                                                </span>
                                                <span className="text-sm text-muted-foreground">
                                                    {p.monthly.formatted} / міс.
                                                </span>
                                            </span>
                                            <span className="text-right">
                                                <span className="block font-semibold">
                                                    {p.formatted}
                                                </span>
                                                {saving > 0 && (
                                                    <span className="text-xs font-medium text-primary">
                                                        економія {saving}%
                                                    </span>
                                                )}
                                            </span>
                                            {p.period_months === 12 &&
                                                saving > 0 && (
                                                    <span className="absolute -top-2.5 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                                                        Найвигідніше
                                                    </span>
                                                )}
                                        </button>
                                    );
                                })}
                            </div>
                            <InputError
                                className="mt-2"
                                message={form.errors.period}
                            />
                        </Step>

                        <Step
                            n={2}
                            title={customer ? 'Ваш акаунт' : 'Ваші дані'}
                            hint={
                                customer
                                    ? undefined
                                    : 'Створимо кабінет автоматично, доступ прийде на пошту.'
                            }
                        >
                            {customer ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
                                        <span className="grid size-10 place-items-center rounded-full bg-primary/15 font-semibold text-primary">
                                            {customer.name.slice(0, 1)}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block truncate font-medium">
                                                {customer.name}
                                            </span>
                                            <span className="block truncate text-sm text-muted-foreground">
                                                {customer.email}
                                            </span>
                                        </span>
                                    </div>
                                    {!customer.phone && (
                                        <PhoneField
                                            value={form.data.phone}
                                            error={form.errors.phone}
                                            onChange={(v) =>
                                                form.setData('phone', v)
                                            }
                                        />
                                    )}
                                </div>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="grid gap-1.5 sm:col-span-2">
                                        <Label htmlFor="name">
                                            Прізвище, ім'я та по батькові
                                        </Label>
                                        <Input
                                            id="name"
                                            autoComplete="name"
                                            placeholder="Шевченко Тарас Григорович"
                                            value={form.data.name}
                                            onChange={(e) =>
                                                form.setData(
                                                    'name',
                                                    e.target.value,
                                                )
                                            }
                                            className="h-11"
                                        />
                                        <InputError
                                            message={form.errors.name}
                                        />
                                    </div>
                                    <PhoneField
                                        value={form.data.phone}
                                        error={form.errors.phone}
                                        onChange={(v) =>
                                            form.setData('phone', v)
                                        }
                                    />
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="email">Пошта</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            autoComplete="email"
                                            inputMode="email"
                                            placeholder="you@gmail.com"
                                            value={form.data.email}
                                            onChange={(e) =>
                                                form.setData(
                                                    'email',
                                                    e.target.value,
                                                )
                                            }
                                            className="h-11"
                                        />
                                        <InputError
                                            message={form.errors.email}
                                        />
                                        {form.errors.email?.includes(
                                            'зареєстрована',
                                        ) && (
                                            <Link
                                                href="/login"
                                                className="text-sm font-medium text-primary hover:underline"
                                            >
                                                Увійти й продовжити →
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            )}
                        </Step>

                        <div className="rounded-xl border bg-card">
                            <button
                                type="button"
                                onClick={() => setExtras(!extras)}
                                className="flex w-full items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground"
                            >
                                <TicketPercent className="size-4" /> Промокод і
                                назва сервера
                                <ChevronDown
                                    className={cn(
                                        'ml-auto size-4 transition',
                                        extras && 'rotate-180',
                                    )}
                                />
                            </button>
                            {extras && (
                                <div className="grid gap-4 border-t p-4 sm:grid-cols-2">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="promo">Промокод</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="promo"
                                                placeholder="RAPTOR10"
                                                value={promoInput}
                                                onChange={(e) =>
                                                    setPromoInput(
                                                        e.target.value.toUpperCase(),
                                                    )
                                                }
                                            />
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                disabled={
                                                    !promoInput || checking
                                                }
                                                onClick={() =>
                                                    form.setData(
                                                        'promo',
                                                        promoInput.trim(),
                                                    )
                                                }
                                            >
                                                {checking ? (
                                                    <Loader2 className="size-4 animate-spin" />
                                                ) : (
                                                    'OK'
                                                )}
                                            </Button>
                                        </div>
                                        {quote && form.data.promo && (
                                            <p className="text-sm text-primary">
                                                Знижка{' '}
                                                {quote.discount.formatted}{' '}
                                                застосована
                                            </p>
                                        )}
                                        <InputError
                                            message={
                                                promoError ?? form.errors.promo
                                            }
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="server_name">
                                            Назва сервера
                                        </Label>
                                        <Input
                                            id="server_name"
                                            placeholder={plan.name}
                                            value={form.data.server_name}
                                            maxLength={64}
                                            onChange={(e) =>
                                                form.setData(
                                                    'server_name',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={form.errors.server_name}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <aside className="lg:sticky lg:top-6 lg:self-start">
                        <div className="rounded-2xl border bg-card p-5 shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold">
                                    Ваше замовлення
                                </span>
                                {currencies.length > 1 && (
                                    <div className="ml-auto flex rounded-lg border p-0.5">
                                        {currencies.map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() =>
                                                    switchCurrency(c)
                                                }
                                                className={cn(
                                                    'rounded-md px-2 py-0.5 text-xs font-medium',
                                                    c === currency
                                                        ? 'bg-primary text-primary-foreground'
                                                        : 'text-muted-foreground',
                                                )}
                                            >
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <ul className="mt-4 space-y-1.5 text-sm">
                                {plan.features.map((f) => (
                                    <li
                                        key={f}
                                        className="flex items-center gap-2"
                                    >
                                        <Check className="size-4 shrink-0 text-primary" />{' '}
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            <dl className="mt-5 space-y-2 border-t pt-4 text-sm">
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground">
                                        {price.period}
                                    </dt>
                                    <dd>{price.formatted}</dd>
                                </div>
                                {quote && quote.discount.amount > 0 && (
                                    <div className="flex justify-between text-primary">
                                        <dt>Промокод {form.data.promo}</dt>
                                        <dd>−{quote.discount.formatted}</dd>
                                    </div>
                                )}
                                {balance && balance.amount > 0 && (
                                    <div className="flex justify-between text-muted-foreground">
                                        <dt>На балансі</dt>
                                        <dd>{balance.formatted}</dd>
                                    </div>
                                )}
                                <div className="flex items-baseline justify-between pt-2">
                                    <dt className="font-medium">До сплати</dt>
                                    <dd className="text-3xl font-semibold tracking-tight">
                                        {total.formatted}
                                    </dd>
                                </div>
                            </dl>

                            {!fromBalance && (
                                <label className="mt-4 flex items-start gap-2.5 text-sm">
                                    <Checkbox
                                        checked={form.data.save_card}
                                        onCheckedChange={(v) =>
                                            form.setData(
                                                'save_card',
                                                v === true,
                                            )
                                        }
                                        className="mt-0.5"
                                    />
                                    <span>
                                        Продовжувати автоматично з цієї картки
                                        <span className="block text-xs text-muted-foreground">
                                            Вимкнути можна в кабінеті будь-коли
                                        </span>
                                    </span>
                                </label>
                            )}

                            <Button
                                size="lg"
                                className="mt-5 hidden h-12 w-full text-base lg:flex"
                                disabled={form.processing}
                            >
                                {form.processing ? (
                                    <Loader2 className="size-5 animate-spin" />
                                ) : (
                                    <Lock className="size-4" />
                                )}
                                {payLabel}
                            </Button>
                            <InputError
                                className="mt-2"
                                message={form.errors.terms}
                            />

                            <p className="mt-3 text-center text-xs text-muted-foreground">
                                Натискаючи «Оплатити», ви погоджуєтесь з умовами
                                надання послуг. Оплата карткою, Apple Pay або
                                Google Pay через plata by mono.
                            </p>

                            <div className="mt-5 grid gap-2 border-t pt-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-2">
                                    <Zap className="size-4 text-primary" />{' '}
                                    Сервер готовий за хвилину після оплати
                                </span>
                                <span className="flex items-center gap-2">
                                    <ShieldCheck className="size-4 text-primary" />{' '}
                                    Захист від DDoS і щоденні бекапи
                                </span>
                                <span className="flex items-center gap-2">
                                    <Clock className="size-4 text-primary" />{' '}
                                    Нагадаємо про оплату заздалегідь
                                </span>
                            </div>
                        </div>
                    </aside>
                </form>

                <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur lg:hidden">
                    <Button
                        size="lg"
                        className="h-12 w-full text-base"
                        disabled={form.processing}
                        onClick={() => submit()}
                    >
                        {form.processing ? (
                            <Loader2 className="size-5 animate-spin" />
                        ) : (
                            <Lock className="size-4" />
                        )}
                        {payLabel}
                    </Button>
                </div>
            </div>
        </>
    );
}

function Step({
    n,
    title,
    hint,
    children,
}: {
    n: number;
    title: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <section>
            <div className="mb-3 flex items-center gap-3">
                <span className="grid size-7 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {n}
                </span>
                <div>
                    <h2 className="font-semibold">{title}</h2>
                    {hint && (
                        <p className="text-sm text-muted-foreground">{hint}</p>
                    )}
                </div>
            </div>
            {children}
        </section>
    );
}

function PhoneField({
    value,
    error,
    onChange,
}: {
    value: string;
    error?: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="grid gap-1.5">
            <Label htmlFor="phone">Телефон</Label>
            <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+380 50 123 45 67"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-11"
            />
            <InputError message={error} />
        </div>
    );
}
