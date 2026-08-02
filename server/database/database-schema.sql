create extension if not exists pgcrypto;

create type public.user_role as enum ('admin', 'agent', 'customer');
create type public.user_status as enum ('active', 'disabled');
create type public.policy_type as enum ('life', 'health', 'auto', 'home', 'travel', 'business');
create type public.policy_status as enum ('draft', 'active', 'expired', 'cancelled');
create type public.payment_method as enum ('cash', 'card', 'bank_transfer', 'upi', 'cheque');
create type public.payment_status as enum ('pending', 'paid', 'overdue', 'failed', 'refunded');
create type public.claim_status as enum ('submitted', 'under_review', 'approved', 'rejected', 'settled');
create type public.document_type as enum ('identity', 'policy', 'claim', 'payment', 'other');

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 2),
  email text not null unique,
  password text not null,
  role public.user_role not null default 'agent',
  status public.user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  jwt_id text not null unique,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.app_users(id) on delete set null,
  created_by uuid references public.app_users(id) on delete set null,
  customer_code text not null unique,
  name text not null,
  dob date,
  phone text,
  address text,
  email text unique,
  identity_type text,
  identity_number text,
  status public.user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers
  add column if not exists identity_type text,
  add column if not exists identity_number text;

create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  created_by uuid references public.app_users(id) on delete set null,
  policy_type public.policy_type not null,
  policy_number text not null unique,
  premium_amount numeric(12, 2) not null check (premium_amount >= 0),
  start_date date not null,
  end_date date not null,
  status public.policy_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.premium_payments (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies(id) on delete cascade,
  payment_date date not null default current_date,
  amount numeric(12, 2) not null check (amount >= 0),
  payment_status public.payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies(id) on delete cascade,
  claim_amount numeric(12, 2) not null check (claim_amount >= 0),
  reason text,
  status public.claim_status not null default 'submitted',
  submission_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.claim_notes (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  author_id uuid references public.app_users(id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.app_users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_users_email on public.app_users (email);
create index if not exists idx_auth_sessions_user_id on public.auth_sessions (user_id);
create index if not exists idx_auth_sessions_jwt_id on public.auth_sessions (jwt_id);
create index if not exists idx_auth_sessions_token_hash on public.auth_sessions (token_hash);
create index if not exists idx_password_reset_tokens_user_id on public.password_reset_tokens (user_id);
create index if not exists idx_password_reset_tokens_token_hash on public.password_reset_tokens (token_hash);
create index if not exists idx_customers_user_id on public.customers (user_id);
create index if not exists idx_customers_created_by on public.customers (created_by);
create index if not exists idx_customers_email on public.customers (email);
create index if not exists idx_policies_customer_id on public.policies (customer_id);
create index if not exists idx_policies_status on public.policies (status);
create index if not exists idx_premium_payments_policy_id on public.premium_payments (policy_id);
create index if not exists idx_claims_policy_id on public.claims (policy_id);
create index if not exists idx_claim_notes_claim_id on public.claim_notes (claim_id);
create index if not exists idx_claim_notes_author_id on public.claim_notes (author_id);
create index if not exists idx_documents_customer_id on public.documents (customer_id);
create index if not exists idx_documents_uploaded_at on public.documents (uploaded_at);
create index if not exists idx_documents_file_name on public.documents (file_name);
create index if not exists idx_audit_logs_actor_user_id on public.audit_logs (actor_user_id);
create index if not exists idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_app_users_updated_at on public.app_users;
create trigger set_app_users_updated_at
before update on public.app_users
for each row
execute function public.set_updated_at();

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
before update on public.customers
for each row
execute function public.set_updated_at();

drop trigger if exists set_policies_updated_at on public.policies;
create trigger set_policies_updated_at
before update on public.policies
for each row
execute function public.set_updated_at();

drop trigger if exists set_premium_payments_updated_at on public.premium_payments;
create trigger set_premium_payments_updated_at
before update on public.premium_payments
for each row
execute function public.set_updated_at();

drop trigger if exists set_claims_updated_at on public.claims;
create trigger set_claims_updated_at
before update on public.claims
for each row
execute function public.set_updated_at();

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
before update on public.documents
for each row
execute function public.set_updated_at();

alter table public.app_users enable row level security;
alter table public.auth_sessions enable row level security;
alter table public.password_reset_tokens enable row level security;
alter table public.customers enable row level security;
alter table public.policies enable row level security;
alter table public.premium_payments enable row level security;
alter table public.claims enable row level security;
alter table public.claim_notes enable row level security;
alter table public.documents enable row level security;
alter table public.audit_logs enable row level security;

comment on table public.app_users is 'Application user accounts for the Day 2 authentication module.';
comment on table public.auth_sessions is 'Revocable JWT sessions. JWT IDs and token hashes are stored for logout support.';
comment on table public.password_reset_tokens is 'One-time password reset tokens used by the Resend email flow.';
comment on table public.customers is 'Insurance customers managed by agents.';
comment on table public.policies is 'Policies linked to customers.';
comment on table public.premium_payments is 'Premium due dates and payment records for policies.';
comment on table public.claims is 'Claims submitted against policies.';
comment on table public.claim_notes is 'Internal claim timeline notes.';
comment on table public.documents is 'Metadata for Supabase Storage files linked to customers, policies, or claims.';
comment on table public.audit_logs is 'Auditable activity trail across platform modules.';
