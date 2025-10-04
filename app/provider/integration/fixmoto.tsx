import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format, parseISO } from "date-fns";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    LayoutAnimation,
    Platform,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    UIManager,
    View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { completeAppointment, getAppointmentsByProviderId, startEnRoute } from "../../../src/api/booking.api";
import CompleteServiceModal from "../../../src/components/modals/CompleteServiceModal";
import { API_CONFIG } from "../../../src/constants/config";
import ApprovedScreenWrapper from "../../../src/navigation/ApprovedScreenWrapper";
import type { Appointment } from "../../../src/types/appointment";

if (Platform.OS === "android") {
    UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const statusColors: Record<string, string> = {
    pending: "#FFC107",
    approved: "#4CAF50",
    scheduled: "#4CAF50",
    confirmed: "#FF9800",
    "in-progress": "#F44336",
    ongoing: "#F44336",
    "in-warranty": "#2196F3",
    finished: "#9E9E9E",
    completed: "#9E9E9E",
    cancelled: "#E53935",
    "no-show": "#E53935",
};

export default function FixMoToday() {
    const [expandedCard, setExpandedCard] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"scheduled" | "ongoing" | "finished" | "completed" | "cancelled">("scheduled");
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [completeModalVisible, setCompleteModalVisible] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    
    const router = useRouter();
    const isApproved = true;

    const fetchAppointments = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem('providerToken');
            const providerIdStr = await AsyncStorage.getItem('providerId');

            if (!token || !providerIdStr) {
                Alert.alert('Error', 'Authentication required. Please log in again.');
                return;
            }

            const providerId = parseInt(providerIdStr, 10);
            const data = await getAppointmentsByProviderId(providerId, token);
            setAppointments(data);
        } catch (error: any) {
            console.error('Fetch appointments error:', error);
            Alert.alert('Error', error.message || 'Failed to load appointments');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchAppointments();
    };

    const toggleCard = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedCard(expandedCard === id ? null : id);
    };

    const handleEnRoute = async (appointment: Appointment) => {
        Alert.alert(
            'Start En Route',
            'Change status to "On the Way" and navigate to route screen?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Start',
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('providerToken');
                            if (!token) {
                                Alert.alert('Error', 'Authentication required');
                                return;
                            }

                            // Update status to ongoing
                            await startEnRoute(appointment.appointment_id, token);

                            // Get provider location from AsyncStorage
                            const providerData = await AsyncStorage.getItem('providerProfile');
                            let providerLocation = '';
                            if (providerData) {
                                try {
                                    const profile = JSON.parse(providerData);
                                    providerLocation = profile.provider_exact_location || profile.exact_location || '';
                                } catch (e) {
                                    console.error('Error parsing provider profile:', e);
                                }
                            }

                            // Navigate to enroute screen with appointment data
                            router.push({
                                pathname: "/provider/integration/enroutescreen",
                                params: {
                                    appointmentId: appointment.appointment_id.toString(),
                                    customerId: appointment.customer_id.toString(),
                                    customerName: getClientName(appointment),
                                    serviceTitle: getServiceName(appointment),
                                    scheduledDate: appointment.scheduled_date,
                                    // Pass exact_location as string in "lat,lng" format
                                    customerLocation: appointment.customer?.exact_location || `${appointment.customer?.latitude || 14.5995},${appointment.customer?.longitude || 120.9842}`,
                                    providerLocation: appointment.provider?.provider_exact_location || providerLocation || '',
                                },
                            });

                            // Refresh appointments list
                            fetchAppointments();
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to start en route');
                        }
                    },
                },
            ]
        );
    };

    const handleChat = async (appointment: Appointment) => {
        try {
            const token = await AsyncStorage.getItem('providerToken');
            const providerId = await AsyncStorage.getItem('provider_id');
            
            if (!token || !providerId) {
                Alert.alert('Error', 'Please log in again');
                return;
            }

            const customerId = appointment.customer_id;
            const clientName = appointment.customer 
                ? `${appointment.customer.first_name} ${appointment.customer.last_name}` 
                : 'Customer';
            const clientPhone = appointment.customer?.phone_number || '';

            // First, check if conversation already exists
            const conversationsResponse = await fetch(
                `${API_CONFIG.BASE_URL}/api/messages/conversations?userType=provider`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!conversationsResponse.ok) {
                throw new Error('Failed to fetch conversations');
            }

            const conversationsData = await conversationsResponse.json();
            
            // Find existing conversation with this customer
            const existingConversation = conversationsData.conversations?.find(
                (conv: any) => conv.customer_id === customerId
            );

            if (existingConversation) {
                // Route to existing conversation
                router.push({
                    pathname: '/messaging/chat',
                    params: {
                        conversationId: existingConversation.conversation_id.toString(),
                        customerId: customerId.toString(),
                        customerName: clientName,
                        customerPhone: clientPhone,
                        customerPhoto: '', // Customer type doesn't include profile_photo
                        appointmentStatus: appointment.appointment_status || 'active',
                    }
                });
            } else {
                // Create new conversation
                const createResponse = await fetch(
                    `${API_CONFIG.BASE_URL}/api/messages/conversations`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            customerId: customerId,
                            providerId: parseInt(providerId),
                            userType: 'provider'
                        })
                    }
                );

                if (!createResponse.ok) {
                    throw new Error('Failed to create conversation');
                }

                const createData = await createResponse.json();
                
                // Route to new conversation
                router.push({
                    pathname: '/messaging/chat',
                    params: {
                        conversationId: createData.conversation.conversation_id.toString(),
                        customerId: customerId.toString(),
                        customerName: clientName,
                        customerPhone: clientPhone,
                        customerPhoto: '', // Customer type doesn't include profile_photo
                        appointmentStatus: appointment.appointment_status || 'active',
                    }
                });
            }
        } catch (error: any) {
            console.error('Error handling chat:', error);
            Alert.alert('Error', error.message || 'Failed to open conversation');
        }
    };

    const handleCompleteService = (appointment: Appointment) => {
        setSelectedAppointment(appointment);
        setCompleteModalVisible(true);
    };

    const handleCompleteSubmit = async (finalPrice: number, description: string) => {
        if (!selectedAppointment) return;

        try {
            const token = await AsyncStorage.getItem('providerToken');
            if (!token) {
                Alert.alert('Error', 'Authentication required');
                return;
            }

            await completeAppointment(
                selectedAppointment.appointment_id,
                finalPrice,
                description,
                token
            );

            Alert.alert('Success', 'Service completed successfully!');
            fetchAppointments(); // Refresh the list
        } catch (error: any) {
            throw error; // Let modal handle the error
        }
    };

    const formatDateTime = (dateString: string) => {
        try {
            const date = parseISO(dateString);
            return format(date, "MMM dd, yyyy");
        } catch {
            return dateString;
        }
    };

    const getClientName = (appointment: Appointment) => {
        if (appointment.customer) {
            return `${appointment.customer.first_name} ${appointment.customer.last_name}`;
        }
        return `Customer #${appointment.customer_id}`;
    };

    const getServiceName = (appointment: Appointment) => {
        return appointment.service?.service_title || 'Service';
    };

    const getLocation = (appointment: Appointment) => {
        // Check exact_location first (format: "lat,lng")
        if (appointment.customer?.exact_location) {
            const parts = appointment.customer.exact_location.trim().split(',');
            if (parts.length === 2) {
                const lat = parseFloat(parts[0]);
                const lng = parseFloat(parts[1]);
                if (!isNaN(lat) && !isNaN(lng)) {
                    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                }
            }
        }
        // Fallback to latitude/longitude fields
        if (appointment.customer?.latitude && appointment.customer?.longitude) {
            return `${appointment.customer.latitude.toFixed(6)}, ${appointment.customer.longitude.toFixed(6)}`;
        }
        return 'Location not available';
    };

    const getCoords = (appointment: Appointment) => {
        // Try exact_location first (format: "lat,lng")
        if (appointment.customer?.exact_location) {
            const [lat, lng] = appointment.customer.exact_location.split(',').map(parseFloat);
            if (!isNaN(lat) && !isNaN(lng)) {
                return { latitude: lat, longitude: lng };
            }
        }
        // Fallback to separate latitude/longitude fields
        const lat = appointment.customer?.latitude;
        const lng = appointment.customer?.longitude;
        
        // Default to Manila City Hall if no coordinates
        return {
            latitude: lat || 14.5995,
            longitude: lng || 120.9842,
        };
    };

    const isAppointmentDateReached = (scheduledDate: string): boolean => {
        try {
            const appointmentDate = parseISO(scheduledDate);
            const now = new Date();
            
            // Check if appointment date is in the past
            if (appointmentDate < now) {
                return true;
            }
            
            // Check if appointment is today and it's past 8 AM
            const appointmentDay = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate());
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            if (appointmentDay.getTime() === today.getTime()) {
                // Same day - check if it's past 8 AM
                const currentHour = now.getHours();
                return currentHour >= 8;
            }
            
            return false;
        } catch {
            return false;
        }
    };

    const filteredAppointments = appointments.filter((apt) => {
        if (activeTab === "scheduled") {
            // Show pending, approved, scheduled appointments
            return apt.appointment_status === "scheduled" || apt.appointment_status === "approved" || apt.appointment_status === "pending";
        }
        if (activeTab === "ongoing") {
            // Show confirmed (on the way), in-progress, and ongoing appointments
            return apt.appointment_status === "confirmed" || apt.appointment_status === "in-progress" || apt.appointment_status === "ongoing";
        }
        if (activeTab === "finished") {
            // Show in-warranty appointments (active warranty)
            return apt.appointment_status === "in-warranty" || apt.appointment_status === "finished";
        }
        if (activeTab === "completed") {
            // Show completed appointments (warranty expired)
            return apt.appointment_status === "completed";
        }
        return apt.appointment_status === activeTab;
    });

    if (loading) {
        return (
            <ApprovedScreenWrapper activeTab="task">
                <View style={[styles.container, styles.centerContent]}>
                    <ActivityIndicator size="large" color="#00796B" />
                    <Text style={styles.loadingText}>Loading appointments...</Text>
                </View>
            </ApprovedScreenWrapper>
        );
    }

    return (
        <ApprovedScreenWrapper activeTab="task">
            <View style={styles.container}>
                <Text style={styles.title}>FixMo Today</Text>

                {/* Tabs */}
                <View style={styles.tabsRow}>
                    {(["scheduled", "ongoing", "finished", "completed", "cancelled"] as const).map((tab) => (
                        <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={styles.tabButton}>
                            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </Text>
                            {activeTab === tab && <View style={styles.tabIndicator}/>}
                        </TouchableOpacity>
                    ))}
                </View>

                {filteredAppointments.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="calendar-outline" size={64} color="#CCC" />
                        <Text style={styles.emptyText}>No {activeTab} appointments</Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredAppointments}
                        keyExtractor={(item) => item.appointment_id.toString()}
                        contentContainerStyle={{paddingBottom: 100}}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#00796B"]} />
                        }
                        renderItem={({item}) => {
                            const isExpanded = expandedCard === item.appointment_id.toString();
                            const clientName = getClientName(item);
                            const serviceName = getServiceName(item);
                            const location = getLocation(item);
                            const coords = getCoords(item);
                            
                            return (
                                <View style={styles.appointmentBox}>
                                    <View style={[styles.statusTag, {backgroundColor: statusColors[item.appointment_status]}]}>
                                        <Text style={styles.statusText}>
                                            {item.appointment_status === "in-progress" || item.appointment_status === "ongoing"
                                                ? "Ongoing"
                                                : item.appointment_status === "confirmed"
                                                ? "On the Way"
                                                : item.appointment_status === "approved" || item.appointment_status === "scheduled"
                                                ? "Scheduled"
                                                : item.appointment_status === "in-warranty"
                                                ? "In Warranty"
                                                : item.appointment_status === "completed"
                                                ? "Completed"
                                                : item.appointment_status.charAt(0).toUpperCase() + item.appointment_status.slice(1)}
                                        </Text>
                                    </View>

                                    <Text style={styles.bookingId}>Booking ID# {item.appointment_id}</Text>
                                    <Text style={styles.clientName}>{clientName}</Text>
                                    <Text style={styles.serviceType}>
                                        Service Type: <Text
                                        style={{color: "#00796B", fontFamily: "Poppins-SemiBold"}}>{serviceName}</Text>
                                    </Text>

                                    <View style={styles.row}>
                                        <View style={styles.row}>
                                            <Ionicons name="calendar" size={16} color="#00796B"/>
                                            <Text style={styles.datetime}>{formatDateTime(item.scheduled_date)}</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.chatButton}
                                            onPress={() => handleChat(item)}
                                        >
                                            <Ionicons name="chatbubble-ellipses" size={20} color="#00796B"/>
                                        </TouchableOpacity>
                                    </View>

                                    <TouchableOpacity style={styles.expandButton} onPress={() => toggleCard(item.appointment_id.toString())}>
                                        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20}
                                                  color="#00796B"/>
                                    </TouchableOpacity>

                                    {isExpanded && (
                                        <View style={styles.expandedContent}>
                                            <View style={styles.locationRow}>
                                                <MaterialIcons name="location-pin" size={16} color="#00796B"/>
                                                <Text style={styles.location}>{location}</Text>
                                            </View>

                                            <MapView
                                                style={styles.map}
                                                initialRegion={{
                                                    latitude: coords.latitude,
                                                    longitude: coords.longitude,
                                                    latitudeDelta: 0.01,
                                                    longitudeDelta: 0.01,
                                                }}
                                            >
                                                <Marker coordinate={coords} title={clientName}
                                                        description={serviceName}/>
                                            </MapView>

                                            {/* TEMPORARILY ENABLED FOR DEMO - REMOVE DATE CHECK */}
                                            {(item.appointment_status === "scheduled" || item.appointment_status === "approved" || item.appointment_status === "confirmed") && isApproved && (
                                                <TouchableOpacity style={styles.actionButton} onPress={() => handleEnRoute(item)}>
                                                    <Text style={styles.actionButtonText}>En Route to Fix</Text>
                                                </TouchableOpacity>
                                            )}

                                            {/* TEMPORARILY COMMENTED OUT FOR DEMO
                                            {(item.appointment_status === "scheduled" || item.appointment_status === "approved") && isApproved && !isAppointmentDateReached(item.scheduled_date) && (
                                                <View style={styles.disabledButton}>
                                                    <Ionicons name="time-outline" size={16} color="#999" />
                                                    <Text style={styles.disabledButtonText}>
                                                        Available on {format(parseISO(item.scheduled_date), "MMM dd, yyyy")} (from 8:00 AM)
                                                    </Text>
                                                </View>
                                            )}
                                            */}

                                            {(item.appointment_status === "in-progress" || item.appointment_status === "ongoing") && isApproved && (
                                                <TouchableOpacity 
                                                    style={styles.actionButton} 
                                                    onPress={() => handleCompleteService(item)}
                                                >
                                                    <Text style={styles.actionButtonText}>Complete Service</Text>
                                                </TouchableOpacity>
                                            )}

                                            {(item.appointment_status === "in-warranty" || item.appointment_status === "completed" || item.appointment_status === "finished") && (
                                                <View style={styles.completedInfo}>
                                                    {item.appointment_status === "in-warranty" && (
                                                        <View style={styles.warrantyBadge}>
                                                            <Ionicons name="shield-checkmark" size={16} color="#2196F3" />
                                                            <Text style={styles.warrantyText}>Under Warranty Period</Text>
                                                        </View>
                                                    )}
                                                    <Text style={styles.completedLabel}>Final Price:</Text>
                                                    <Text style={styles.completedValue}>₱{typeof item.final_price === 'number' && item.final_price !== null ? item.final_price.toFixed(2) : '0.00'}</Text>
                                                    {item.repairDescription && (
                                                        <>
                                                            <Text style={styles.completedLabel}>Repair Description:</Text>
                                                            <Text style={styles.completedDescription}>{item.repairDescription}</Text>
                                                        </>
                                                    )}
                                                </View>
                                            )}
                                        </View>
                                    )}
                                </View>
                            );
                        }}
                    />
                )}

                <CompleteServiceModal
                    visible={completeModalVisible}
                    onClose={() => {
                        setCompleteModalVisible(false);
                        setSelectedAppointment(null);
                    }}
                    onComplete={handleCompleteSubmit}
                    starting_price={
                        selectedAppointment?.service?.service_startingprice || 
                        selectedAppointment?.starting_price || 
                        selectedAppointment?.final_price || 
                        0
                    }
                    currentDescription={selectedAppointment?.repairDescription || ''}
                    clientName={selectedAppointment ? getClientName(selectedAppointment) : ''}
                />
            </View>
        </ApprovedScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: {flex: 1, paddingHorizontal: 16, paddingTop: 20},
    title: {
        fontSize: 18,
        fontFamily: "PoppinsSemiBold",
        textAlign: "center",
        marginBottom: 10,
        marginTop: 30,
        color: "#333"
    },
    centerContent: {
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        fontSize: 14,
        fontFamily: "PoppinsRegular",
        color: "#666",
        marginTop: 12,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 60,
    },
    emptyText: {
        fontSize: 16,
        fontFamily: "PoppinsMedium",
        color: "#999",
        marginTop: 16,
    },
    tabsRow: {flexDirection: "row", justifyContent: "space-around", marginBottom: 16},
    tabButton: {alignItems: "center"},
    tabText: {fontSize: 14, fontFamily: "PoppinsMedium", color: "#999"},
    tabTextActive: {color: "#00796B", fontFamily: "PoppinsSemiBold"},
    tabIndicator: {marginTop: 4, height: 2, width: "100%", backgroundColor: "#00796B", borderRadius: 2},
    appointmentBox: {backgroundColor: "#f2f2f2", borderRadius: 20, padding: 15, marginBottom: 16},
    statusTag: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 8, alignSelf: "flex-start"},
    statusText: {color: "#fff", fontFamily: "PoppinsBold", fontSize: 12},
    bookingId: {fontSize: 12, fontFamily: "PoppinsMedium", color: "#666", marginBottom: 4},
    clientName: {fontSize: 16, fontFamily: "PoppinsSemiBold", color: "#333"},
    serviceType: {fontSize: 14, fontFamily: "PoppinsRegular", color: "#555", marginTop: 4},
    row: {flexDirection: "row", alignItems: "center", marginTop: 10},
    datetime: {fontSize: 13, fontFamily: "PoppinsRegular", color: "#00796B", marginLeft: 6},
    chatButton: {
        backgroundColor: "#fff",
        padding: 8,
        borderRadius: 20,
        marginLeft: "auto",
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowOffset: {width: 0, height: 2},
        shadowRadius: 4,
        elevation: 3
    },
    expandButton: {alignItems: "center", marginTop: 8},
    expandedContent: {marginTop: 12},
    locationRow: {flexDirection: "row", alignItems: "center", marginBottom: 6},
    location: {fontSize: 13, fontFamily: "PoppinsRegular", color: "#333", marginLeft: 4},
    map: {width: "100%", height: 150, borderRadius: 12, marginBottom: 10},
    actionButton: {backgroundColor: "#00796B", paddingVertical: 12, borderRadius: 8, alignItems: "center"},
    actionButtonText: {color: "#fff", fontFamily: "PoppinsSemiBold", fontSize: 14},
    disabledButton: {
        backgroundColor: "#F5F5F5",
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#E0E0E0",
    },
    disabledButtonText: {
        color: "#999",
        fontFamily: "PoppinsMedium",
        fontSize: 13,
        marginLeft: 6,
    },
    completedInfo: {
        backgroundColor: "#E0F2F1",
        padding: 12,
        borderRadius: 8,
        marginTop: 8,
    },
    completedLabel: {
        fontSize: 12,
        fontFamily: "PoppinsMedium",
        color: "#00796B",
        marginBottom: 4,
    },
    completedValue: {
        fontSize: 18,
        fontFamily: "PoppinsSemiBold",
        color: "#00796B",
        marginBottom: 8,
    },
    completedDescription: {
        fontSize: 13,
        fontFamily: "PoppinsRegular",
        color: "#333",
        lineHeight: 18,
    },
    warrantyBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#E3F2FD",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#2196F3",
    },
    warrantyText: {
        fontSize: 13,
        fontFamily: "PoppinsSemiBold",
        color: "#2196F3",
        marginLeft: 6,
    },
});
