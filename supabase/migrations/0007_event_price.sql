-- Adds a sale price to events, primarily for ownership_transfer (real sales
-- history). Nullable and general-purpose on the events table rather than
-- type-specific, matching how other optional fields like notes work — a
-- gift or inheritance transfer just leaves it null.

alter table events add column if not exists price numeric;
alter table events add column if not exists currency text default 'USD';
