import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

interface LocationMapPickerProps {
  district: string;
  city: string;
  barangay: string;
  initialCoordinates: { latitude: number; longitude: number };
  onLocationUpdate: (coordinates: { latitude: number; longitude: number }) => void;
  disabled?: boolean;
}

const { width, height } = Dimensions.get('window');

const LocationMapPicker: React.FC<LocationMapPickerProps> = ({
  district,
  city,
  barangay,
  initialCoordinates,
  onLocationUpdate,
  disabled = false,
}) => {
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [tempCoordinates, setTempCoordinates] = useState(initialCoordinates);
  const [isLoading, setIsLoading] = useState(false);

  // Only update temp coordinates when modal is not visible (not being interacted with)
  useEffect(() => {
    if (!mapModalVisible) {
      setTempCoordinates(initialCoordinates);
    }
  }, [initialCoordinates, mapModalVisible]);

  const handleOpenMap = () => {
    setTempCoordinates(initialCoordinates);
    setMapModalVisible(true);
  };

  const handleConfirm = () => {
    onLocationUpdate(tempCoordinates);
    setMapModalVisible(false);
  };

  // Generate HTML for OpenStreetMap with Leaflet
  const generateMapHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body, html { margin: 0; padding: 0; height: 100%; width: 100%; }
          #map { height: 100%; width: 100%; }
          .coordinates-display {
            position: absolute;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            padding: 8px 15px;
            border-radius: 20px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            z-index: 1000;
            font-size: 12px;
            font-family: monospace;
            font-weight: bold;
            color: #008080;
          }
        </style>
      </head>
      <body>
        <div id="coordinates" class="coordinates-display">
          ${tempCoordinates.latitude.toFixed(6)}, ${tempCoordinates.longitude.toFixed(6)}
        </div>
        <div id="map"></div>
        <script>
          // Initialize map
          var map = L.map('map', {
            zoomControl: true,
            attributionControl: true
          }).setView([${tempCoordinates.latitude}, ${tempCoordinates.longitude}], 15);

          // Add OpenStreetMap tile layer
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
          }).addTo(map);

          // Create draggable marker
          var marker = L.marker([${tempCoordinates.latitude}, ${tempCoordinates.longitude}], {
            draggable: true,
            autoPan: true
          }).addTo(map);

          // Custom marker icon (optional)
          var customIcon = L.divIcon({
            className: 'custom-marker',
            html: '<div style="background-color: #008080; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
            iconSize: [30, 30],
            iconAnchor: [15, 30]
          });
          marker.setIcon(customIcon);

          // Popup with location info
          marker.bindPopup(\`
            <strong>${barangay}</strong><br/>
            ${city}<br/>
            <small>Drag to adjust location</small>
          \`).openPopup();

          // Update coordinates display
          function updateCoordinates(lat, lng) {
            document.getElementById('coordinates').innerText = 
              lat.toFixed(6) + ', ' + lng.toFixed(6);
            
            // Send message to React Native
            window.ReactNativeWebView.postMessage(JSON.stringify({
              latitude: lat,
              longitude: lng
            }));
          }

          // Handle marker drag
          marker.on('dragend', function(e) {
            var position = marker.getLatLng();
            updateCoordinates(position.lat, position.lng);
          });

          // Handle map click to move marker
          map.on('click', function(e) {
            marker.setLatLng(e.latlng);
            updateCoordinates(e.latlng.lat, e.latlng.lng);
            marker.openPopup();
          });

          // Add locate control button
          L.control.locate = L.Control.extend({
            onAdd: function(map) {
              var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
              container.innerHTML = '<a href="#" style="width:30px; height:30px; line-height:30px; text-align:center; font-size:18px; display:block; background:white; color:#008080; text-decoration:none;" title="My Location">📍</a>';
              container.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(function(position) {
                    var lat = position.coords.latitude;
                    var lng = position.coords.longitude;
                    map.setView([lat, lng], 16);
                    marker.setLatLng([lat, lng]);
                    updateCoordinates(lat, lng);
                    marker.openPopup();
                  });
                }
                return false;
              };
              return container;
            }
          });
          
          var locateControl = new L.control.locate({ position: 'topright' });
          map.addControl(locateControl);

          // Prevent default touch handling
          map.dragging.enable();
          map.touchZoom.enable();
          map.doubleClickZoom.enable();
          map.scrollWheelZoom.enable();
        </script>
      </body>
      </html>
    `;
  };

  const handleWebViewMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.latitude && data.longitude) {
        // Validate that the new coordinates are still within the selected area
        const validationResult = await validateCoordinates(data.latitude, data.longitude);
        
        if (validationResult.isValid) {
          setTempCoordinates({
            latitude: data.latitude,
            longitude: data.longitude,
          });
        } else {
          // Reset to initial coordinates if outside boundary
          setTempCoordinates(initialCoordinates);
          Alert.alert(
            'Location Outside Boundary',
            `The pin must be within ${city}. ${validationResult.message || 'Please select a location within the selected city.'}\n\nLocation has been reset to the original position.`,
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error parsing webview message:', error);
    }
  };

  // Validate if coordinates are within the selected city/barangay
  const validateCoordinates = async (lat: number, lng: number): Promise<{isValid: boolean, message?: string}> => {
    try {
      // Calculate distance from original coordinates (in meters)
      const distance = calculateDistance(
        initialCoordinates.latitude,
        initialCoordinates.longitude,
        lat,
        lng
      );

      // Skip validation for very small movements (less than 50 meters)
      // This allows fine-tuning the pin without triggering validation
      if (distance < 50) {
        return { isValid: true };
      }

      // Allow movement within 1km radius (reasonable for same barangay/area)
      if (distance > 1000) {
        return { 
          isValid: false, 
          message: `Location is too far (${(distance/1000).toFixed(1)}km away). Please stay within your selected area.` 
        };
      }

      // If within 1km, assume it's valid without reverse geocoding
      // This avoids API calls and false positives for nearby locations
      return { isValid: true };
    } catch (error) {
      console.error('Validation error:', error);
      // If validation fails, allow the change
      return { isValid: true };
    }
  };

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  return (
    <>
      {/* Pin Location Button */}
      <TouchableOpacity
        onPress={handleOpenMap}
        style={[styles.mapButton, disabled && styles.mapButtonDisabled]}
        disabled={disabled}
      >
        <Ionicons name="map" size={20} color={disabled ? "#999" : "#fff"} />
        <Text style={[styles.mapButtonText, disabled && styles.mapButtonTextDisabled]}>
          {disabled ? 'Select all fields to enable map' : 'Pin Exact Location on Map'}
        </Text>
      </TouchableOpacity>

      {/* Map Modal */}
      <Modal
        visible={mapModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setMapModalVisible(false)}
      >
        <View style={styles.mapModalContainer}>
          {/* Header */}
          <View style={styles.mapHeader}>
            <TouchableOpacity onPress={() => setMapModalVisible(false)}>
              <Ionicons name="close" size={28} color="#008080" />
            </TouchableOpacity>
            <Text style={styles.mapTitle}>Pin Your Location</Text>
            <TouchableOpacity onPress={handleConfirm}>
              <Text style={styles.doneButton}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Instructions */}
          <View style={styles.instructions}>
            <Ionicons name="information-circle" size={20} color="#008080" />
            <Text style={styles.instructionsText}>
              Drag the pin or tap on the map to set your exact location
            </Text>
          </View>

          {/* Selected Location Display */}
          <View style={styles.selectedLocation}>
            <Text style={styles.selectedLocationLabel}>Selected Area:</Text>
            <Text style={styles.selectedLocationValue}>
              {barangay}, {city}
            </Text>
          </View>

          {/* Map WebView */}
          <View style={styles.mapContainer}>
            <WebView
              source={{ html: generateMapHTML() }}
              style={styles.map}
              onMessage={handleWebViewMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#008080" />
                  <Text style={styles.loadingText}>Loading map...</Text>
                </View>
              )}
            />
          </View>

          {/* Coordinates Display */}
          <View style={styles.coordinatesDisplay}>
            <View style={styles.coordinatesRow}>
              <Ionicons name="location" size={18} color="#008080" />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.coordinatesLabel}>Current Pin Location:</Text>
                <Text style={styles.coordinatesValue}>
                  {tempCoordinates.latitude.toFixed(6)}, {tempCoordinates.longitude.toFixed(6)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#008080',
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 10,
  },
  mapButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  mapButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  mapButtonTextDisabled: {
    color: '#999',
  },
  mapModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  doneButton: {
    color: '#008080',
    fontSize: 16,
    fontWeight: '600',
  },
  instructions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#e0f7f4',
  },
  instructionsText: {
    fontSize: 13,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  selectedLocation: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  selectedLocationLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  selectedLocationValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  coordinatesDisplay: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#f9f9f9',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  coordinatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coordinatesLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  coordinatesValue: {
    fontSize: 14,
    color: '#008080',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
});

export default LocationMapPicker;
         