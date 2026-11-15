-- 0003_privacy down: drops the privacy record tables (their rows are lost - take an export first in production).
drop table if exists "privacy_requests";
drop table if exists "contract_acceptances";
drop table if exists "privacy_acknowledgements";
