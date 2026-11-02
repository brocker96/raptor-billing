import { Head, Link, router, usePage } from '@inertiajs/react';
import { Announcement } from '@/components/announcement';
import {
    Check,
    Cpu,
    Gauge,
    HardDrive,
    Headphones,
    ShieldCheck,
    Sparkles,
    Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Plan } from '@/types/billing';

type Props = {
    currency: string;
    currencies: string[];
    plans: Plan[];
    name: string;
    auth: { user: { name: string; balance: { formatted: string } } | null };
};

const perks = [
    {
        icon: Zap,
        title: 'Запуск за хвилину',
        text: 'Після оплати сервер створюється автоматично, без очікування оператора.',
    },
    {
        icon: Gauge,
        title: 'Raptor Panel',
        text: 'Сучасна панель керування: консоль, файли, бекапи, бази даних, розклади.',
    },
    {
        icon: ShieldCheck,
        title: 'Захист і бекапи',
        text: 'Ізольовані контейнери, двофакторний вхід і резервні копії за розкладом.',
    },
    {
        icon: Headphones,
        title: 'Підтримка',
        text: 'Відповідаємо українською та допомагаємо з налаштуванням сервера.',
    },
];

export default function Shop({
    currency,
    currencies,
    plans,
    name,
    auth,
}: Props) {
    const periods = useMemo(
        () =>
            [
                ...new Set(
                    plans.flatMap((p) => p.prices.map((x) => x.period_months)),
                ),
            ].sort((a, b) => a - b),
        [plans],
    );
    const [period, setPeriod] = useState(
        periods.includes(1) ? 1 : (periods[0] ?? 1),
    );
    const categories = useMemo(
        () => [...new Set(plans.map((p) => p.category))],
        [plans],
    );
    const [category, setCategory] = useState(categories[0] ?? '');
    const visible = plans.filter((p) => p.category === category);
    const user = auth.user;
    const { url, props: shared } = usePage<{
        company_url?: string;
        logo?: string;
    }>();
    const company_url = shared.company_url;

    const switchCurrency = (value: string) => {
        document.cookie = `currency=${value};path=/;max-age=31536000`;
        router.get(
            url.split('?')[0],
            { currency: value },
            { preserveScroll: true, preserveState: false },
        );
    };

    return (
        <>
            <Head title="Ігрові сервери" />
            <div className="min-h-screen bg-background">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_22%,transparent),transparent)]" />
                <div className="relative mx-auto max-w-6xl px-4 pt-4 empty:hidden">
                    <Announcement />
                </div>
                <header className="relative mx-auto flex max-w-6xl items-center gap-4 px-4 py-5">
                    <Link href="/" className="flex items-center gap-2.5">
                        <img
                            src={shared.logo ?? '/brand/raptor-icon-128.webp'}
                            alt=""
                            className="size-9 drop-shadow-[0_0_14px_rgba(110,255,60,0.45)]"
                        />
                        <span className="text-lg font-semibold tracking-tight">
                            {name}
                        </span>
                    </Link>
                    <div className="ml-auto flex items-center gap-2">
                        {currencies.length > 1 && !user && (
                            <div className="hidden rounded-lg border p-0.5 sm:flex">
                                {currencies.map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => switchCurrency(c)}
                                        className={cn(
                                            'rounded-md px-2.5 py-1 text-xs font-medium',
                                            c === currency
                                                ? 'bg-primary text-primary-foreground'
                                                : 'text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        )}
                        {user ? (
                            <Button asChild>
                                <Link href="/dashboard">
                                    Кабінет · {user.balance.formatted}
                                </Link>
                            </Button>
                        ) : (
                            <>
                                <Button variant="ghost" asChild>
                                    <Link href="/login">Увійти</Link>
                                </Button>
                                <Button asChild>
                                    <Link href="/register">Реєстрація</Link>
                                </Button>
                            </>
                        )}
                    </div>
                </header>

                <section className="relative mx-auto max-w-6xl px-4 pt-10 pb-12 text-center sm:pt-16">
                    <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        <Sparkles className="size-3.5" /> Хостинг ігрових
                        серверів на Raptor Panel
                    </span>
                    <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
                        Ваш сервер готовий{' '}
                        <span className="text-primary">за хвилину</span>
                    </h1>
                    <p className="mx-auto mt-4 max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
                        Оберіть тариф, сплатіть карткою через Plata by mono, і
                        сервер з’явиться в панелі автоматично. Продовження з
                        балансу або збереженої картки.
                    </p>
                </section>

                <section className="relative mx-auto max-w-6xl px-4 pb-20">
                    <div className="mb-6 flex flex-wrap items-center gap-3">
                        {categories.length > 1 && (
                            <div className="flex flex-wrap gap-1 rounded-xl border bg-card p-1">
                                {categories.map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => setCategory(c)}
                                        className={cn(
                                            'rounded-lg px-3 py-1.5 text-sm font-medium',
                                            c === category
                                                ? 'bg-primary text-primary-foreground'
                                                : 'text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        )}
                        {periods.length > 1 && (
                            <div className="ml-auto flex flex-wrap gap-1 rounded-xl border bg-card p-1">
                                {periods.map((m) => (
                                    <button
                                        key={m}
                                        onClick={() => setPeriod(m)}
                                        className={cn(
                                            'rounded-lg px-3 py-1.5 text-sm font-medium',
                                            m === period
                                                ? 'bg-secondary text-foreground'
                                                : 'text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {plans[0]?.prices.find(
                                            (p) => p.period_months === m,
                                        )?.period ?? `${m} міс.`}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {visible.length === 0 ? (
                        <div className="rounded-2xl border bg-card px-6 py-16 text-center text-muted-foreground">
                            Тарифи ще не опубліковано. Загляньте трохи пізніше.
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {visible.map((plan) => {
                                const price =
                                    plan.prices.find(
                                        (p) => p.period_months === period,
                                    ) ?? plan.prices[0];
                                const monthly = plan.prices.find(
                                    (p) => p.period_months === 1,
                                );
                                const saving =
                                    monthly && price && price.period_months > 1
                                        ? Math.round(
                                              (1 -
                                                  price.amount /
                                                      (monthly.amount *
                                                          price.period_months)) *
                                                  100,
                                          )
                                        : 0;

                                return (
                                    <article
                                        key={plan.id}
                                        className={cn(
                                            'relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg',
                                            plan.featured &&
                                                'border-primary/50 shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_35%,transparent),0_20px_50px_-20px_color-mix(in_oklch,var(--primary)_45%,transparent)]',
                                        )}
                                    >
                                        {plan.featured && (
                                            <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                                                Популярний
                                            </span>
                                        )}
                                        <h3 className="text-lg font-semibold">
                                            {plan.name}
                                        </h3>
                                        {plan.description && (
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {plan.description}
                                            </p>
                                        )}
                                        <div className="mt-5 flex items-end gap-2">
                                            <span className="text-3xl font-bold tracking-tight">
                                                {price?.monthly.formatted}
                                            </span>
                                            <span className="pb-1 text-sm text-muted-foreground">
                                                / місяць
                                            </span>
                                        </div>
                                        <p className="mt-1 h-5 text-xs text-muted-foreground">
                                            {price &&
                                                price.period_months > 1 && (
                                                    <>
                                                        {price.formatted} за{' '}
                                                        {price.period.toLowerCase()}
                                                        {saving > 0 && (
                                                            <span className="ml-1.5 font-medium text-primary">
                                                                −{saving}%
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                        </p>
                                        <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                                            {plan.features.map((f) => (
                                                <li
                                                    key={f}
                                                    className="flex gap-2.5"
                                                >
                                                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                                                    {f}
                                                </li>
                                            ))}
                                        </ul>
                                        {plan.in_stock === false ? (
                                            <Button
                                                className="mt-6 w-full"
                                                variant="secondary"
                                                disabled
                                            >
                                                Немає в наявності
                                            </Button>
                                        ) : (
                                            <Button
                                                className="mt-6 w-full"
                                                variant={
                                                    plan.featured
                                                        ? 'default'
                                                        : 'secondary'
                                                }
                                                asChild
                                            >
                                                <Link
                                                    href={`/checkout/${plan.slug}?period=${price?.period_months ?? 1}`}
                                                >
                                                    Замовити
                                                </Link>
                                            </Button>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    )}

                    <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {perks.map(({ icon: Icon, title, text }) => (
                            <div
                                key={title}
                                className="rounded-2xl border bg-card/60 p-5"
                            >
                                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 ring-1 ring-primary/20 ring-inset">
                                    <Icon className="size-5 text-primary" />
                                </span>
                                <p className="mt-4 font-medium">{title}</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {text}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                <footer className="border-t">
                    <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-6 text-sm text-muted-foreground">
                        <span>
                            © {new Date().getFullYear()}{' '}
                            {company_url ? (
                                <a
                                    href={company_url}
                                    className="hover:text-foreground"
                                >
                                    {name}
                                </a>
                            ) : (
                                name
                            )}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <Cpu className="size-4" /> Raptor Panel
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <HardDrive className="size-4" /> Оплата через Plata
                            by mono
                        </span>
                    </div>
                </footer>
            </div>
        </>
    );
}
