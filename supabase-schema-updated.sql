-- Updated Supabase schema for location detection system
-- Run this in your Supabase SQL editor

-- Drop existing tables if they exist (be careful in production!)
-- DROP TABLE IF EXISTS media CASCADE;
-- DROP TABLE IF EXISTS restaurants CASCADE;
-- DROP TABLE IF EXISTS place_cache CASCADE;

-- restaurants table
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  place_provider TEXT DEFAULT 'google',          -- 'google' | 'mapbox' | 'manual'
  place_id TEXT,                                  -- Google place_id or Mapbox feature id
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- media table
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  restaurant_id UUID REFERENCES restaurants(id),
  storage_path TEXT NOT NULL,                     -- Supabase Storage path
  source_app TEXT,                                -- 'tiktok' | 'instagram' | 'gallery'
  type TEXT CHECK (type IN ('video','photo')),
  ocr_frame_paths TEXT[] DEFAULT '{}',            -- array of frame paths
  ocr_text TEXT,                                  -- aggregated OCR text
  status TEXT DEFAULT 'uploaded',                 -- 'uploaded' | 'processing' | 'needs_confirmation' | 'done'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- cached place lookups
CREATE TABLE IF NOT EXISTS place_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_query TEXT NOT NULL,
  country TEXT,
  city TEXT,
  provider TEXT DEFAULT 'google',
  place_id TEXT,
  name TEXT,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  score DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: users can read/write their own media; restaurants are public read
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "media_owner_rw"
  ON media FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "restaurants_public_read"
  ON restaurants FOR SELECT
  USING (true);
CREATE POLICY "restaurants_owner_write"
  ON restaurants FOR INSERT
  WITH CHECK (auth.uid() = created_by);

ALTER TABLE place_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "place_cache_public_read"
  ON place_cache FOR SELECT USING (true);
CREATE POLICY "place_cache_admin_write"
  ON place_cache FOR INSERT WITH CHECK (true); -- or restrict via service role in Edge Function.

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_restaurants_lat_lng ON restaurants(lat, lng);
CREATE INDEX IF NOT EXISTS idx_media_user_id ON media(user_id);
CREATE INDEX IF NOT EXISTS idx_media_status ON media(status);
CREATE INDEX IF NOT EXISTS idx_place_cache_query ON place_cache(normalized_query, country, city);
