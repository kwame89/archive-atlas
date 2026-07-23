-- 0031 — Public "sold" marker
--
-- artwork_sales is deliberately private (revoked from anon/authenticated,
-- readable only by seller, buyer, actor, or the root artist), so price,
-- buyer, channel and notes stay confidential. But a red dot is a gallery
-- convention that only works if the room can see it: a visitor should be
-- able to tell a piece is spoken for.
--
-- artworks.sold_at is that one public bit. It discloses nothing new — a sale
-- already writes a public ownership_transfer event (0027), so the fact and
-- date of a transfer are visible in the provenance timeline today. This just
-- makes the state readable without walking the event log, and artworks_select
-- is already `using (true)`.
--
-- Follows the existing denormalised-cache pattern on this table
-- (current_owner_id / current_custodian_id from 0001): the event log stays
-- the source of truth, this is a read convenience kept in sync at write time.

alter table public.artworks
  add column if not exists sold_at timestamptz;

comment on column public.artworks.sold_at is
  'Public marker that the work has sold. Set by record_artwork_sale. Only '
  'the fact and time — price, buyer and channel remain private in '
  'artwork_sales. Null means not sold (or a pre-0031 sale not yet backfilled).';

-- Backfill from sales already recorded, using the most recent per artwork.
update public.artworks a
set sold_at = latest.sale_date
from (
  select artwork_id, max(sale_date) as sale_date
  from public.artwork_sales
  group by artwork_id
) latest
where latest.artwork_id = a.id
  and a.sold_at is null;

-- record_artwork_sale re-emitted with the marker set alongside the owner
-- change, so the flag cannot drift from the sale that caused it.

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
  set current_owner_id = p_buyer_id,
      sold_at = coalesce(p_sale_date, now())
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
