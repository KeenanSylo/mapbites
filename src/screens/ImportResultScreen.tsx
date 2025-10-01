import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { pollOCRStatus } from '../services/ocrMediaService';
import { PlaceCandidate, ProcessMediaResult } from '../types';

export const ImportResultScreen: React.FC = () => {
  const route = useRoute();
  const { mediaId } = (route.params as any) || {};
  const navigation = useNavigation();
  
  const [ocrResult, setOcrResult] = useState<{ status: string; ocr_text?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [showDropPin, setShowDropPin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceCandidate[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    processMediaAsync();
  }, []);

  const processMediaAsync = async () => {
    try {
      setLoading(true);
      
      // Poll OCR status until completion
      const result = await pollOCRStatus(mediaId, (status) => {
        console.log('OCR Status:', status);
      });
      
      setOcrResult(result);
      
    } catch (error) {
      console.error('OCR processing failed:', error);
      Alert.alert('Error', 'Failed to process OCR. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRestaurant = async () => {
    try {
      setProcessing(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Create a new restaurant with the OCR text as name
      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .insert({
          name: ocrResult?.ocr_text || 'Restaurant from OCR',
          address: 'Address to be determined',
          lat: 0,
          lng: 0,
          place_provider: 'manual',
          created_by: user.id
        } as any)
        .select()
        .single();
        
      if (error) {
        throw error;
      }
      
      // Update media record with restaurant
      const { error: updateError } = await (supabase as any)
        .from('media')
        .update({ restaurant_id: (restaurant as any).id })
        .eq('id', mediaId);
        
      if (updateError) {
        throw new Error(`Failed to update media: ${updateError.message}`);
      }
        
      Alert.alert('Success', 'Restaurant created!', [
        { text: 'OK', onPress: () => navigation.navigate('Map' as never) }
      ]);
    } catch (error) {
      console.error('Failed to create restaurant:', error);
      Alert.alert('Error', 'Failed to create restaurant. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleManualSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Error', 'Please enter a search query');
      return;
    }

    try {
      setSearching(true);
      
      // This would integrate with Google Places API
      // For now, show a placeholder
      setSearchResults([
        {
          name: searchQuery,
          address: 'Address not found',
          lat: 0,
          lng: 0,
          place_id: 'manual_' + Date.now(),
          score: 0.5
        }
      ]);
    } catch (error) {
      console.error('Manual search failed:', error);
      Alert.alert('Error', 'Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleDropPin = () => {
    // This would open a map interface for dropping a pin
    Alert.alert('Drop Pin', 'This feature will open a map for you to drop a pin at the restaurant location.');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Processing your media...</Text>
        <Text style={styles.loadingSubtext}>This may take a few moments</Text>
      </View>
    );
  }

  if (ocrResult?.status === 'done') {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.content}>
          <Text style={styles.title}>OCR Results</Text>
          <Text style={styles.subtitle}>
            We extracted text from your media. You can create a restaurant entry or search manually.
          </Text>

          {ocrResult.ocr_text && (
            <View style={styles.ocrContainer}>
              <Text style={styles.ocrTitle}>Text we found:</Text>
              <Text style={styles.ocrText}>{ocrResult.ocr_text}</Text>
            </View>
          )}

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleCreateRestaurant}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>📝 Create Restaurant</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowManualSearch(true)}
            >
              <Text style={styles.actionButtonText}>🔍 Search Manually</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowDropPin(true)}
            >
              <Text style={styles.actionButtonText}>📍 Drop Pin</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Processing...</Text>
        <Text style={styles.subtitle}>
          We're analyzing your media. This may take a few moments.
        </Text>
      </ScrollView>

      {/* Manual Search Modal */}
      <Modal
        visible={showManualSearch}
        transparent
        animationType="slide"
        onRequestClose={() => setShowManualSearch(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Search for Restaurant</Text>
            
            <TextInput
              style={styles.searchInput}
              placeholder="Enter restaurant name or address"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleManualSearch}
              disabled={searching}
            >
              {searching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </TouchableOpacity>

            {searchResults.length > 0 && (
              <ScrollView style={styles.searchResults}>
                {searchResults.map((result, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.searchResultItem}
                    onPress={() => handleCreateRestaurant()}
                  >
                    <Text style={styles.searchResultName}>{result.name}</Text>
                    <Text style={styles.searchResultAddress}>{result.address}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowManualSearch(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Drop Pin Modal */}
      <Modal
        visible={showDropPin}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDropPin(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Drop a Pin</Text>
            <Text style={styles.dropPinText}>
              This feature will open a map where you can drop a pin at the exact restaurant location.
            </Text>
            
            <TouchableOpacity
              style={styles.dropPinButton}
              onPress={handleDropPin}
            >
              <Text style={styles.dropPinButtonText}>Open Map</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowDropPin(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
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
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  successIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  successText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  successButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  successButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  ocrContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  ocrTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  ocrText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  candidatesContainer: {
    marginBottom: 20,
  },
  candidatesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  candidateItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  candidateContent: {
    flex: 1,
  },
  candidateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  candidateAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  candidateScore: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  candidateArrow: {
    fontSize: 20,
    color: '#007AFF',
    marginLeft: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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
    borderRadius: 15,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  searchResults: {
    maxHeight: 200,
    marginBottom: 15,
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  searchResultAddress: {
    fontSize: 14,
    color: '#666',
  },
  dropPinText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  dropPinButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  dropPinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 15,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
});
