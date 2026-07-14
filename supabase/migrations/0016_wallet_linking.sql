-- Phase 2 wallet-linking: profiles.linked_wallet and the wallet_linked trust
-- tier already existed from migration 0001. This adds the one new column
-- needed to distinguish, per event, whether its Stellar anchor was signed by
-- the platform's own key (today's default) or by the artist's own linked
-- wallet (new — see anchor-event and link-wallet Edge Functions).

alter table events add column if not exists wallet_signed boolean not null default false;
