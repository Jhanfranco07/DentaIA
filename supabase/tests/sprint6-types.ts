import type { Database, Tables, TablesInsert } from "../../src/lib/supabase/database.types";

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;
type OptionalKeys<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? K : never }[keyof T];

export type SmileConsentContract = [
  Assert<Equal<keyof Tables<"smile_analysis_consents">,
    "accepted_at" | "audit_metadata" | "consent_version" | "id" | "patient_id" | "purpose" | "revoked_at">>,
  Assert<Equal<OptionalKeys<TablesInsert<"smile_analysis_consents">>,
    "accepted_at" | "audit_metadata" | "id" | "patient_id" | "purpose" | "revoked_at">>,
];

export type SmileAnalysisContract = [
  Assert<Equal<keyof Tables<"smile_analyses">,
    "analyzed_at" | "consent_id" | "deleted_at" | "deletion_reason" | "educational_explanation"
    | "engine" | "engine_version" | "explanation_source" | "id" | "original_mime_type"
    | "original_object_path" | "original_size_bytes" | "overlay_object_path" | "patient_id" | "status" | "technical_result">>,
  Assert<Equal<OptionalKeys<TablesInsert<"smile_analyses">>,
    "analyzed_at" | "deleted_at" | "deletion_reason" | "educational_explanation" | "engine"
    | "explanation_source" | "id" | "original_mime_type" | "original_object_path"
    | "original_size_bytes" | "overlay_object_path">>,
  Assert<Equal<OptionalKeys<TablesInsert<"smile_analysis_access_grants">>,
    "granted_at" | "id" | "revoked_at">>,
  Assert<Equal<keyof Tables<"smile_analysis_access_grants">,
    "analysis_id" | "expires_at" | "granted_at" | "id" | "patient_id" | "professional_id" | "revoked_at">>,
];

export type PremiumContract = [
  Assert<Equal<keyof Tables<"premium_subscriptions">,
    "cancel_at_period_end" | "canceled_at" | "checkout_session_id" | "created_at"
    | "current_period_end" | "current_period_start" | "id" | "plan" | "status"
    | "stripe_customer_id" | "stripe_event_created_at" | "stripe_price_id"
    | "stripe_subscription_id" | "updated_at" | "user_id">>,
  Assert<Equal<OptionalKeys<TablesInsert<"premium_subscriptions">>,
    "cancel_at_period_end" | "canceled_at" | "checkout_session_id" | "created_at"
    | "current_period_end" | "current_period_start" | "id" | "plan" | "updated_at">>,
  Assert<Equal<keyof Tables<"stripe_webhook_events">,
    "event_type" | "payload" | "processed_at" | "processing_error" | "received_at" | "stripe_created_at" | "stripe_event_id">>,
  Assert<Equal<OptionalKeys<TablesInsert<"stripe_webhook_events">>,
    "processed_at" | "processing_error" | "received_at">>,
  Assert<Equal<Database["public"]["Functions"]["grant_smile_analysis_access"]["Returns"], string>>,
  Assert<Equal<Database["public"]["Functions"]["revoke_smile_analysis_access"]["Returns"], undefined>>,
  Assert<Equal<Database["public"]["Functions"]["revoke_smile_analysis_consent"]["Returns"], undefined>>,
];
