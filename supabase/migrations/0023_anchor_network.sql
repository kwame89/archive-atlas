-- Record which Stellar network each anchor lives on, ahead of the
-- testnet -> mainnet cutover. Every anchor written before this migration is
-- a testnet anchor; after the cutover, anchor-event stamps new rows with its
-- STELLAR_NETWORK ("testnet" | "mainnet"). Old testnet anchors stay honestly
-- labeled and verifiable on testnet explorers — history is never relabeled.

alter table events add column if not exists anchor_network text;

update events
set anchor_network = 'testnet'
where on_chain_anchor_hash is not null
  and anchor_network is null;
