import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ImageAnnotatorClient } from 'https://esm.sh/@google-cloud/vision@4.0.0'

// Types
interface ProcessOCRRequest {
  media_id: string;
  image_url: string;
}

interface ProcessOCRResponse {
  status: 'done' | 'error';
  text?: string[];
  error?: string;
}

// Input validation schema
const ProcessOCRSchema = {
  media_id: 'string',
  image_url: 'string'
};

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body: ProcessOCRRequest = await req.json();
    
    // Validate input
    if (!body.media_id || !body.image_url) {
      return new Response(JSON.stringify({
        status: 'error',
        error: 'Missing required fields: media_id and image_url'
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Get service account JSON from Supabase secrets
    const serviceAccountJson = Deno.env.get('GOOGLE_APPLICATION_CREDENTIALS_JSON');
    if (!serviceAccountJson) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON not found in secrets');
    }

    // Parse service account JSON
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (error) {
      throw new Error('Invalid service account JSON format');
    }

    // Initialize Google Vision client with service account
    const visionClient = new ImageAnnotatorClient({
      credentials: serviceAccount,
    });

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase configuration in secrets');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log(`Processing OCR for media_id: ${body.media_id}`);
    console.log(`Image URL: ${body.image_url}`);

    // Perform OCR using Google Vision API
    const [result] = await visionClient.textDetection(body.image_url);
    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      console.log('No text detected in image');
      
      // Update media record with empty result
      const { error: updateError } = await supabase
        .from('media')
        .update({
          ocr_text: '',
          status: 'done'
        })
        .eq('id', body.media_id);

      if (updateError) {
        throw new Error(`Failed to update media record: ${updateError.message}`);
      }

      return new Response(JSON.stringify({
        status: 'done',
        text: []
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Extract text from detections
    const extractedText = detections.map(detection => detection.description || '').filter(text => text.length > 0);
    
    // The first detection is usually the full text, subsequent ones are individual words/lines
    const fullText = extractedText[0] || '';
    const individualTexts = extractedText.slice(1);

    console.log(`OCR completed. Found ${extractedText.length} text elements`);
    console.log(`Full text: ${fullText.substring(0, 100)}...`);

    // Update media record with OCR results
    const { error: updateError } = await supabase
      .from('media')
      .update({
        ocr_text: fullText,
        status: 'done'
      })
      .eq('id', body.media_id);

    if (updateError) {
      throw new Error(`Failed to update media record: ${updateError.message}`);
    }

    const response: ProcessOCRResponse = {
      status: 'done',
      text: individualTexts
    };

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('OCR processing error:', error);
    
    const errorResponse: ProcessOCRResponse = {
      status: 'error',
      error: error.message || 'Unknown error occurred'
    };

    return new Response(JSON.stringify(errorResponse), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
