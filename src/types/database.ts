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
          address: string | null
          lat: number
          lng: number
          place_provider: string
          place_id: string | null
          tags: string[]
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          lat: number
          lng: number
          place_provider?: string
          place_id?: string | null
          tags?: string[]
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          lat?: number
          lng?: number
          place_provider?: string
          place_id?: string | null
          tags?: string[]
          created_by?: string
          created_at?: string
        }
      }
      media: {
        Row: {
          id: string
          user_id: string
          restaurant_id: string | null
          storage_path: string
          source_app: string | null
          type: 'video' | 'photo'
          ocr_frame_paths: string[]
          ocr_text: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          restaurant_id?: string | null
          storage_path: string
          source_app?: string | null
          type: 'video' | 'photo'
          ocr_frame_paths?: string[]
          ocr_text?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          restaurant_id?: string | null
          storage_path?: string
          source_app?: string | null
          type?: 'video' | 'photo'
          ocr_frame_paths?: string[]
          ocr_text?: string | null
          status?: string
          created_at?: string
        }
      }
      place_cache: {
        Row: {
          id: string
          normalized_query: string
          country: string | null
          city: string | null
          provider: string
          place_id: string | null
          name: string | null
          address: string | null
          lat: number | null
          lng: number | null
          score: number | null
          created_at: string
        }
        Insert: {
          id?: string
          normalized_query: string
          country?: string | null
          city?: string | null
          provider?: string
          place_id?: string | null
          name?: string | null
          address?: string | null
          lat?: number | null
          lng?: number | null
          score?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          normalized_query?: string
          country?: string | null
          city?: string | null
          provider?: string
          place_id?: string | null
          name?: string | null
          address?: string | null
          lat?: number | null
          lng?: number | null
          score?: number | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      process_media: {
        Args: {
          media_id: string
          frame_urls: string[]
          country?: string
          city?: string
        }
        Returns: {
          status: string
          restaurant_id?: string
          score?: number
          candidates?: Array<{
            name: string
            address: string
            lat: number
            lng: number
            place_id: string
            score: number
          }>
          ocr_text?: string
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
