export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  description?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface Media {
  id: string;
  restaurant_id: string;
  user_id: string;
  file_url: string;
  file_type: 'image' | 'video';
  file_name: string;
  file_size: number;
  metadata?: {
    latitude?: number;
    longitude?: number;
    timestamp?: string;
    source?: 'tiktok' | 'instagram' | 'manual';
  };
  created_at: string;
  updated_at: string;
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
