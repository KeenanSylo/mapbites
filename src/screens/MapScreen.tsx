import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Text,
  Modal,
  TextInput,
} from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { Restaurant, Media, MapPin } from '../types';
import * as Location from 'expo-location';

// Configure Mapbox
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN!);

export const MapScreen: React.FC = () => {
  const { user } = useAuth();
  const [pins, setPins] = useState<MapPin[]>([]);
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [showAddRestaurant, setShowAddRestaurant] = useState(false);
  const [newRestaurantName, setNewRestaurantName] = useState('');
  const [newRestaurantAddress, setNewRestaurantAddress] = useState('');
  const [selectedCoordinate, setSelectedCoordinate] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (user) {
      loadRestaurants();
      getCurrentLocation();
    }
  }, [user]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to use the map');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const coords: [number, number] = [location.coords.longitude, location.coords.latitude];
      setUserLocation(coords);
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const loadRestaurants = async () => {
    if (!user) return;

    try {
      const { data: restaurants, error } = await supabase
        .from('restaurants')
        .select(`
          *,
          media (*)
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const mapPins: MapPin[] = (restaurants || []).map((restaurant: any) => ({
        id: restaurant.id,
        coordinate: [restaurant.longitude, restaurant.latitude],
        restaurant,
        media: restaurant.media || [],
      }));

      setPins(mapPins);
    } catch (error) {
      console.error('Error loading restaurants:', error);
      Alert.alert('Error', 'Failed to load restaurants');
    }
  };

  const handleMapPress = useCallback((event: any) => {
    const { geometry } = event;
    if (geometry && geometry.coordinates) {
      const coordinate: [number, number] = geometry.coordinates;
      setSelectedCoordinate(coordinate);
      setShowAddRestaurant(true);
    }
  }, []);

  const handleAddRestaurant = async () => {
    if (!user || !selectedCoordinate || !newRestaurantName.trim()) {
      Alert.alert('Error', 'Please provide a restaurant name');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('restaurants')
        .insert({
          name: newRestaurantName.trim(),
          address: newRestaurantAddress.trim() || 'Address not provided',
          latitude: selectedCoordinate[1],
          longitude: selectedCoordinate[0],
          user_id: user.id,
        } as any)
        .select()
        .single();

      if (error) throw error;

      const newPin: MapPin = {
        id: (data as any).id,
        coordinate: selectedCoordinate,
        restaurant: data as any,
        media: [],
      };

      setPins([...pins, newPin]);
      setShowAddRestaurant(false);
      setNewRestaurantName('');
      setNewRestaurantAddress('');
      setSelectedCoordinate(null);
      
      Alert.alert('Success', 'Restaurant added successfully!');
    } catch (error) {
      console.error('Error adding restaurant:', error);
      Alert.alert('Error', 'Failed to add restaurant');
    }
  };

  const renderPin = (pin: MapPin) => (
    <Mapbox.PointAnnotation
      key={pin.id}
      id={pin.id}
      coordinate={pin.coordinate}
      onSelected={() => setSelectedPin(pin)}
    >
      <View style={styles.pin}>
        <Text style={styles.pinText}>🍽️</Text>
      </View>
    </Mapbox.PointAnnotation>
  );

  return (
    <View style={styles.container}>
      <Mapbox.MapView
        style={styles.map}
        onPress={handleMapPress}
        styleURL={Mapbox.StyleURL.Street}
      >
        <Mapbox.Camera
          centerCoordinate={userLocation || [-74.006, 40.7128]}
          zoomLevel={12}
          animationMode="flyTo"
          animationDuration={2000}
        />

        {pins.map(renderPin)}
      </Mapbox.MapView>

      {/* Add Restaurant Modal */}
      <Modal
        visible={showAddRestaurant}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddRestaurant(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Restaurant</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Restaurant Name"
              value={newRestaurantName}
              onChangeText={setNewRestaurantName}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Address (optional)"
              value={newRestaurantAddress}
              onChangeText={setNewRestaurantAddress}
            />

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setShowAddRestaurant(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.addButton]}
                onPress={handleAddRestaurant}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Restaurant Details Modal */}
      <Modal
        visible={!!selectedPin}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedPin(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedPin && (
              <>
                <Text style={styles.modalTitle}>{selectedPin.restaurant.name}</Text>
                <Text style={styles.restaurantAddress}>{selectedPin.restaurant.address}</Text>
                
                {selectedPin.restaurant.description && (
                  <Text style={styles.restaurantDescription}>
                    {selectedPin.restaurant.description}
                  </Text>
                )}

                <Text style={styles.mediaCount}>
                  {selectedPin.media.length} media item{selectedPin.media.length !== 1 ? 's' : ''}
                </Text>

                <TouchableOpacity
                  style={[styles.button, styles.closeButton]}
                  onPress={() => setSelectedPin(null)}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  pin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  pinText: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  addButton: {
    backgroundColor: '#007AFF',
  },
  closeButton: {
    backgroundColor: '#007AFF',
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  restaurantAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  restaurantDescription: {
    fontSize: 14,
    color: '#333',
    marginBottom: 10,
  },
  mediaCount: {
    fontSize: 12,
    color: '#999',
    marginBottom: 15,
  },
});
