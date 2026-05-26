import type { Database } from "./database";

// Is { id: number } a Record<string, unknown>?
type _SimpleCheck = { id: number } extends Record<string, unknown> ? true : false;
const _s1: _SimpleCheck = true;

// Is Database['public']['Tables']['inventory_items'] a GenericTable?
type _ItemRow = Database['public']['Tables']['inventory_items'];
type _ItemIsGT = _ItemRow extends { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: { foreignKeyName: string; columns: string[]; referencedRelationName: string; referencedColumns: string[]; isOneToOne?: boolean }[] } ? true : false;
const _s2: _ItemIsGT = true;

// Is inventory_items['Row'] a Record<string, unknown>?
type _ItemRowRecord = _ItemRow['Row'] extends Record<string, unknown> ? true : false;
const _s3: _ItemRowRecord = true;

// Is inventory_items['Insert'] a Record<string, unknown>?
type _ItemInsertRecord = _ItemRow['Insert'] extends Record<string, unknown> ? true : false;
const _s4: _ItemInsertRecord = true;

// Is inventory_items['Update'] a Record<string, unknown>?
type _ItemUpdateRecord = _ItemRow['Update'] extends Record<string, unknown> ? true : false;
const _s5: _ItemUpdateRecord = true;

// Is inventory_items['Relationships'] the right shape?
type _ItemRels = _ItemRow['Relationships'] extends { foreignKeyName: string; columns: string[]; referencedRelationName: string; referencedColumns: string[]; isOneToOne?: boolean }[] ? true : false;
const _s6: _ItemRels = true;

// Now check the whole Tables object — is every value a GenericTable?
type _TablesAsRecord = Database['public']['Tables'] extends { [key: string]: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: any[] } } ? true : false;
const _s7: _TablesAsRecord = true;

// Check Tables as Record<string, GenericTable>
type _RecordGenericTable = Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: any[] }>;
type _TablesExtendsRecord = Database['public']['Tables'] extends _RecordGenericTable ? true : false;
const _s8: _TablesExtendsRecord = true;

// FULL check: Does Database['public'] extend GenericSchema?
type _FullGenericSchema = {
    Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: { foreignKeyName: string; columns: string[]; referencedRelationName: string; referencedColumns: string[]; isOneToOne?: boolean }[] }>;
    Views: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: { foreignKeyName: string; columns: string[]; referencedRelationName: string; referencedColumns: string[]; isOneToOne?: boolean }[] }>;
    Functions: Record<string, (...args: unknown[]) => unknown>;
};
type _FullCheck = Database['public'] extends _FullGenericSchema ? true : false;
const _s9: _FullCheck = true;

// What SupabaseClient's Schema default resolves to:
type _SupabaseDefault = Database['public'] extends _FullGenericSchema ? Database['public'] : never;
type _SupabaseDefaultIsNever = _SupabaseDefault extends never ? true : false;
const _s10: _SupabaseDefaultIsNever = false;

// Check Views separately with same Record<string, ...> pattern
type _ViewsRecord = Database['public']['Views'] extends Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: any[] }> ? true : false;
const _s11: _ViewsRecord = true;

// Check Functions separately
type _FuncsRecord = Database['public']['Functions'] extends Record<string, (...args: unknown[]) => unknown> ? true : false;
const _s12: _FuncsRecord = true;

// Check: does Tables with FULL GenericRelationship shape extend Record<string, ...>?
type _FullRel = { foreignKeyName: string; columns: string[]; referencedRelationName: string; referencedColumns: string[]; isOneToOne?: boolean }[];
type _GT = { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: _FullRel };
type _TablesFull = Database['public']['Tables'] extends Record<string, _GT> ? true : false;
const _s13: _TablesFull = true;

// What about the EXACT postgrest-js GenericRelationship type?
// It's: { foreignKeyName: string; columns: string[]; referencedRelationName: string; referencedColumns: string[]; isOneToOne?: boolean }
// Note: isOneToOne is OPTIONAL with ? — so maybe some tables don't have it?
type _FirstTableRel = Database['public']['Tables']['inventory_items']['Relationships'];
// Does the first relationship shape match?
type _Rel0IsValid = _FirstTableRel[0] extends { foreignKeyName: string; columns: string[]; referencedRelationName: string; referencedColumns: string[]; isOneToOne?: boolean } ? true : false;
const _s14: _Rel0IsValid = true;
