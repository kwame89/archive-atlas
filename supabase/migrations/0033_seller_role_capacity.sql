-- 0033 — Let a multi-role seller name the capacity they sold in
--
-- seller_type records the capacity a sale happened in, and was always read
-- from the selling profile's `type`. Which party that is was already handled
-- correctly by 0027:
--
--   direct sale       -> the current owner sells
--   consignment sale  -> the consignee sells on the owner's behalf
--
-- So "a curator sells another artist's work" already works: the artist
-- consigns the piece, the curator completes the sale as consignee, and the
-- consignee's type is recorded.
--
-- Secondary roles (0032) broke the last step. A profile whose primary type
-- is 'artist' but who also curates would record 'artist' on a consigned sale
-- they made as a curator — the provenance would misstate the capacity.
--
-- p_seller_role (optional) fixes that. Omitted, behaviour is exactly as
-- before: the primary type. Supplied, it must be a role that profile
-- actually holds, so nobody can claim a capacity they have not published.
--
-- The self-curated case needs no special handling: selling your own work is
-- a direct sale, you are the owner, and the default primary type ('artist')
-- is already the right answer. Consigning to yourself is not a thing.

drop function if exists public.record_artwork_sale(
  uuid, uuid, uuid, timestamptz, text, numeric, text, text, uuid, boolean, boolean
);

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
  p_share_sale_price boolean default false,
  p_seller_role profile_type default null
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
  v_seller_profile_id uuid;
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
  -- Direct sale: the current owner is the selling party.
  v_seller_profile_id := v_artwork.current_owner_id;

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
      -- Consignment sale: the consignee sells on the owner's behalf, so the
      -- capacity recorded is theirs, not the owner's.
      v_seller_profile_id := v_consignment.consignee_id;
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

  -- Capacity the seller acted in. Defaults to their primary type, which is
  -- what this always used. A profile with secondary roles (0032) may instead
  -- name one it actually holds — an artist/curator selling a consigned work
  -- records 'curator', while selling their own work records 'artist'.
  if p_seller_role is null then
    select type::text into v_seller_type
    from public.profiles
    where id = v_seller_profile_id;
  else
    select p_seller_role::text into v_seller_type
    from public.profiles
    where id = v_seller_profile_id
      and (type = p_seller_role or p_seller_role = any (secondary_roles));

    if v_seller_type is null then
      raise exception
        'The selling profile does not hold the role %. Add it under "Also works as" first.',
        p_seller_role;
    end if;
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
