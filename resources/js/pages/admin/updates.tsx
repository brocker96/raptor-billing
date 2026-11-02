import { Deferred, Head, router, useForm } from '@inertiajs/react';
import {
    ArchiveRestore,
    ArrowUpCircle,
    CheckCircle2,
    CircleAlert,
    Clock3,
    Download,
    ExternalLink,
    History,
    Loader2,
    RefreshCw,
    ShieldCheck,
    Sparkles,
    TerminalSquare,
    XCircle,
} from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Switch } from '@/components/billing';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { date, PageHeader, Panel, Pill } from '@/lib/billing';
import { bytes } from '@/lib/format';
import { cn } from '@/lib/utils';

type Release = {
    version: string;
    tag: string;
    name: string;
    prerelease: boolean;
    published_at: string | null;
    url: string;
    notes: string;
    archive: string | null;
};
type State = {
    status: 'idle' | 'queued' | 'running' | 'completed' | 'failed';
    action: string | null;
    target: string | null;
    step: string | null;
    error: string | null;
    requested_by: string | null;
    started_at: string | null;
    finished_at: string | null;
    from: string | null;
};
type Backup = {
    id: string;
    version: string;
    created_at: string | null;
    size: number;
    database: boolean;
};
type Check = { key: string; label: string; ok: boolean; detail: string };
type Props = {
    current: string;
    development: boolean;
    repository: string;
    settings: {
        channel: 'stable' | 'beta';
        auto_check: boolean;
        auto_install: boolean;
        hour: number;
    };
    state: State;
    log: string;
    backups: Backup[];
    history: (Partial<State> & { status: string })[];
    releases?: {
        error: string | null;
        latest: Release | null;
        update_available: boolean;
        list: Release[];
    };
    health: Check[];
    services?: Check[];
};

/** The steps an update goes through, matched against the step text the updater writes. */
const STEPS = [
    ['Завантаження', 'Завантаження релізу'],
    ['Резервна копія', 'Резервна копія'],
    ['Обслуговування', 'Режим обслуговування'],
    ['Файли', 'Заміна файлів'],
    ['Залежності', 'Встановлення PHP'],
    ['База даних', 'Міграції'],
    ['Запуск', 'Перезапуск'],
] as const;

export default function Updates(props: Props) {
    const { current, development, settings, backups, history, health } = props;
    const [state, setState] = useState(props.state);
    const [log, setLog] = useState(props.log);
    const [confirm, setConfirm] = useState<Release | null>(null);
    const [restore, setRestore] = useState<Backup | null>(null);
    const [showLog, setShowLog] = useState(false);
    const active = state.status === 'queued' || state.status === 'running';

    useEffect(() => {
        if (!active) {
            return;
        }
        const timer = window.setInterval(async () => {
            try {
                const response = await fetch('/admin/updates/status', {
                    headers: { Accept: 'application/json' },
                });
                if (!response.ok) {
                    return;
                }
                const data = (await response.json()) as {
                    state: State;
                    log: string;
                };
                setState(data.state);
                setLog(data.log);
                if (
                    data.state.status === 'completed' ||
                    data.state.status === 'failed'
                ) {
                    window.clearInterval(timer);
                    window.setTimeout(() => router.reload(), 1200);
                }
            } catch {
                // The site restarts during the update, the next poll gets through.
            }
        }, 2000);

        return () => window.clearInterval(timer);
    }, [active]);

    return (
        <>
            <Head title="Оновлення" />
            <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Оновлення та система"
                    description="Нові версії встановлюються з резервною копією і повертаються самі, якщо щось пішло не так."
                />

                <Deferred
                    data="releases"
                    fallback={<Skeleton className="h-44 w-full rounded-2xl" />}
                >
                    <Hero
                        current={current}
                        development={development}
                        channel={settings.channel}
                        releases={props.releases}
                        busy={active}
                        onInstall={setConfirm}
                    />
                </Deferred>

                {active && <Progress state={state} log={log} />}

                {!active && state.status === 'failed' && (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5">
                        <div className="flex items-start gap-3">
                            <XCircle className="mt-0.5 size-5 shrink-0 text-rose-500" />
                            <div className="min-w-0 flex-1">
                                <div className="font-medium">{state.step}</div>
                                <div className="mt-1 text-sm break-words text-muted-foreground">
                                    {state.error}
                                </div>
                                <button
                                    className="mt-2 text-sm text-primary hover:underline"
                                    onClick={() => setShowLog(!showLog)}
                                >
                                    {showLog
                                        ? 'Сховати журнал'
                                        : 'Показати журнал'}
                                </button>
                            </div>
                        </div>
                        {showLog && <Terminal log={log} className="mt-4" />}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                    <div className="space-y-6">
                        <Deferred
                            data="releases"
                            fallback={
                                <Skeleton className="h-72 w-full rounded-xl" />
                            }
                        >
                            <ReleaseList
                                releases={props.releases}
                                current={current}
                                busy={active}
                                onInstall={setConfirm}
                            />
                        </Deferred>
                        <Backups
                            backups={backups}
                            busy={active}
                            onRestore={setRestore}
                        />
                    </div>
                    <div className="space-y-6">
                        <HealthPanel
                            health={health}
                            services={props.services}
                        />
                        <SettingsPanel settings={settings} />
                        <HistoryPanel history={history} />
                    </div>
                </div>
            </div>

            <Dialog
                open={confirm !== null}
                onOpenChange={(open) => !open && setConfirm(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Оновити до {confirm?.tag}?</DialogTitle>
                        <DialogDescription>
                            Займе 1–3 хвилини. Клієнти на цей час побачать
                            сторінку обслуговування.
                        </DialogDescription>
                    </DialogHeader>
                    <ul className="space-y-2.5 text-sm">
                        <Li icon={ShieldCheck}>
                            Спершу резервна копія файлів і бази даних
                        </Li>
                        <Li icon={Download}>
                            Архів перевіряється за контрольною сумою SHA-256
                        </Li>
                        <Li icon={ArchiveRestore}>
                            Будь-яка помилка — і попередня версія повертається
                            сама
                        </Li>
                        <Li icon={Clock3}>
                            Оновлення почнеться протягом хвилини (його запускає
                            cron)
                        </Li>
                    </ul>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setConfirm(null)}
                        >
                            Не зараз
                        </Button>
                        <Button
                            onClick={() =>
                                router.post(
                                    '/admin/updates/install',
                                    { version: confirm?.version },
                                    {
                                        preserveScroll: true,
                                        onSuccess: () => {
                                            setConfirm(null);
                                            router.reload({
                                                only: ['state', 'log'],
                                                onSuccess: (page) => {
                                                    setState(
                                                        page.props
                                                            .state as State,
                                                    );
                                                    setLog(
                                                        page.props
                                                            .log as string,
                                                    );
                                                },
                                            });
                                        },
                                    },
                                )
                            }
                        >
                            <ArrowUpCircle className="size-4" /> Оновити
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={restore !== null}
                onOpenChange={(open) => !open && setRestore(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Повернути версію {restore?.version}?
                        </DialogTitle>
                        <DialogDescription>
                            Файли і база даних повернуться до стану на{' '}
                            {date(restore?.created_at, true)}. Усе, що змінилося
                            після цього (оплати, нові клієнти), буде втрачено.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setRestore(null)}
                        >
                            Скасувати
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() =>
                                router.post(
                                    '/admin/updates/rollback',
                                    { backup: restore?.id },
                                    {
                                        preserveScroll: true,
                                        onSuccess: () => {
                                            setRestore(null);
                                            router.reload();
                                        },
                                    },
                                )
                            }
                        >
                            Відновити
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function Hero({
    current,
    development,
    channel,
    releases,
    busy,
    onInstall,
}: {
    current: string;
    development: boolean;
    channel: string;
    releases?: Props['releases'];
    busy: boolean;
    onInstall: (r: Release) => void;
}) {
    const latest = releases?.latest;
    const available = releases?.update_available && latest;
    const [checking, setChecking] = useState(false);

    return (
        <section className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm md:p-8">
            <div
                className={cn(
                    'pointer-events-none absolute -top-24 -right-24 size-80 rounded-full blur-3xl',
                    available ? 'bg-primary/25' : 'bg-primary/10',
                )}
            />
            <div className="relative flex flex-wrap items-center gap-6">
                <div
                    className={cn(
                        'grid size-16 shrink-0 place-items-center rounded-2xl ring-1 ring-inset',
                        available
                            ? 'bg-primary/15 ring-primary/30'
                            : 'bg-muted ring-border',
                    )}
                >
                    {available ? (
                        <Sparkles className="size-7 text-primary" />
                    ) : (
                        <CheckCircle2 className="size-7 text-primary" />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        Встановлено
                        <Pill tone={channel === 'beta' ? 'yellow' : 'green'}>
                            {channel === 'beta'
                                ? 'канал beta'
                                : 'стабільний канал'}
                        </Pill>
                        {development && <Pill tone="blue">збірка з git</Pill>}
                    </div>
                    <div className="mt-1 font-mono text-3xl font-semibold tracking-tight md:text-4xl">
                        {development ? current : `v${current}`}
                    </div>
                    <div className="mt-1 text-sm">
                        {releases?.error ? (
                            <span className="text-rose-500">
                                {releases.error}
                            </span>
                        ) : available ? (
                            <span>
                                Доступна{' '}
                                <b className="text-primary">{latest.tag}</b>
                                {latest.published_at && (
                                    <span className="text-muted-foreground">
                                        {' '}
                                        · вийшла {date(latest.published_at)}
                                    </span>
                                )}
                            </span>
                        ) : latest ? (
                            <span className="text-muted-foreground">
                                Це найновіша версія.
                            </span>
                        ) : (
                            <span className="text-muted-foreground">
                                Релізів на цьому каналі ще немає.
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        disabled={checking}
                        onClick={() =>
                            router.post(
                                '/admin/updates/check',
                                {},
                                {
                                    preserveScroll: true,
                                    onStart: () => setChecking(true),
                                    onFinish: () => setChecking(false),
                                },
                            )
                        }
                    >
                        <RefreshCw
                            className={cn('size-4', checking && 'animate-spin')}
                        />{' '}
                        Перевірити
                    </Button>
                    {available && (
                        <Button
                            size="lg"
                            disabled={busy}
                            onClick={() => onInstall(latest)}
                        >
                            <ArrowUpCircle className="size-4" /> Оновити до{' '}
                            {latest.tag}
                        </Button>
                    )}
                </div>
            </div>
        </section>
    );
}

function Progress({ state, log }: { state: State; log: string }) {
    const index = Math.max(
        0,
        STEPS.findIndex(([, match]) => state.step?.startsWith(match)),
    );
    const percent =
        state.status === 'queued'
            ? 4
            : Math.round(((index + 0.5) / STEPS.length) * 100);

    return (
        <Panel
            title={
                <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    {state.action === 'rollback'
                        ? 'Відновлення копії '
                        : 'Оновлення до '}
                    {state.target}
                </span>
            }
            description={state.step}
            actions={
                state.status === 'queued' && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                            router.post(
                                '/admin/updates/cancel',
                                {},
                                { onSuccess: () => router.reload() },
                            )
                        }
                    >
                        Скасувати
                    </Button>
                )
            }
        >
            <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                    className="h-full rounded-full bg-primary transition-all duration-700"
                    style={{ width: `${percent}%` }}
                />
            </div>
            {state.action !== 'rollback' && (
                <ol className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-7">
                    {STEPS.map(([label], i) => {
                        const done = state.status === 'running' && i < index;
                        const now = state.status === 'running' && i === index;

                        return (
                            <li
                                key={label}
                                className={cn(
                                    'flex items-center gap-1.5 rounded-lg border px-2.5 py-2',
                                    now &&
                                        'border-primary/50 bg-primary/5 text-foreground',
                                    done && 'text-muted-foreground',
                                    !done && !now && 'text-muted-foreground/60',
                                )}
                            >
                                {done ? (
                                    <CheckCircle2 className="size-3.5 text-primary" />
                                ) : now ? (
                                    <Loader2 className="size-3.5 animate-spin text-primary" />
                                ) : (
                                    <span className="size-3.5 rounded-full border" />
                                )}
                                {label}
                            </li>
                        );
                    })}
                </ol>
            )}
            <Terminal log={log} className="mt-4" />
        </Panel>
    );
}

function Terminal({ log, className }: { log: string; className?: string }) {
    const ref = useRef<HTMLPreElement>(null);
    useEffect(() => {
        ref.current?.scrollTo({ top: ref.current.scrollHeight });
    }, [log]);

    return (
        <div
            className={cn(
                'overflow-hidden rounded-xl border bg-zinc-950 text-zinc-300',
                className,
            )}
        >
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-xs text-zinc-400">
                <TerminalSquare className="size-3.5" /> update.log
            </div>
            <pre
                ref={ref}
                className="max-h-72 overflow-auto p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap"
            >
                {log || 'Чекаємо на перший рядок…'}
            </pre>
        </div>
    );
}

function ReleaseList({
    releases,
    current,
    busy,
    onInstall,
}: {
    releases?: Props['releases'];
    current: string;
    busy: boolean;
    onInstall: (r: Release) => void;
}) {
    const [open, setOpen] = useState<string | null>(
        releases?.list[0]?.version ?? null,
    );

    if (!releases || releases.list.length === 0) {
        return (
            <Panel title="Що нового">
                <p className="text-sm text-muted-foreground">
                    {releases?.error ??
                        'Тут з’являться нотатки до релізів з GitHub.'}
                </p>
            </Panel>
        );
    }

    return (
        <Panel title="Що нового" description="Останні релізи з GitHub" flush>
            <ul className="divide-y">
                {releases.list.map((release) => {
                    const installed = release.version === current;
                    const expanded = open === release.version;

                    return (
                        <li key={release.version}>
                            <button
                                className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/40"
                                onClick={() =>
                                    setOpen(expanded ? null : release.version)
                                }
                            >
                                <span className="font-mono font-semibold">
                                    {release.tag}
                                </span>
                                {release.prerelease && (
                                    <Pill tone="yellow">beta</Pill>
                                )}
                                {installed && (
                                    <Pill tone="green">встановлено</Pill>
                                )}
                                <span className="ml-auto text-sm text-muted-foreground">
                                    {date(release.published_at)}
                                </span>
                            </button>
                            {expanded && (
                                <div className="px-5 pb-5">
                                    <Markdown
                                        text={release.notes || 'Без опису.'}
                                    />
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {!installed && release.archive && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={busy}
                                                onClick={() =>
                                                    onInstall(release)
                                                }
                                            >
                                                <Download className="size-3.5" />{' '}
                                                Встановити {release.tag}
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            asChild
                                        >
                                            <a
                                                href={release.url}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                GitHub{' '}
                                                <ExternalLink className="size-3.5" />
                                            </a>
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </Panel>
    );
}

function HealthPanel({
    health,
    services,
}: {
    health: Check[];
    services?: Check[];
}) {
    const all = [...health, ...(services ?? [])];
    const problems = all.filter((c) => !c.ok).length;

    return (
        <Panel
            title="Стан системи"
            actions={
                services ? (
                    <Pill tone={problems ? 'yellow' : 'green'}>
                        {problems ? `проблем: ${problems}` : 'усе працює'}
                    </Pill>
                ) : (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                )
            }
            flush
        >
            <ul className="divide-y">
                {health.map((check) => (
                    <CheckRow key={check.key} check={check} />
                ))}
                <Deferred
                    data="services"
                    fallback={['Raptor Panel', 'plata by mono'].map((label) => (
                        <li
                            key={label}
                            className="flex items-center gap-3 px-5 py-3 text-sm"
                        >
                            <Loader2 className="size-4 animate-spin text-muted-foreground" />{' '}
                            {label}
                        </li>
                    ))}
                >
                    <>
                        {services?.map((check) => (
                            <CheckRow key={check.key} check={check} />
                        ))}
                    </>
                </Deferred>
            </ul>
        </Panel>
    );
}

function CheckRow({ check }: { check: Check }) {
    return (
        <li className="flex items-start gap-3 px-5 py-3 text-sm">
            {check.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
            ) : (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
            )}
            <span className="min-w-0">
                <span className="block font-medium">{check.label}</span>
                <span className="block text-xs break-words text-muted-foreground">
                    {check.detail}
                </span>
            </span>
        </li>
    );
}

function SettingsPanel({ settings }: { settings: Props['settings'] }) {
    const form = useForm(settings);
    const save = (data: Partial<Props['settings']>) => {
        const next = { ...form.data, ...data };
        form.setData(next);
        router.put('/admin/updates/settings', next, { preserveScroll: true });
    };

    return (
        <Panel title="Як оновлювати">
            <div className="flex rounded-lg border p-1">
                {(['stable', 'beta'] as const).map((channel) => (
                    <button
                        key={channel}
                        onClick={() => save({ channel })}
                        className={cn(
                            'h-8 flex-1 rounded-md text-sm',
                            form.data.channel === channel
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {channel === 'stable' ? 'Стабільні' : 'Бета-версії'}
                    </button>
                ))}
            </div>
            <div className="mt-4 space-y-4 text-sm">
                <label className="flex items-center justify-between gap-3">
                    <span>
                        <span className="block font-medium">
                            Перевіряти щогодини
                        </span>
                        <span className="text-xs text-muted-foreground">
                            І писати адмінам на пошту про нову версію
                        </span>
                    </span>
                    <Switch
                        checked={form.data.auto_check}
                        onChange={(v) => save({ auto_check: v })}
                    />
                </label>
                <label className="flex items-center justify-between gap-3">
                    <span>
                        <span className="block font-medium">
                            Ставити самостійно
                        </span>
                        <span className="text-xs text-muted-foreground">
                            Лише стабільні релізи, вночі
                        </span>
                    </span>
                    <Switch
                        checked={form.data.auto_install}
                        disabled={!form.data.auto_check}
                        onChange={(v) => save({ auto_install: v })}
                    />
                </label>
                {form.data.auto_install && (
                    <label className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                            О котрій годині
                        </span>
                        <select
                            className="h-8 rounded-md border bg-transparent px-2"
                            value={form.data.hour}
                            onChange={(e) =>
                                save({ hour: Number(e.target.value) })
                            }
                        >
                            {Array.from({ length: 24 }, (_, h) => (
                                <option key={h} value={h}>
                                    {String(h).padStart(2, '0')}:07
                                </option>
                            ))}
                        </select>
                    </label>
                )}
            </div>
        </Panel>
    );
}

function Backups({
    backups,
    busy,
    onRestore,
}: {
    backups: Backup[];
    busy: boolean;
    onRestore: (b: Backup) => void;
}) {
    return (
        <Panel
            title="Резервні копії"
            description="Робляться перед кожним оновленням, зберігаються три останні."
            flush
        >
            {backups.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">
                    Копій ще немає, перша з’явиться перед першим оновленням.
                </p>
            ) : (
                <ul className="divide-y">
                    {backups.map((backup) => (
                        <li
                            key={backup.id}
                            className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"
                        >
                            <ArchiveRestore className="size-4 text-muted-foreground" />
                            <span className="min-w-0 flex-1">
                                <span className="block font-medium">
                                    v{backup.version}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {date(backup.created_at, true)} ·{' '}
                                    {bytes(backup.size)}
                                    {backup.database ? ' · з базою даних' : ''}
                                </span>
                            </span>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => onRestore(backup)}
                            >
                                Відновити
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}

function HistoryPanel({ history }: { history: Props['history'] }) {
    if (history.length === 0) {
        return null;
    }

    return (
        <Panel title="Історія" flush>
            <ul className="divide-y">
                {history.slice(0, 8).map((entry, i) => (
                    <li
                        key={i}
                        className="flex items-start gap-3 px-5 py-3 text-sm"
                    >
                        {entry.status === 'completed' ? (
                            <CheckCircle2 className="mt-0.5 size-4 text-primary" />
                        ) : (
                            <XCircle className="mt-0.5 size-4 text-rose-500" />
                        )}
                        <span className="min-w-0">
                            <span className="block">
                                {entry.action === 'rollback'
                                    ? 'Відкат до копії'
                                    : `${entry.from ?? '?'} → ${entry.target}`}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                                <History className="mr-1 inline size-3" />
                                {date(entry.finished_at, true)}
                                {entry.requested_by &&
                                    ` · ${entry.requested_by}`}
                            </span>
                            {entry.error && (
                                <span className="block text-xs break-words text-rose-500">
                                    {entry.error}
                                </span>
                            )}
                        </span>
                    </li>
                ))}
            </ul>
        </Panel>
    );
}

function Li({
    icon: Icon,
    children,
}: {
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
}) {
    return (
        <li className="flex items-start gap-2.5">
            <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
            {children}
        </li>
    );
}

/**
 * Release notes: headings, lists, bold, inline code and links. Built from elements, the text of a
 * release is never inserted as HTML.
 */
function Markdown({ text }: { text: string }) {
    const inline = (line: string) =>
        line
            .split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g)
            .map((part, i) => {
                if (part.startsWith('**')) {
                    return <b key={i}>{part.slice(2, -2)}</b>;
                }
                if (part.startsWith('`')) {
                    return (
                        <code
                            key={i}
                            className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
                        >
                            {part.slice(1, -1)}
                        </code>
                    );
                }
                const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
                if (link) {
                    return (
                        <a
                            key={i}
                            href={link[2]}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                        >
                            {link[1]}
                        </a>
                    );
                }

                return <Fragment key={i}>{part}</Fragment>;
            });

    const blocks: React.ReactNode[] = [];
    let list: string[] = [];
    const flush = () => {
        if (list.length) {
            blocks.push(
                <ul key={blocks.length} className="my-2 space-y-1 pl-1">
                    {list.map((item, i) => (
                        <li key={i} className="flex gap-2">
                            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                            <span>{inline(item)}</span>
                        </li>
                    ))}
                </ul>,
            );
            list = [];
        }
    };
    for (const raw of text.split('\n')) {
        const line = raw.trimEnd();
        if (/^\s*[-*]\s+/.test(line)) {
            list.push(line.replace(/^\s*[-*]\s+/, ''));
            continue;
        }
        flush();
        if (/^#{1,6}\s/.test(line)) {
            blocks.push(
                <h4 key={blocks.length} className="mt-3 mb-1 font-semibold">
                    {inline(line.replace(/^#+\s/, ''))}
                </h4>,
            );
        } else if (line.trim()) {
            blocks.push(
                <p key={blocks.length} className="my-1.5">
                    {inline(line)}
                </p>,
            );
        }
    }
    flush();

    return (
        <div className="text-sm leading-relaxed text-muted-foreground [&_b]:text-foreground [&_h4]:text-foreground">
            {blocks}
        </div>
    );
}

Updates.layout = {
    breadcrumbs: [{ title: 'Оновлення', href: '/admin/updates' }],
};
