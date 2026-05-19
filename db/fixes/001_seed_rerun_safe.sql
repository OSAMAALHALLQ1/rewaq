-- Use this file when Supabase reports that the demo menu-to-recipe mapping
-- already exists while re-running the seed data.
--
-- It is intentionally small and safe to run more than once.

insert into menu_item_recipe_mapping (organization_id, menu_item_id, recipe_id)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000601'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000602'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000603')
on conflict (menu_item_id, recipe_id) do nothing;
