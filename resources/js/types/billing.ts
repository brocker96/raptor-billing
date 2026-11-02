export type Money = { amount: number; currency: string; formatted: string };

export type Price = Money & {
    period_months: number;
    period: string;
    monthly: Money;
};

export type Plan = {
    id: number;
    name: string;
    slug: string;
    category: string;
    description: string | null;
    features: string[];
    panel_package: string;
    active: boolean;
    featured: boolean;
    sort: number;
    prices: Price[];
    in_stock?: boolean;
};

export type ServiceStatus =
    | 'pending'
    | 'provisioning'
    | 'active'
    | 'suspended'
    | 'terminated'
    | 'cancelled'
    | 'failed';

export type Service = {
    id: number;
    name: string;
    status: ServiceStatus;
    plan: { id: number; name: string; slug: string };
    next_plan: { id: number; name: string } | null;
    price: Money;
    period_months: number;
    period: string;
    auto_renew: boolean;
    next_due_at: string | null;
    address: string | null;
    identifier: string | null;
    last_error: string | null;
    activated_at: string | null;
    created_at: string;
    user: { id: number; name: string; email: string } | null;
};

export type Invoice = {
    id: number;
    number: string;
    type: 'order' | 'renewal' | 'upgrade' | 'topup';
    status: 'unpaid' | 'paid' | 'cancelled';
    subtotal: Money;
    discount: Money;
    total: Money;
    due_at: string | null;
    paid_at: string | null;
    created_at: string;
    service: { id: number; name: string } | null;
    user: { id: number; name: string; email: string } | null;
    items: (Money & { description: string })[] | null;
};

export type Transaction = {
    id: number;
    type: 'topup' | 'charge' | 'refund' | 'adjustment';
    description: string;
    amount: Money;
    balance_after: Money;
    invoice: { id: number; number: string } | null;
    created_at: string;
};

export type PaymentRow = {
    id: number;
    method: 'page' | 'card';
    status: string;
    amount: Money;
    provider_id: string | null;
    failure_reason: string | null;
    invoice: { id: number; number: string } | null;
    user: { id: number; name: string; email: string } | null;
    created_at: string;
};

export type Card = {
    id: number;
    masked_pan: string;
    autopay: boolean;
    created_at: string;
};

export type Client = {
    id: number;
    name: string;
    email: string;
    is_admin: boolean;
    currency: string;
    balance: Money;
    email_verified: boolean;
    created_at: string;
    services_count?: number;
};

export type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    links: { url: string | null; label: string; active: boolean }[];
};
