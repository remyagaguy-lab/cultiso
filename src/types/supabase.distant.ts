export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      business_plans: {
        Row: {
          created_at: string
          cultiso_id: string | null
          financial_data: Json | null
          id: string
          market_data: Json | null
          technical_data: Json | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cultiso_id?: string | null
          financial_data?: Json | null
          id?: string
          market_data?: Json | null
          technical_data?: Json | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cultiso_id?: string | null
          financial_data?: Json | null
          id?: string
          market_data?: Json | null
          technical_data?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_plans_cultiso_id_fkey"
            columns: ["cultiso_id"]
            isOneToOne: false
            referencedRelation: "cultisos"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          is_pinned: boolean
          share_id: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          share_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          share_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      cultiplan_crops: {
        Row: {
          base_temperature_c: number | null
          id: string
          name: string
          reference_harvest_index_pct: number | null
          slug: string
          upper_temperature_c: number | null
          water_productivity_normalized: number | null
        }
        Insert: {
          base_temperature_c?: number | null
          id?: string
          name: string
          reference_harvest_index_pct?: number | null
          slug: string
          upper_temperature_c?: number | null
          water_productivity_normalized?: number | null
        }
        Update: {
          base_temperature_c?: number | null
          id?: string
          name?: string
          reference_harvest_index_pct?: number | null
          slug?: string
          upper_temperature_c?: number | null
          water_productivity_normalized?: number | null
        }
        Relationships: []
      }
      cultiplan_soils: {
        Row: {
          curve_number: number | null
          field_capacity_vol_pct: number | null
          id: string
          ksat_mm_day: number | null
          name: string
          saturation_vol_pct: number | null
          slug: string
          wilting_point_vol_pct: number | null
        }
        Insert: {
          curve_number?: number | null
          field_capacity_vol_pct?: number | null
          id?: string
          ksat_mm_day?: number | null
          name: string
          saturation_vol_pct?: number | null
          slug: string
          wilting_point_vol_pct?: number | null
        }
        Update: {
          curve_number?: number | null
          field_capacity_vol_pct?: number | null
          id?: string
          ksat_mm_day?: number | null
          name?: string
          saturation_vol_pct?: number | null
          slug?: string
          wilting_point_vol_pct?: number | null
        }
        Relationships: []
      }
      cultisia_knowledge: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          file_hash: string
          file_name: string
          id: string
          metadata: Json | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          embedding?: string | null
          file_hash: string
          file_name: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          file_hash?: string
          file_name?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      cultiso_members: {
        Row: {
          created_at: string
          cultiso_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cultiso_id: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          cultiso_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cultiso_members_cultiso_id_fkey"
            columns: ["cultiso_id"]
            isOneToOne: false
            referencedRelation: "cultisos"
            referencedColumns: ["id"]
          },
        ]
      }
      cultisos: {
        Row: {
          created_at: string
          domain: string | null
          id: string
          location: string | null
          name: string
          status: string | null
          surface_area: number | null
          surface_unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          id?: string
          location?: string | null
          name: string
          status?: string | null
          surface_area?: number | null
          surface_unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          id?: string
          location?: string | null
          name?: string
          status?: string | null
          surface_area?: number | null
          surface_unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      price_records: {
        Row: {
          country: string | null
          created_at: string
          currency: string
          id: string
          location: string | null
          price: number
          product_id: string
          raw_text: string | null
          record_date: string
          source: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          currency?: string
          id?: string
          location?: string | null
          price: number
          product_id: string
          raw_text?: string | null
          record_date: string
          source: string
        }
        Update: {
          country?: string | null
          created_at?: string
          currency?: string
          id?: string
          location?: string | null
          price?: number
          product_id?: string
          raw_text?: string | null
          record_date?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          default_unit: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          default_unit: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          default_unit?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          cultiso_id: string
          date: string
          description: string | null
          id: string
          type: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          cultiso_id: string
          date?: string
          description?: string | null
          id?: string
          type: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          cultiso_id?: string
          date?: string
          description?: string | null
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_cultiso_id_fkey"
            columns: ["cultiso_id"]
            isOneToOne: false
            referencedRelation: "cultisos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      deduct_tokens: { Args: { deduction_amount: number }; Returns: number }
      match_cultisia_knowledge: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          content: string
          file_name: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      search_market_prices: {
        Args: { search_term: string }
        Returns: {
          currency: string
          location: string
          price: number
          product_default_unit: string
          product_id: string
          product_name: string
          record_date: string
          unit: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
