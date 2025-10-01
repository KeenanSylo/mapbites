import * as VideoThumbnails from 'expo-video-thumbnails';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export interface MediaUploadOptions {
  type: 'video' | 'photo';
  sourceApp?: 'tiktok' | 'instagram' | 'gallery' | 'camera';
  userId: string;
}

export interface OCRResult {
  status: 'done' | 'error';
  text?: string[];
  error?: string;
}

export interface FrameExtractionResult {
  time: number;
  uri: string;
}

/**
 * Extract frames from a video for OCR processing
 */
export async function extractFrames(
  videoUri: string, 
  durationMs: number
): Promise<FrameExtractionResult[]> {
  const times = [0, durationMs / 2, Math.max(0, durationMs - 500)];
  
  // Add 2 random frames if duration > 3s
  if (durationMs > 3000) {
    times.push(Math.random() * durationMs);
    times.push(Math.random() * durationMs);
  }

  const frames: FrameExtractionResult[] = [];
  
  for (const time of times) {
    try {
      const { uri: frameUri } = await VideoThumbnails.getThumbnailAsync(
        videoUri, 
        { time: Math.floor(time) }
      );
      frames.push({ time, uri: frameUri });
    } catch (error) {
      console.error(`Failed to extract frame at ${time}ms:`, error);
    }
  }
  
  return frames;
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(
  bucket: string, 
  path: string, 
  fileUri: string
): Promise<string> {
  const response = await fetch(fileUri);
  const blob = await response.blob();
  
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { 
      upsert: true, 
      contentType: 'image/jpeg' 
    });
    
  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
  
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);
    
  return data.publicUrl;
}

/**
 * Upload media file and trigger OCR processing
 */
export async function uploadMediaWithOCR(
  fileUri: string,
  options: MediaUploadOptions
): Promise<{ media_id: string; status: string }> {
  const { type, sourceApp, userId } = options;
  
  // Generate unique filename
  const fileExtension = type === 'video' ? 'mp4' : 'jpg';
  const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExtension}`;
  const storagePath = `media/${userId}/${fileName}`;
  
  // Upload main file
  const fileUrl = await uploadFile('media', storagePath, fileUri);
  
  // Create media record
  const { data: media, error: mediaError } = await supabase
    .from('media')
    .insert({
      user_id: userId,
      storage_path: storagePath,
      source_app: sourceApp,
      type,
      status: 'uploaded'
    })
    .select()
    .single();
    
  if (mediaError) {
    throw new Error(`Failed to create media record: ${mediaError.message}`);
  }
  
  // For photos, trigger OCR immediately
  if (type === 'photo') {
    await triggerOCR(media.id, fileUrl);
  } else {
    // For videos, extract frames first
    const durationMs = 10000; // Default 10 seconds, should be replaced with actual duration
    const frames = await extractFrames(fileUri, durationMs);
    
    if (frames.length > 0) {
      // Upload the first frame and trigger OCR
      const framePath = `ocr-frames/${userId}/${media.id}/frame_0.jpg`;
      const frameUrl = await uploadFile('media', framePath, frames[0].uri);
      
      // Update media record with frame path
      await supabase
        .from('media')
        .update({ ocr_frame_paths: [framePath] })
        .eq('id', media.id);
        
      // Trigger OCR on the first frame
      await triggerOCR(media.id, frameUrl);
    }
  }
  
  return {
    media_id: media.id,
    status: 'processing'
  };
}

/**
 * Trigger OCR processing via Edge Function
 */
export async function triggerOCR(
  mediaId: string,
  imageUrl: string
): Promise<OCRResult> {
  const { data, error } = await supabase.functions.invoke('process-ocr', {
    body: {
      media_id: mediaId,
      image_url: imageUrl
    }
  });
  
  if (error) {
    throw new Error(`OCR processing failed: ${error.message}`);
  }
  
  return data;
}

/**
 * Poll media status until OCR completion
 */
export async function pollOCRStatus(
  mediaId: string,
  onStatusUpdate?: (status: string) => void
): Promise<{ status: string; ocr_text?: string }> {
  const maxAttempts = 60; // 60 seconds max
  const pollInterval = 1000; // 1 second
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data: media, error } = await supabase
      .from('media')
      .select('status, ocr_text')
      .eq('id', mediaId)
      .single();
      
    if (error) {
      throw new Error(`Failed to check media status: ${error.message}`);
    }
    
    if (onStatusUpdate) {
      onStatusUpdate(media.status);
    }
    
    if (media.status === 'done') {
      return {
        status: 'done',
        ocr_text: media.ocr_text
      };
    }
    
    if (media.status === 'error') {
      throw new Error('OCR processing failed');
    }
    
    // Still processing, wait and try again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  throw new Error('OCR processing timeout');
}

/**
 * Get user's location for bias parameters
 */
export async function getUserLocation(): Promise<{ country?: string; city?: string }> {
  try {
    // This would integrate with expo-location to get user's current location
    // and reverse geocode to get country/city
    // For now, return empty object
    return {};
  } catch (error) {
    console.error('Failed to get user location:', error);
    return {};
  }
}
