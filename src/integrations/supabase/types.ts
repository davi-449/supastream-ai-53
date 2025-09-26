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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      builder_data: {
        Row: {
          created_at: string | null
          data: Json
          id: string
          label: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          data: Json
          id?: string
          label?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json
          id?: string
          label?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      chats: {
        Row: {
          created_at: string | null
          id: string
          project_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          project_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          project_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          file_name: string
          file_path: string
          id: string
          is_global: boolean | null
          meta: Json | null
          processed_at: string | null
          project_id: string | null
          status: string | null
          type: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          file_name: string
          file_path: string
          id?: string
          is_global?: boolean | null
          meta?: Json | null
          processed_at?: string | null
          project_id?: string | null
          status?: string | null
          type?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          file_name?: string
          file_path?: string
          id?: string
          is_global?: boolean | null
          meta?: Json | null
          processed_at?: string | null
          project_id?: string | null
          status?: string | null
          type?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      github_integrations: {
        Row: {
          created_at: string | null
          id: string
          meta: Json | null
          project_id: string | null
          repository_url: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          meta?: Json | null
          project_id?: string | null
          repository_url: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          meta?: Json | null
          project_id?: string | null
          repository_url?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "github_integrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          chat_id: string | null
          content: string
          created_at: string | null
          id: string
          sender: string
        }
        Insert: {
          chat_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          sender: string
        }
        Update: {
          chat_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      supabase_integrations: {
        Row: {
          anon_key: string
          created_at: string | null
          id: string
          meta: Json | null
          project_id: string | null
          project_url: string
          status: string
          updated_at: string | null
        }
        Insert: {
          anon_key: string
          created_at?: string | null
          id?: string
          meta?: Json | null
          project_id?: string | null
          project_url: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          anon_key?: string
          created_at?: string | null
          id?: string
          meta?: Json | null
          project_id?: string | null
          project_url?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supabase_integrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
