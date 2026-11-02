import { router } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import type { FlashToast } from '@/types/ui';

type Flash = {
    success?: string | null;
    error?: string | null;
    toast?: FlashToast;
};

/**
 * Shows the success and error messages controllers put in the session.
 */
export function useFlashToast(): void {
    useEffect(() => {
        const show = (flash: Flash | undefined) => {
            if (flash?.toast) {
                toast[flash.toast.type](flash.toast.message);
            }
            if (flash?.success) {
                toast.success(flash.success);
            }
            if (flash?.error) {
                toast.error(flash.error);
            }
        };

        const offFlash = router.on('flash', (event) =>
            show((event as CustomEvent).detail?.flash),
        );
        const offSuccess = router.on('success', (event) =>
            show((event as CustomEvent).detail?.page?.props?.flash),
        );

        return () => {
            offFlash();
            offSuccess();
        };
    }, []);
}
