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
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { VideoMetadata } from '../types';
import { metadataService } from '../services/urlMetadataService';

export const URLImportScreen: React.FC = () => {
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

  const handleSaveVideo = async () => {
    if (!extractedMetadata || !user) return;

    try {
      console.log('User ID:', user.id);
      console.log('User object:', user);
      
      // Create a placeholder restaurant for the video
      const { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .insert({
          name: `Restaurant from ${extractedMetadata.platform}`,
          address: 'Location to be determined from video analysis',
          latitude: 0,
          longitude: 0,
          description: `Restaurant discovered from ${extractedMetadata.platform} video`,
          tags: [extractedMetadata.platform, 'video-import'],
          user_id: user.id,
        } as any)
        .select()
        .single();

      if (restaurantError) {
        console.error('Restaurant insert error:', restaurantError);
        throw restaurantError;
      }

      console.log('Restaurant created:', restaurantData);

      // Save the video as media
      const { error: mediaError } = await supabase
        .from('media')
        .insert({
          restaurant_id: (restaurantData as any).id,
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
            needsLocationExtraction: true,
          },
        } as any);

      if (mediaError) {
        console.error('Media insert error:', mediaError);
        throw mediaError;
      }

      Alert.alert(
        'Success!', 
        'Video imported successfully! The app will analyze the video to extract location information.',
        [
          {
            text: 'OK',
            onPress: () => {
              setUrl('');
              setExtractedMetadata(null);
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Error saving video:', error);
      Alert.alert('Error', `Failed to save video: ${error.message || 'Unknown error'}`);
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
});
