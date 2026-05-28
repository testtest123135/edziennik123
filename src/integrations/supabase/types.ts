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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_chats: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          role: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          role: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "ai_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          id: string
          pinned: boolean | null
          title: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          id?: string
          pinned?: boolean | null
          title: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          id?: string
          pinned?: boolean | null
          title?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          ai_model: string
          ai_provider: string
          ai_vision_enabled: boolean | null
          gguf_endpoint: string | null
          gguf_model_name: string | null
          groq_api_key_set: boolean | null
          id: number
          school_name: string | null
          teacher_name: string | null
          updated_at: string
        }
        Insert: {
          ai_model?: string
          ai_provider?: string
          ai_vision_enabled?: boolean | null
          gguf_endpoint?: string | null
          gguf_model_name?: string | null
          groq_api_key_set?: boolean | null
          id?: number
          school_name?: string | null
          teacher_name?: string | null
          updated_at?: string
        }
        Update: {
          ai_model?: string
          ai_provider?: string
          ai_vision_enabled?: boolean | null
          gguf_endpoint?: string | null
          gguf_model_name?: string | null
          groq_api_key_set?: boolean | null
          id?: number
          school_name?: string | null
          teacher_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          created_at: string
          date: string
          id: string
          note: string | null
          status: string
          student_id: string
          subject_id: string | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          note?: string | null
          status: string
          student_id: string
          subject_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          status?: string
          student_id?: string
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      behavior_entries: {
        Row: {
          created_at: string
          date: string
          id: string
          points: number
          reason: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          points: number
          reason?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          points?: number
          reason?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "behavior_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          created_at: string
          description: string | null
          event_date: string
          event_time: string | null
          event_type: string
          id: string
          subject_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_date: string
          event_time?: string | null
          event_type?: string
          id?: string
          subject_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_date?: string
          event_time?: string | null
          event_type?: string
          id?: string
          subject_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      extra_activities: {
        Row: {
          created_at: string
          date: string | null
          description: string | null
          end_time: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          start_time: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          date?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          start_time?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          date?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          start_time?: string | null
          status?: string | null
        }
        Relationships: []
      }
      grade_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          weight?: number
        }
        Relationships: []
      }
      grades: {
        Row: {
          category_id: string | null
          created_at: string
          date: string
          description: string | null
          grade: string
          grade_value: number | null
          id: string
          student_id: string
          subject_id: string | null
          weight: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          grade: string
          grade_value?: number | null
          id?: string
          student_id: string
          subject_id?: string | null
          weight?: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          grade?: string
          grade_value?: number | null
          id?: string
          student_id?: string
          subject_id?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "grades_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "grade_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_topics: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          subject_id: string | null
          topic: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          subject_id?: string | null
          topic: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          subject_id?: string | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          ai_replied: boolean | null
          ai_scheduled_for: string | null
          body: string
          created_at: string
          direction: string
          id: string
          reply_to: string | null
          student_id: string | null
          subject: string | null
        }
        Insert: {
          ai_replied?: boolean | null
          ai_scheduled_for?: string | null
          body: string
          created_at?: string
          direction: string
          id?: string
          reply_to?: string | null
          student_id?: string | null
          subject?: string | null
        }
        Update: {
          ai_replied?: boolean | null
          ai_scheduled_for?: string | null
          body?: string
          created_at?: string
          direction?: string
          id?: string
          reply_to?: string | null
          student_id?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      punishments: {
        Row: {
          amount: number | null
          amount_paid: number | null
          created_at: string
          degree: number | null
          details: string | null
          expires_at: string | null
          hours: number | null
          id: string
          installments_allowed: boolean | null
          paid_at: string | null
          pay_due_date: string | null
          reason: string
          student_id: string
          type: string
          work_done_at: string | null
          work_hours_done: number | null
          work_hours_required: number | null
        }
        Insert: {
          amount?: number | null
          amount_paid?: number | null
          created_at?: string
          degree?: number | null
          details?: string | null
          expires_at?: string | null
          hours?: number | null
          id?: string
          installments_allowed?: boolean | null
          paid_at?: string | null
          pay_due_date?: string | null
          reason: string
          student_id: string
          type: string
          work_done_at?: string | null
          work_hours_done?: number | null
          work_hours_required?: number | null
        }
        Update: {
          amount?: number | null
          amount_paid?: number | null
          created_at?: string
          degree?: number | null
          details?: string | null
          expires_at?: string | null
          hours?: number | null
          id?: string
          installments_allowed?: boolean | null
          paid_at?: string | null
          pay_due_date?: string | null
          reason?: string
          student_id?: string
          type?: string
          work_done_at?: string | null
          work_hours_done?: number | null
          work_hours_required?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "punishments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule: {
        Row: {
          class_name: string | null
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          room: string | null
          start_time: string
          subject_id: string | null
        }
        Insert: {
          class_name?: string | null
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          room?: string | null
          start_time: string
          subject_id?: string | null
        }
        Update: {
          class_name?: string | null
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          room?: string | null
          start_time?: string
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          behavior_points: number
          class_name: string | null
          created_at: string
          first_name: string
          id: string
          last_name: string
          notes: string | null
          parent_contact: string | null
          parent_name: string | null
        }
        Insert: {
          behavior_points?: number
          class_name?: string | null
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          parent_contact?: string | null
          parent_name?: string | null
        }
        Update: {
          behavior_points?: number
          class_name?: string | null
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          parent_contact?: string | null
          parent_name?: string | null
        }
        Relationships: []
      }
      subjects: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "teacher" | "admin"
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
    Enums: {
      app_role: ["teacher", "admin"],
    },
  },
} as const
