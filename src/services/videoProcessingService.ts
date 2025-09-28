/**
 * Video Processing Service
 * Handles video frame extraction and processing for OCR analysis
 */

export interface VideoFrame {
  url: string;
  timestamp: number;
  width: number;
  height: number;
}

export interface VideoProcessingResult {
  frames: VideoFrame[];
  duration: number;
  success: boolean;
  error?: string;
}

export class VideoProcessingService {
  private readonly CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  private readonly CLOUDINARY_API_KEY = process.env.EXPO_PUBLIC_CLOUDINARY_API_KEY;
  private readonly CLOUDINARY_API_SECRET = process.env.EXPO_PUBLIC_CLOUDINARY_API_SECRET;

  /**
   * Extract frames from a video URL using Cloudinary
   */
  async extractVideoFrames(videoUrl: string): Promise<VideoFrame[]> {
    try {
      console.log('Extracting frames from video:', videoUrl);
      
      if (!this.CLOUDINARY_CLOUD_NAME) {
        console.warn('Cloudinary not configured, using fallback method');
        return this.extractFramesFallback(videoUrl);
      }

      // Upload video to Cloudinary and extract frames
      const uploadedVideo = await this.uploadVideoToCloudinary(videoUrl);
      if (!uploadedVideo) {
        throw new Error('Failed to upload video to Cloudinary');
      }

      // Extract frames at regular intervals
      const frames = await this.extractFramesFromCloudinaryVideo(uploadedVideo);
      return frames;
    } catch (error) {
      console.error('Error extracting video frames:', error);
      return this.extractFramesFallback(videoUrl);
    }
  }

  /**
   * Upload video to Cloudinary for processing
   */
  private async uploadVideoToCloudinary(videoUrl: string): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append('file', videoUrl);
      formData.append('upload_preset', 'video_processing');
      formData.append('resource_type', 'video');

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${this.CLOUDINARY_CLOUD_NAME}/video/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`Cloudinary upload error: ${response.status}`);
      }

      const result = await response.json();
      return result.public_id;
    } catch (error) {
      console.error('Error uploading to Cloudinary:', error);
      return null;
    }
  }

  /**
   * Extract frames from Cloudinary video
   */
  private async extractFramesFromCloudinaryVideo(publicId: string): Promise<VideoFrame[]> {
    const frames: VideoFrame[] = [];
    const frameCount = 5; // Extract 5 frames evenly distributed

    for (let i = 0; i < frameCount; i++) {
      const timestamp = (i / (frameCount - 1)) * 100; // 0%, 25%, 50%, 75%, 100%
      const frameUrl = `https://res.cloudinary.com/${this.CLOUDINARY_CLOUD_NAME}/video/upload/so_${timestamp}/${publicId}.jpg`;
      
      frames.push({
        url: frameUrl,
        timestamp: timestamp,
        width: 1280,
        height: 720,
      });
    }

    return frames;
  }

  /**
   * Fallback method for frame extraction
   */
  private extractFramesFallback(videoUrl: string): VideoFrame[] {
    // For TikTok videos, try to extract thumbnail frames
    if (videoUrl.includes('tiktok.com')) {
      return this.extractTikTokThumbnails(videoUrl);
    }

    // For other platforms, return empty array
    return [];
  }

  /**
   * Extract TikTok video thumbnails
   */
  private extractTikTokThumbnails(videoUrl: string): VideoFrame[] {
    const videoId = this.extractTikTokVideoId(videoUrl);
    if (!videoId) {
      console.log('Could not extract video ID from URL:', videoUrl);
      return [];
    }

    console.log('Extracted TikTok video ID:', videoId);

    // Try multiple TikTok CDN patterns for thumbnails
    const thumbnailPatterns = [
      `https://p16-sign-va.tiktokcdn-us.com/obj/tos-useast2a-p-0068-tx/${videoId}_1.jpg`,
      `https://p16-sign-va.tiktokcdn-us.com/obj/tos-useast2a-p-0068-tx/${videoId}_2.jpg`,
      `https://p16-sign-va.tiktokcdn-us.com/obj/tos-useast2a-p-0068-tx/${videoId}_3.jpg`,
      `https://p16-sign-va.tiktokcdn-us.com/obj/tos-useast2a-p-0068-tx/${videoId}.jpg`,
      `https://p16-sign-va.tiktokcdn-us.com/obj/tos-useast2a-p-0068-tx/${videoId}_cover.jpg`,
      `https://p16-sign-va.tiktokcdn-us.com/obj/tos-useast2a-p-0068-tx/${videoId}_thumbnail.jpg`,
    ];

    const frames: VideoFrame[] = [];
    
    // Try to get actual video frames using TikTok's API or CDN
    for (let i = 0; i < thumbnailPatterns.length; i++) {
      frames.push({
        url: thumbnailPatterns[i],
        timestamp: i * 25, // 0, 25, 50, 75, 100, 125
        width: 720,
        height: 1280,
      });
    }

    console.log('Generated thumbnail URLs:', frames.map(f => f.url));
    return frames;
  }

  /**
   * Extract TikTok video ID from URL
   */
  private extractTikTokVideoId(url: string): string | null {
    const patterns = [
      /tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
      /vm\.tiktok\.com\/(\w+)/,
      /tiktok\.com\/v\/(\d+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * Process video using FFmpeg (requires backend service)
   */
  async processVideoWithFFmpeg(videoUrl: string): Promise<VideoFrame[]> {
    try {
      // This would call a backend service that uses FFmpeg
      // to extract frames from the video
      const response = await fetch('/api/process-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoUrl }),
      });

      if (!response.ok) {
        throw new Error(`FFmpeg processing error: ${response.status}`);
      }

      const result = await response.json();
      return result.frames;
    } catch (error) {
      console.error('Error processing video with FFmpeg:', error);
      return [];
    }
  }
}

export const videoProcessingService = new VideoProcessingService();
