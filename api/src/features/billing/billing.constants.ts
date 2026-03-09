import { ICreatePlanRequest } from "./billing.interfaces";

export const DEFAULT_CONCEPT_CODE = process.env.CONCEPT_CODE || "app_subscription_fee";

export const BILLING_PLANS: ICreatePlanRequest[] = [
    // Argentina (ARS)
    { code: "ARS", external_reference: "ars_monthly", description: "Plan Mensual (ARS) - $25,000" },
    { code: "ARS", external_reference: "ars_annual", description: "Plan Anual (ARS) - $200,000" },

    // Brasil (BRL)
    { code: "BRL", external_reference: "brl_monthly", description: "Plan Mensual (BRL) - R$ 125" },
    { code: "BRL", external_reference: "brl_annual", description: "Plan Anual (BRL) - R$ 1000" },

    // Mexico (MXN)
    { code: "MXN", external_reference: "mxn_monthly", description: "Plan Mensual (MXN) - $425" },
    { code: "MXN", external_reference: "mxn_annual", description: "Plan Anual (MXN) - $3400" },

    // Colombia (COP)
    { code: "COP", external_reference: "cop_monthly", description: "Plan Mensual (COP) - $95,000" },
    { code: "COP", external_reference: "cop_annual", description: "Plan Anual (COP) - $760,000" },

    // Chile (CLP)
    { code: "CLP", external_reference: "clp_monthly", description: "Plan Mensual (CLP) - $24,000" },
    { code: "CLP", external_reference: "clp_annual", description: "Plan Anual (CLP) - $192,000" },

    // Peru (PEN)
    { code: "PEN", external_reference: "pen_monthly", description: "Plan Mensual (PEN) - S/ 95" },
    { code: "PEN", external_reference: "pen_annual", description: "Plan Anual (PEN) - S/ 760" },
];
