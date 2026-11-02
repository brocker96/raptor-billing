import { usePage } from '@inertiajs/react';
import { Info, Megaphone, TriangleAlert, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const tones = {
    info: ['border-sky-500/30 bg-sky-500/10', Info, 'text-sky-500'],
    success: ['border-primary/30 bg-primary/10', Megaphone, 'text-primary'],
    warning: [
        'border-amber-500/30 bg-amber-500/10',
        TriangleAlert,
        'text-amber-500',
    ],
} as const;

/**
 * The admin's notice for every customer. Closing it hides this text until it changes.
 */
export function Announcement({ className }: { className?: string }) {
    const { announcement } = usePage<{
        announcement: { text: string; tone: keyof typeof tones } | null;
    }>().props;
    const key = announcement ? `announcement:${announcement.text}` : '';
    const [hidden, setHidden] = useState(() => {
        try {
            return key !== '' && localStorage.getItem(key) === '1';
        } catch {
            return false;
        }
    });

    if (!announcement || hidden) {
        return null;
    }
    const [box, Icon, color] = tones[announcement.tone] ?? tones.info;

    return (
        <div
            className={cn(
                'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm',
                box,
                className,
            )}
        >
            <Icon className={cn('mt-0.5 size-4 shrink-0', color)} />
            <span className="flex-1">{announcement.text}</span>
            <button
                aria-label="Сховати"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => {
                    try {
                        localStorage.setItem(key, '1');
                    } catch {
                        // Private mode: hidden until the next visit.
                    }
                    setHidden(true);
                }}
            >
                <X className="size-4" />
            </button>
        </div>
    );
}
