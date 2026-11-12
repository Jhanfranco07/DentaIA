export type PaymentStatus = "paid" | "unpaid" | "expired";

export type Payment = {
  id: string;
  user_id: string;
  stripe_session_id: string;
  stripe_event_id: string;
  plan: string;
  amount_total: number;
  currency: string;
  status: PaymentStatus;
  created_at: string;
};