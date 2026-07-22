-- Private commercial records, public sale provenance, delivery-confirmed
-- custody changes, and owner-contributed installation photography.

alter table public.events
  add column if not exists sale_channel text,
  add column if not exists seller_type text,
  add column if not exists buyer_identity_public boolean not null default false,
  add column if not exists buyer_display_name_public text;

alter table public.events
  drop constraint if exists events_sale_channel_check;
alter table public.events
  add constraint events_sale_channel_check
  check (
    sale_channel is null
    or sale_channel in ('private', 'exhibition', 'gallery', 'auction', 'other')
  );

alter table public.events
  drop constraint if exists events_seller_type_check;
alter table public.events
  add constraint events_seller_type_check
  check (
    seller_type is null
    or seller_type in ('artist', 'collective', 'gallery', 'curator', 'collector')
  );

create table if not exists public.artwork_sales (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks (id) on delete cascade,
  ownership_event_id uuid not null unique references public.events (id),
  transaction_group_id uuid not null,
  seller_id uuid not null references public.profiles (id),
  buyer_id uuid not null references public.profiles (id),
  actor_id uuid not null references public.profiles (id),
  consignment_id uuid references public.consignments (id),
  sale_channel text not null
    check (sale_channel in ('private', 'exhibition', 'gallery', 'auction', 'other')),
  seller_type text not null
    check (seller_type in ('artist', 'collective', 'gallery', 'curator', 'collector')),
  sale_price numeric check (sale_price is null or sale_price >= 0),
  currency text not null default 'USD',
  share_sale_price boolean not null default false,
  share_buyer_identity boolean not null default false,
  sale_date timestamptz not null,
  private_notes text,
  delivery_status text not null default 'awaiting_delivery'
    check (delivery_status in ('awaiting_delivery', 'delivered')),
  delivered_at timestamptz,
  delivery_confirmed_by uuid references public.profiles (id),
  delivery_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (seller_id <> buyer_id),
  check (
    (delivery_status = 'awaiting_delivery' and delivered_at is null)
    or (delivery_status = 'delivered' and delivered_at is not null)
  )
);

create index if not exists artwork_sales_artwork_date_idx
  on public.artwork_sales (artwork_id, sale_date desc);
create index if not exists artwork_sales_buyer_idx
  on public.artwork_sales (buyer_id, sale_date desc);

alter table public.artwork_sales enable row level security;

drop policy if exists "artwork_sales_select" on public.artwork_sales;
create policy "artwork_sales_select" on public.artwork_sales
  for select
  using (
    public.auth_controls_profile(seller_id)
    or public.auth_controls_profile(buyer_id)
    or public.auth_controls_profile(actor_id)
    or exists (
      select 1
      from public.artworks artwork
      where artwork.id = artwork_id
        and public.auth_controls_or_created_unclaimed(artwork.root_artist_id)
    )
  );

revoke all on public.artwork_sales from anon, authenticated;
grant select on public.artwork_sales to authenticated;

create or replace function public.record_artwork_sale(
  p_artwork_id uuid,
  p_actor_id uuid,
  p_buyer_id uuid,
  p_sale_date timestamptz,
  p_sale_channel text,
  p_sale_price numeric default null,
  p_currency text default 'USD',
  p_private_notes text default null,
  p_consignment_id uuid default null,
  p_share_buyer_identity boolean default false,
  p_share_sale_price boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_artwork public.artworks%rowtype;
  v_actor public.profiles%rowtype;
  v_buyer public.profiles%rowtype;
  v_consignment public.consignments%rowtype;
  v_event_id uuid := gen_random_uuid();
  v_sale_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_direct_authorized boolean := false;
  v_consignment_authorized boolean := false;
  v_seller_type text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_sale_channel not in ('private', 'exhibition', 'gallery', 'auction', 'other') then
    raise exception 'Invalid sale channel';
  end if;
  if p_sale_price is not null and p_sale_price < 0 then
    raise exception 'Sale price cannot be negative';
  end if;

  select * into v_artwork
  from public.artworks
  where id = p_artwork_id
  for update;
  if not found or v_artwork.current_owner_id is null then
    raise exception 'Artwork or current owner not found';
  end if;

  select * into v_actor from public.profiles where id = p_actor_id;
  if not found or not public.auth_controls_profile(p_actor_id) then
    raise exception 'You are not authorized to act for this seller';
  end if;

  select * into v_buyer from public.profiles where id = p_buyer_id;
  if not found or v_buyer.trust_tier = 'unclaimed' then
    raise exception 'The buyer must have a claimed profile';
  end if;
  if p_buyer_id = v_artwork.current_owner_id then
    raise exception 'The buyer already owns this artwork';
  end if;

  v_direct_authorized := public.auth_controls_profile(v_artwork.current_owner_id);
  select type::text into v_seller_type
  from public.profiles
  where id = v_artwork.current_owner_id;

  if p_consignment_id is not null then
    select * into v_consignment
    from public.consignments
    where id = p_consignment_id
      and artwork_id = p_artwork_id
      and status = 'active'
    for update;

    v_consignment_authorized := found
      and v_consignment.consignor_id = v_artwork.current_owner_id
      and v_artwork.current_custodian_id = v_consignment.consignee_id
      and public.auth_controls_profile(v_consignment.consignee_id);

    if v_consignment_authorized then
      select type::text into v_seller_type
      from public.profiles
      where id = v_consignment.consignee_id;
    end if;
  end if;

  if p_consignment_id is not null and not v_consignment_authorized then
    raise exception 'Only the active consignee may complete this consignment sale';
  end if;
  if p_consignment_id is null and not v_direct_authorized then
    raise exception 'Only the current owner may record this direct sale';
  end if;
  if p_consignment_id is null and exists (
    select 1 from public.consignments
    where artwork_id = p_artwork_id and status = 'active'
  ) then
    raise exception 'Complete or return the active consignment before recording a direct sale';
  end if;

  insert into public.events (
    id,
    type,
    actor_id,
    artwork_id,
    from_party_id,
    to_party_id,
    transaction_group_id,
    occurred_at,
    price,
    currency,
    notes,
    sale_channel,
    seller_type,
    buyer_identity_public,
    buyer_display_name_public
  ) values (
    v_event_id,
    'ownership_transfer',
    p_actor_id,
    p_artwork_id,
    v_artwork.current_owner_id,
    p_buyer_id,
    v_group_id,
    coalesce(p_sale_date, now()),
    case when p_share_sale_price then p_sale_price else null end,
    upper(coalesce(nullif(trim(p_currency), ''), 'USD')),
    'Sale completed through Archive Atlas.',
    p_sale_channel,
    v_seller_type,
    p_share_buyer_identity,
    case when p_share_buyer_identity then v_buyer.display_name else null end
  );

  insert into public.artwork_sales (
    id,
    artwork_id,
    ownership_event_id,
    transaction_group_id,
    seller_id,
    buyer_id,
    actor_id,
    consignment_id,
    sale_channel,
    seller_type,
    sale_price,
    currency,
    share_sale_price,
    share_buyer_identity,
    sale_date,
    private_notes
  ) values (
    v_sale_id,
    p_artwork_id,
    v_event_id,
    v_group_id,
    v_artwork.current_owner_id,
    p_buyer_id,
    p_actor_id,
    p_consignment_id,
    p_sale_channel,
    v_seller_type,
    p_sale_price,
    upper(coalesce(nullif(trim(p_currency), ''), 'USD')),
    p_share_sale_price,
    p_share_buyer_identity,
    coalesce(p_sale_date, now()),
    nullif(trim(p_private_notes), '')
  );

  update public.artworks
  set current_owner_id = p_buyer_id
  where id = p_artwork_id;

  if p_consignment_id is not null then
    update public.consignments
    set status = 'sold',
        outcome_date = coalesce(p_sale_date, now())::date,
        sale_price = p_sale_price,
        outcome_notes = nullif(trim(p_private_notes), ''),
        updated_at = now()
    where id = p_consignment_id;
  end if;

  return jsonb_build_object(
    'sale_id', v_sale_id,
    'ownership_event_id', v_event_id,
    'artwork_id', p_artwork_id,
    'delivery_status', 'awaiting_delivery'
  );
end;
$$;

create or replace function public.confirm_artwork_sale_delivery(
  p_sale_id uuid,
  p_actor_id uuid,
  p_delivered_at timestamptz default now(),
  p_delivery_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.artwork_sales%rowtype;
  v_artwork public.artworks%rowtype;
  v_custody_event_id uuid;
begin
  if auth.uid() is null or not public.auth_controls_profile(p_actor_id) then
    raise exception 'You are not authorized to confirm delivery';
  end if;

  select * into v_sale
  from public.artwork_sales
  where id = p_sale_id
  for update;
  if not found then
    raise exception 'Sale not found';
  end if;
  if v_sale.delivery_status = 'delivered' then
    return jsonb_build_object('sale_id', v_sale.id, 'custody_event_id', null);
  end if;

  select * into v_artwork
  from public.artworks
  where id = v_sale.artwork_id
  for update;

  if v_artwork.current_owner_id <> v_sale.buyer_id then
    raise exception 'The recorded buyer is no longer the current owner';
  end if;
  if not (
    public.auth_controls_profile(v_artwork.current_custodian_id)
    or public.auth_controls_profile(v_sale.buyer_id)
  ) then
    raise exception 'Only the custodian or buyer may confirm delivery';
  end if;

  if v_artwork.current_custodian_id is distinct from v_sale.buyer_id then
    v_custody_event_id := gen_random_uuid();
    insert into public.events (
      id,
      type,
      actor_id,
      artwork_id,
      from_party_id,
      to_party_id,
      transaction_group_id,
      occurred_at,
      notes
    ) values (
      v_custody_event_id,
      'custody_change',
      p_actor_id,
      v_sale.artwork_id,
      v_artwork.current_custodian_id,
      v_sale.buyer_id,
      v_sale.transaction_group_id,
      coalesce(p_delivered_at, now()),
      'Delivery confirmed after sale completion.'
    );

    update public.artworks
    set current_custodian_id = v_sale.buyer_id
    where id = v_sale.artwork_id;
  end if;

  update public.artwork_sales
  set delivery_status = 'delivered',
      delivered_at = coalesce(p_delivered_at, now()),
      delivery_confirmed_by = p_actor_id,
      delivery_notes = nullif(trim(p_delivery_notes), ''),
      updated_at = now()
  where id = p_sale_id;

  return jsonb_build_object(
    'sale_id', p_sale_id,
    'custody_event_id', v_custody_event_id,
    'delivery_status', 'delivered'
  );
end;
$$;

revoke all on function public.record_artwork_sale(
  uuid, uuid, uuid, timestamptz, text, numeric, text, text, uuid, boolean, boolean
) from public;
revoke all on function public.confirm_artwork_sale_delivery(
  uuid, uuid, timestamptz, text
) from public;
grant execute on function public.record_artwork_sale(
  uuid, uuid, uuid, timestamptz, text, numeric, text, text, uuid, boolean, boolean
) to authenticated;
grant execute on function public.confirm_artwork_sale_delivery(
  uuid, uuid, timestamptz, text
) to authenticated;

alter table public.artwork_images
  add column if not exists image_kind text not null default 'record',
  add column if not exists caption text;

alter table public.artwork_images
  drop constraint if exists artwork_images_image_kind_check;
alter table public.artwork_images
  add constraint artwork_images_image_kind_check
  check (image_kind in ('record', 'installation'));

drop policy if exists "artwork_images_table_insert" on public.artwork_images;
create policy "artwork_images_table_insert" on public.artwork_images
  for insert
  with check (
    exists (
      select 1
      from public.artworks artwork
      where artwork.id = artwork_id
        and (
          public.auth_controls_or_created_unclaimed(artwork.root_artist_id)
          or (
            public.auth_controls_profile(artwork.current_owner_id)
            and image_kind = 'installation'
            and is_primary = false
          )
        )
    )
  );

drop policy if exists "artwork_images_insert" on storage.objects;
create policy "artwork_images_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'artwork-images'
    and exists (
      select 1
      from public.artworks artwork
      where artwork.id::text = split_part(name, '/', 1)
        and (
          public.auth_controls_or_created_unclaimed(artwork.root_artist_id)
          or public.auth_controls_profile(artwork.current_owner_id)
        )
    )
  );

comment on table public.artwork_sales is
  'Private sale terms linked to a public ownership-transfer provenance event.';
comment on column public.artwork_images.image_kind is
  'record for artist archive media; installation for owner-contributed display photography.';
