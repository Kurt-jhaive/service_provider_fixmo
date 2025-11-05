// app/provider/enroutescreen.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format, parseISO } from "date-fns";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { WebView } from "react-native-webview";
import { markAsArrived, markAsProviderNoShow, reportCustomerNoShow } from "../../../src/api/booking.api";
import type { Appointment } from "../../../src/types/appointment";

export default function EnRouteScreen() {
    const params = useLocalSearchParams();
    const router = useRouter();
    const webViewRef = useRef<WebView>(null);

    const [providerLocation, setProviderLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
    const [distance, setDistance] = useState<string>("Calculating...");
    const [loading, setLoading] = useState(true);
    const [mapHtml, setMapHtml] = useState<string>("");
    const [appointmentData, setAppointmentData] = useState<Appointment | null>(null);

    // Timer states for customer no-show feature
    const [elapsedMinutes, setElapsedMinutes] = useState<number>(0);
    const [enRouteStartTime, setEnRouteStartTime] = useState<Date>(new Date());
    const [showNoShowModal, setShowNoShowModal] = useState<boolean>(false);
    const [noShowDescription, setNoShowDescription] = useState<string>("");
    const [evidencePhoto, setEvidencePhoto] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);

    // Parse appointment data from params
    const appointmentId = params.appointmentId as string;
    const customerName = params.customerName as string || "Customer";
    const serviceTitle = params.serviceTitle as string || "Service";
    const scheduledDate = params.scheduledDate as string;
    const customerLocationStr = params.customerLocation as string;
    const providerLocationStr = params.providerLocation as string;
    const startTime = params.startTime as string; // e.g., "08:00"
    const endTime = params.endTime as string; // e.g., "10:30"

    // Parse exact_location if it's in "lat,lng" format
    const parseExactLocation = (locationStr: string): { latitude: number; longitude: number } | null => {
        if (!locationStr) return null;
        
        const parts = locationStr.split(',');
        if (parts.length === 2) {
            const lat = parseFloat(parts[0].trim());
            const lng = parseFloat(parts[1].trim());
            if (!isNaN(lat) && !isNaN(lng)) {
                return { latitude: lat, longitude: lng };
            }
        }
        return null;
    };

    // Parse customer and provider coordinates
    const customerCoords = parseExactLocation(customerLocationStr) || { latitude: 14.5995, longitude: 120.9842 };
    const initialProviderCoords = parseExactLocation(providerLocationStr);

    // Format date (only date, no time)
    const formatDate = (dateString: string) => {
        try {
            const date = parseISO(dateString);
            return format(date, "MMMM dd, yyyy");
        } catch {
            return dateString;
        }
    };

    // Calculate distance between two coordinates (Haversine formula)
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // Radius of the Earth in km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        return distance;
    };

    // Fetch route from OpenStreetMap (OSRM)
    const fetchRoute = async (origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }) => {
        try {
            const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;
            
            const response = await fetch(url);
            const data = await response.json();

            if (data.code === "Ok" && data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                const coordinates = route.geometry.coordinates.map((coord: [number, number]) => ({
                    latitude: coord[1],
                    longitude: coord[0],
                }));

                setRouteCoordinates(coordinates);

                // Get distance from OSRM response
                const distanceKm = (route.distance / 1000).toFixed(2);
                setDistance(`${distanceKm} km`);
            }
        } catch (error) {
            console.error("Route fetch error:", error);
            // Fallback: draw straight line
            setRouteCoordinates([origin, destination]);
            const dist = calculateDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
            setDistance(`${dist.toFixed(2)} km (direct)`);
        }
    };

    // Generate HTML for map with route
    const generateMapHtml = (providerCoords: { latitude: number; longitude: number }, customerCoords: { latitude: number; longitude: number }) => {
        const routeCoords = routeCoordinates.length > 0 
            ? routeCoordinates.map(coord => `[${coord.latitude}, ${coord.longitude}]`).join(',')
            : `[${providerCoords.latitude}, ${providerCoords.longitude}],[${customerCoords.latitude}, ${customerCoords.longitude}]`;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
                <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
                <style>
                    body { margin: 0; padding: 0; }
                    #map { width: 100%; height: 100vh; }
                </style>
            </head>
            <body>
                <div id="map"></div>
                <script>
                    // Initialize map
                    var map = L.map('map').setView([${(providerCoords.latitude + customerCoords.latitude) / 2}, ${(providerCoords.longitude + customerCoords.longitude) / 2}], 13);
                    
                    // Add OpenStreetMap tiles
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '© OpenStreetMap contributors',
                        maxZoom: 19
                    }).addTo(map);

                    // Custom provider marker icon (blue circle with arrow)
                    var providerIcon = L.divIcon({
                        className: 'custom-div-icon',
                        html: "<div style='background-color:#00796B;width:40px;height:40px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,0.3);'><svg width='24' height='24' viewBox='0 0 24 24' fill='white'><path d='M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z'/></svg></div>",
                        iconSize: [40, 40],
                        iconAnchor: [20, 20]
                    });

                    // Add provider marker (You)
                    var providerMarker = L.marker([${providerCoords.latitude}, ${providerCoords.longitude}], {icon: providerIcon}).addTo(map);
                    providerMarker.bindPopup('<b>You</b><br>Your Location');

                    // Add customer marker
                    var customerMarker = L.marker([${customerCoords.latitude}, ${customerCoords.longitude}]).addTo(map);
                    customerMarker.bindPopup('<b>${customerName.replace(/'/g, "\\'")}</b><br>${serviceTitle.replace(/'/g, "\\'")}');

                    // Draw route polyline
                    var routeCoords = [${routeCoords}];
                    if (routeCoords.length > 0) {
                        var polyline = L.polyline(routeCoords, {
                            color: '#00796B',
                            weight: 4,
                            opacity: 0.8
                        }).addTo(map);
                        
                        // Fit map to show both markers and route
                        map.fitBounds([
                            [${providerCoords.latitude}, ${providerCoords.longitude}],
                            [${customerCoords.latitude}, ${customerCoords.longitude}]
                        ], {padding: [50, 50]});
                    }
                </script>
            </body>
            </html>
        `;
        setMapHtml(html);
    };

    // Get provider location and watch for updates
    useEffect(() => {
        let locationSubscription: Location.LocationSubscription | null = null;

        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== "granted") {
                    Alert.alert("Permission Denied", "Location permission is required to show your position.");
                    setLoading(false);
                    return;
                }

                // Get initial location - use provider_exact_location if available, otherwise GPS
                let providerCoords;
                if (initialProviderCoords) {
                    providerCoords = initialProviderCoords;
                } else {
                    const location = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.High,
                    });
                    providerCoords = {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                    };
                }

                setProviderLocation(providerCoords);

                // Fetch route from OpenStreetMap
                await fetchRoute(providerCoords, customerCoords);

                // Generate map HTML after fetching route
                generateMapHtml(providerCoords, customerCoords);

                setLoading(false);

                // Watch location updates
                locationSubscription = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.High,
                        timeInterval: 10000, // Update every 10 seconds
                        distanceInterval: 50, // Update every 50 meters
                    },
                    (loc) => {
                        const newCoords = {
                            latitude: loc.coords.latitude,
                            longitude: loc.coords.longitude,
                        };
                        setProviderLocation(newCoords);

                        // Update route when provider moves significantly
                        fetchRoute(newCoords, customerCoords).then(() => {
                            generateMapHtml(newCoords, customerCoords);
                        });
                    }
                );
            } catch (error) {
                console.error("Location error:", error);
                Alert.alert("Error", "Failed to get your location");
                setLoading(false);
            }
        })();

        return () => {
            if (locationSubscription) {
                locationSubscription.remove();
            }
        };
    }, []);

    // Timer to track elapsed time since en route started (for 1-hour customer no-show feature)
    useEffect(() => {
        // Calculate immediately on mount
        const calculateElapsed = () => {
            const now = new Date();
            const elapsed = Math.floor((now.getTime() - enRouteStartTime.getTime()) / 1000 / 60); // minutes
            setElapsedMinutes(elapsed);
            console.log('⏱️ Timer Update - Elapsed minutes:', elapsed);
        };

        // Run immediately
        calculateElapsed();

        // Then run every minute
        const timerInterval = setInterval(calculateElapsed, 60000); // Update every minute

        return () => clearInterval(timerInterval);
    }, [enRouteStartTime]);

    // Handle photo selection for customer no-show evidence
    const handleSelectPhoto = async () => {
        try {
            // Request camera permissions
            const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
            const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (!cameraPermission.granted || !mediaPermission.granted) {
                Alert.alert('Permission Required', 'Camera and media library access is required to upload evidence.');
                return;
            }

            // Show options: Camera or Gallery
            Alert.alert(
                'Select Photo Source',
                'Choose where to get the evidence photo',
                [
                    {
                        text: 'Take Photo',
                        onPress: async () => {
                            const result = await ImagePicker.launchCameraAsync({
                                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                quality: 0.8,
                                allowsEditing: true,
                                aspect: [4, 3],
                            });

                            if (!result.canceled && result.assets && result.assets.length > 0) {
                                setEvidencePhoto(result.assets[0].uri);
                            }
                        },
                    },
                    {
                        text: 'Choose from Gallery',
                        onPress: async () => {
                            const result = await ImagePicker.launchImageLibraryAsync({
                                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                quality: 0.8,
                                allowsEditing: true,
                                aspect: [4, 3],
                            });

                            if (!result.canceled && result.assets && result.assets.length > 0) {
                                setEvidencePhoto(result.assets[0].uri);
                            }
                        },
                    },
                    {
                        text: 'Cancel',
                        style: 'cancel',
                    },
                ]
            );
        } catch (error) {
            console.error('Error selecting photo:', error);
            Alert.alert('Error', 'Failed to select photo. Please try again.');
        }
    };

    // Handle customer no-show report submission
    const handleSubmitNoShowReport = async () => {
        // Validate inputs
        if (!evidencePhoto) {
            Alert.alert('Photo Required', 'Please upload a photo as evidence before submitting.');
            return;
        }

        if (!noShowDescription.trim()) {
            Alert.alert('Description Required', 'Please provide a description of the situation.');
            return;
        }

        if (noShowDescription.trim().length < 10) {
            Alert.alert('Description Too Short', 'Please provide a more detailed description (at least 10 characters).');
            return;
        }

        try {
            setIsSubmitting(true);

            const token = await AsyncStorage.getItem('providerToken');
            if (!token) {
                Alert.alert('Error', 'Authentication required');
                return;
            }

            // Call API to report customer no-show
            const result = await reportCustomerNoShow(
                parseInt(appointmentId),
                token,
                evidencePhoto,
                noShowDescription.trim()
            );

            if (result.success) {
                // Close report modal and show success modal
                setShowNoShowModal(false);
                setShowSuccessModal(true);
            } else {
                Alert.alert('Error', result.message || 'Failed to submit no-show report. Please try again.');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Network error. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle opening customer no-show modal
    const handleOpenNoShowModal = () => {
        console.log('🚫 Opening customer no-show modal. Elapsed minutes:', elapsedMinutes);
        setShowNoShowModal(true);
        setNoShowDescription('');
        setEvidencePhoto(null);
    };

    // Open Google Maps for navigation
    const openGoogleMaps = () => {
        const url = Platform.select({
            ios: `maps:0,0?q=${customerCoords.latitude},${customerCoords.longitude}`,
            android: `geo:0,0?q=${customerCoords.latitude},${customerCoords.longitude}`,
        });

        if (url) {
            Linking.canOpenURL(url).then((supported) => {
                if (supported) {
                    Linking.openURL(url);
                } else {
                    // Fallback to browser-based Google Maps
                    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${customerCoords.latitude},${customerCoords.longitude}`);
                }
            });
        }
    };

    /**
     * Check if provider is late or overdue for the appointment
     * @returns 'on-time' | 'late' | 'overdue'
     */
    const checkAppointmentTimingStatus = (): 'on-time' | 'late' | 'overdue' => {
        if (!scheduledDate || !startTime || !endTime) {
            return 'on-time'; // Default if no time data
        }

        try {
            const now = new Date();
            const appointmentDate = parseISO(scheduledDate);
            
            // Parse start and end times (format: "HH:mm")
            const [startHour, startMinute] = startTime.split(':').map(Number);
            const [endHour, endMinute] = endTime.split(':').map(Number);
            
            // Create datetime objects for start and end
            const startDateTime = new Date(appointmentDate);
            startDateTime.setHours(startHour, startMinute, 0, 0);
            
            const endDateTime = new Date(appointmentDate);
            endDateTime.setHours(endHour, endMinute, 0, 0);
            
            // Check timing status
            if (now < startDateTime) {
                return 'on-time'; // Before scheduled start time
            } else if (now >= startDateTime && now <= endDateTime) {
                return 'late'; // After start but before end - can still start with warning
            } else {
                return 'overdue'; // Past end time - cannot start
            }
        } catch (error) {
            console.error('Error checking appointment timing:', error);
            return 'on-time'; // Default to on-time if error
        }
    };

    // Handle arrived button - mark appointment as in-progress
    const handleArrived = async () => {
        const timingStatus = checkAppointmentTimingStatus();
        
        // Check if appointment is overdue
        if (timingStatus === 'overdue') {
            Alert.alert(
                'Appointment Overdue',
                `This appointment was scheduled for ${startTime} - ${endTime}. The appointment is now overdue and cannot be started. It will be marked as a no-show.`,
                [
                    {
                        text: 'OK',
                        onPress: async () => {
                            try {
                                const token = await AsyncStorage.getItem('providerToken');
                                if (!token) {
                                    Alert.alert('Error', 'Authentication required');
                                    return;
                                }

                                // Mark appointment as provider no-show
                                const result = await markAsProviderNoShow(parseInt(appointmentId), token);
                                
                                if (result.success) {
                                    Alert.alert(
                                        'Appointment Cancelled',
                                        'The appointment has been marked as a no-show and cancelled. This may affect your Fix-Score.',
                                        [
                                            {
                                                text: 'OK',
                                                onPress: () => router.replace('/provider/integration/fixmoto'),
                                            },
                                        ]
                                    );
                                } else {
                                    Alert.alert('Error', result.message || 'Failed to mark as no-show');
                                }
                            } catch (error: any) {
                                Alert.alert('Error', error.message || 'Failed to process no-show');
                            }
                        },
                    },
                ]
            );
            return;
        }
        
        // Check if appointment is late (but not overdue)
        if (timingStatus === 'late') {
            Alert.alert(
                'Late Start Warning',
                `This appointment was scheduled to start at ${startTime}. Starting late may affect your Fix-Score. Do you want to continue?`,
                [
                    {
                        text: 'Cancel',
                        style: 'cancel',
                    },
                    {
                        text: 'Continue Anyway',
                        onPress: () => proceedWithArrival(),
                    },
                ]
            );
            return;
        }
        
        // On time - proceed normally
        proceedWithArrival();
    };

    const proceedWithArrival = async () => {
        Alert.alert(
            'Mark as Arrived',
            'Have you arrived at the customer location? This will change the status to "In Progress".',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Yes, I Arrived',
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('providerToken');
                            if (!token) {
                                Alert.alert('Error', 'Authentication required');
                                return;
                            }

                            await markAsArrived(parseInt(appointmentId), token);
                            
                            Alert.alert(
                                'Status Updated',
                                'Appointment status changed to In Progress. You can now start working on the service.',
                                [
                                    {
                                        text: 'OK',
                                        onPress: () => router.back(),
                                    },
                                ]
                            );
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to update status');
                        }
                    },
                },
            ]
        );
    };

    if (loading || !providerLocation) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#00796B" />
                <Text style={styles.loadingText}>Fetching your location...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Back Button */}
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            {/* Map */}
            {mapHtml ? (
                <WebView
                    ref={webViewRef}
                    style={styles.map}
                    source={{ html: mapHtml }}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    startInLoadingState={true}
                    scalesPageToFit={true}
                />
            ) : (
                <View style={styles.map}>
                    <ActivityIndicator size="large" color="#00796B" />
                </View>
            )}

            {/* Bottom booking card */}
            <View style={styles.bottomPanel}>
                <View style={styles.card}>
                    <View style={styles.headerRow}>
                        <Text style={styles.cardTitle}>En Route to Customer</Text>
                        <View style={styles.distanceBadge}>
                            <Ionicons name="location-outline" size={16} color="#00796B" />
                            <Text style={styles.distanceText}>{distance}</Text>
                        </View>
                    </View>

                    <Text style={styles.customerName}>{customerName}</Text>
                    <Text style={styles.serviceType}>
                        Service: <Text style={styles.serviceTitle}>{serviceTitle}</Text>
                    </Text>
                    <View style={styles.dateRow}>
                        <Ionicons name="calendar-outline" size={16} color="#666" />
                        <Text style={styles.dateText}>{formatDate(scheduledDate)}</Text>
                    </View>

                    {/* Track Button - Opens Google Maps */}
                    <TouchableOpacity
                        style={styles.trackButton}
                        onPress={openGoogleMaps}
                    >
                        <Ionicons name="navigate-circle" size={20} color="#fff" />
                        <Text style={styles.trackButtonText}>Track in Google Maps</Text>
                    </TouchableOpacity>

                    {/* Arrived Button */}
                    <TouchableOpacity
                        style={styles.arrivedButton}
                        onPress={handleArrived}
                    >
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        <Text style={styles.arrivedButtonText}>I've Arrived</Text>
                    </TouchableOpacity>

                    {/* Customer No Show Button - Shows after 1 hour (60 minutes) */}
                    {(() => {
                        const shouldShow = elapsedMinutes >= 60;
                        console.log('🔍 No-Show Button Check - elapsedMinutes:', elapsedMinutes, 'shouldShow:', shouldShow);
                        return shouldShow ? (
                            <TouchableOpacity
                                style={styles.noShowButton}
                                onPress={handleOpenNoShowModal}
                            >
                                <Ionicons name="alert-circle-outline" size={20} color="#fff" />
                                <Text style={styles.noShowButtonText}>Customer No Show</Text>
                            </TouchableOpacity>
                        ) : null;
                    })()}

                    {/* Timer display (for testing - shows minutes elapsed) */}
                    {elapsedMinutes > 0 && (
                        <Text style={styles.timerText}>
                            Time elapsed: {elapsedMinutes} min{elapsedMinutes !== 1 ? 's' : ''}
                            {elapsedMinutes < 60 && ` (No-show available in ${60 - elapsedMinutes} min${60 - elapsedMinutes !== 1 ? 's' : ''})`}
                        </Text>
                    )}
                </View>
            </View>

            {/* Customer No Show Report Modal */}
            <Modal
                visible={showNoShowModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowNoShowModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Modal Header */}
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Report Customer No Show</Text>
                                <TouchableOpacity
                                    onPress={() => setShowNoShowModal(false)}
                                    style={styles.closeButton}
                                >
                                    <Ionicons name="close" size={24} color="#666" />
                                </TouchableOpacity>
                            </View>

                            {/* Modal Message */}
                            <Text style={styles.modalMessage}>
                                It appears the customer is not available at the service location. 
                                Please submit supporting evidence so we can review the situation and 
                                update the appointment status.
                            </Text>

                            {/* Photo Upload Section */}
                            <View style={styles.uploadSection}>
                                <Text style={styles.sectionLabel}>Upload Photo Evidence *</Text>
                                <Text style={styles.sectionHint}>
                                    (Front door / gate / environment / timestamp proof)
                                </Text>
                                
                                {evidencePhoto ? (
                                    <View style={styles.photoPreviewContainer}>
                                        <Image
                                            source={{ uri: evidencePhoto }}
                                            style={styles.photoPreview}
                                            resizeMode="cover"
                                        />
                                        <TouchableOpacity
                                            style={styles.changePhotoButton}
                                            onPress={handleSelectPhoto}
                                        >
                                            <Text style={styles.changePhotoText}>Change Photo</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.uploadButton}
                                        onPress={handleSelectPhoto}
                                    >
                                        <Ionicons name="camera-outline" size={32} color="#00796B" />
                                        <Text style={styles.uploadButtonText}>Take or Select Photo</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Description Input Section */}
                            <View style={styles.descriptionSection}>
                                <Text style={styles.sectionLabel}>Add Note / Explanation *</Text>
                                <TextInput
                                    style={styles.descriptionInput}
                                    placeholder="Describe the situation (e.g., customer not answering door, phone calls not answered, etc.)"
                                    placeholderTextColor="#999"
                                    multiline
                                    numberOfLines={4}
                                    value={noShowDescription}
                                    onChangeText={setNoShowDescription}
                                    textAlignVertical="top"
                                />
                                <Text style={styles.characterCount}>
                                    {noShowDescription.length} characters (minimum 10)
                                </Text>
                            </View>

                            {/* Action Buttons */}
                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => setShowNoShowModal(false)}
                                    disabled={isSubmitting}
                                >
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.submitButton,
                                        (isSubmitting || !evidencePhoto || noShowDescription.trim().length < 10) && styles.submitButtonDisabled
                                    ]}
                                    onPress={handleSubmitNoShowReport}
                                    disabled={isSubmitting || !evidencePhoto || noShowDescription.trim().length < 10}
                                >
                                    {isSubmitting ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.submitButtonText}>Submit Report</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Success Confirmation Modal */}
            <Modal
                visible={showSuccessModal}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowSuccessModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.successModalContainer}>
                        <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
                        <Text style={styles.successTitle}>Report Submitted</Text>
                        <Text style={styles.successMessage}>
                            Your report has been submitted for review. The customer will be notified 
                            and FixScore will not be affected while the case is being reviewed.
                        </Text>
                        <TouchableOpacity
                            style={styles.successButton}
                            onPress={() => {
                                setShowSuccessModal(false);
                                router.replace('/provider/integration/fixmoto');
                            }}
                        >
                            <Text style={styles.successButtonText}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    map: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#fff",
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        fontFamily: "PoppinsRegular",
        color: "#666",
    },
    backButton: {
        position: "absolute",
        top: 50,
        left: 20,
        backgroundColor: "#00796B",
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    providerMarker: {
        backgroundColor: "#00796B",
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 3,
        borderColor: "#fff",
    },
    bottomPanel: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#fff",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 30,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 10,
    },
    card: {
        width: "100%",
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 16,
        fontFamily: "PoppinsSemiBold",
        color: "#333",
    },
    distanceBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#E0F2F1",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    distanceText: {
        fontSize: 14,
        fontFamily: "PoppinsSemiBold",
        color: "#00796B",
        marginLeft: 4,
    },
    customerName: {
        fontSize: 18,
        fontFamily: "PoppinsSemiBold",
        color: "#333",
        marginBottom: 4,
    },
    serviceType: {
        fontSize: 14,
        fontFamily: "PoppinsRegular",
        color: "#666",
        marginBottom: 8,
    },
    serviceTitle: {
        fontFamily: "PoppinsMedium",
        color: "#00796B",
    },
    dateRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
    },
    dateText: {
        fontSize: 13,
        fontFamily: "PoppinsRegular",
        color: "#666",
        marginLeft: 6,
    },
    trackButton: {
        flexDirection: "row",
        backgroundColor: "#00796B",
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 10,
    },
    trackButtonText: {
        color: "#fff",
        fontSize: 15,
        fontFamily: "PoppinsSemiBold",
        marginLeft: 8,
    },
    arrivedButton: {
        flexDirection: "row",
        backgroundColor: "#4CAF50",
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    arrivedButtonText: {
        color: "#fff",
        fontSize: 15,
        fontFamily: "PoppinsSemiBold",
        marginLeft: 8,
    },
    noShowButton: {
        flexDirection: "row",
        backgroundColor: "#D32F2F",
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 10,
    },
    noShowButtonText: {
        color: "#fff",
        fontSize: 15,
        fontFamily: "PoppinsSemiBold",
        marginLeft: 8,
    },
    timerText: {
        fontSize: 12,
        fontFamily: "PoppinsRegular",
        color: "#999",
        textAlign: "center",
        marginTop: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    modalContainer: {
        backgroundColor: "#fff",
        borderRadius: 16,
        width: "100%",
        maxHeight: "90%",
        padding: 20,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontFamily: "PoppinsSemiBold",
        color: "#333",
        flex: 1,
    },
    closeButton: {
        padding: 4,
    },
    modalMessage: {
        fontSize: 14,
        fontFamily: "PoppinsRegular",
        color: "#666",
        lineHeight: 22,
        marginBottom: 20,
    },
    uploadSection: {
        marginBottom: 20,
    },
    sectionLabel: {
        fontSize: 15,
        fontFamily: "PoppinsSemiBold",
        color: "#333",
        marginBottom: 4,
    },
    sectionHint: {
        fontSize: 12,
        fontFamily: "PoppinsRegular",
        color: "#999",
        marginBottom: 12,
    },
    uploadButton: {
        backgroundColor: "#E0F2F1",
        borderWidth: 2,
        borderColor: "#00796B",
        borderStyle: "dashed",
        borderRadius: 12,
        padding: 30,
        alignItems: "center",
        justifyContent: "center",
    },
    uploadButtonText: {
        fontSize: 14,
        fontFamily: "PoppinsMedium",
        color: "#00796B",
        marginTop: 8,
    },
    photoPreviewContainer: {
        alignItems: "center",
    },
    photoPreview: {
        width: "100%",
        height: 200,
        borderRadius: 12,
        marginBottom: 12,
    },
    changePhotoButton: {
        backgroundColor: "#E0F2F1",
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    changePhotoText: {
        fontSize: 13,
        fontFamily: "PoppinsMedium",
        color: "#00796B",
    },
    descriptionSection: {
        marginBottom: 20,
    },
    descriptionInput: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        fontFamily: "PoppinsRegular",
        color: "#333",
        minHeight: 100,
        backgroundColor: "#f9f9f9",
    },
    characterCount: {
        fontSize: 11,
        fontFamily: "PoppinsRegular",
        color: "#999",
        marginTop: 4,
        textAlign: "right",
    },
    modalActions: {
        flexDirection: "row",
        gap: 12,
        marginTop: 10,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: "#f5f5f5",
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    cancelButtonText: {
        fontSize: 15,
        fontFamily: "PoppinsSemiBold",
        color: "#666",
    },
    submitButton: {
        flex: 1,
        backgroundColor: "#D32F2F",
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    submitButtonDisabled: {
        backgroundColor: "#ccc",
    },
    submitButtonText: {
        fontSize: 15,
        fontFamily: "PoppinsSemiBold",
        color: "#fff",
    },
    successModalContainer: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 30,
        alignItems: "center",
        width: "90%",
    },
    successTitle: {
        fontSize: 22,
        fontFamily: "PoppinsSemiBold",
        color: "#333",
        marginTop: 16,
        marginBottom: 12,
    },
    successMessage: {
        fontSize: 14,
        fontFamily: "PoppinsRegular",
        color: "#666",
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 24,
    },
    successButton: {
        backgroundColor: "#4CAF50",
        paddingVertical: 12,
        paddingHorizontal: 40,
        borderRadius: 12,
    },
    successButtonText: {
        fontSize: 15,
        fontFamily: "PoppinsSemiBold",
        color: "#fff",
    },
});
