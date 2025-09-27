import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { Media, Restaurant } from '../types';
import * as ImagePicker from 'expo-image-picker';

interface MediaItem {
  id: string;
  media: Media;
  restaurant: Restaurant;
}

export const ProfileScreen: React.FC = () => {
  const { user, signOut } = useAuth();
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      loadMediaItems();
    }
  }, [user]);

  const loadMediaItems = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('media')
        .select(`
          *,
          restaurants (*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const items: MediaItem[] = (data || []).map((item: any) => ({
        id: item.id,
        media: item,
        restaurant: item.restaurants,
      }));

      setMediaItems(items);
    } catch (error) {
      console.error('Error loading media items:', error);
      Alert.alert('Error', 'Failed to load media items');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMediaItems();
    setRefreshing(false);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Media library permission is required');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadMedia(result.assets[0]);
    }
  };

  const uploadMedia = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!user) return;

    try {
      // Create a form data to upload the file
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.type === 'image' ? 'image/jpeg' : 'video/mp4',
        name: asset.fileName || 'media.jpg',
      } as any);

      // Upload to Supabase Storage
      const fileExt = asset.fileName?.split('.').pop() || 'jpg';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, {
          uri: asset.uri,
          type: asset.type === 'image' ? 'image/jpeg' : 'video/mp4',
          name: asset.fileName || 'media.jpg',
        } as any);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      // For now, we'll create a placeholder restaurant
      // In a real app, you'd either select an existing restaurant or create a new one
      const { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .insert({
          name: 'Imported Location',
          address: 'Address to be determined',
          latitude: 0,
          longitude: 0,
          user_id: user.id,
        } as any)
        .select()
        .single();

      if (restaurantError) throw restaurantError;

      // Save media record
      const { error: mediaError } = await supabase
        .from('media')
        .insert({
          restaurant_id: (restaurantData as any).id,
          user_id: user.id,
          file_url: urlData.publicUrl,
          file_type: asset.type === 'image' ? 'image' : 'video',
          file_name: asset.fileName || 'media.jpg',
          file_size: asset.fileSize || 0,
          metadata: {
            source: 'manual',
            timestamp: new Date().toISOString(),
          },
        } as any);

      if (mediaError) throw mediaError;

      Alert.alert('Success', 'Media uploaded successfully!');
      loadMediaItems();
    } catch (error) {
      console.error('Error uploading media:', error);
      Alert.alert('Error', 'Failed to upload media');
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const renderMediaItem = ({ item }: { item: MediaItem }) => (
    <TouchableOpacity style={styles.mediaItem}>
      <View style={styles.mediaPreview}>
        {item.media.file_type === 'image' ? (
          <Image
            source={{ uri: item.media.file_url }}
            style={styles.mediaImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.videoPlaceholder}>
            <Text style={styles.videoIcon}>🎥</Text>
          </View>
        )}
      </View>
      <View style={styles.mediaInfo}>
        <Text style={styles.restaurantName}>{item.restaurant.name}</Text>
        <Text style={styles.mediaDate}>
          {new Date(item.media.created_at).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Media Library</Text>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.addButton} onPress={pickImage}>
          <Text style={styles.addButtonText}>+ Add Media</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.urlImportButton} onPress={() => {
          // Navigate to URL import screen
          // This will be handled by the tab navigation
        }}>
          <Text style={styles.urlImportButtonText}>📱 Import Video URL</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={mediaItems}
        renderItem={renderMediaItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No media items yet</Text>
            <Text style={styles.emptySubtext}>
              Tap "Add Media" to import photos and videos from your social media
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  signOutButton: {
    padding: 8,
  },
  signOutText: {
    color: '#007AFF',
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    margin: 20,
    gap: 10,
  },
  addButton: {
    backgroundColor: '#007AFF',
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  urlImportButton: {
    backgroundColor: '#34C759',
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  urlImportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    padding: 20,
  },
  mediaItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 15,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  mediaPreview: {
    width: 80,
    height: 80,
    backgroundColor: '#f0f0f0',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  videoIcon: {
    fontSize: 24,
  },
  mediaInfo: {
    flex: 1,
    padding: 15,
    justifyContent: 'center',
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  mediaDate: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});
