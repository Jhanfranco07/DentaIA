import type { Tables, TablesInsert } from "../../src/lib/supabase/database.types";

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;
type OptionalKeys<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? K : never }[keyof T];

export type PremiumSubscriptionContract = [
  Assert<Equal<keyof Tables<"premium_subscriptions">,
    "cancel_at_period_end" | "canceled_at" | "checkout_session_id" | "created_at"
    | "current_period_end" | "current_period_start" | "id" | "plan" | "status"
    | "stripe_customer_id" | "stripe_event_created_at" | "stripe_price_id"
    | "stripe_subscription_id" | "updated_at" | "user_id">>,
  Assert<Equal<OptionalKeys<TablesInsert<"premium_subscriptions">>,
    "cancel_at_period_end" | "canceled_at" | "checkout_session_id" | "created_at"
    | "current_period_end" | "current_period_start" | "id" | "plan" | "updated_at">>,
];

export type StripeWebhookEventContract = [
  Assert<Equal<keyof Tables<"stripe_webhook_events">,
    "event_type" | "payload" | "processed_at" | "processing_error" | "received_at"
    | "stripe_created_at" | "stripe_event_id">>,
  Assert<Equal<OptionalKeys<TablesInsert<"stripe_webhook_events">>,
    "processed_at" | "processing_error" | "received_at">>,
];
