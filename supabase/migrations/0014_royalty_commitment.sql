-- Royalty commitment: a suggested resale royalty percentage attached to an
-- artwork, per SCOPE.md's design. Unenforced in the MVP — this is the seed
-- for enforceable resale royalties once a payment/settlement layer exists
-- (Phase 2+), not a mechanism that collects anything today. Editable by the
-- same controllers who can edit other artwork fields.

alter table artworks add column if not exists royalty_percentage numeric;
