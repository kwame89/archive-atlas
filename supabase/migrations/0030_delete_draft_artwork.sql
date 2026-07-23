-- 0030 — Discard incomplete artwork records
--
-- createArtwork does two inserts: the artworks row, then its genesis event.
-- When the second failed (see 0029's RLS recursion), the first had already
-- committed — leaving records with no provenance at all. Retrying produced
-- one orphan per attempt, and nothing in the app could remove them.
--
-- Deliberately NOT a general "delete artwork" feature. A record with a
-- genesis event is a provenance record: it may be Stellar-anchored,
-- corroborated, or cited by a certificate, and destroying it is the one
-- thing an archive must not do. A record with zero events was never really
-- created — the genesis never happened — so discarding it removes an
-- artifact of a failed write, not history.
--
-- That boundary is already structural: events.artwork_id (0001) is the only
-- FK to artworks WITHOUT on delete cascade, so Postgres itself refuses to
-- delete an artwork that has events. This function adds authorization and a
-- readable error on top of that guarantee rather than re-implementing it.
--
-- SECURITY DEFINER so the events check does not re-enter RLS — the same
-- lesson as 0029.

create or replace function public.delete_draft_artwork(p_artwork_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_root_artist_id uuid;
  v_event_count integer;
begin
  select root_artist_id into v_root_artist_id
  from public.artworks
  where id = p_artwork_id;

  if v_root_artist_id is null then
    raise exception 'Artwork record not found.';
  end if;

  if not public.auth_controls_profile(v_root_artist_id) then
    raise exception 'You do not have permission to delete this artwork record.';
  end if;

  select count(*) into v_event_count
  from public.events
  where artwork_id = p_artwork_id;

  if v_event_count > 0 then
    raise exception
      'This record has % provenance event(s) and cannot be deleted. Records with provenance are permanent.',
      v_event_count;
  end if;

  -- Everything else referencing artworks cascades (images, collaborators,
  -- private notes, collection memberships, consignments, sales,
  -- certificates), so this one delete is sufficient and atomic.
  delete from public.artworks where id = p_artwork_id;
end;
$$;

comment on function public.delete_draft_artwork(uuid) is
  'Discards an artwork record that has no provenance events (a failed '
  'creation). Refuses once any event exists — see 0030. SECURITY DEFINER so '
  'the events check does not re-enter RLS.';

revoke all on function public.delete_draft_artwork(uuid) from public;
grant execute on function public.delete_draft_artwork(uuid) to authenticated;
