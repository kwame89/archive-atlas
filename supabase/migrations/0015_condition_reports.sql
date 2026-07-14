-- Condition reports: the `condition_report` event type was defined in the
-- enum from the start but never had fields or a logging UI. Reuses the
-- generic `notes` column for the report body; only needs a rating field.
-- Logging it also refreshes the artwork's denormalized `condition` cache,
-- same pattern as ownership_transfer/custody_change updating their caches.

alter table events add column if not exists condition_rating text;
