export interface IPlan {
    id: string;
    code: string;
    external_reference: string;
    description: string;
    default: boolean;
}

export interface ICreatePlanRequest {
    code: string;
    external_reference?: string;
    description?: string;
}

export interface IUpdatePlanRequest {
    code: string;
    external_reference: string;
    description: string;
}

export interface ISubscription {
    external_reference: string;
    description: string;
    recurring_frequency: string;
    recurring_interval: number;
    amount_currency: string;
    amount_value: number;
    concept_code: string;
    store_id: number;
    next_execution: Date;
    last_execution: Date;
    plan: {
        id: string;
        code: string;
    };
}

export interface IUpdateSubscriptionRequest {
    amount_currency?: string;
    amount_value?: number;
    plan_id?: string;
    plan_external_id?: string;
}
