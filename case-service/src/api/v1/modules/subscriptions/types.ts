import { SUBSCRIPTIONS } from "#constants/index";

export interface GetSubscriptionPlansQuery {
    items_per_page: number;
    is_active: boolean;
};

export interface GetSubscriptionPlansPayload {
    expand: string[];
    limit?: number;
    active?: boolean;
};

export interface BusinessData {
    name: string;
    id: string;
    business_id: string;
    stripe_customer_id: string;
    stripe_subscription_id: string;
    status: typeof SUBSCRIPTIONS[keyof typeof SUBSCRIPTIONS];
    created_at: Date;
    updated_at: Date;
    created_by: string;
    updated_by: string;
};

export interface BusinessSubscriptionStatusResponse {
    subscription?: object;
    next_score_refresh_date?: string;
    status: typeof SUBSCRIPTIONS[keyof typeof SUBSCRIPTIONS];
    message: string;
};
