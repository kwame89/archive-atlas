-- Allows a genesis event's occurred_at to be corrected after the fact (the
-- real-world creation date, vs. today when it's archived into the system).
-- Scoped to genesis events specifically — this is a metadata correction
-- (when something happened), not a provenance-changing edit (who did it).

create policy "events_update_genesis_date" on events
  for update
  using (
    type = 'genesis'
    and auth_controls_profile(actor_id)
  );
