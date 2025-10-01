import * as VideoThumbnails from 'expo-video-thumbnails';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import { MediaUploadResult, ProcessMediaResult } from '../types';

export interface MediaUploadOptions {
  type: 'video' | 'photo';
  sourceApp?: 'tiktok' | 'instagram' | 'gallery';
  userId: string;
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
 * Upload media file and create media record
 */
export async function uploadMedia(
  fileUri: string,
  options: MediaUploadOptions
): Promise<MediaUploadResult> {
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
  
  let frameUrls: string[] = [];
  
  if (type === 'video') {
    // For videos, we need to get duration first
    // This is a simplified approach - in production you might want to use a proper video metadata library
    const durationMs = 10000; // Default 10 seconds, should be replaced with actual duration
    
    // Extract frames
    const frames = await extractFrames(fileUri, durationMs);
    
    // Upload frames
    const framePaths: string[] = [];
    for (let i = 0; i < frames.length; i++) {
      const framePath = `ocr-frames/${userId}/${media.id}/frame_${i}.jpg`;
      const frameUrl = await uploadFile('media', framePath, frames[i].uri);
      framePaths.push(framePath);
      frameUrls.push(frameUrl);
    }
    
    // Update media record with frame paths
    await supabase
      .from('media')
      .update({ ocr_frame_paths: framePaths })
      .eq('id', media.id);
  } else {
    // For photos, use the photo itself as the frame
    frameUrls = [fileUrl];
    
    await supabase
      .from('media')
      .update({ ocr_frame_paths: [storagePath] })
      .eq('id', media.id);
  }
  
  return {
    media_id: media.id,
    frame_urls: frameUrls,
    status: 'uploaded'
  };
}

/**
 * Process media through the Edge Function
 */
export async function processMedia(
  mediaId: string,
  frameUrls: string[],
  country?: string,
  city?: string
): Promise<ProcessMediaResult> {
  const { data, error } = await supabase.functions.invoke('process_media', {
    body: {
      media_id: mediaId,
      frame_urls: frameUrls,
      country,
      city
    }
  });
  
  if (error) {
    throw new Error(`Process media failed: ${error.message}`);
  }
  
  return data;
}

/**
 * Poll media status until completion
 */
export async function pollMediaStatus(
  mediaId: string,
  onStatusUpdate?: (status: string) => void
): Promise<ProcessMediaResult | null> {
  const maxAttempts = 30; // 30 seconds max
  const pollInterval = 1000; // 1 second
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data: media, error } = await supabase
      .from('media')
      .select('status, restaurant_id, ocr_text')
      .eq('id', mediaId)
      .single();
      
    if (error) {
      throw new Error(`Failed to check media status: ${error.message}`);
    }
    
    if (onStatusUpdate) {
      onStatusUpdate(media.status);
    }
    
    if (media.status === 'done') {
      // Get restaurant details
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', media.restaurant_id)
        .single();
        
      return {
        status: 'confirmed',
        restaurant_id: media.restaurant_id,
        score: 1.0, // Auto-confirmed
        ocr_text: media.ocr_text
      };
    }
    
    if (media.status === 'needs_confirmation') {
      // Get candidates from the Edge Function response
      // This would need to be stored in the database or returned differently
      return {
        status: 'needs_confirmation',
        candidates: [], // Would need to be populated from stored data
        ocr_text: media.ocr_text
      };
    }
    
    // Still processing, wait and try again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  throw new Error('Media processing timeout');
}

/**
 * Confirm a restaurant selection
 */
export async function confirmRestaurant(
  mediaId: string,
  restaurantId: string
): Promise<void> {
  const { error } = await supabase
    .from('media')
    .update({
      restaurant_id: restaurantId,
      status: 'done'
    })
    .eq('id', mediaId);
    
  if (error) {
    throw new Error(`Failed to confirm restaurant: ${error.message}`);
  }
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
