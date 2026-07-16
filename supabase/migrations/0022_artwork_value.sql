-- Artwork valuation is archival metadata, not a sale listing price.
-- JGA Studio continues to own public commerce pricing independently.

alter table public.artworks
  add column if not exists artwork_value numeric,
  add column if not exists value_currency text;

update public.artworks
set value_currency = 'USD'
where value_currency is null;

alter table public.artworks
  alter column value_currency set default 'USD',
  alter column value_currency set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'artworks_artwork_value_nonnegative'
      and conrelid = 'public.artworks'::regclass
  ) then
    alter table public.artworks
      add constraint artworks_artwork_value_nonnegative
      check (artwork_value is null or artwork_value >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'artworks_value_currency_format'
      and conrelid = 'public.artworks'::regclass
  ) then
    alter table public.artworks
      add constraint artworks_value_currency_format
      check (value_currency ~ '^[A-Z]{3}$');
  end if;
end
$$;

comment on column public.artworks.artwork_value is
  'Artist-maintained archival value; does not set a JGA Studio sale price.';

comment on column public.artworks.value_currency is
  'ISO 4217 currency code for artwork_value.';
