export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<
      string,
      {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      }
    >;
    Views: Record<string, never>;
    Functions: {
      find_catalog_item_by_barcode: {
        Args: {
          p_organization_id: string;
          p_barcode: string;
        };
        Returns: Array<{
          catalog_item_id: string;
          menu_item_id: string | null;
          inventory_item_id: string | null;
          code: string;
          name: string;
          unit_name: string;
          unit_factor: number;
          retail_price: number;
          tax_rate: number;
        }>;
      };
      issue_customer_invoice: {
        Args: {
          p_organization_id: string;
          p_branch_id: string;
          p_customer_name: string;
          p_customer_phone: string | null;
          p_payment_method: "cash" | "card" | "bank_transfer" | "delivery_app";
          p_channel: "dine_in" | "delivery" | "pickup";
          p_items: Json;
          p_invoice_discount?: number;
          p_service_fee?: number;
          p_delivery_fee?: number;
          p_notes?: string | null;
          p_idempotency_key?: string | null;
          p_allow_negative_stock?: boolean;
        };
        Returns: Json;
      };
    };
    Enums: {
      app_role:
        | "super_admin"
        | "organization_owner"
        | "branch_manager"
        | "inventory_manager"
        | "purchasing_manager"
        | "chef"
        | "marketing_manager"
        | "accountant"
        | "staff";
      stock_movement_type:
        | "purchase"
        | "sale_usage"
        | "waste"
        | "transfer_in"
        | "transfer_out"
        | "adjustment"
        | "stock_count"
        | "return";
      social_platform: "facebook" | "instagram" | "telegram" | "tiktok" | "x" | "google_business";
      sales_channel: "dine_in" | "delivery" | "pickup";
    };
    CompositeTypes: Record<string, never>;
  };
};
