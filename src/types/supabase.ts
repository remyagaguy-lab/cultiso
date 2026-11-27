
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "ateliers": {
                  Row: {
                    "created_at": string,"cultiso_id": string,"date_demarrage": string | null,"id": string,"libelle": string | null,"speculation_code": string,"taille": number,"unite": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"cultiso_id": string,"date_demarrage"?: string | null,"id"?: string,"libelle"?: string | null,"speculation_code": string,"taille": number,"unite": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"cultiso_id"?: string,"date_demarrage"?: string | null,"id"?: string,"libelle"?: string | null,"speculation_code"?: string,"taille"?: number,"unite"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ateliers_cultiso_id_fkey"
      columns: ["cultiso_id"]
isOneToOne: false
      referencedRelation: "cultisos"
      referencedColumns: ["id"]
    }
                  ]
                },"business_plans": {
                  Row: {
                    "created_at": string,"cultiso_id": string | null,"financial_data": Json | null,"id": string,"market_data": Json | null,"technical_data": Json | null,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"cultiso_id"?: string | null,"financial_data"?: Json | null,"id"?: string,"market_data"?: Json | null,"technical_data"?: Json | null,"title": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"cultiso_id"?: string | null,"financial_data"?: Json | null,"id"?: string,"market_data"?: Json | null,"technical_data"?: Json | null,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_plans_cultiso_id_fkey"
      columns: ["cultiso_id"]
isOneToOne: false
      referencedRelation: "cultisos"
      referencedColumns: ["id"]
    }
                  ]
                },"chat_messages": {
                  Row: {
                    "content": string,"created_at": string,"id": string,"role": string,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"created_at"?: string,"id"?: string,"role": string,"session_id": string
                  }
                  Update: {
                    "content"?: string,"created_at"?: string,"id"?: string,"role"?: string,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_messages_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "chat_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"chat_sessions": {
                  Row: {
                    "created_at": string,"exploitation_id": string | null,"id": string,"is_archived": boolean,"is_pinned": boolean,"module": string | null,"share_id": string | null,"title": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"exploitation_id"?: string | null,"id"?: string,"is_archived"?: boolean,"is_pinned"?: boolean,"module"?: string | null,"share_id"?: string | null,"title"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"exploitation_id"?: string | null,"id"?: string,"is_archived"?: boolean,"is_pinned"?: boolean,"module"?: string | null,"share_id"?: string | null,"title"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_sessions_exploitation_id_fkey"
      columns: ["exploitation_id"]
isOneToOne: false
      referencedRelation: "cultisos"
      referencedColumns: ["id"]
    }
                  ]
                },"contexte_terrain": {
                  Row: {
                    "cle": string,"cultiso_id": string,"updated_at": string,"valeur": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cle": string,"cultiso_id": string,"updated_at"?: string,"valeur": string
                  }
                  Update: {
                    "cle"?: string,"cultiso_id"?: string,"updated_at"?: string,"valeur"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contexte_terrain_cultiso_id_fkey"
      columns: ["cultiso_id"]
isOneToOne: false
      referencedRelation: "cultisos"
      referencedColumns: ["id"]
    }
                  ]
                },"cultiplan_crops": {
                  Row: {
                    "base_temperature_c": number | null,"id": string,"name": string,"reference_harvest_index_pct": number | null,"slug": string,"upper_temperature_c": number | null,"water_productivity_normalized": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "base_temperature_c"?: number | null,"id"?: string,"name": string,"reference_harvest_index_pct"?: number | null,"slug": string,"upper_temperature_c"?: number | null,"water_productivity_normalized"?: number | null
                  }
                  Update: {
                    "base_temperature_c"?: number | null,"id"?: string,"name"?: string,"reference_harvest_index_pct"?: number | null,"slug"?: string,"upper_temperature_c"?: number | null,"water_productivity_normalized"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"cultiplan_soils": {
                  Row: {
                    "curve_number": number | null,"field_capacity_vol_pct": number | null,"id": string,"ksat_mm_day": number | null,"name": string,"saturation_vol_pct": number | null,"slug": string,"wilting_point_vol_pct": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "curve_number"?: number | null,"field_capacity_vol_pct"?: number | null,"id"?: string,"ksat_mm_day"?: number | null,"name": string,"saturation_vol_pct"?: number | null,"slug": string,"wilting_point_vol_pct"?: number | null
                  }
                  Update: {
                    "curve_number"?: number | null,"field_capacity_vol_pct"?: number | null,"id"?: string,"ksat_mm_day"?: number | null,"name"?: string,"saturation_vol_pct"?: number | null,"slug"?: string,"wilting_point_vol_pct"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"cultiplan_zae_togo": {
                  Row: {
                    "created_at": string | null,"description": string | null,"id": string,"name": string,"rainfall_max_mm": number | null,"rainfall_min_mm": number | null,"zone_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"description"?: string | null,"id"?: string,"name": string,"rainfall_max_mm"?: number | null,"rainfall_min_mm"?: number | null,"zone_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"description"?: string | null,"id"?: string,"name"?: string,"rainfall_max_mm"?: number | null,"rainfall_min_mm"?: number | null,"zone_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cultisia_knowledge": {
                  Row: {
                    "chunk_index": number,"content": string,"created_at": string,"embedding": string | null,"file_hash": string,"file_name": string,"id": string,"metadata": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "chunk_index": number,"content": string,"created_at"?: string,"embedding"?: string | null,"file_hash": string,"file_name": string,"id"?: string,"metadata"?: Json | null
                  }
                  Update: {
                    "chunk_index"?: number,"content"?: string,"created_at"?: string,"embedding"?: string | null,"file_hash"?: string,"file_name"?: string,"id"?: string,"metadata"?: Json | null
                  }
                  Relationships: [
                    
                  ]
                },"cultiso_members": {
                  Row: {
                    "created_at": string,"cultiso_id": string,"id": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"cultiso_id": string,"id"?: string,"role": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"cultiso_id"?: string,"id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cultiso_members_cultiso_id_fkey"
      columns: ["cultiso_id"]
isOneToOne: false
      referencedRelation: "cultisos"
      referencedColumns: ["id"]
    }
                  ]
                },"cultisos": {
                  Row: {
                    "created_at": string,"domain": string | null,"id": string,"location": string | null,"name": string,"status": string,"surface_area": number | null,"surface_unit": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"domain"?: string | null,"id"?: string,"location"?: string | null,"name": string,"status"?: string,"surface_area"?: number | null,"surface_unit"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"domain"?: string | null,"id"?: string,"location"?: string | null,"name"?: string,"status"?: string,"surface_area"?: number | null,"surface_unit"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"price_records": {
                  Row: {
                    "country": string | null,"created_at": string,"currency": string,"id": string,"location": string | null,"price": number,"product_id": string,"raw_text": string | null,"record_date": string,"source": string,"unit": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "country"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"location"?: string | null,"price": number,"product_id": string,"raw_text"?: string | null,"record_date": string,"source": string,"unit"?: string | null
                  }
                  Update: {
                    "country"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"location"?: string | null,"price"?: number,"product_id"?: string,"raw_text"?: string | null,"record_date"?: string,"source"?: string,"unit"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "price_records_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "category": string,"created_at": string,"default_unit": string,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"created_at"?: string,"default_unit": string,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"default_unit"?: string,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"transactions": {
                  Row: {
                    "amount": number,"category": string,"created_at": string,"cultiso_id": string,"date": string,"description": string | null,"id": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category": string,"created_at"?: string,"cultiso_id": string,"date"?: string,"description"?: string | null,"id"?: string,"type": string
                  }
                  Update: {
                    "amount"?: number,"category"?: string,"created_at"?: string,"cultiso_id"?: string,"date"?: string,"description"?: string | null,"id"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_cultiso_id_fkey"
      columns: ["cultiso_id"]
isOneToOne: false
      referencedRelation: "cultisos"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "chercher_savoir_autorise":
{ Args: { "p_embedding": string,"p_nombre": number,"p_seuil": number }; Returns: {
              "content": string,"file_name": string,"similarity": number
            }[]
                           },
"debiter_credits":
{ Args: { "p_montant": number,"p_user_id": string }; Returns: number
                           },
"est_proprietaire":
{ Args: { "p_cultiso_id": string }; Returns: boolean
                           },
"lire_prix_marche":
{ Args: { "p_terme": string }; Returns: {
              "currency": string,"location": string,"price": number,"product_name": string,"record_date": string,"source": string,"unit": string
            }[]
                           },
"match_cultisia_knowledge":
{ Args: { "match_count": number,"match_threshold": number,"query_embedding": string }; Returns: {
              "content": string,"file_name": string,"id": string,"metadata": Json,"similarity": number
            }[]
                           },
"mes_exploitations":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"peut_modifier":
{ Args: { "p_cultiso_id": string }; Returns: boolean
                           },
"search_market_prices":
{ Args: { "search_term": string }; Returns: {
              "currency": string,"location": string,"price": number,"product_default_unit": string,"product_id": string,"product_name": string,"record_date": string,"unit": string
            }[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"ref": {
          Tables: {
            "modeles_charges": {
                  Row: {
                    "base": string,"classe": string,"created_at": string,"duree_vie_ans": number | null,"frequence": number,"id": string,"libelle": string,"mois_decaissement": (number)[] | null,"nature": string,"ordre": number,"prix_reference": number,"produit_prix": string | null,"quantite": number,"source": string | null,"speculation_code": string,"statut": string,"type_charge": string,"unite": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base"?: string,"classe": string,"created_at"?: string,"duree_vie_ans"?: number | null,"frequence"?: number,"id"?: string,"libelle": string,"mois_decaissement"?: (number)[] | null,"nature": string,"ordre"?: number,"prix_reference": number,"produit_prix"?: string | null,"quantite": number,"source"?: string | null,"speculation_code": string,"statut"?: string,"type_charge": string,"unite": string,"updated_at"?: string
                  }
                  Update: {
                    "base"?: string,"classe"?: string,"created_at"?: string,"duree_vie_ans"?: number | null,"frequence"?: number,"id"?: string,"libelle"?: string,"mois_decaissement"?: (number)[] | null,"nature"?: string,"ordre"?: number,"prix_reference"?: number,"produit_prix"?: string | null,"quantite"?: number,"source"?: string | null,"speculation_code"?: string,"statut"?: string,"type_charge"?: string,"unite"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "modeles_charges_speculation_code_fkey"
      columns: ["speculation_code"]
isOneToOne: false
      referencedRelation: "speculations"
      referencedColumns: ["code"]
    }
                  ]
                },"modeles_revenus": {
                  Row: {
                    "base": string,"created_at": string,"id": string,"libelle": string,"mois_vente": (number)[] | null,"ordre": number,"pertes": number,"prix_reference": number,"produit_prix": string | null,"quantite_optimiste": number,"quantite_pessimiste": number,"quantite_realiste": number,"source": string | null,"speculation_code": string,"statut": string,"type_revenu": string,"unite": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base"?: string,"created_at"?: string,"id"?: string,"libelle": string,"mois_vente"?: (number)[] | null,"ordre"?: number,"pertes"?: number,"prix_reference": number,"produit_prix"?: string | null,"quantite_optimiste": number,"quantite_pessimiste": number,"quantite_realiste": number,"source"?: string | null,"speculation_code": string,"statut"?: string,"type_revenu": string,"unite": string,"updated_at"?: string
                  }
                  Update: {
                    "base"?: string,"created_at"?: string,"id"?: string,"libelle"?: string,"mois_vente"?: (number)[] | null,"ordre"?: number,"pertes"?: number,"prix_reference"?: number,"produit_prix"?: string | null,"quantite_optimiste"?: number,"quantite_pessimiste"?: number,"quantite_realiste"?: number,"source"?: string | null,"speculation_code"?: string,"statut"?: string,"type_revenu"?: string,"unite"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "modeles_revenus_speculation_code_fkey"
      columns: ["speculation_code"]
isOneToOne: false
      referencedRelation: "speculations"
      referencedColumns: ["code"]
    }
                  ]
                },"questions_terrain": {
                  Row: {
                    "cle": string,"created_at": string,"libelle": string,"ordre": number,"reponses": NonNullable<Json>,"secteurs": (string)[],"source": string | null,"sous_titre": string | null,"statut": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cle": string,"created_at"?: string,"libelle": string,"ordre"?: number,"reponses"?: NonNullable<Json>,"secteurs"?: (string)[],"source"?: string | null,"sous_titre"?: string | null,"statut"?: string,"updated_at"?: string
                  }
                  Update: {
                    "cle"?: string,"created_at"?: string,"libelle"?: string,"ordre"?: number,"reponses"?: NonNullable<Json>,"secteurs"?: (string)[],"source"?: string | null,"sous_titre"?: string | null,"statut"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"regles_ajustement": {
                  Row: {
                    "cible_modele_id": string | null,"cible_sens": string | null,"cible_type": string | null,"cle_question": string,"coefficient": number | null,"created_at": string,"description": string | null,"effet": string,"id": string,"ligne": Json | null,"source": string | null,"speculation_code": string | null,"statut": string,"updated_at": string,"valeur": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cible_modele_id"?: string | null,"cible_sens"?: string | null,"cible_type"?: string | null,"cle_question": string,"coefficient"?: number | null,"created_at"?: string,"description"?: string | null,"effet": string,"id"?: string,"ligne"?: Json | null,"source"?: string | null,"speculation_code"?: string | null,"statut"?: string,"updated_at"?: string,"valeur": string
                  }
                  Update: {
                    "cible_modele_id"?: string | null,"cible_sens"?: string | null,"cible_type"?: string | null,"cle_question"?: string,"coefficient"?: number | null,"created_at"?: string,"description"?: string | null,"effet"?: string,"id"?: string,"ligne"?: Json | null,"source"?: string | null,"speculation_code"?: string | null,"statut"?: string,"updated_at"?: string,"valeur"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "regles_ajustement_cle_question_fkey"
      columns: ["cle_question"]
isOneToOne: false
      referencedRelation: "questions_terrain"
      referencedColumns: ["cle"]
    },{
      foreignKeyName: "regles_ajustement_speculation_code_fkey"
      columns: ["speculation_code"]
isOneToOne: false
      referencedRelation: "speculations"
      referencedColumns: ["code"]
    }
                  ]
                },"speculations": {
                  Row: {
                    "code": string,"created_at": string,"cycles_par_an": number,"duree_cycle_jours": number | null,"nom": string,"secteur": string,"source": string | null,"sous_secteur": string | null,"statut": string,"unite_echelle": string,"updated_at": string,"valide_le": string | null,"valide_par": string | null,"zones": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"cycles_par_an"?: number,"duree_cycle_jours"?: number | null,"nom": string,"secteur": string,"source"?: string | null,"sous_secteur"?: string | null,"statut"?: string,"unite_echelle": string,"updated_at"?: string,"valide_le"?: string | null,"valide_par"?: string | null,"zones"?: (string)[]
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"cycles_par_an"?: number,"duree_cycle_jours"?: number | null,"nom"?: string,"secteur"?: string,"source"?: string | null,"sous_secteur"?: string | null,"statut"?: string,"unite_echelle"?: string,"updated_at"?: string,"valide_le"?: string | null,"valide_par"?: string | null,"zones"?: (string)[]
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        },"ref": {
          Enums: {
            
          }
        }
} as const
