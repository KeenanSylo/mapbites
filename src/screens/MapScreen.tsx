import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Text,
  Modal,
  TextInput,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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
  const [refreshing, setRefreshing] = useState(false);
  const [recentlyImported, setRecentlyImported] = useState<MapPin | null>(null);
  const [currentZoom, setCurrentZoom] = useState(12);
  const [mapRef, setMapRef] = useState<Mapbox.MapView | null>(null);
  const [showRestaurantList, setShowRestaurantList] = useState(false);

  useEffect(() => {
    if (user) {
      loadRestaurants();
      getCurrentLocation();
    }
  }, [user]);

  // Refresh restaurants when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadRestaurants();
      }
    }, [user])
  );

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

  const loadRestaurants = async (isRefresh = false) => {
    if (!user) return;

    if (isRefresh) {
      setRefreshing(true);
    }

    try {
      const { data: restaurants, error } = await supabase
        .from('restaurants')
        .select(`
          *,
          media (*)
        `)
        .eq('created_by', user.id);

      if (error) throw error;

      const mapPins: MapPin[] = (restaurants || [])
        .filter((restaurant: any) => 
          restaurant.lat !== 0 && restaurant.lng !== 0 &&
          !isNaN(restaurant.lat) && !isNaN(restaurant.lng)
        )
        .map((restaurant: any) => ({
          id: restaurant.id,
          coordinate: [restaurant.lng, restaurant.lat],
          restaurant,
          media: restaurant.media || [],
        }));

      console.log('Loaded restaurants for map:', mapPins.length);
      setPins(mapPins);
      
      // Check if there's a recently imported restaurant (with ai-analyzed tag)
      const videoImported = mapPins.find(pin => 
        pin.restaurant.tags?.includes('ai-analyzed') && 
        pin.restaurant.created_at && 
        new Date(pin.restaurant.created_at) > new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
      );
      
      if (videoImported) {
        setRecentlyImported(videoImported);
        // Auto-hide after 10 seconds
        setTimeout(() => setRecentlyImported(null), 10000);
      }
    } catch (error) {
      console.error('Error loading restaurants:', error);
      Alert.alert('Error', 'Failed to load restaurants');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  };

  const onRefresh = useCallback(() => {
    loadRestaurants(true);
  }, [user]);

  // Zoom controls
  const zoomIn = useCallback(() => {
    if (mapRef) {
      const newZoom = Math.min(currentZoom + 2, 20);
      setCurrentZoom(newZoom);
      (mapRef as any).setCamera({
        centerCoordinate: userLocation || [-74.006, 40.7128],
        zoomLevel: newZoom,
        animationDuration: 500,
      });
    }
  }, [mapRef, currentZoom, userLocation]);

  const zoomOut = useCallback(() => {
    if (mapRef) {
      const newZoom = Math.max(currentZoom - 2, 1);
      setCurrentZoom(newZoom);
      (mapRef as any).setCamera({
        centerCoordinate: userLocation || [-74.006, 40.7128],
        zoomLevel: newZoom,
        animationDuration: 500,
      });
    }
  }, [mapRef, currentZoom, userLocation]);

  // Locate restaurant feature
  const locateRestaurant = useCallback((restaurant: any) => {
    if (mapRef && restaurant.lat && restaurant.lng) {
      const coordinate: [number, number] = [restaurant.lng, restaurant.lat];
      (mapRef as any).setCamera({
        centerCoordinate: coordinate,
        zoomLevel: 16,
        animationDuration: 1000,
      });
      setSelectedPin({
        id: restaurant.id,
        coordinate,
        restaurant,
        media: restaurant.media || [],
      });
    }
  }, [mapRef]);

  // Show all restaurants
  const showAllRestaurants = useCallback(() => {
    if (mapRef && pins.length > 0) {
      // Calculate bounds to fit all restaurants
      const lats = pins.map(pin => pin.coordinate[1]);
      const lngs = pins.map(pin => pin.coordinate[0]);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      
      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;
      
      (mapRef as any).setCamera({
        centerCoordinate: [centerLng, centerLat],
        zoomLevel: 10,
        animationDuration: 1000,
      });
    }
  }, [mapRef, pins]);

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
          lat: selectedCoordinate[1],
          lng: selectedCoordinate[0],
          created_by: user.id,
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
        ref={setMapRef}
        style={styles.map}
        onPress={handleMapPress}
        styleURL={Mapbox.StyleURL.Street}
      >
        <Mapbox.Camera
          centerCoordinate={userLocation || [-74.006, 40.7128]}
          zoomLevel={currentZoom}
          animationMode="flyTo"
          animationDuration={2000}
        />

        {pins.map(renderPin)}
      </Mapbox.MapView>

      {/* Refresh Button */}
      <TouchableOpacity
        style={styles.refreshButton}
        onPress={onRefresh}
        disabled={refreshing}
      >
        <Text style={styles.refreshButtonText}>
          {refreshing ? '🔄' : '🔄'} Refresh
        </Text>
      </TouchableOpacity>

      {/* Restaurant Count */}
      <View style={styles.restaurantCount}>
        <Text style={styles.restaurantCountText}>
          {pins.length} restaurant{pins.length !== 1 ? 's' : ''} found
        </Text>
      </View>

      {/* Zoom Controls */}
      <View style={styles.zoomControls}>
        <TouchableOpacity
          style={styles.zoomButton}
          onPress={zoomIn}
        >
          <Text style={styles.zoomButtonText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.zoomButton}
          onPress={zoomOut}
        >
          <Text style={styles.zoomButtonText}>−</Text>
        </TouchableOpacity>
      </View>

      {/* Locate Controls */}
      <View style={styles.locateControls}>
        <TouchableOpacity
          style={styles.locateButton}
          onPress={showAllRestaurants}
          disabled={pins.length === 0}
        >
          <Text style={styles.locateButtonText}>📍 Show All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.locateButton}
          onPress={() => setShowRestaurantList(true)}
          disabled={pins.length === 0}
        >
          <Text style={styles.locateButtonText}>📋 List</Text>
        </TouchableOpacity>
        {userLocation && (
          <TouchableOpacity
            style={styles.locateButton}
            onPress={() => {
              if (mapRef) {
                (mapRef as any).setCamera({
                  centerCoordinate: userLocation,
                  zoomLevel: 15,
                  animationDuration: 1000,
                });
              }
            }}
          >
            <Text style={styles.locateButtonText}>🎯 My Location</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Recently Imported Restaurant Info Bar */}
      {recentlyImported && (
        <View style={styles.importedRestaurantBar}>
          <View style={styles.importedRestaurantContent}>
            <Text style={styles.importedRestaurantTitle}>
              🎉 New Restaurant Found!
            </Text>
            <Text style={styles.importedRestaurantName}>
              {recentlyImported.restaurant.name}
            </Text>
            <Text style={styles.importedRestaurantAddress}>
              {recentlyImported.restaurant.address}
            </Text>
            {recentlyImported.restaurant.tags?.includes('ai-analyzed') && (
              <Text style={styles.importedRestaurantTag}>
                ✨ AI Analyzed
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.closeImportedBar}
            onPress={() => setRecentlyImported(null)}
          >
            <Text style={styles.closeImportedBarText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

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

      {/* Restaurant List Modal */}
      <Modal
        visible={showRestaurantList}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRestaurantList(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.restaurantListModal}>
            <Text style={styles.modalTitle}>Restaurant List</Text>
            <ScrollView style={styles.restaurantList}>
              {pins.map((pin) => (
                <TouchableOpacity
                  key={pin.id}
                  style={styles.restaurantListItem}
                  onPress={() => {
                    locateRestaurant(pin.restaurant);
                    setShowRestaurantList(false);
                  }}
                >
                  <Text style={styles.restaurantListItemName}>
                    {pin.restaurant.name}
                  </Text>
                  <Text style={styles.restaurantListItemAddress}>
                    {pin.restaurant.address}
                  </Text>
                  {pin.restaurant.tags?.includes('ai-analyzed') && (
                    <Text style={styles.restaurantListItemTag}>
                      ✨ AI Analyzed
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.button, styles.closeButton]}
              onPress={() => setShowRestaurantList(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
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
  refreshButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  restaurantCount: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
  },
  restaurantCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  importedRestaurantBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  importedRestaurantContent: {
    flex: 1,
  },
  importedRestaurantTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  importedRestaurantName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  importedRestaurantAddress: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginBottom: 4,
  },
  importedRestaurantTag: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '600',
  },
  closeImportedBar: {
    padding: 5,
    marginLeft: 10,
  },
  closeImportedBarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  zoomControls: {
    position: 'absolute',
    right: 20,
    top: 100,
    flexDirection: 'column',
  },
  zoomButton: {
    backgroundColor: '#fff',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  zoomButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  locateControls: {
    position: 'absolute',
    right: 20,
    top: 200,
    flexDirection: 'column',
  },
  locateButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  locateButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  restaurantListModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  restaurantList: {
    maxHeight: 400,
    marginBottom: 15,
  },
  restaurantListItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  restaurantListItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  restaurantListItemAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  restaurantListItemTag: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
  },
});
