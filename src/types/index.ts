export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Restaurant {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  place_provider: string;
  place_id: string | null;
  tags: string[];
  created_by: string;
  created_at: string;
}

export interface Media {
  id: string;
  user_id: string;
  restaurant_id: string | null;
  storage_path: string;
  source_app: string | null;
  type: 'video' | 'photo';
  ocr_frame_paths: string[];
  ocr_text: string | null;
  status: string;
  created_at: string;
}

export interface PlaceCache {
  id: string;
  normalized_query: string;
  country: string | null;
  city: string | null;
  provider: string;
  place_id: string | null;
  name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  score: number | null;
  created_at: string;
}

export interface AuthContextType {
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
}

export interface MapPin {
  id: string;
  coordinate: [number, number];
  restaurant: Restaurant;
  media: Media[];
}

export interface PlaceCandidate {
  name: string;
  address: string;
  lat: number;
  lng: number;
  place_id: string;
  score: number;
}

export interface ProcessMediaResult {
  status: 'confirmed' | 'needs_confirmation';
  restaurant_id?: string;
  score?: number;
  candidates?: PlaceCandidate[];
  ocr_text?: string;
}

export interface MediaUploadResult {
  media_id: string;
  frame_urls: string[];
  status: 'uploaded' | 'processing' | 'needs_confirmation' | 'done';
}

export interface VideoMetadata {
  url: string;
  platform: 'tiktok' | 'youtube' | 'instagram' | 'other';
  title?: string;
  description?: string;
  thumbnail?: string;
}

export interface ShareData {
  type: 'image' | 'video';
  uri: string;
  name: string;
  size: number;
}
