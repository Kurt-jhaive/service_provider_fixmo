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
import { WebView } from "react-native-webview";
import { cancelAppointmentByProvider, completeAppointment, getAppointmentsByProviderId, startEnRoute } from "../../../src/api/booking.api";
import { getUnratedAppointments } from "../../../src/api/ratings.api";
import BackjobBadge from "../../../src/components/backjob/BackjobBadge";
import CompleteServiceModal from "../../../src/components/modals/CompleteServiceModal";
import { API_CONFIG } from "../../../src/constants/config";
import ApprovedScreenWrapper from "../../../src/navigation/ApprovedScreenWrapper";
import type { Appointment } from "../../../src/types/appointment";
import CancelAppointmentModal from "./modals/CancelAppointmentModal";
import DisputeBackjobModal from "./modals/DisputeBackjobModal";

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
    backjob: "#FF6B6B",  // Red for backjob - requires action
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
    const [disputeModalVisible, setDisputeModalVisible] = useState(false);
    const [cancelModalVisible, setCancelModalVisible] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [selectedBackjobId, setSelectedBackjobId] = useState<number | null>(null);
    const [isRatingPopupShown, setIsRatingPopupShown] = useState(false);
    
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

    // Check for unrated appointments
    const checkForUnratedAppointments = useCallback(async () => {
        if (isRatingPopupShown || completeModalVisible || disputeModalVisible) {
            console.log('⏭️ Skipping rating check - modal is open or rating already shown');
            return;
        }

        try {
            console.log('=== CHECKING FOR UNRATED APPOINTMENTS (PROVIDER) ===');
            const token = await AsyncStorage.getItem('providerToken');
            
            if (!token) {
                console.log('⚠️ No auth token found, skipping rating check');
                return;
            }

            const response = await getUnratedAppointments(token, 10);
            
            if (response.success && response.data && response.data.length > 0) {
                console.log('🎯 Found unrated appointment(s):', response.data.length);
                const appointmentToRate = response.data[0];
                
                // Debug: Log the full appointment object structure
                console.log('📋 Full appointment data:', JSON.stringify(appointmentToRate, null, 2));
                
                // Validate required data before navigating
                if (!appointmentToRate.appointment_id) {
                    console.error('❌ Missing appointment_id in unrated appointment');
                    return;
                }
                
                // Validate customer object exists
                if (!appointmentToRate.customer) {
                    console.error('❌ Missing customer object in unrated appointment');
                    return;
                }
                
                // Get customer_id from the customer object (backend uses 'user_id' field)
                const customerId = (appointmentToRate.customer as any).customer_id || 
                                 (appointmentToRate.customer as any).user_id;
                
                if (!customerId) {
                    console.error('❌ Missing customer_id/user_id in customer object');
                    console.error('📋 Customer object:', appointmentToRate.customer);
                    console.error('📋 Available keys:', Object.keys(appointmentToRate.customer));
                    return;
                }
                
                console.log('✅ Valid rating data:', {
                    appointment_id: appointmentToRate.appointment_id,
                    customer_id: customerId,
                    customer_name: `${appointmentToRate.customer.first_name || ''} ${appointmentToRate.customer.last_name || ''}`.trim()
                });
                
                setIsRatingPopupShown(true);
                
                // Navigate to rating screen
                router.push({
                    pathname: '/provider/integration/rate-customer',
                    params: {
                        appointment_id: appointmentToRate.appointment_id.toString(),
                        customer_id: customerId.toString(),
                        customer_name: `${appointmentToRate.customer?.first_name || ''} ${appointmentToRate.customer?.last_name || ''}`.trim() || 'Customer',
                        service_title: appointmentToRate.service?.service_title || 'Service',
                        scheduled_date: appointmentToRate.scheduled_date,
                    }
                });
            } else {
                console.log('✅ No unrated appointments found');
            }
        } catch (error: any) {
            console.error('❌ Error checking for unrated appointments:', error);
        }
    }, [isRatingPopupShown, completeModalVisible, disputeModalVisible, router]);

    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments]);

    // Initial check for unrated appointments (3 seconds after mount)
    useEffect(() => {
        const timer = setTimeout(() => {
            console.log('🕐 Initial unrated appointments check...');
            checkForUnratedAppointments();
        }, 3000);

        return () => clearTimeout(timer);
    }, [checkForUnratedAppointments]);

    // Background periodic check (every 30 seconds)
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (!isRatingPopupShown && !completeModalVisible && !disputeModalVisible) {
                console.log('🔄 Background check for unrated appointments...');
                checkForUnratedAppointments();
            }
        }, 30000); // 30 seconds

        return () => clearInterval(intervalId);
    }, [checkForUnratedAppointments, isRatingPopupShown, completeModalVisible, disputeModalVisible]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchAppointments();
    };

    const toggleCard = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedCard(expandedCard === id ? null : id);
    };

    /**
     * Check if appointment is late or overdue
     * @returns 'on-time' | 'late' | 'overdue'
     */
    const checkAppointmentTiming = (appointment: Appointment): 'on-time' | 'late' | 'overdue' => {
        console.log('🕐 Checking appointment timing...');
        console.log('📅 Scheduled date:', appointment.scheduled_date);
        console.log('⏰ Start time:', appointment.availability?.startTime);
        console.log('⏰ End time:', appointment.availability?.endTime);
        
        if (!appointment.scheduled_date || !appointment.availability?.startTime || !appointment.availability?.endTime) {
            console.log('⚠️ Missing time data, defaulting to on-time');
            return 'on-time'; // Default if no time data
        }

        try {
            const now = new Date();
            const appointmentDate = parseISO(appointment.scheduled_date);
            
            console.log('📍 Current time:', now.toLocaleString());
            console.log('📍 Appointment date:', appointmentDate.toLocaleDateString());
            
            // Parse start and end times (format: "HH:mm")
            const [startHour, startMinute] = appointment.availability.startTime.split(':').map(Number);
            const [endHour, endMinute] = appointment.availability.endTime.split(':').map(Number);
            
            // Create datetime objects for start and end
            const startDateTime = new Date(appointmentDate);
            startDateTime.setHours(startHour, startMinute, 0, 0);
            
            const endDateTime = new Date(appointmentDate);
            endDateTime.setHours(endHour, endMinute, 0, 0);
            
            console.log('⏰ Start DateTime:', startDateTime.toLocaleString());
            console.log('⏰ End DateTime:', endDateTime.toLocaleString());
            
            // Check timing status
            if (now < startDateTime) {
                console.log('✅ Status: ON-TIME (before start)');
                return 'on-time'; // Before scheduled start time
            } else if (now >= startDateTime && now <= endDateTime) {
                console.log('⚠️ Status: LATE (after start, before end)');
                return 'late'; // After start but before end - can still start with warning
            } else {
                console.log('❌ Status: OVERDUE (past end time)');
                return 'overdue'; // Past end time - cannot start
            }
        } catch (error) {
            console.error('❌ Error checking appointment timing:', error);
            return 'on-time'; // Default to on-time if error
        }
    };

    const handleEnRoute = async (appointment: Appointment) => {
        // Check if appointment is overdue or late
        const timingStatus = checkAppointmentTiming(appointment);
        const startTime = appointment.availability?.startTime || '';
        const endTime = appointment.availability?.endTime || '';
        
        // If overdue, prevent starting
        if (timingStatus === 'overdue') {
            Alert.alert(
                'Appointment Overdue',
                `This appointment was scheduled for ${startTime} - ${endTime}. The appointment is now overdue and cannot be started.`,
                [
                    {
                        text: 'OK',
                    },
                ]
            );
            return;
        }
        
        // If late, show warning but allow to continue
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
                        onPress: () => proceedWithEnRoute(appointment),
                    },
                ]
            );
            return;
        }
        
        // On time - show normal confirmation
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
                    onPress: () => proceedWithEnRoute(appointment),
                },
            ]
        );
    };

    const proceedWithEnRoute = async (appointment: Appointment) => {
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
                    // Pass time slot information
                    startTime: appointment.availability?.startTime || '',
                    endTime: appointment.availability?.endTime || '',
                },
            });

            // Refresh appointments list
            fetchAppointments();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to start en route');
        }
    };

    const handleChat = async (appointment: Appointment) => {
        try {
            console.log('💬 Opening chat for appointment:', appointment.appointment_id);
            
            // Validate appointment data
            if (!appointment || !appointment.customer_id) {
                console.error('❌ Invalid appointment data:', appointment);
                Alert.alert('Error', 'Invalid appointment data. Cannot open chat.');
                return;
            }

            const token = await AsyncStorage.getItem('providerToken');
            const providerId = await AsyncStorage.getItem('providerId');
            
            if (!token || !providerId) {
                console.error('❌ Missing authentication');
                Alert.alert('Error', 'Please log in again');
                return;
            }

            const customerId = appointment.customer_id;
            const clientName = appointment.customer 
                ? `${appointment.customer.first_name} ${appointment.customer.last_name}` 
                : 'Customer';
            const clientPhone = appointment.customer?.phone_number || '';

            console.log('👤 Customer info:', { customerId, clientName, clientPhone });

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
            
            console.log('📋 Conversations data:', conversationsData);
            
            // Find existing conversation with this customer
            const existingConversation = conversationsData.conversations?.find(
                (conv: any) => conv.customer_id === customerId
            );

            console.log('🔍 Existing conversation:', existingConversation);

            if (existingConversation && existingConversation.conversation_id) {
                // Route to existing conversation
                console.log('✅ Navigating to existing conversation:', existingConversation.conversation_id);
                
                // Extract customer photo from conversation data if available
                const customerPhoto = existingConversation.customer?.profile_photo || '';
                
                router.push({
                    pathname: '/messaging/chat',
                    params: {
                        conversationId: existingConversation.conversation_id.toString(),
                        customerId: customerId.toString(),
                        customerName: clientName,
                        customerPhone: clientPhone,
                        customerPhoto: customerPhoto,
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
                    const errorData = await createResponse.json().catch(() => ({}));
                    console.error('❌ Create conversation failed:', errorData);
                    throw new Error(errorData.message || 'Failed to create conversation');
                }

                const createData = await createResponse.json();
                console.log('📦 Create conversation response:', createData);
                
                // Handle different response formats from server
                // Server may return: { data: { conversation_id } } or { conversation: { conversation_id } }
                const conversationData = createData.data || createData.conversation || createData;
                const conversationId = conversationData.conversation_id;
                
                // Validate response data
                if (!conversationId) {
                    console.error('❌ Invalid conversation data:', createData);
                    throw new Error('Invalid conversation data received from server');
                }
                
                // Extract customer data for navigation
                const customerData = conversationData.customer || appointment.customer;
                const customerPhoto = customerData?.profile_photo || '';
                
                // Route to new conversation
                console.log('✅ Navigating to new conversation:', conversationId);
                router.push({
                    pathname: '/messaging/chat',
                    params: {
                        conversationId: conversationId.toString(),
                        customerId: customerId.toString(),
                        customerName: clientName,
                        customerPhone: clientPhone,
                        customerPhoto: customerPhoto,
                        appointmentStatus: appointment.appointment_status || 'active',
                    }
                });
            }
        } catch (error: any) {
            console.error('❌ Error handling chat:', error);
            console.error('Error stack:', error.stack);
            Alert.alert(
                'Error', 
                error.message || 'Failed to open conversation. Please try again.'
            );
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

    const handleCancelAppointment = (appointment: Appointment) => {
        setSelectedAppointment(appointment);
        setCancelModalVisible(true);
    };

    const handleCancelConfirm = async (reason: string) => {
        if (!selectedAppointment) return;

        try {
            const token = await AsyncStorage.getItem('providerToken');
            if (!token) {
                Alert.alert('Error', 'Authentication required');
                return;
            }

            console.log('🗑️ Cancelling appointment:', {
                appointmentId: selectedAppointment.appointment_id,
                reason: reason.substring(0, 50) + '...'
            });

            const response = await cancelAppointmentByProvider(
                selectedAppointment.appointment_id,
                reason,
                token
            );

            if (!response.success) {
                throw new Error(response.message || 'Failed to cancel appointment');
            }

            Alert.alert(
                'Appointment Cancelled',
                'The appointment has been cancelled and the customer has been notified.',
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            setCancelModalVisible(false);
                            setSelectedAppointment(null);
                            fetchAppointments(); // Refresh the list
                        },
                    },
                ]
            );
        } catch (error: any) {
            console.error('❌ Cancel appointment error:', error);
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
        if (appointment.customer?.latitude != null && appointment.customer?.longitude != null) {
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
        // 🧪 TEMPORARY: Date check disabled for testing
        // TODO: Re-enable this check after testing
        return true;
        
        /* ORIGINAL CODE - COMMENTED OUT FOR TESTING
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
        */
    };

    const filteredAppointments = appointments.filter((apt) => {
        if (activeTab === "scheduled") {
            // Show pending, approved, scheduled appointments
            return apt.appointment_status === "scheduled" || apt.appointment_status === "approved" || apt.appointment_status === "pending";
        }
        if (activeTab === "ongoing") {
            // Show confirmed (on the way), in-progress, and ongoing appointments
            return apt.appointment_status === "confirmed" || apt.appointment_status === "in-progress" || apt.appointment_status === "ongoing" || apt.appointment_status === "On the Way";
        }
        if (activeTab === "finished") {
            // Show in-warranty, finished, and backjob appointments
            return apt.appointment_status === "in-warranty" || apt.appointment_status === "finished" || apt.appointment_status === "backjob";
        }
        if (activeTab === "completed") {
            // Show completed appointments (warranty expired)
            return apt.appointment_status === "completed";
        }
        if (activeTab === "cancelled") {
            // Show cancelled and user_no_show appointments
            return apt.appointment_status === "cancelled" || apt.appointment_status === "user_no_show";
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
                            
                            // Check timing status for scheduled appointments
                            const timingStatus = (item.appointment_status === "scheduled" || item.appointment_status === "approved") 
                                ? checkAppointmentTiming(item) 
                                : 'on-time';
                            
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
                                                : item.appointment_status === "backjob"
                                                ? "Backjob"
                                                : item.appointment_status === "completed"
                                                ? "Completed"
                                                : item.appointment_status.charAt(0).toUpperCase() + item.appointment_status.slice(1)}
                                        </Text>
                                    </View>

                                    {/* Late/Overdue Badge for scheduled appointments */}
                                    {(item.appointment_status === 'scheduled' || item.appointment_status === 'approved') && timingStatus === 'late' && (
                                        <View style={styles.lateBadge}>
                                            <Ionicons name="time" size={16} color="#FF9800" />
                                            <Text style={styles.lateText}>LATE START</Text>
                                        </View>
                                    )}
                                    
                                    {(item.appointment_status === 'scheduled' || item.appointment_status === 'approved') && timingStatus === 'overdue' && (
                                        <View style={styles.overdueBadge}>
                                            <Ionicons name="alert-circle" size={16} color="#D32F2F" />
                                            <Text style={styles.overdueText}>OVERDUE - Cannot Start</Text>
                                        </View>
                                    )}

                                    {/* Provider No-Show Badge */}
                                    {item.appointment_status === 'cancelled' && item.cancellation_reason === 'provider-no-show' && (
                                        <View style={styles.noShowBadge}>
                                            <Ionicons name="alert-circle" size={16} color="#D32F2F" />
                                            <Text style={styles.noShowText}>Provider No-Show (Overdue)</Text>
                                        </View>
                                    )}

                                    {/* Customer No-Show Badge */}
                                    {item.appointment_status === 'user_no_show' && (
                                        <View style={styles.customerNoShowBadge}>
                                            <Ionicons name="person-remove" size={16} color="#FF6F00" />
                                            <Text style={styles.customerNoShowText}>Customer No-Show</Text>
                                        </View>
                                    )}

                                    <Text style={styles.bookingId}>Booking ID# {item.appointment_id}</Text>
                                    
                                    {item.current_backjob && (
                                        <View style={styles.backjobBadgeContainer}>
                                            <BackjobBadge status={item.current_backjob.status} size="medium" />
                                            {item.current_backjob.reason && (
                                                <View style={styles.backjobReasonBox}>
                                                    <Text style={styles.backjobReasonLabel}>Customer's Reason:</Text>
                                                    <Text style={styles.backjobReasonText}>{item.current_backjob.reason}</Text>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                    
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
                                        {item.appointment_status !== 'cancelled' && (
                                            <TouchableOpacity
                                                style={styles.chatButton}
                                                onPress={() => handleChat(item)}
                                            >
                                                <Ionicons name="chatbubble-ellipses" size={20} color="#00796B"/>
                                            </TouchableOpacity>
                                        )}
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

                                            <WebView
                                                style={styles.map}
                                                source={{
                                                    html: `
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
                                                                var map = L.map('map').setView([${coords.latitude}, ${coords.longitude}], 15);
                                                                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                                                                    attribution: '© OpenStreetMap contributors',
                                                                    maxZoom: 19
                                                                }).addTo(map);
                                                                var marker = L.marker([${coords.latitude}, ${coords.longitude}]).addTo(map);
                                                                marker.bindPopup('<b>${clientName.replace(/'/g, "\\'")}</b><br>${serviceName.replace(/'/g, "\\'")}').openPopup();
                                                            </script>
                                                        </body>
                                                        </html>
                                                    `
                                                }}
                                                javaScriptEnabled={true}
                                                domStorageEnabled={true}
                                                startInLoadingState={true}
                                                scalesPageToFit={true}
                                            />

                                            {(item.appointment_status === "scheduled" || item.appointment_status === "approved") && isApproved && isAppointmentDateReached(item.scheduled_date) && (
                                                <>
                                                    {/* Only show En Route button if not overdue */}
                                                    {timingStatus !== 'overdue' && (
                                                        <TouchableOpacity style={styles.actionButton} onPress={() => handleEnRoute(item)}>
                                                            <Text style={styles.actionButtonText}>En Route to Fix</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                    
                                                    {/* Show overdue message if appointment is overdue */}
                                                    {timingStatus === 'overdue' && (
                                                        <View style={[styles.disabledButton, { borderColor: '#D32F2F', backgroundColor: '#FFEBEE' }]}>
                                                            <Ionicons name="close-circle" size={16} color="#D32F2F" />
                                                            <Text style={[styles.disabledButtonText, { color: '#D32F2F' }]}>
                                                                Appointment Overdue - Cannot Start
                                                            </Text>
                                                        </View>
                                                    )}
                                                    
                                                    <TouchableOpacity 
                                                        style={[styles.actionButton, styles.cancelButton]} 
                                                        onPress={() => handleCancelAppointment(item)}
                                                    >
                                                        <Ionicons name="close-circle-outline" size={18} color="#FF6B6B" style={{ marginRight: 6 }} />
                                                        <Text style={[styles.actionButtonText, styles.cancelButtonText]}>Cancel Appointment</Text>
                                                    </TouchableOpacity>
                                                </>
                                            )}

                                            {(item.appointment_status === "scheduled" || item.appointment_status === "approved") && isApproved && !isAppointmentDateReached(item.scheduled_date) && (
                                                <>
                                                    <View style={styles.disabledButton}>
                                                        <Ionicons name="time-outline" size={16} color="#999" />
                                                        <Text style={styles.disabledButtonText}>
                                                            Available on {format(parseISO(item.scheduled_date), "MMM dd, yyyy")} (from 8:00 AM)
                                                        </Text>
                                                    </View>
                                                    
                                                    <TouchableOpacity 
                                                        style={[styles.actionButton, styles.cancelButton]} 
                                                        onPress={() => handleCancelAppointment(item)}
                                                    >
                                                        <Ionicons name="close-circle-outline" size={18} color="#FF6B6B" style={{ marginRight: 6 }} />
                                                        <Text style={[styles.actionButtonText, styles.cancelButtonText]}>Cancel Appointment</Text>
                                                    </TouchableOpacity>
                                                </>
                                            )}

                                            {item.appointment_status === "confirmed" && isApproved && (
                                                <TouchableOpacity 
                                                    style={[styles.actionButton, { backgroundColor: "#FF9800" }]} 
                                                    onPress={async () => {
                                                        // Navigate to en route screen
                                                        try {
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

                                                            router.push({
                                                                pathname: "/provider/integration/enroutescreen",
                                                                params: {
                                                                    appointmentId: item.appointment_id.toString(),
                                                                    customerId: item.customer_id.toString(),
                                                                    customerName: getClientName(item),
                                                                    serviceTitle: getServiceName(item),
                                                                    scheduledDate: item.scheduled_date,
                                                                    customerLocation: item.customer?.exact_location || `${item.customer?.latitude || 14.5995},${item.customer?.longitude || 120.9842}`,
                                                                    providerLocation: item.provider?.provider_exact_location || providerLocation || '',
                                                                    startTime: item.availability?.startTime || '',
                                                                    endTime: item.availability?.endTime || '',
                                                                },
                                                            });
                                                        } catch (error) {
                                                            console.error('Error navigating to en route screen:', error);
                                                            Alert.alert('Error', 'Failed to navigate to en route screen');
                                                        }
                                                    }}
                                                >
                                                    <Ionicons name="navigate" size={18} color="#FFF" style={{ marginRight: 8 }} />
                                                    <Text style={styles.actionButtonText}>View En Route</Text>
                                                </TouchableOpacity>
                                            )}

                                            {(item.appointment_status === "in-progress" || item.appointment_status === "ongoing") && isApproved && (
                                                <TouchableOpacity 
                                                    style={styles.actionButton} 
                                                    onPress={() => handleCompleteService(item)}
                                                >
                                                    <Text style={styles.actionButtonText}>Complete Service</Text>
                                                </TouchableOpacity>
                                            )}

                                            {item.appointment_status === "backjob" && isApproved && item.current_backjob && (
                                                <View style={styles.backjobActionsContainer}>
                                                    <View style={styles.backjobInfo}>
                                                        <Ionicons name="warning" size={20} color="#FF6B6B" />
                                                        <Text style={styles.backjobInfoText}>
                                                            Customer has applied for warranty work
                                                        </Text>
                                                    </View>
                                                    
                                                    {item.current_backjob.status === 'disputed' ? (
                                                        <View style={styles.disputedMessageContainer}>
                                                            <Ionicons name="hourglass-outline" size={20} color="#FF9800" />
                                                            <Text style={styles.disputedMessageText}>
                                                                Already disputed. Waiting for admin to review.
                                                            </Text>
                                                        </View>
                                                    ) : (
                                                        <View style={styles.backjobButtonsRow}>
                                                            <TouchableOpacity 
                                                                style={[styles.backjobButton, styles.disputeButton]}
                                                                onPress={() => {
                                                                    setSelectedAppointment(item);
                                                                    setSelectedBackjobId(item.current_backjob?.backjob_id || null);
                                                                    setDisputeModalVisible(true);
                                                                }}
                                                            >
                                                                <Ionicons name="close-circle" size={18} color="#FFF" />
                                                                <Text style={styles.backjobButtonText}>Dispute</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity 
                                                                style={[styles.backjobButton, styles.rescheduleButton]}
                                                                onPress={() => {
                                                                    router.push({
                                                                        pathname: "/provider/integration/reschedule-backjob",
                                                                        params: {
                                                                            appointmentId: item.appointment_id.toString(),
                                                                            backjobId: item.current_backjob?.backjob_id.toString() || '',
                                                                            customerName: getClientName(item),
                                                                            serviceTitle: getServiceName(item),
                                                                            currentDate: formatDateTime(item.scheduled_date),
                                                                        },
                                                                    });
                                                                }}
                                                            >
                                                                <Ionicons name="calendar" size={18} color="#FFF" />
                                                                <Text style={styles.backjobButtonText}>Reschedule</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    )}
                                                </View>
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
                                                    <Text style={styles.completedValue}>₱{item.final_price != null ? item.final_price.toFixed(2) : '0.00'}</Text>
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

                <DisputeBackjobModal
                    visible={disputeModalVisible}
                    backjobId={selectedBackjobId || 0}
                    appointmentId={selectedAppointment?.appointment_id || 0}
                    onClose={() => {
                        setDisputeModalVisible(false);
                        setSelectedAppointment(null);
                        setSelectedBackjobId(null);
                    }}
                    onSuccess={() => {
                        setDisputeModalVisible(false);
                        setSelectedAppointment(null);
                        setSelectedBackjobId(null);
                        fetchAppointments(); // Refresh the list
                    }}
                />

                <CancelAppointmentModal
                    visible={cancelModalVisible}
                    onClose={() => {
                        setCancelModalVisible(false);
                        setSelectedAppointment(null);
                    }}
                    onConfirm={handleCancelConfirm}
                    customerName={selectedAppointment ? getClientName(selectedAppointment) : undefined}
                    serviceTitle={selectedAppointment ? getServiceName(selectedAppointment) : undefined}
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
    lateBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF3E0",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#FF9800",
    },
    lateText: {
        fontSize: 12,
        fontFamily: "PoppinsSemiBold",
        color: "#FF9800",
        marginLeft: 6,
    },
    overdueBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFEBEE",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#D32F2F",
    },
    overdueText: {
        fontSize: 12,
        fontFamily: "PoppinsSemiBold",
        color: "#D32F2F",
        marginLeft: 6,
    },
    noShowBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFEBEE",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#D32F2F",
    },
    noShowText: {
        fontSize: 12,
        fontFamily: "PoppinsSemiBold",
        color: "#D32F2F",
        marginLeft: 6,
    },
    customerNoShowBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF3E0",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#FF6F00",
    },
    customerNoShowText: {
        fontSize: 12,
        fontFamily: "PoppinsSemiBold",
        color: "#FF6F00",
        marginLeft: 6,
    },
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
    backjobBadgeContainer: {
        marginVertical: 8,
    },
    backjobReasonBox: {
        marginTop: 8,
        padding: 10,
        backgroundColor: "#FFF8E1",
        borderRadius: 6,
        borderLeftWidth: 3,
        borderLeftColor: "#FF6B6B",
    },
    backjobReasonLabel: {
        fontSize: 11,
        fontFamily: "PoppinsSemiBold",
        color: "#D32F2F",
        marginBottom: 4,
    },
    backjobReasonText: {
        fontSize: 12,
        fontFamily: "PoppinsRegular",
        color: "#333",
        lineHeight: 18,
    },
    backjobActionsContainer: {
        marginTop: 12,
        padding: 12,
        backgroundColor: "#FFF3E0",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#FF6B6B",
    },
    backjobInfo: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    backjobInfoText: {
        fontSize: 13,
        fontFamily: "PoppinsMedium",
        color: "#D32F2F",
        marginLeft: 8,
        flex: 1,
    },
    backjobButtonsRow: {
        flexDirection: "row",
        gap: 10,
    },
    backjobButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 6,
    },
    disputeButton: {
        backgroundColor: "#9C27B0",
    },
    rescheduleButton: {
        backgroundColor: "#FF9800",
    },
    backjobButtonText: {
        fontSize: 13,
        fontFamily: "PoppinsSemiBold",
        color: "#FFF",
    },
    disputedMessageContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFF3E0",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#FF9800",
        gap: 8,
        marginTop: 8,
    },
    disputedMessageText: {
        flex: 1,
        fontSize: 13,
        fontFamily: "PoppinsMedium",
        color: "#E65100",
        lineHeight: 18,
    },
    cancelButton: {
        backgroundColor: "#FFF",
        borderWidth: 1.5,
        borderColor: "#FF6B6B",
        marginTop: 8,
    },
    cancelButtonText: {
        color: "#FF6B6B",
        fontFamily: "PoppinsSemiBold",
    },
});
