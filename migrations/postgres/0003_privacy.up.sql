-- 0003_privacy (15 Nov 2026, session 461f9ea9) - privacy records (docs/planning/CHECK_PrivacyCompliance_20261115.md
-- #7 / #10). Hand-written (not generated from the Apps Script schema: these tables exist on Postgres only).
--   privacy_acknowledgements - a user acknowledged the Privacy Policy version shown at sign-in (no consent checkbox:
--                              the organization is the controller). One row per user and version; a separate table so
--                              recording it never creates or activates a user_profiles row (the sign-in allow-list).
--   contract_acceptances     - an organization admin accepted the General Terms / the DPA for a company. Append-only;
--                              kept when an organization's data is deleted (KRAtiv's contract record, like billing).
--   privacy_requests         - the data-subject request log (docs/guides/GUIDE_Privacy_RightsRequests.md).

create table if not exists "privacy_acknowledgements" (
  "id" text primary key default gen_random_uuid()::text,
  "user_id" text not null,
  "version" text not null,
  "acknowledged_at" timestamptz not null default now(),
  constraint "uq_privacy_acknowledgements_user_version" unique ("user_id", "version")
);
create index if not exists "idx_privacy_acknowledgements_user" on "privacy_acknowledgements" ("user_id", "acknowledged_at" desc);

create table if not exists "contract_acceptances" (
  "id" text primary key default gen_random_uuid()::text,
  "company_id" text not null references "companies" ("id"),
  "document" text not null check ("document" in ('terms', 'dpa')),
  "version" text not null,
  "accepted_by" text not null,
  "accepted_by_email" text,
  "accepted_at" timestamptz not null default now()
);
create index if not exists "idx_contract_acceptances_company" on "contract_acceptances" ("company_id", "document", "accepted_at" desc);

create table if not exists "privacy_requests" (
  "id" text primary key,
  "received_at" timestamptz not null,
  "channel" text,
  "requester_name" text,
  "requester_email" text,
  "user_id" text,
  "company_id" text,
  "request_type" text not null check ("request_type" in
    ('information', 'access', 'portability', 'rectification', 'erasure', 'blocking', 'objection', 'complaint')),
  "data_role" text check ("data_role" in ('processor', 'controller')),
  "status" text not null default 'received' check ("status" in
    ('received', 'verifying', 'forwarded', 'in_progress', 'done', 'refused')),
  "due_at" timestamptz,
  "forwarded_to" text,
  "forwarded_at" timestamptz,
  "completed_at" timestamptz,
  "outcome" text,
  "handled_by" text,
  "notes" text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz
);
create index if not exists "idx_privacy_requests_open" on "privacy_requests" ("status", "due_at");
