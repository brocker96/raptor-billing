import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const compact = new Intl.NumberFormat('uk-UA', {
    notation: 'compact',
    maximumFractionDigits: 1,
});
const day = new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'short',
});

function useWidth<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState(600);
    useEffect(() => {
        if (!ref.current) {
            return;
        }
        const observer = new ResizeObserver(([entry]) =>
            setWidth(Math.max(240, entry.contentRect.width)),
        );
        observer.observe(ref.current);

        return () => observer.disconnect();
    }, []);

    return [ref, width] as const;
}

/**
 * One series over time: a 2px line over a soft fill, a crosshair with a tooltip on hover, three
 * recessive grid lines. Amounts are minor units, `format` turns them into text.
 */
export function AreaChart({
    data,
    format,
    height = 220,
    label,
}: {
    data: { date: string; total: number }[];
    format: (minor: number) => string;
    height?: number;
    label: string;
}) {
    const [ref, width] = useWidth<HTMLDivElement>();
    const [hover, setHover] = useState<number | null>(null);
    const pad = { top: 12, right: 8, bottom: 26, left: 44 };
    const w = width - pad.left - pad.right;
    const h = height - pad.top - pad.bottom;
    const max = Math.max(1, ...data.map((d) => d.total));
    const nice = useMemo(() => {
        const step = 10 ** Math.floor(Math.log10(max));
        return Math.ceil(max / step) * step;
    }, [max]);
    const x = (i: number) =>
        pad.left + (data.length > 1 ? (i / (data.length - 1)) * w : w / 2);
    const y = (v: number) => pad.top + h - (v / nice) * h;
    const points = data.map((d, i) => [x(i), y(d.total)] as const);
    // Monotone-ish smoothing with short horizontal control points, never overshoots below zero.
    const path = points
        .map(([px, py], i) => {
            if (i === 0) {
                return `M${px},${py}`;
            }
            const [qx, qy] = points[i - 1];
            const dx = (px - qx) / 2;

            return `C${qx + dx},${qy} ${px - dx},${py} ${px},${py}`;
        })
        .join(' ');
    const area = `${path} L${x(data.length - 1)},${pad.top + h} L${x(0)},${pad.top + h} Z`;
    const active = hover !== null ? data[hover] : null;

    return (
        <div ref={ref} className="relative w-full select-none">
            <svg
                width={width}
                height={height}
                role="img"
                aria-label={label}
                onMouseLeave={() => setHover(null)}
                onMouseMove={(e) => {
                    const box = e.currentTarget.getBoundingClientRect();
                    const i = Math.round(
                        ((e.clientX - box.left - pad.left) / w) *
                            (data.length - 1),
                    );
                    setHover(Math.min(data.length - 1, Math.max(0, i)));
                }}
            >
                <defs>
                    <linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1">
                        <stop
                            offset="0%"
                            stopColor="var(--primary)"
                            stopOpacity={0.28}
                        />
                        <stop
                            offset="100%"
                            stopColor="var(--primary)"
                            stopOpacity={0}
                        />
                    </linearGradient>
                </defs>
                {[0, 0.5, 1].map((t) => (
                    <g key={t}>
                        <line
                            x1={pad.left}
                            x2={pad.left + w}
                            y1={y(nice * t)}
                            y2={y(nice * t)}
                            className="stroke-border"
                            strokeDasharray={t === 0 ? undefined : '3 4'}
                        />
                        <text
                            x={pad.left - 8}
                            y={y(nice * t)}
                            dy="0.32em"
                            textAnchor="end"
                            className="fill-muted-foreground text-[11px]"
                        >
                            {compact.format((nice * t) / 100)}
                        </text>
                    </g>
                ))}
                {[0, Math.floor((data.length - 1) / 2), data.length - 1].map(
                    (i) => (
                        <text
                            key={i}
                            x={x(i)}
                            y={height - 6}
                            textAnchor={
                                i === 0
                                    ? 'start'
                                    : i === data.length - 1
                                      ? 'end'
                                      : 'middle'
                            }
                            className="fill-muted-foreground text-[11px]"
                        >
                            {data[i] && day.format(new Date(data[i].date))}
                        </text>
                    ),
                )}
                <path d={area} fill="url(#area-fill)" />
                <path
                    d={path}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
                {hover !== null && (
                    <g>
                        <line
                            x1={x(hover)}
                            x2={x(hover)}
                            y1={pad.top}
                            y2={pad.top + h}
                            className="stroke-muted-foreground/40"
                        />
                        <circle
                            cx={x(hover)}
                            cy={y(data[hover].total)}
                            r={5}
                            fill="var(--primary)"
                            className="stroke-card"
                            strokeWidth={2}
                        />
                    </g>
                )}
            </svg>
            {active && hover !== null && (
                <div
                    className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg"
                    style={{
                        left: Math.min(width - 70, Math.max(70, x(hover))),
                    }}
                >
                    <div className="text-muted-foreground">
                        {day.format(new Date(active.date))}
                    </div>
                    <div className="mt-0.5 text-sm font-semibold">
                        {format(active.total)}
                    </div>
                </div>
            )}
        </div>
    );
}

export type Segment = {
    key: string;
    label: string;
    value: number;
    className: string;
};

/**
 * Parts of a whole as one rounded bar with 2px gaps, a legend with counts below it.
 */
export function SegmentBar({
    segments,
    label,
}: {
    segments: Segment[];
    label: string;
}) {
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    const [hover, setHover] = useState<string | null>(null);

    return (
        <div>
            <div
                className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={label}
            >
                {total > 0 &&
                    segments
                        .filter((s) => s.value > 0)
                        .map((s) => (
                            <div
                                key={s.key}
                                className={cn(
                                    'h-full transition-opacity first:rounded-l-full last:rounded-r-full',
                                    s.className,
                                    hover && hover !== s.key && 'opacity-40',
                                )}
                                style={{ width: `${(s.value / total) * 100}%` }}
                                onMouseEnter={() => setHover(s.key)}
                                onMouseLeave={() => setHover(null)}
                                title={`${s.label}: ${s.value}`}
                            />
                        ))}
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {segments.map((s) => (
                    <li
                        key={s.key}
                        className={cn(
                            'flex items-center gap-2 transition-opacity',
                            hover && hover !== s.key && 'opacity-50',
                        )}
                        onMouseEnter={() => setHover(s.key)}
                        onMouseLeave={() => setHover(null)}
                    >
                        <span
                            className={cn(
                                'size-2.5 shrink-0 rounded-sm',
                                s.className,
                            )}
                        />
                        <span className="flex-1 text-muted-foreground">
                            {s.label}
                        </span>
                        <span className="font-medium tabular-nums">
                            {s.value}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/**
 * Ranked values as thin bars in one hue, value and label in text colors.
 */
export function BarList({
    items,
}: {
    items: { label: string; value: number; display: string; hint?: string }[];
}) {
    const max = Math.max(1, ...items.map((i) => i.value));

    return (
        <ul className="space-y-3">
            {items.map((item) => (
                <li key={item.label}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate">{item.label}</span>
                        <span className="shrink-0 font-medium tabular-nums">
                            {item.display}
                        </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full rounded-full bg-primary"
                                style={{
                                    width: `${(item.value / max) * 100}%`,
                                }}
                            />
                        </div>
                        {item.hint && (
                            <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                                {item.hint}
                            </span>
                        )}
                    </div>
                </li>
            ))}
        </ul>
    );
}
