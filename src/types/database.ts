export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      restaurants: {
        Row: {
          id: string
          name: string
          address: string
          latitude: number
          longitude: number
          description: string | null
          tags: string[] | null
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          name: string
          address: string
          latitude: number
          longitude: number
          description?: string | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          name?: string
          address?: string
          latitude?: number
          longitude?: number
          description?: string | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
          user_id?: string
        }
      }
      media: {
        Row: {
          id: string
          restaurant_id: string
          user_id: string
          file_url: string
          file_type: 'image' | 'video'
          file_name: string
          file_size: number
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          user_id: string
          file_url: string
          file_type: 'image' | 'video'
          file_name: string
          file_size: number
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          user_id?: string
          file_url?: string
          file_type?: 'image' | 'video'
          file_name?: string
          file_size?: number
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
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
  }
}
