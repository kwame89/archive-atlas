-- Fixes a bootstrap gap in 0001: inserting the FIRST controller row for a
-- profile required already being a controller of it (auth_controls_profile),
-- which is circular for both self-registration and claiming. This adds a
-- self-referential exception: a profile can add itself as its own first
-- controller if it's directly owned (auth_user_id = auth.uid()) by the
-- caller — i.e. a profile that was just created or just claimed by them.
-- Adding OTHER profiles as controllers still requires being an existing
-- controller, per the general rule in SCOPE.md > Profile control & succession.

drop policy if exists "profile_controllers_insert" on profile_controllers;

create policy "profile_controllers_insert" on profile_controllers
  for insert
  with check (
    auth_controls_profile(profile_id)
    or (
      profile_id = controller_profile_id
      and exists (
        select 1 from profiles p
        where p.id = controller_profile_id
          and p.auth_user_id = auth.uid()
      )
    )
  );
