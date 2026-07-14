-- Exhibition logging: activates the Curator role and the dormant
-- `exhibition` event type. Per SCOPE.md's graduated-trust design, any
-- signed-in profile can self-log a show (low friction, "self-logged" tier),
-- and the artwork's root artist can corroborate it to raise its trust.
--
-- Exhibition-specific fields live on the events table as nullable columns,
-- matching how price/currency were added for ownership_transfer rather than
-- a separate table.

alter table events add column if not exists exhibition_title text;
alter table events add column if not exists exhibition_venue text;
alter table events add column if not exists exhibition_location text;
alter table events add column if not exists exhibition_end_date timestamptz;
alter table events add column if not exists corroborated_by uuid references profiles (id);
alter table events add column if not exists corroborated_at timestamptz;

-- Corroboration: the root artist's controllers (or the collective that
-- created an unclaimed root artist profile) can update an exhibition event
-- on their work — used to set corroborated_by/corroborated_at. Deliberately
-- scoped to exhibition events; provenance events are not editable this way.
drop policy if exists "events_update_exhibition" on events;
create policy "events_update_exhibition" on events
  for update
  using (
    type = 'exhibition'
    and artwork_id is not null
    and exists (
      select 1 from artworks a
      where a.id = events.artwork_id
        and auth_controls_or_created_unclaimed(a.root_artist_id)
    )
  );
