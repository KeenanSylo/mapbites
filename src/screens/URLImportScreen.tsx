import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { VideoMetadata } from '../types';
import { metadataService } from '../services/urlMetadataService';
import { videoAnalysisService } from '../services/videoAnalysisService';
import { uploadMediaWithOCR } from '../services/ocrMediaService';

export const URLImportScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [extractedMetadata, setExtractedMetadata] = useState<VideoMetadata | null>(null);

  // Debug function to check Supabase session
  const checkSupabaseSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('Supabase session:', session);
      console.log('Session error:', error);
      console.log('Current user from session:', session?.user);
    } catch (error) {
      console.error('Error getting session:', error);
    }
  };

  // Check session on component mount
  React.useEffect(() => {
    checkSupabaseSession();
  }, []);

  const detectPlatform = (url: string): VideoMetadata['platform'] => {
    return metadataService.detectPlatform(url);
  };

  const extractVideoMetadata = async (videoUrl: string): Promise<VideoMetadata> => {
    return await metadataService.extractMetadata(videoUrl);
  };

  const handleExtractMetadata = async () => {
    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }

    setLoading(true);
    try {
      const metadata = await extractVideoMetadata(url);
      setExtractedMetadata(metadata);
    } catch (error) {
      console.error('Error extracting metadata:', error);
      Alert.alert('Error', 'Failed to extract video metadata. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestOCR = async () => {
    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }

    try {
      new URL(url);
    } catch {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }

    setLoading(true);
    try {
      // Test OCR extraction
      await videoAnalysisService.testOCRExtraction(url);
      Alert.alert('Debug', 'Check console for OCR test results');
    } catch (error) {
      console.error('Error testing OCR:', error);
      Alert.alert('Error', 'Failed to test OCR extraction');
    } finally {
      setLoading(false);
    }
  };

  const handleImagePicker = async () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to upload media');
      return;
    }

    try {
      setLoading(true);

      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Media library permission is required');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const isVideo = asset.type === 'video';
        
        // Upload media and trigger OCR
        const uploadResult = await uploadMediaWithOCR(asset.uri, {
          type: isVideo ? 'video' : 'photo',
          sourceApp: 'gallery',
          userId: user.id,
        });

        Alert.alert('Success', 'Media uploaded! OCR processing started. Check the media in your profile.', [
          { text: 'OK', onPress: () => {
            // Navigate to profile to see the media
            (navigation as any).navigate('Profile');
          }}
        ]);
      }
    } catch (error) {
      console.error('Media upload failed:', error);
      Alert.alert('Error', 'Failed to upload media. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVideo = async () => {
    if (!extractedMetadata || !user) return;

    setLoading(true);
    try {
      console.log('User ID:', user.id);
      console.log('User object:', user);
      
      // Analyze video for restaurant information
      console.log('Starting video analysis...');
      const analysisResult = await videoAnalysisService.analyzeVideo(extractedMetadata.url);
      console.log('Video analysis result:', analysisResult);
      
      // Create restaurant with analyzed information
      const restaurantData = {
        name: analysisResult.restaurantName || `Restaurant from ${extractedMetadata.platform}`,
        address: analysisResult.location || 'Location to be determined from video analysis',
        latitude: analysisResult.coordinates?.latitude || 0,
        longitude: analysisResult.coordinates?.longitude || 0,
        description: `Restaurant discovered from ${extractedMetadata.platform} video${analysisResult.extractedText.length > 0 ? ` - Extracted text: ${analysisResult.extractedText.join(', ')}` : ''}`,
        tags: [extractedMetadata.platform, 'video-import', ...(analysisResult.confidence > 0.5 ? ['ai-analyzed'] : [])],
        user_id: user.id,
      };

      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .insert(restaurantData as any)
        .select()
        .single();

      if (restaurantError) {
        console.error('Restaurant insert error:', restaurantError);
        throw restaurantError;
      }

      console.log('Restaurant created:', restaurant);

      // Save the video as media
      const { error: mediaError } = await supabase
        .from('media')
        .insert({
          restaurant_id: (restaurant as any).id,
          user_id: user.id,
          file_url: extractedMetadata.url,
          file_type: 'video',
          file_name: `${extractedMetadata.platform}-video`,
          file_size: 0,
          metadata: {
            source: extractedMetadata.platform,
            originalUrl: extractedMetadata.url,
            title: extractedMetadata.title,
            description: extractedMetadata.description,
            thumbnail: extractedMetadata.thumbnail,
            timestamp: new Date().toISOString(),
            analysisResult,
          },
        } as any);

      if (mediaError) {
        console.error('Media insert error:', mediaError);
        throw mediaError;
      }

      const successMessage = analysisResult.confidence > 0.5 
        ? `Video imported successfully! Found: ${restaurantData.name} at ${restaurantData.address}`
        : 'Video imported successfully! Location analysis completed with limited confidence.';
      
      Alert.alert('Success!', successMessage, [
        {
          text: 'OK',
          onPress: () => {
            setUrl('');
            setExtractedMetadata(null);
          }
        }
      ]);
    } catch (error: any) {
      console.error('Error saving video:', error);
      Alert.alert('Error', `Failed to save video: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Import Video from Social Media</Text>
        <Text style={styles.subtitle}>
          Paste a TikTok, YouTube, or Instagram video URL to extract restaurant location information
        </Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.urlInput}
            placeholder="https://www.tiktok.com/@user/video/..."
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <TouchableOpacity
            style={[styles.extractButton, loading && styles.buttonDisabled]}
            onPress={handleExtractMetadata}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.extractButtonText}>Extract Video Info</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.debugButton, loading && styles.buttonDisabled]}
            onPress={handleTestOCR}
            disabled={loading}
          >
            <Text style={styles.debugButtonText}>Test OCR (Debug)</Text>
          </TouchableOpacity>
        </View>

        {extractedMetadata && (
          <View style={styles.metadataContainer}>
            <Text style={styles.metadataTitle}>Video Information</Text>
            
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>Platform:</Text>
              <Text style={styles.metadataValue}>
                {extractedMetadata.platform.charAt(0).toUpperCase() + extractedMetadata.platform.slice(1)}
              </Text>
            </View>

            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>Title:</Text>
              <Text style={styles.metadataValue}>{extractedMetadata.title}</Text>
            </View>

            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>Description:</Text>
              <Text style={styles.metadataValue}>{extractedMetadata.description}</Text>
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveVideo}
            >
              <Text style={styles.saveButtonText}>Save Video & Extract Location</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.importOptions}>
          <Text style={styles.importOptionsTitle}>Import Options:</Text>
          
          <TouchableOpacity
            style={styles.importOptionButton}
            onPress={handleImagePicker}
          >
            <Text style={styles.importOptionIcon}>📷</Text>
            <Text style={styles.importOptionTitle}>Upload Photo/Video</Text>
            <Text style={styles.importOptionDescription}>
              Upload from gallery or take a new photo
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.supportedPlatforms}>
          <Text style={styles.supportedTitle}>Supported Platforms:</Text>
          <Text style={styles.supportedText}>• TikTok</Text>
          <Text style={styles.supportedText}>• YouTube</Text>
          <Text style={styles.supportedText}>• Instagram</Text>
          <Text style={styles.supportedText}>• And more...</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 30,
  },
  urlInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 15,
  },
  extractButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  extractButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  debugButton: {
    backgroundColor: '#FF9500',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  metadataContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  metadataTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  metadataItem: {
    marginBottom: 10,
  },
  metadataLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 2,
  },
  metadataValue: {
    fontSize: 14,
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#34C759',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 15,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  supportedPlatforms: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  supportedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  supportedText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  importOptions: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  importOptionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  importOptionButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  importOptionIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  importOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  importOptionDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});
