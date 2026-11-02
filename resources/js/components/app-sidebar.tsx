import { Link, usePage } from '@inertiajs/react';
import {
    BadgePercent,
    CreditCard,
    FileText,
    LayoutDashboard,
    LayoutGrid,
    Receipt,
    Server,
    Settings2,
    ShoppingCart,
    Users,
    Wallet,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import type { NavItem } from '@/types';

const client: NavItem[] = [
    { title: 'Огляд', href: '/dashboard', icon: LayoutGrid },
    { title: 'Мої сервери', href: '/services', icon: Server },
    { title: 'Рахунки', href: '/invoices', icon: FileText },
    { title: 'Баланс', href: '/balance', icon: Wallet },
    { title: 'Замовити сервер', href: '/', icon: ShoppingCart },
];

const admin: NavItem[] = [
    { title: 'Огляд', href: '/admin', icon: LayoutDashboard },
    { title: 'Клієнти', href: '/admin/clients', icon: Users },
    { title: 'Послуги', href: '/admin/services', icon: Server },
    { title: 'Рахунки', href: '/admin/invoices', icon: Receipt },
    { title: 'Платежі', href: '/admin/payments', icon: CreditCard },
    { title: 'Тарифи', href: '/admin/plans', icon: LayoutGrid },
    { title: 'Промокоди', href: '/admin/promo-codes', icon: BadgePercent },
    { title: 'Налаштування', href: '/admin/settings', icon: Settings2 },
];

export function AppSidebar() {
    const page = usePage<{ auth: { user: { is_admin?: boolean } | null } }>();
    const path = page.url.split('?')[0];
    const mark = (items: NavItem[]) =>
        items.map((item) => ({
            ...item,
            // Sections stay highlighted on their detail pages, the overviews only on themselves.
            isActive: ['/', '/dashboard', '/admin'].includes(
                item.href as string,
            )
                ? path === item.href
                : path.startsWith(item.href as string),
        }));

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mark(client)} />
                {page.props.auth.user?.is_admin && (
                    <NavMain items={mark(admin)} label="Адміністрування" />
                )}
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
