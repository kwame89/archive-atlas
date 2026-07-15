-- Private-beta wallet hardening.
--
-- Wallet addresses and wallet-linked trust must only be changed by the
-- signature-verifying link-wallet Edge Function, which writes with the
-- service role after independently authorizing the caller. Regular browser
-- sessions may still perform the existing unclaimed -> claimed transition.

begin;

drop policy if exists "profiles_insert" on profiles;
create policy "profiles_insert" on profiles
  for insert
  with check (
    (
      trust_tier = 'claimed'
      and auth_user_id = auth.uid()
      and linked_wallet is null
      and created_by is null
    )
    or
    (
      trust_tier = 'unclaimed'
      and auth_user_id is null
      and linked_wallet is null
      and claimed_at is null
      and created_by is not null
      and auth_controls_profile(created_by)
    )
  );

create or replace function protect_profile_wallet_identity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  is_self_service_claim boolean;
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    return new;
  end if;

  is_self_service_claim :=
    old.trust_tier = 'unclaimed'
    and old.auth_user_id is null
    and new.trust_tier = 'claimed'
    and new.auth_user_id = auth.uid()
    and new.linked_wallet is null;

  if new.linked_wallet is distinct from old.linked_wallet then
    raise exception 'Wallet links must be changed through verified wallet management';
  end if;

  if new.trust_tier is distinct from old.trust_tier and not is_self_service_claim then
    raise exception 'Trust tier cannot be changed directly';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_wallet_identity_trigger on profiles;
create trigger protect_profile_wallet_identity_trigger
  before update on profiles
  for each row
  execute function protect_profile_wallet_identity();

commit;
