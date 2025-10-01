import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.16.1/mod.ts'

// Types
interface OCRResult {
  text: string;
  confidence: number;
}

interface PlaceSearchResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
  place_id: string;
  rating?: number;
  types?: string[];
}

interface ProcessMediaRequest {
  media_id: string;
  frame_urls: string[];
  country?: string;
  city?: string;
}

interface ProcessMediaResponse {
  status: 'confirmed' | 'needs_confirmation';
  restaurant_id?: string;
  score?: number;
  candidates?: Array<{
    name: string;
    address: string;
    lat: number;
    lng: number;
    place_id: string;
    score: number;
  }>;
  ocr_text?: string;
}

// Input validation schema
const ProcessMediaSchema = z.object({
  media_id: z.string().uuid(),
  frame_urls: z.array(z.string().url()),
  country: z.string().optional(),
  city: z.string().optional(),
});

// Food-related keywords for POI extraction
const FOOD_KEYWORDS = [
  'burger', 'pizza', 'sushi', 'café', 'cafe', 'bakery', 'bar', 'grill', 
  'kebab', 'ramen', 'taco', 'steak', 'bistro', 'brunch', 'restaurant',
  'diner', 'eatery', 'kitchen', 'food', 'dining', 'cuisine'
];

// OCR using Google Vision API
async function performOCRWithVision(imageUrl: string): Promise<OCRResult> {
  const visionApiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
  if (!visionApiKey) {
    throw new Error('GOOGLE_VISION_API_KEY not configured');
  }

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              source: {
                imageUri: imageUrl,
              },
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 1,
              },
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Vision API error: ${response.statusText}`);
  }

  const data = await response.json();
  const textAnnotations = data.responses[0]?.textAnnotations;
  
  if (!textAnnotations || textAnnotations.length === 0) {
    return { text: '', confidence: 0 };
  }

  const fullText = textAnnotations[0].description || '';
  const confidence = textAnnotations[0].confidence || 0;

  return { text: fullText, confidence };
}

// OCR using Tesseract.js (fallback)
async function performOCRWithTesseract(imageUrl: string): Promise<OCRResult> {
  // For now, return empty result - Tesseract.js would need to be implemented
  // This is a placeholder for the fallback OCR method
  console.log('Tesseract OCR not implemented yet, using Vision API');
  return { text: '', confidence: 0 };
}

// Extract candidate POI strings from OCR text
function extractPOICandidates(text: string): string[] {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const candidates: string[] = [];

  for (const line of lines) {
    // Check if line contains food keywords
    const hasFoodKeyword = FOOD_KEYWORDS.some(keyword => 
      line.toLowerCase().includes(keyword.toLowerCase())
    );

    // Check if line looks like a restaurant name (title case, reasonable length)
    const isTitleCase = /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(line);
    const reasonableLength = line.length >= 3 && line.length <= 50;

    // Check for social media indicators
    const hasSocialIndicator = line.includes('@') || line.includes('#');

    if ((hasFoodKeyword || (isTitleCase && reasonableLength) || hasSocialIndicator) && 
        !line.includes('http') && !line.includes('www')) {
      candidates.push(line);
    }
  }

  return [...new Set(candidates)]; // Remove duplicates
}

// Search places using Google Places API
async function searchPlaces(query: string, country?: string, city?: string): Promise<PlaceSearchResult[]> {
  const placesApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!placesApiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY not configured');
  }

  // Build search query
  let searchQuery = query;
  if (city) {
    searchQuery = `${query} in ${city}`;
  }

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${placesApiKey}&type=restaurant|food`
  );

  if (!response.ok) {
    throw new Error(`Places API error: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.status !== 'OK') {
    console.warn(`Places API returned status: ${data.status}`);
    return [];
  }

  return data.results.map((place: any) => ({
    name: place.name,
    address: place.formatted_address,
    lat: place.geometry.location.lat,
    lng: place.geometry.location.lng,
    place_id: place.place_id,
    rating: place.rating,
    types: place.types,
  }));
}

// Get place details from Google Places API
async function getPlaceDetails(placeId: string): Promise<PlaceSearchResult | null> {
  const placesApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!placesApiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY not configured');
  }

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${placesApiKey}&fields=name,formatted_address,geometry,place_id,rating,types`
  );

  if (!response.ok) {
    throw new Error(`Places Details API error: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.status !== 'OK' || !data.result) {
    return null;
  }

  const place = data.result;
  return {
    name: place.name,
    address: place.formatted_address,
    lat: place.geometry.location.lat,
    lng: place.geometry.location.lng,
    place_id: place.place_id,
    rating: place.rating,
    types: place.types,
  };
}

// Calculate similarity score between two strings
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  if (s1 === s2) return 1.0;
  
  // Simple Jaro-Winkler-like similarity
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Score place candidates
function scorePlaceCandidates(candidates: string[], places: PlaceSearchResult[]): Array<PlaceSearchResult & { score: number }> {
  return places.map(place => {
    let maxScore = 0;
    
    for (const candidate of candidates) {
      const similarity = calculateSimilarity(candidate, place.name);
      let score = similarity;
      
      // Bonus for food-related types
      if (place.types?.some(type => FOOD_KEYWORDS.some(keyword => type.includes(keyword)))) {
        score += 0.1;
      }
      
      // Bonus for high rating
      if (place.rating && place.rating > 4.0) {
        score += 0.1;
      }
      
      maxScore = Math.max(maxScore, score);
    }
    
    return { ...place, score: maxScore };
  }).sort((a, b) => b.score - a.score);
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    const validatedData = ProcessMediaSchema.parse(body);
    
    const { media_id, frame_urls, country, city } = validatedData;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if we should use Tesseract instead of Vision
    const useTesseract = Deno.env.get('FEATURE_USE_TESSERACT') === 'true';
    
    // Perform OCR on all frames
    const ocrResults: OCRResult[] = [];
    for (const frameUrl of frame_urls) {
      try {
        const result = useTesseract 
          ? await performOCRWithTesseract(frameUrl)
          : await performOCRWithVision(frameUrl);
        ocrResults.push(result);
      } catch (error) {
        console.error(`OCR failed for frame ${frameUrl}:`, error);
        ocrResults.push({ text: '', confidence: 0 });
      }
    }

    // Aggregate and normalize OCR text
    const allText = ocrResults.map(r => r.text).join(' ').toLowerCase();
    const normalizedText = allText.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Extract POI candidates
    const candidates = extractPOICandidates(allText);
    
    if (candidates.length === 0) {
      // No candidates found, return needs_confirmation
      await supabase
        .from('media')
        .update({ 
          status: 'needs_confirmation',
          ocr_text: normalizedText
        })
        .eq('id', media_id);

      return new Response(JSON.stringify({
        status: 'needs_confirmation',
        ocr_text: normalizedText,
        candidates: []
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Search for places using the best candidates
    const allPlaces: PlaceSearchResult[] = [];
    for (const candidate of candidates.slice(0, 3)) { // Limit to top 3 candidates
      try {
        const places = await searchPlaces(candidate, country, city);
        allPlaces.push(...places);
      } catch (error) {
        console.error(`Place search failed for candidate "${candidate}":`, error);
      }
    }

    if (allPlaces.length === 0) {
      // No places found, return needs_confirmation
      await supabase
        .from('media')
        .update({ 
          status: 'needs_confirmation',
          ocr_text: normalizedText
        })
        .eq('id', media_id);

      return new Response(JSON.stringify({
        status: 'needs_confirmation',
        ocr_text: normalizedText,
        candidates: []
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Score and rank places
    const scoredPlaces = scorePlaceCandidates(candidates, allPlaces);
    const topPlaces = scoredPlaces.slice(0, 3);

    // Check if we have a confident match (score >= 0.75)
    const bestMatch = topPlaces[0];
    if (bestMatch && bestMatch.score >= 0.75) {
      // Auto-confirm the best match
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .insert({
          name: bestMatch.name,
          address: bestMatch.address,
          lat: bestMatch.lat,
          lng: bestMatch.lng,
          place_provider: 'google',
          place_id: bestMatch.place_id,
          tags: ['ai-analyzed'],
          created_by: (await supabase.from('media').select('user_id').eq('id', media_id).single()).data?.user_id
        })
        .select()
        .single();

      if (restaurantError) {
        throw new Error(`Failed to create restaurant: ${restaurantError.message}`);
      }

      // Update media record
      await supabase
        .from('media')
        .update({
          restaurant_id: restaurant.id,
          status: 'done',
          ocr_text: normalizedText
        })
        .eq('id', media_id);

      // Cache the result
      await supabase
        .from('place_cache')
        .insert({
          normalized_query: candidates[0].toLowerCase(),
          country,
          city,
          provider: 'google',
          place_id: bestMatch.place_id,
          name: bestMatch.name,
          address: bestMatch.address,
          lat: bestMatch.lat,
          lng: bestMatch.lng,
          score: bestMatch.score
        });

      return new Response(JSON.stringify({
        status: 'confirmed',
        restaurant_id: restaurant.id,
        score: bestMatch.score
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      // Return candidates for manual confirmation
      await supabase
        .from('media')
        .update({ 
          status: 'needs_confirmation',
          ocr_text: normalizedText
        })
        .eq('id', media_id);

      return new Response(JSON.stringify({
        status: 'needs_confirmation',
        candidates: topPlaces.map(place => ({
          name: place.name,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
          place_id: place.place_id,
          score: place.score
        })),
        ocr_text: normalizedText
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

  } catch (error) {
    console.error('Process media error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
