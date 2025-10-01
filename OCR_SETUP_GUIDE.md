# Google Vision OCR Setup Guide

This guide explains how to set up Google Vision OCR with service account authentication in your Supabase Edge Function.

## Overview

The OCR system uses Google Vision API with service account authentication to securely process images in Supabase Edge Functions. The client never handles sensitive credentials.

## Setup Steps

### 1. Google Cloud Setup

#### Create a Service Account
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to **IAM & Admin** → **Service Accounts**
4. Click **Create Service Account**
5. Fill in the details:
   - Name: `mapbites-ocr-service`
   - Description: `Service account for OCR processing in MapBites app`
6. Click **Create and Continue**

#### Grant Permissions
1. In the **Grant this service account access to project** section:
   - Add role: **Cloud Vision API User**
2. Click **Continue** and then **Done**

#### Create and Download Key
1. Click on the created service account
2. Go to the **Keys** tab
3. Click **Add Key** → **Create new key**
4. Choose **JSON** format
5. Download the JSON file (keep it secure!)

#### Enable Vision API
1. Go to **APIs & Services** → **Library**
2. Search for "Cloud Vision API"
3. Click on it and press **Enable**

### 2. Supabase Secrets Configuration

#### Set Up Edge Function Secrets
In your Supabase dashboard:

1. Go to **Edge Functions** → **Settings**
2. Add the following secrets:

**GOOGLE_APPLICATION_CREDENTIALS_JSON**
```
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "your-private-key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
  "client_id": "your-client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com"
}
```

**SERVICE_ROLE_KEY**
```
your-supabase-service-role-key
```

**SUPABASE_URL**
```
https://your-project-ref.supabase.co
```

### 3. Deploy Edge Function

#### Install Supabase CLI
```bash
npm install -g supabase
```

#### Login and Link Project
```bash
supabase login
supabase link --project-ref your-project-ref
```

#### Deploy Function
```bash
supabase functions deploy process-ocr
```

### 4. Client Environment Variables

Create a `.env` file in your project root:

```env
# Public environment variables (safe for client)
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=your-mapbox-token
```

### 5. Storage Buckets Setup

Create the following storage buckets in Supabase:

1. **media** - For uploaded photos/videos
2. **ocr-frames** - For extracted video frames

Set up RLS policies:

```sql
-- Allow authenticated users to upload to media bucket
CREATE POLICY "Users can upload media" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'media' AND 
  auth.role() = 'authenticated'
);

-- Allow users to read their own media
CREATE POLICY "Users can read own media" ON storage.objects
FOR SELECT USING (
  bucket_id = 'media' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
```

## Usage Flow

### 1. Client Uploads Media
```typescript
import { uploadMediaWithOCR } from '../services/ocrMediaService';

const result = await uploadMediaWithOCR(fileUri, {
  type: 'photo',
  sourceApp: 'gallery',
  userId: user.id,
});
```

### 2. Edge Function Processes OCR
- Receives `{ media_id, image_url }`
- Authenticates with Google Vision using service account
- Performs OCR on the image
- Updates database with results

### 3. Client Polls for Results
```typescript
import { pollOCRStatus } from '../services/ocrMediaService';

const result = await pollOCRStatus(mediaId, (status) => {
  console.log('OCR Status:', status);
});
```

## Security Considerations

### ✅ What's Secure
- Service account JSON is stored in Supabase secrets (server-side only)
- Service role key is stored in Supabase secrets (server-side only)
- Client only uses public anon key
- All OCR processing happens in Edge Functions

### ❌ What to Avoid
- Never put service account JSON in client code
- Never put service role key in client code
- Don't expose API keys in client environment variables

## Testing

### Test Edge Function Locally
```bash
# Start Supabase locally
supabase start

# Deploy function locally
supabase functions deploy process-ocr --no-verify-jwt

# Test with curl
curl -X POST 'http://localhost:54321/functions/v1/process-ocr' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "media_id": "test-media-id",
    "image_url": "https://example.com/image.jpg"
  }'
```

### Test in Production
1. Upload a photo through the app
2. Check Supabase logs for Edge Function execution
3. Verify OCR results in the database

## Troubleshooting

### Common Issues

1. **"GOOGLE_APPLICATION_CREDENTIALS_JSON not found"**
   - Check that the secret is set in Supabase Edge Functions settings
   - Verify the JSON format is correct

2. **"Invalid service account JSON format"**
   - Ensure the JSON is properly formatted
   - Check that all required fields are present

3. **"Vision API not enabled"**
   - Enable the Cloud Vision API in Google Cloud Console
   - Verify billing is set up

4. **"Permission denied"**
   - Check service account has "Cloud Vision API User" role
   - Verify the service account is active

### Debug Logs
Check Supabase Edge Functions logs:
1. Go to **Edge Functions** → **Logs**
2. Look for execution logs and errors
3. Check Google Cloud Console for API usage

## Cost Optimization

### Google Vision API Pricing
- $1.50 per 1,000 images (first 1,000 free per month)
- For typical usage: ~$0.0015 per image

### Optimization Tips
1. **Image Compression**: Compress images before OCR
2. **Batch Processing**: Process multiple images in one request
3. **Caching**: Cache OCR results to avoid re-processing
4. **Image Selection**: Use strategic frame extraction for videos

## Monitoring

### Set Up Monitoring
1. **Google Cloud Monitoring**: Track API usage and costs
2. **Supabase Analytics**: Monitor Edge Function performance
3. **Custom Logging**: Add detailed logs in Edge Function

### Alerts
Set up alerts for:
- High API usage
- Failed OCR requests
- Edge Function timeouts
- Cost thresholds

## Next Steps

1. Deploy the Edge Function
2. Test with sample images
3. Monitor costs and performance
4. Optimize based on usage patterns
5. Add error handling and retry logic
