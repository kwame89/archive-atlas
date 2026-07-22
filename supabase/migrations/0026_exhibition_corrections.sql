-- Exhibition corrections remain auditable. Editing stores the prior event
-- snapshot and creates a fresh anchor opportunity; removing an erroneous
-- exhibition withdraws it from public views instead of erasing history.

alter table public.events
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.profiles (id),
  add column if not exists void_reason text;

create table if not exists public.event_revisions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  revised_by uuid not null references public.profiles (id),
  revision_kind text not null check (revision_kind in ('edit', 'withdrawal')),
  previous_values jsonb not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists event_revisions_event_id_idx
  on public.event_revisions (event_id, created_at desc);

alter table public.event_revisions enable row level security;

drop policy if exists "event_revisions_select" on public.event_revisions;
create policy "event_revisions_select" on public.event_revisions
  for select
  using (
    exists (
      select 1
      from public.events e
      left join public.artworks a on a.id = e.artwork_id
      where e.id = event_id
        and (
          public.auth_controls_profile(e.actor_id)
          or (
            a.root_artist_id is not null
            and public.auth_controls_or_created_unclaimed(a.root_artist_id)
          )
        )
    )
  );

-- Withdrawn events stay available to authorized participants but disappear
-- from the public provenance feed.
drop policy if exists "events_select" on public.events;
create policy "events_select" on public.events
  for select
  using (
    voided_at is null
    or public.auth_controls_profile(actor_id)
    or exists (
      select 1
      from public.artworks a
      where a.id = artwork_id
        and public.auth_controls_or_created_unclaimed(a.root_artist_id)
    )
  );

create or replace function public.update_exhibition_event(
  p_event_id uuid,
  p_revised_by uuid,
  p_title text,
  p_venue text,
  p_location text,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
begin
  select * into v_event
  from public.events
  where id = p_event_id and type = 'exhibition'
  for update;

  if not found then
    raise exception 'Exhibition event not found';
  end if;

  if v_event.voided_at is not null then
    raise exception 'A withdrawn exhibition cannot be edited';
  end if;

  if not public.auth_controls_profile(p_revised_by) then
    raise exception 'You cannot act for the selected profile' using errcode = '42501';
  end if;

  if not (
    public.auth_controls_profile(v_event.actor_id)
    or exists (
      select 1
      from public.artworks a
      where a.id = v_event.artwork_id
        and public.auth_controls_or_created_unclaimed(a.root_artist_id)
    )
  ) then
    raise exception 'You cannot edit this exhibition' using errcode = '42501';
  end if;

  if nullif(trim(p_title), '') is null then
    raise exception 'Exhibition title is required';
  end if;

  if p_end_date is not null and p_end_date < p_start_date then
    raise exception 'The ending date cannot be earlier than the starting date';
  end if;

  insert into public.event_revisions (
    event_id,
    revised_by,
    revision_kind,
    previous_values
  ) values (
    v_event.id,
    p_revised_by,
    'edit',
    to_jsonb(v_event)
  );

  update public.events
  set exhibition_title = trim(p_title),
      exhibition_venue = nullif(trim(p_venue), ''),
      exhibition_location = nullif(trim(p_location), ''),
      occurred_at = p_start_date,
      exhibition_end_date = p_end_date,
      notes = nullif(trim(p_notes), ''),
      corroborated_by = null,
      corroborated_at = null,
      on_chain_anchor_hash = null,
      anchor_network = null,
      wallet_signed = false,
      updated_at = now()
  where id = v_event.id;

  return v_event.id;
end;
$$;

create or replace function public.withdraw_exhibition_event(
  p_event_id uuid,
  p_revised_by uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
begin
  select * into v_event
  from public.events
  where id = p_event_id and type = 'exhibition'
  for update;

  if not found then
    raise exception 'Exhibition event not found';
  end if;

  if v_event.voided_at is not null then
    return v_event.id;
  end if;

  if not public.auth_controls_profile(p_revised_by) then
    raise exception 'You cannot act for the selected profile' using errcode = '42501';
  end if;

  if not (
    public.auth_controls_profile(v_event.actor_id)
    or exists (
      select 1
      from public.artworks a
      where a.id = v_event.artwork_id
        and public.auth_controls_or_created_unclaimed(a.root_artist_id)
    )
  ) then
    raise exception 'You cannot withdraw this exhibition' using errcode = '42501';
  end if;

  insert into public.event_revisions (
    event_id,
    revised_by,
    revision_kind,
    previous_values,
    reason
  ) values (
    v_event.id,
    p_revised_by,
    'withdrawal',
    to_jsonb(v_event),
    nullif(trim(p_reason), '')
  );

  update public.events
  set voided_at = now(),
      voided_by = p_revised_by,
      void_reason = nullif(trim(p_reason), ''),
      updated_at = now()
  where id = v_event.id;

  return v_event.id;
end;
$$;

revoke all on function public.update_exhibition_event(
  uuid, uuid, text, text, text, timestamptz, timestamptz, text
) from public;
grant execute on function public.update_exhibition_event(
  uuid, uuid, text, text, text, timestamptz, timestamptz, text
) to authenticated;

revoke all on function public.withdraw_exhibition_event(uuid, uuid, text) from public;
grant execute on function public.withdraw_exhibition_event(uuid, uuid, text) to authenticated;
