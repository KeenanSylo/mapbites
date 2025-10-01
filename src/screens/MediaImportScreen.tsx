import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { uploadMediaWithOCR, pollOCRStatus } from '../services/ocrMediaService';
import { useAuth } from '../hooks/useAuth';

export const MediaImportScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const handleImagePicker = async () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to upload media');
      return;
    }

    try {
      setUploading(true);

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

        // Navigate to result screen with media ID
        (navigation as any).navigate('ImportResult', {
          mediaId: uploadResult.media_id,
        });
      }
    } catch (error) {
      console.error('Media upload failed:', error);
      Alert.alert('Error', 'Failed to upload media. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleCamera = async () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to take photos');
      return;
    }

    try {
      setUploading(true);

      // Request permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Camera permission is required');
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        // Upload media and trigger OCR
        const uploadResult = await uploadMediaWithOCR(asset.uri, {
          type: 'photo',
          sourceApp: 'camera',
          userId: user.id,
        });

        // Navigate to result screen with media ID
        (navigation as any).navigate('ImportResult', {
          mediaId: uploadResult.media_id,
        });
      }
    } catch (error) {
      console.error('Camera capture failed:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (uploading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Uploading your media...</Text>
        <Text style={styles.loadingSubtext}>This may take a few moments</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Restaurant from Media</Text>
      <Text style={styles.subtitle}>
        Upload a photo or video of a restaurant to automatically find its location.
      </Text>

      <View style={styles.optionsContainer}>
        <TouchableOpacity
          style={styles.optionButton}
          onPress={handleImagePicker}
          disabled={uploading}
        >
          <Text style={styles.optionIcon}>📷</Text>
          <Text style={styles.optionTitle}>Choose from Gallery</Text>
          <Text style={styles.optionDescription}>
            Select a photo or video from your device
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionButton}
          onPress={handleCamera}
          disabled={uploading}
        >
          <Text style={styles.optionIcon}>📸</Text>
          <Text style={styles.optionTitle}>Take Photo</Text>
          <Text style={styles.optionDescription}>
            Capture a new photo with your camera
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>How it works:</Text>
        <Text style={styles.infoText}>
          • We'll analyze the text in your media using OCR
        </Text>
        <Text style={styles.infoText}>
          • Search for restaurants matching the text we find
        </Text>
        <Text style={styles.infoText}>
          • Show you the best matches to confirm
        </Text>
        <Text style={styles.infoText}>
          • Add the restaurant to your map automatically
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  optionsContainer: {
    marginBottom: 40,
  },
  optionButton: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  optionIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  infoContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
});
