# Location Detection System Setup

This document explains how to set up the location detection system for the MapBites app.

## Overview

The location detection system uses OCR (Optical Character Recognition) to extract text from photos and videos, then searches for restaurants using Google Places API. The system can automatically identify restaurants with high confidence or present candidates for manual confirmation.

## Architecture

### Client Side (React Native)
- **Media Upload**: Upload photos/videos to Supabase Storage
- **Frame Extraction**: Extract 3-5 frames from videos for OCR
- **Result Handling**: Show confirmation screen with candidates or auto-confirm

### Server Side (Supabase Edge Functions)
- **OCR Processing**: Use Google Vision API or Tesseract.js
- **Place Search**: Query Google Places API with extracted text
- **Scoring**: Rank candidates by similarity and relevance
- **Caching**: Store results to avoid repeated API calls

## Setup Instructions

### 1. Database Schema

Run the SQL in `supabase-schema-updated.sql` in your Supabase SQL editor:

```sql
-- This creates the restaurants, media, and place_cache tables
-- with proper RLS policies
```

### 2. Environment Variables

#### Client (Expo - Public)
Create a `.env` file in your project root:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_access_token
```

#### Server (Supabase Edge Functions - Secret)
Set these in your Supabase project under Edge Functions > Environment Variables:

```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
GOOGLE_VISION_API_KEY=your_google_vision_api_key
FEATURE_USE_TESSERACT=false
DEFAULT_REGION=US
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. Google APIs Setup

#### Google Maps API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the following APIs:
   - Places API
   - Maps JavaScript API
3. Create an API key and restrict it to your domains
4. Add the key to your Supabase Edge Functions environment

#### Google Vision API
1. Enable the Vision API in Google Cloud Console
2. Create a service account and download the JSON key
3. Add the key to your Supabase Edge Functions environment

### 4. Deploy Edge Function

Deploy the Edge Function to Supabase:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy process_media
```

### 5. Storage Buckets

Create the following storage buckets in Supabase:

1. **media** - For uploaded photos/videos
2. **ocr-frames** - For extracted video frames

Set up RLS policies for these buckets to allow authenticated users to upload.

## Usage

### 1. Upload Media

```typescript
import { uploadMedia } from '../services/mediaService';

const result = await uploadMedia(fileUri, {
  type: 'video',
  sourceApp: 'gallery',
  userId: user.id,
});
```

### 2. Process Media

```typescript
import { processMedia } from '../services/mediaService';

const result = await processMedia(
  mediaId,
  frameUrls,
  country,
  city
);
```

### 3. Handle Results

```typescript
if (result.status === 'confirmed') {
  // Auto-confirmed, navigate to map
  navigation.navigate('Map');
} else {
  // Show candidates for manual confirmation
  setCandidates(result.candidates);
}
```

## API Costs

### Google Vision API
- $1.50 per 1,000 images (first 1,000 free per month)
- For 5 frames per video: ~$0.0075 per video

### Google Places API
- Text Search: $32 per 1,000 requests
- Place Details: $17 per 1,000 requests
- For typical usage: ~$0.05 per restaurant search

### Cost Optimization
- Use `place_cache` table to avoid repeated searches
- Set `FEATURE_USE_TESSERACT=true` to use free Tesseract.js instead of Vision API
- Implement rate limiting and request batching

## Testing

### Happy Path
1. Upload a photo with clear restaurant signage
2. System should auto-confirm and add to map

### Ambiguous Case
1. Upload a photo with generic text
2. System should show 3 candidates for manual selection

### Edge Case
1. Upload a photo with no readable text
2. System should show manual search options

## Troubleshooting

### Common Issues

1. **OCR not working**: Check Google Vision API key and permissions
2. **Places API errors**: Verify API key and billing setup
3. **Storage upload fails**: Check Supabase storage policies
4. **Edge Function timeout**: Increase timeout in Supabase settings

### Debug Mode

Enable debug logging by setting environment variables:

```env
DEBUG_OCR=true
DEBUG_PLACES=true
```

## Performance Tips

1. **Frame Selection**: Use strategic frame extraction (beginning, middle, end)
2. **Caching**: Implement aggressive caching for repeated queries
3. **Batch Processing**: Process multiple frames in parallel
4. **Image Optimization**: Compress images before OCR processing

## Security Considerations

1. **API Keys**: Never expose server-side keys in client code
2. **RLS Policies**: Ensure proper row-level security
3. **Rate Limiting**: Implement rate limiting for API calls
4. **Input Validation**: Validate all inputs in Edge Functions

## Monitoring

Set up monitoring for:
- Edge Function execution time
- API quota usage
- Error rates
- Cache hit rates

Use Supabase Analytics and Google Cloud Monitoring for comprehensive observability.
