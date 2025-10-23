// app/provider/enroutescreen.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format, parseISO } from "date-fns";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { WebView } from "react-native-webview";
import { markAsArrived } from "../../../src/api/booking.api";

export default function EnRouteScreen() {
    const params = useLocalSearchParams();
    const router = useRouter();
    const webViewRef = useRef<WebView>(null);

    const [providerLocation, setProviderLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
    const [distance, setDistance] = useState<string>("Calculating...");
    const [loading, setLoading] = useState(true);
    const [mapHtml, setMapHtml] = useState<string>("");

    // Parse appointment data from params
    const appointmentId = params.appointmentId as string;
    const customerName = params.customerName as string || "Customer";
    const serviceTitle = params.serviceTitle as string || "Service";
    const scheduledDate = params.scheduledDate as string;
    const customerLocationStr = params.customerLocation as string;
    const providerLocationStr = params.providerLocation as string;

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

    // Handle arrived button - mark appointment as in-progress
    const handleArrived = async () => {
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
                </View>
            </View>
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
});
