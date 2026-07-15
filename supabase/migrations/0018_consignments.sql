-- Private consignment records sit beside public provenance. Creating or
-- returning a consignment also records a public custody event through the
-- existing application flow, while commercial terms and agreements remain
-- visible only to authorized parties.

create table consignments (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references artworks (id) on delete cascade,
  consignor_id uuid not null references profiles (id),
  consignee_id uuid not null references profiles (id),
  actor_id uuid not null references profiles (id),
  status text not null default 'active'
    check (status in ('active', 'sold', 'returned')),
  asking_price numeric check (asking_price is null or asking_price >= 0),
  currency text not null default 'USD',
  commission_percentage numeric
    check (commission_percentage is null or commission_percentage between 0 and 100),
  start_date date not null,
  end_date date,
  insurance_responsibility text not null default 'not_recorded'
    check (insurance_responsibility in ('not_recorded', 'consignor', 'consignee', 'other')),
  insurance_value numeric check (insurance_value is null or insurance_value >= 0),
  insurance_currency text not null default 'USD',
  insurance_notes text,
  agreement_path text,
  agreement_file_name text,
  notes text,
  outcome_date date,
  sale_price numeric check (sale_price is null or sale_price >= 0),
  outcome_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (consignor_id <> consignee_id)
);

create unique index consignments_one_active_per_artwork
  on consignments (artwork_id)
  where status = 'active';

create index consignments_artwork_created_at
  on consignments (artwork_id, created_at desc);

alter table consignments enable row level security;

create policy "consignments_select" on consignments
  for select
  using (
    auth_controls_profile(consignor_id)
    or auth_controls_profile(consignee_id)
    or exists (
      select 1 from artworks a
      where a.id = artwork_id
        and auth_controls_or_created_unclaimed(a.root_artist_id)
    )
  );

create policy "consignments_insert" on consignments
  for insert
  with check (
    auth_controls_profile(consignor_id)
    and auth_controls_profile(actor_id)
    and exists (
      select 1 from artworks a
      where a.id = artwork_id
        and a.current_owner_id = consignor_id
    )
  );

create policy "consignments_update" on consignments
  for update
  using (
    auth_controls_profile(consignor_id)
    or auth_controls_profile(consignee_id)
  )
  with check (
    auth_controls_profile(consignor_id)
    or auth_controls_profile(consignee_id)
  );

create policy "consignments_delete" on consignments
  for delete
  using (auth_controls_profile(consignor_id));

insert into storage.buckets (id, name, public)
values ('consignment-agreements', 'consignment-agreements', false)
on conflict (id) do update set public = false;

create policy "consignment_agreements_select" on storage.objects
  for select
  using (
    bucket_id = 'consignment-agreements'
    and exists (
      select 1
      from public.consignments c
      join public.artworks a on a.id = c.artwork_id
      where c.id::text = split_part(name, '/', 1)
        and (
          public.auth_controls_profile(c.consignor_id)
          or public.auth_controls_profile(c.consignee_id)
          or public.auth_controls_or_created_unclaimed(a.root_artist_id)
        )
    )
  );

create policy "consignment_agreements_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'consignment-agreements'
    and exists (
      select 1 from public.consignments c
      where c.id::text = split_part(name, '/', 1)
        and (
          public.auth_controls_profile(c.consignor_id)
          or public.auth_controls_profile(c.consignee_id)
        )
    )
  );

create policy "consignment_agreements_update" on storage.objects
  for update
  using (
    bucket_id = 'consignment-agreements'
    and exists (
      select 1 from public.consignments c
      where c.id::text = split_part(name, '/', 1)
        and (
          public.auth_controls_profile(c.consignor_id)
          or public.auth_controls_profile(c.consignee_id)
        )
    )
  );

create policy "consignment_agreements_delete" on storage.objects
  for delete
  using (
    bucket_id = 'consignment-agreements'
    and exists (
      select 1 from public.consignments c
      where c.id::text = split_part(name, '/', 1)
        and (
          public.auth_controls_profile(c.consignor_id)
          or public.auth_controls_profile(c.consignee_id)
        )
    )
  );
