import { Head, router, useForm } from '@inertiajs/react';
import { Copy, PlugZap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader, Panel } from '@/lib/billing';
import { cn } from '@/lib/utils';
import { Field } from '@/components/billing';

const keys = [
    'company_name',
    'company_url',
    'logo_url',
    'company_details',
    'support_email',
    'currencies',
    'panel_url',
    'panel_key',
    'panel_webhook_secret',
    'monopay_token',
    'invoice_days_before',
    'suspend_after_days',
    'terminate_after_days',
    'invoice_prefix',
] as const;
type Values = Record<(typeof keys)[number], string>;
type Props = {
    values: Values;
    currencies: string[];
    webhooks: { monopay: string; raptor: string };
};

export default function Settings({ values, currencies, webhooks }: Props) {
    const form = useForm<Omit<Values, 'currencies'> & { currencies: string[] }>(
        { ...values, currencies: values.currencies.split(',').filter(Boolean) },
    );
    const set =
        (key: Exclude<(typeof keys)[number], 'currencies'>) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            form.setData(key, e.target.value);
    const err = (key: string) => (form.errors as Record<string, string>)[key];

    return (
        <>
            <Head title="Налаштування білінгу" />
            <form
                className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6"
                onSubmit={(e) => {
                    e.preventDefault();
                    form.put('/admin/settings', { preserveScroll: true });
                }}
            >
                <PageHeader
                    title="Налаштування"
                    actions={
                        <Button disabled={form.processing}>Зберегти</Button>
                    }
                />

                <Panel
                    title="Компанія"
                    description="Видно в магазині, рахунках і листах."
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Назва" error={err('company_name')}>
                            <Input
                                value={form.data.company_name}
                                onChange={set('company_name')}
                            />
                        </Field>
                        <Field
                            label="Email підтримки"
                            error={err('support_email')}
                        >
                            <Input
                                type="email"
                                value={form.data.support_email}
                                onChange={set('support_email')}
                            />
                        </Field>
                        <Field label="Сайт хостингу" error={err('company_url')}>
                            <Input
                                placeholder="https://hostmc.net.ua"
                                value={form.data.company_url}
                                onChange={set('company_url')}
                            />
                        </Field>
                        <Field
                            label="Логотип (URL картинки, квадратний)"
                            error={err('logo_url')}
                        >
                            <Input
                                placeholder="https://hostmc.net.ua/logo.png"
                                value={form.data.logo_url}
                                onChange={set('logo_url')}
                            />
                        </Field>
                        <div className="sm:col-span-2">
                            <Field
                                label="Реквізити (ФОП, ЄДРПОУ, адреса) для рахунків"
                                error={err('company_details')}
                            >
                                <textarea
                                    rows={3}
                                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
                                    value={form.data.company_details}
                                    onChange={set('company_details')}
                                />
                            </Field>
                        </div>
                        <Field label="Валюти" error={err('currencies')}>
                            <div className="flex gap-2">
                                {currencies.map((c) => {
                                    const on = form.data.currencies.includes(c);

                                    return (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() =>
                                                form.setData(
                                                    'currencies',
                                                    on
                                                        ? form.data.currencies.filter(
                                                              (x) => x !== c,
                                                          )
                                                        : [
                                                              ...form.data
                                                                  .currencies,
                                                              c,
                                                          ],
                                                )
                                            }
                                            className={cn(
                                                'h-9 rounded-md border px-4 text-sm',
                                                on
                                                    ? 'border-primary bg-primary/10 text-primary'
                                                    : 'text-muted-foreground',
                                            )}
                                        >
                                            {c}
                                        </button>
                                    );
                                })}
                            </div>
                        </Field>
                        <Field
                            label="Префікс рахунків"
                            error={err('invoice_prefix')}
                        >
                            <Input
                                value={form.data.invoice_prefix}
                                onChange={(e) =>
                                    form.setData(
                                        'invoice_prefix',
                                        e.target.value.toUpperCase(),
                                    )
                                }
                            />
                        </Field>
                    </div>
                </Panel>

                <Panel
                    title="Raptor Panel"
                    description="Ключ Raptor API: Адмінка панелі → Raptor API → Ключі (права servers і users: write)."
                    actions={
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                router.post(
                                    '/admin/settings/test-panel',
                                    {},
                                    { preserveScroll: true },
                                )
                            }
                        >
                            <PlugZap className="size-4" /> Перевірити
                        </Button>
                    }
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Адреса панелі" error={err('panel_url')}>
                            <Input
                                placeholder="https://panel.example.com"
                                value={form.data.panel_url}
                                onChange={set('panel_url')}
                            />
                        </Field>
                        <Field label="Ключ API" error={err('panel_key')}>
                            <Input
                                type="password"
                                autoComplete="off"
                                value={form.data.panel_key}
                                onChange={set('panel_key')}
                            />
                        </Field>
                        <Field
                            label="Секрет вебхука"
                            error={err('panel_webhook_secret')}
                        >
                            <Input
                                type="password"
                                autoComplete="off"
                                value={form.data.panel_webhook_secret}
                                onChange={set('panel_webhook_secret')}
                            />
                        </Field>
                        <Field label="URL вебхука для панелі">
                            <CopyField value={webhooks.raptor} />
                        </Field>
                    </div>
                </Panel>

                <Panel
                    title="plata by mono"
                    description="Токен з web.monobank.ua → Налаштування → API. Для тестів — токен з api.monobank.ua."
                    actions={
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                router.post(
                                    '/admin/settings/test-monopay',
                                    {},
                                    { preserveScroll: true },
                                )
                            }
                        >
                            <PlugZap className="size-4" /> Перевірити
                        </Button>
                    }
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="X-Token" error={err('monopay_token')}>
                            <Input
                                type="password"
                                autoComplete="off"
                                value={form.data.monopay_token}
                                onChange={set('monopay_token')}
                            />
                        </Field>
                        <Field label="URL вебхука (підставляється сам)">
                            <CopyField value={webhooks.monopay} />
                        </Field>
                    </div>
                </Panel>

                <Panel
                    title="Автоматика"
                    description="Перевірка щогодини. Нагадування листами про кожен крок."
                >
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Field
                            label="Рахунок за N днів до кінця"
                            error={err('invoice_days_before')}
                        >
                            <Input
                                type="number"
                                min={0}
                                max={30}
                                value={form.data.invoice_days_before}
                                onChange={set('invoice_days_before')}
                            />
                        </Field>
                        <Field
                            label="Призупинити через N днів боргу"
                            error={err('suspend_after_days')}
                        >
                            <Input
                                type="number"
                                min={0}
                                max={30}
                                value={form.data.suspend_after_days}
                                onChange={set('suspend_after_days')}
                            />
                        </Field>
                        <Field
                            label="Видалити через N днів боргу"
                            error={err('terminate_after_days')}
                        >
                            <Input
                                type="number"
                                min={1}
                                max={90}
                                value={form.data.terminate_after_days}
                                onChange={set('terminate_after_days')}
                            />
                        </Field>
                    </div>
                </Panel>
            </form>
        </>
    );
}

function CopyField({ value }: { value: string }) {
    return (
        <div className="flex gap-2">
            <Input readOnly value={value} className="font-mono text-xs" />
            <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Копіювати"
                onClick={() =>
                    navigator.clipboard
                        .writeText(value)
                        .then(() => toast.success('Скопійовано'))
                }
            >
                <Copy className="size-4" />
            </Button>
        </div>
    );
}

Settings.layout = {
    breadcrumbs: [{ title: 'Налаштування', href: '/admin/settings' }],
};
