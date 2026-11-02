import { usePage } from '@inertiajs/react';

export default function AppLogo() {
    const { name, logo } = usePage<{ name: string; logo?: string }>().props;

    return (
        <>
            <img
                src={logo ?? '/brand/raptor-icon-128.webp'}
                alt=""
                className="size-8 shrink-0 drop-shadow-[0_0_10px_rgba(110,255,60,0.35)]"
            />
            <div className="ml-1 grid flex-1 text-left text-sm">
                <span className="truncate leading-tight font-semibold">
                    {name}
                </span>
                <span className="truncate text-[0.7rem] leading-tight text-muted-foreground">
                    Кабінет клієнта
                </span>
            </div>
        </>
    );
}
