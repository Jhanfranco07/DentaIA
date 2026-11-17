// Contrato de compilación: tsc --noEmit verifica estos tipos sin ejecutar pagos.
import type { Payment, PaymentStatus } from "../../src/types/payments";
import type { Database, Tables, TablesInsert, TablesUpdate } from "../../src/lib/supabase/database.types";

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;
type Extends<A, B> = A extends B ? true : false;
type OptionalKeys<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? K : never }[keyof T];
type Insert = TablesInsert<"payments">;

export type PaymentContractChecks = [
  Assert<Equal<Tables<"payments">, Payment>>,
  Assert<Equal<OptionalKeys<Insert>, "id" | "created_at">>,
  Assert<Equal<Required<Insert>, Payment>>,
  Assert<Equal<TablesUpdate<"payments">, Partial<Payment>>>,
  Assert<Equal<PaymentStatus, "paid" | "unpaid" | "expired">>,
  Assert<Equal<Database["public"]["Tables"]["payments"]["Relationships"], []>>,
];
// @ts-expect-error user_id no tiene DEFAULT y no puede omitirse.
export type MissingOwnerMustFail = Assert<Extends<Omit<Insert, "user_id">, Insert>>;
// @ts-expect-error El CHECK de PostgreSQL no admite refunded.
export type InvalidStatusMustFail = Assert<Extends<"refunded", PaymentStatus>>;
// @ts-expect-error amount_total es number, no string.
export type InvalidAmountMustFail = Assert<Extends<Omit<Insert, "amount_total"> & { amount_total: string }, Insert>>;
