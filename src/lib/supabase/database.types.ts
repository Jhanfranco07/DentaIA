import type { PaymentStatus } from "@/types/payments";

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      appointment_requests: {
        Row: {
          contact_email: string
          contact_name: string
          created_at: string
          dentist_id: string
          id: string
          is_demo: boolean
          message: string
          preferred_date: string
          preferred_time: string | null
          status: string
          user_id: string
        }
        Insert: {
          contact_email: string
          contact_name: string
          created_at?: string
          dentist_id: string
          id?: string
          is_demo?: boolean
          message?: string
          preferred_date: string
          preferred_time?: string | null
          status?: string
          user_id?: string
        }
        Update: {
          contact_email?: string
          contact_name?: string
          created_at?: string
          dentist_id?: string
          id?: string
          is_demo?: boolean
          message?: string
          preferred_date?: string
          preferred_time?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_requests_dentist_id_fkey"
            columns: ["dentist_id"]
            isOneToOne: false
            referencedRelation: "dentists"
            referencedColumns: ["id"]
          },
        ]
      }
      dental_photos: {
        Row: {
          bucket_id: string
          consent_id: string
          created_at: string
          id: string
          mime_type: string
          object_path: string
          original_filename: string
          size_bytes: number
          user_id: string
        }
        Insert: {
          bucket_id?: string
          consent_id: string
          created_at?: string
          id?: string
          mime_type: string
          object_path: string
          original_filename: string
          size_bytes: number
          user_id?: string
        }
        Update: {
          bucket_id?: string
          consent_id?: string
          created_at?: string
          id?: string
          mime_type?: string
          object_path?: string
          original_filename?: string
          size_bytes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dental_photos_user_id_consent_id_fkey"
            columns: ["user_id", "consent_id"]
            isOneToOne: false
            referencedRelation: "patient_consents"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      dentists: {
        Row: {
          avatar_color: string
          consultation_price: number
          created_at: string
          currency: string
          description: string
          district: string
          id: string
          initials: string
          is_active: boolean
          is_demo: boolean
          name: string
          slug: string
          specialty: string
        }
        Insert: {
          avatar_color: string
          consultation_price: number
          created_at?: string
          currency?: string
          description: string
          district: string
          id?: string
          initials: string
          is_active?: boolean
          is_demo?: boolean
          name: string
          slug: string
          specialty: string
        }
        Update: {
          avatar_color?: string
          consultation_price?: number
          created_at?: string
          currency?: string
          description?: string
          district?: string
          id?: string
          initials?: string
          is_active?: boolean
          is_demo?: boolean
          name?: string
          slug?: string
          specialty?: string
        }
        Relationships: []
      }
      dentist_public_locations: {
        Row: {
          clinic_id: string
          created_at: string
          dentist_id: string
          id: string
          latitude: number
          longitude: number
          practice_address: string
          practice_location: string
          practice_name: string
          publication_status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          verification_reference: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          dentist_id: string
          id?: string
          latitude: number
          longitude: number
          practice_address: string
          practice_location?: never
          practice_name: string
          publication_status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          verification_reference?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          dentist_id?: string
          id?: string
          latitude?: number
          longitude?: number
          practice_address?: string
          practice_location?: never
          practice_name?: string
          publication_status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          verification_reference?: string | null
        }
        Relationships: [
          { foreignKeyName: "dentist_public_locations_dentist_id_fkey"; columns: ["dentist_id"]; isOneToOne: false; referencedRelation: "dentists"; referencedColumns: ["id"] },
        ]
      }
      directory_demo_locations: {
        Row: {
          city: string
          country: string
          created_at: string
          district: string
          id: string
          is_demo: boolean
          is_published: boolean
          latitude: number
          longitude: number
          name: string
          public_label: string
          requests_enabled: boolean
          slug: string
        }
        Insert: {
          city: string
          country: string
          created_at?: string
          district: string
          id?: string
          is_demo?: boolean
          is_published?: boolean
          latitude: number
          longitude: number
          name: string
          public_label: string
          requests_enabled?: boolean
          slug: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          district?: string
          id?: string
          is_demo?: boolean
          is_published?: boolean
          latitude?: number
          longitude?: number
          name?: string
          public_label?: string
          requests_enabled?: boolean
          slug?: string
        }
        Relationships: []
      }
      dentist_reviews: {
        Row: {
          appointment_request_id: string
          author_user_id: string
          comment: string
          created_at: string
          dentist_id: string
          id: string
          moderation_status: string
          rating: number
        }
        Insert: {
          appointment_request_id: string
          author_user_id?: string
          comment: string
          created_at?: string
          dentist_id: string
          id?: string
          moderation_status?: string
          rating: number
        }
        Update: {
          appointment_request_id?: string
          author_user_id?: string
          comment?: string
          created_at?: string
          dentist_id?: string
          id?: string
          moderation_status?: string
          rating?: number
        }
        Relationships: [
          { foreignKeyName: "dentist_reviews_dentist_id_fkey"; columns: ["dentist_id"]; isOneToOne: false; referencedRelation: "dentists"; referencedColumns: ["id"] },
          { foreignKeyName: "dentist_reviews_appointment_request_id_fkey"; columns: ["appointment_request_id"]; isOneToOne: true; referencedRelation: "appointment_requests"; referencedColumns: ["id"] },
        ]
      }
      dentist_review_reports: {
        Row: {
          category: string
          created_at: string
          details: string
          id: string
          moderation_status: string
          reporter_user_id: string
          review_id: string
        }
        Insert: {
          category: string
          created_at?: string
          details?: string
          id?: string
          moderation_status?: string
          reporter_user_id?: string
          review_id: string
        }
        Update: {
          category?: string
          created_at?: string
          details?: string
          id?: string
          moderation_status?: string
          reporter_user_id?: string
          review_id?: string
        }
        Relationships: [
          { foreignKeyName: "dentist_review_reports_review_id_fkey"; columns: ["review_id"]; isOneToOne: false; referencedRelation: "dentist_reviews"; referencedColumns: ["id"] },
        ]
      }
      patient_consents: {
        Row: {
          accepted_at: string
          consent_text: string
          id: string
          policy_version: string
          purpose: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          consent_text: string
          id?: string
          policy_version: string
          purpose?: string
          revoked_at?: string | null
          user_id?: string
        }
        Update: {
          accepted_at?: string
          consent_text?: string
          id?: string
          policy_version?: string
          purpose?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_total: number
          created_at: string
          currency: string
          id: string
          plan: string
          status: PaymentStatus
          stripe_event_id: string
          stripe_session_id: string
          user_id: string
        }
        Insert: {
          amount_total: number
          created_at?: string
          currency: string
          id?: string
          plan: string
          status: PaymentStatus
          stripe_event_id: string
          stripe_session_id: string
          user_id: string
        }
        Update: {
          amount_total?: number
          created_at?: string
          currency?: string
          id?: string
          plan?: string
          status?: PaymentStatus
          stripe_event_id?: string
          stripe_session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      dentaia_manage_clinic_membership_v1: {
        Args: { p_request_id: string | null; p_operation: string; p_professional_id: string | null; p_clinic_id: string | null; p_membership_id: string | null }
        Returns: Json
      }
      dentaia_gestionar_ubicacion_v1: {
        Args: {
          p_solicitud: string
          p_operacion: string
          p_ubicacion_id: string | null
          p_dentist_id: string | null
          p_clinic_id: string | null
          p_practice_name: string | null
          p_practice_address: string | null
          p_latitude: number | null
          p_longitude: number | null
          p_verification_reference: string | null
        }
        Returns: Json
      }
      dentaia_moderate_reviews_v1: {
        Args: { p_request_id: string | null; p_operation: string; p_review_id: string | null; p_report_id: string | null; p_status: string | null }
        Returns: Json
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
