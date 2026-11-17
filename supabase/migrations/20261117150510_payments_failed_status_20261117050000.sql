begin;

alter table public.payments
  drop constraint payments_status_check;

alter table public.payments
  add constraint payments_status_check
  check (status in ('paid', 'unpaid', 'expired', 'failed'));

commit;
