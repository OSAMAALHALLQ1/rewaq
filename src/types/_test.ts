import type { Database } from "./database";

// @ts-expect-error - test file
type _S1 = Database['public'] extends import("@supabase/postgrest-js").GenericSchema ? true : false;

// @ts-expect-error - test file
type _S2 = Database extends { __InternalSupabase: any } ? true : false;

// @ts-expect-error - test file
type _Public = Database['public'];

// @ts-expect-error - test file
type _Tables = Database['public']['Tables'];

// @ts-expect-error - test file
type _HasInventory = "inventory_items" extends keyof Database['public']['Tables'] ? true : false;
