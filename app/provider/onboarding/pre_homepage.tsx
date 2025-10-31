import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, parseISO } from "date-fns";
import { useFonts } from "expo-font";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getDetailedProviderProfile, ProviderProfile } from "../../../src/api/auth.api";
import { getProviderAvailability } from "../../../src/api/availability.api";
import { getAppointmentsByProviderId } from "../../../src/api/booking.api";
import { useNotifications } from "../../../src/context/NotificationContext";
import ApprovedScreenWrapper from "../../../src/navigation/ApprovedScreenWrapper";
import type { Appointment } from "../../../src/types/appointment";
import type { Availability } from "../../../src/types/availability";

// Prevent auto-hide with error handling
// Only call if the native module is available
try {
    SplashScreen.preventAutoHideAsync();
} catch (error) {
    // Native module not available, splash screen will auto-hide
    console.warn('SplashScreen.preventAutoHideAsync() not available:', error);
}

type ScheduledWork = {
    status: "scheduled" | "ongoing" | "finished";
    client: string;
    service: string;
    datetime: string;
};

export default function Homepage() {
    const scrollRef = useRef<ScrollView>(null);
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams();
    const { unreadCount, refreshUnreadCount } = useNotifications();
    const [profileLoading, setProfileLoading] = useState(true);
    const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);
    const [ongoingAppointment, setOngoingAppointment] = useState<Appointment | null>(null);
    const [availabilities, setAvailabilities] = useState<Availability[]>([]);

    // Load fonts
    const [fontsLoaded] = useFonts({
        PoppinsRegular: require("../../assets/fonts/Poppins-Regular.ttf"),
        PoppinsBold: require("../../assets/fonts/Poppins-Bold.ttf"),
        PoppinsSemiBold: require("../../assets/fonts/Poppins-SemiBold.ttf"),
    });

    // Prevent back navigation - this is the root screen after login
    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                // Return true to prevent default back action
                // This prevents going back to signin/otp screens
                return true;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

            return () => subscription.remove();
        }, [])
    );

    // Fetch provider profile on mount
    useEffect(() => {
        async function fetchProfile() {
            try {
                // Get token from AsyncStorage
                const token = await AsyncStorage.getItem('providerToken');
                
                if (!token) {
                    Alert.alert('Error', 'Session expired. Please login again.');
                    router.replace('/provider/onboarding/signin');
                    return;
                }

                // Fetch detailed profile
                const profile = await getDetailedProviderProfile(token);

                if (profile) {
                    setProviderProfile(profile);
                } else {
                    throw new Error('Invalid profile data');
                }
            } catch (error: any) {
                console.error('Profile fetch error:', error);
                Alert.alert(
                    'Error',
                    error?.message || 'Failed to load profile. Please try again.',
                    [
                        {
                            text: 'Retry',
                            onPress: () => fetchProfile(),
                        },
                        {
                            text: 'Logout',
                            onPress: async () => {
                                await AsyncStorage.multiRemove(['providerToken', 'providerId', 'providerUserName']);
                                router.replace('/provider/onboarding/signin');
                            },
                        },
                    ]
                );
            } finally {
                setProfileLoading(false);
            }
        }

        if (fontsLoaded) {
            fetchProfile();
        }
    }, [fontsLoaded]);

    // Fetch ongoing appointments
    useEffect(() => {
        async function fetchOngoingAppointments() {
            try {
                const token = await AsyncStorage.getItem('providerToken');
                const providerIdStr = await AsyncStorage.getItem('providerId');

                if (!token || !providerIdStr) {
                    return;
                }

                const providerId = parseInt(providerIdStr, 10);
                const appointments = await getAppointmentsByProviderId(providerId, token);
                
                // Find first appointment with "confirmed" (on the way), "in-progress", or "ongoing" status
                const ongoing = appointments.find(
                    (apt) => apt.appointment_status === "confirmed" || apt.appointment_status === "in-progress" || apt.appointment_status === "ongoing"
                );
                
                setOngoingAppointment(ongoing || null);
            } catch (error: any) {
                console.error('Fetch ongoing appointments error:', error);
            }
        }

        if (fontsLoaded && !profileLoading) {
            fetchOngoingAppointments();
        }
    }, [fontsLoaded, profileLoading]);

    // Fetch availability
    useEffect(() => {
        async function fetchAvailability() {
            try {
                const token = await AsyncStorage.getItem('providerToken');
                const providerIdStr = await AsyncStorage.getItem('providerId');

                if (!token || !providerIdStr) {
                    return;
                }

                const providerId = parseInt(providerIdStr, 10);
                const data = await getProviderAvailability(providerId, token);
                setAvailabilities(data);
            } catch (error: any) {
                console.error('Fetch availability error:', error);
            }
        }

        if (fontsLoaded && !profileLoading) {
            fetchAvailability();
        }
    }, [fontsLoaded, profileLoading]);

    // Refresh notification count when screen is focused
    useFocusEffect(
        useCallback(() => {
            refreshUnreadCount();
        }, [refreshUnreadCount])
    );

    // Hide splash screen when fonts are loaded
    useEffect(() => {
        async function hideSplash() {
            if (fontsLoaded) {
                try {
                    await SplashScreen.hideAsync();
                } catch (error) {
                    // Native module not available or already hidden
                    console.log('SplashScreen.hideAsync() not available');
                }
            }
        }
        hideSplash();
    }, [fontsLoaded]);

    if (!fontsLoaded || profileLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#399d9d" />
                <Text style={{ marginTop: 10, color: '#555' }}>Loading profile...</Text>
            </View>
        );
    }

    // User & approval state
    const {client, service, datetime, status} = params;
    const isApproved = providerProfile?.is_verified || false;

    // Format provider name
    const formattedName = providerProfile
        ? (providerProfile.full_name?.trim() || `${providerProfile.first_name ?? ""} ${providerProfile.last_name ?? ""}`.trim() || providerProfile.userName)
        : "User";

    // Greeting
    const greetingText = (() => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning,";
        if (hour < 18) return "Good Afternoon,";
        return "Good Evening,";
    })();

    // Use real ongoing appointment if available
    const appointment = ongoingAppointment 
        ? {
            ...ongoingAppointment,
            // Format for display
            clientName: ongoingAppointment.customer 
                ? `${ongoingAppointment.customer.first_name} ${ongoingAppointment.customer.last_name}`.trim()
                : 'Unknown Client',
            serviceName: ongoingAppointment.service?.service_title || 'Service',
            dateTime: format(parseISO(ongoingAppointment.scheduled_date), "MMMM dd, yyyy")
        }
        : null;

    const statusColors: Record<string, string> = {
        pending: "#FFC107",
        approved: "#4CAF50",
        scheduled: "#4CAF50",
        confirmed: "#FF9800",
        "in-progress": "#F44336",
        ongoing: "#F44336",
        finished: "#9E9E9E",
        completed: "#9E9E9E",
    };

    return (
        <ApprovedScreenWrapper activeTab="home" isApproved={isApproved}>
            <ScrollView
                ref={scrollRef}
                contentContainerStyle={[styles.scrollContent, {paddingTop: insets.top + 20}]}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.greetingRow}>
                        <Ionicons name="person-circle-outline" size={45} color="#008080" style={styles.avatar}/>
                        <View style={styles.greetingBlock}>
                            <Text style={styles.greeting}>{greetingText}</Text>
                            <Text style={styles.name}>{formattedName}</Text>
                            {providerProfile?.location && (
                                <Text style={styles.locationText}>{providerProfile.location}</Text>
                            )}
                            {typeof providerProfile?.rating === "number" && (
                                <View style={styles.ratingRow}>
                                    <Ionicons name="star" size={14} color="#FFB300" />
                                    <Text style={styles.ratingText}>
                                        {providerProfile.rating.toFixed(1)} ({providerProfile.ratings_count || 0} reviews)
                                    </Text>
                                </View>
                            )}
                        </View>

                    </View>

                    <View style={styles.headerIcons}>
                        {/* Messages Icon */}
                        <Pressable
                            onPress={() => router.push("/messaging")}
                            style={styles.iconButton}
                        >
                            <View style={styles.bellWrapper}>
                                <Ionicons name="chatbubble-ellipses-outline" size={26} color="#333"/>
                                {/* Add unread count badge here if needed */}
                            </View>
                        </Pressable>

                        {/* Notification Icon */}
                        <Pressable
                            onPress={() => router.push("provider/notifications" as any)}
                            style={styles.iconButton}
                        >
                            <View style={styles.bellWrapper}>
                                <Ionicons name="notifications-outline" size={26} color="#333"/>
                                {unreadCount > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{unreadCount}</Text>
                                    </View>
                                )}
                            </View>
                        </Pressable>
                    </View>
                </View>

                {providerProfile && (
                    <View style={styles.summaryRow}>
                        <View style={styles.summaryCard}>
                            <Ionicons name="construct-outline" size={18} color="#00796B" />
                            <Text style={styles.summaryValue}>{providerProfile.totals?.professions ?? providerProfile.professions?.length ?? 0}</Text>
                            <Text style={styles.summaryLabel}>Professions</Text>
                        </View>
                        <View style={styles.summaryCard}>
                            <Ionicons name="ribbon-outline" size={18} color="#00796B" />
                            <Text style={styles.summaryValue}>{providerProfile.totals?.certificates ?? providerProfile.certificates?.length ?? 0}</Text>
                            <Text style={styles.summaryLabel}>Certificates</Text>
                        </View>
                        <View style={styles.summaryCard}>
                            <Ionicons name="briefcase-outline" size={18} color="#00796B" />
                            <Text style={styles.summaryValue}>{providerProfile.totals?.recent_services ?? providerProfile.recent_services?.length ?? 0}</Text>
                            <Text style={styles.summaryLabel}>Services</Text>
                        </View>
                    </View>
                )}

                {/* FixMo Today */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>FixMo Today</Text>
                    {!isApproved ? (
                        <View style={styles.pendingBox}>
                            <Ionicons name="hammer-outline" size={40} color="#009688"/>
                            <Text style={styles.pendingText}>
                                Your account is currently under review. Once <Text
                                style={styles.highlight}>approved</Text>, you'll start
                                receiving bookings here.
                            </Text>
                        </View>
                    ) : appointment ? (
                        <TouchableOpacity onPress={() => router.push('/provider/integration/fixmoto')}>
                            <View style={styles.appointmentBox}>
                                <View
                                    style={[styles.statusTag, {backgroundColor: statusColors[appointment.appointment_status] || "#777"}]}>
                                    <Text style={styles.statusText}>
                                        {appointment.appointment_status === "in-progress" || appointment.appointment_status === "ongoing"
                                            ? "Ongoing" 
                                            : appointment.appointment_status === "confirmed"
                                            ? "On the Way"
                                            : appointment.appointment_status === "approved" || appointment.appointment_status === "scheduled"
                                            ? "Scheduled"
                                            : appointment.appointment_status === "completed"
                                            ? "Finished"
                                            : appointment.appointment_status}
                                    </Text>
                                </View>
                                <Text style={styles.bookingId}>Booking ID# {appointment.appointment_id}</Text>
                                <Text style={styles.clientName}>{appointment.clientName}</Text>
                                <Text style={styles.serviceType}>
                                    Service Type: <Text style={styles.highlightService}>{appointment.serviceName}</Text>
                                </Text>

                                <View style={styles.row}>
                                    <View style={styles.row}>
                                        <Ionicons name="calendar-outline" size={16} color="#00796B"/>
                                        <Text style={styles.datetime}>{appointment.dateTime}</Text>
                                    </View>

                                    <TouchableOpacity
                                        style={styles.chatButton}
                                        onPress={() =>
                                            router.push({
                                                pathname: "/provider/integration/messagescreen",
                                                params: {
                                                    clientId: appointment.customer_id.toString(),
                                                    clientName: appointment.clientName,
                                                },
                                            })
                                        }
                                    >
                                        <Ionicons name="chatbubble-ellipses-outline" size={20} color="#00796B"/>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.pendingBox}>
                            <Ionicons name="calendar-outline" size={40} color="#009688"/>
                            <Text style={styles.pendingText}>
                                No ongoing appointments right now. Check the FixMo Today page to see all your scheduled services.
                            </Text>
                        </View>
                    )}
                </View>

                {/* Availability */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Availability</Text>
                        <TouchableOpacity onPress={() => router.push('/calendar/availability')}>
                            <Text style={styles.manageLink}>Manage</Text>
                        </TouchableOpacity>
                    </View>
                    {isApproved ? (
                        availabilities.length > 0 ? (
                            <View style={styles.availabilityBox}>
                                <View style={styles.activeDaysRow}>
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
                                        const fullDay = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index];
                                        const isActive = availabilities.some(
                                            (av) => av.dayOfWeek === fullDay && av.availability_isActive
                                        );
                                        return (
                                            <View
                                                key={day}
                                                style={[
                                                    styles.dayBadge,
                                                    isActive && styles.dayBadgeActive,
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.dayBadgeText,
                                                        isActive && styles.dayBadgeTextActive,
                                                    ]}
                                                >
                                                    {day}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </View>
                                <Text style={styles.availabilityNote}>
                                    <Ionicons name="checkmark-circle" size={14} color="#00796B" />{' '}
                                    {availabilities.filter((av) => av.availability_isActive).length} time slots active
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.pendingBox}>
                                <Ionicons name="calendar-outline" size={40} color="#009688" />
                                <Text style={styles.pendingText}>
                                    Set your weekly availability to start receiving bookings.
                                </Text>
                                <TouchableOpacity
                                    style={styles.setupButton}
                                    onPress={() => router.push('/calendar/availability')}
                                >
                                    <Text style={styles.setupButtonText}>Set Availability</Text>
                                </TouchableOpacity>
                            </View>
                        )
                    ) : (
                        <View style={styles.pendingBox}>
                            <Text style={styles.pendingText}>
                                Availability will be enabled once your account is approved.
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>

        </ApprovedScreenWrapper>
    );
}

const styles = StyleSheet.create({
    scrollContent: {paddingBottom: 100},
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        alignItems: "center",
        marginVertical: 20,
    },
    greetingRow: {flexDirection: "row", alignItems: "center"},
    avatar: {marginRight: 10},
    greetingBlock: {flexDirection: "column"},
    greeting: {fontSize: 14, color: "#333", fontFamily: "PoppinsRegular"},
    name: {fontSize: 17, color: "#008080", fontFamily: "PoppinsBold"},
    locationText: {fontSize: 12, color: "#777", fontFamily: "PoppinsRegular", marginTop: 2},
    ratingRow: {flexDirection: "row", alignItems: "center", marginTop: 2},
    ratingText: {fontSize: 12, color: "#555", marginLeft: 4, fontFamily: "PoppinsRegular"},
    summaryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginHorizontal: 20,
        marginBottom: 20,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: "#f7f7f7",
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 12,
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowOffset: {width: 0, height: 2},
        shadowRadius: 4,
        elevation: 2,
        marginHorizontal: 6,
    },
    summaryValue: {fontSize: 18, fontFamily: "PoppinsBold", color: "#00796B", marginTop: 6},
    summaryLabel: {fontSize: 12, fontFamily: "PoppinsRegular", color: "#555", marginTop: 2},
    bellWrapper: {position: "relative"},
    section: {marginHorizontal: 20, marginBottom: 20},
    sectionTitle: {fontSize: 18, marginBottom: 10, fontFamily: "PoppinsRegular"},
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    manageLink: {
        fontSize: 14,
        color: "#00796B",
        fontFamily: "PoppinsSemiBold",
    },
    availabilityBox: {
        backgroundColor: "#f2f2f2",
        borderRadius: 20,
        padding: 15,
    },
    activeDaysRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    dayBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#E0E0E0",
        justifyContent: "center",
        alignItems: "center",
    },
    dayBadgeActive: {
        backgroundColor: "#00796B",
    },
    dayBadgeText: {
        fontSize: 11,
        fontFamily: "PoppinsSemiBold",
        color: "#999",
    },
    dayBadgeTextActive: {
        color: "#fff",
    },
    availabilityNote: {
        fontSize: 13,
        fontFamily: "PoppinsRegular",
        color: "#00796B",
        textAlign: "center",
    },
    setupButton: {
        backgroundColor: "#00796B",
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
        marginTop: 12,
    },
    setupButtonText: {
        color: "#fff",
        fontSize: 14,
        fontFamily: "PoppinsSemiBold",
    },
    pendingBox: {backgroundColor: "#f2f2f2", borderRadius: 30, padding: 15, alignItems: "center"},
    pendingText: {fontSize: 14, color: "#555", textAlign: "center", fontFamily: "PoppinsRegular"},
    highlight: {color: "#009688", fontFamily: "PoppinsBold"},
    highlightService: {color: "#00796B", fontFamily: "PoppinsSemiBold"},
    appointmentBox: {backgroundColor: "#f2f2f2", borderRadius: 20, padding: 15},
    statusTag: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 8, alignSelf: "flex-start"},
    statusText: {color: "#fff", fontSize: 12, fontFamily: "PoppinsSemiBold"},
    bookingId: {fontSize: 12, fontFamily: "PoppinsMedium", color: "#666", marginBottom: 4, marginTop: 4},
    clientName: {fontSize: 16, color: "#333", fontFamily: "PoppinsSemiBold"},
    serviceType: {fontSize: 14, color: "#555", marginTop: 4, fontFamily: "PoppinsRegular"},
    datetime: {fontSize: 13, color: "#00796B", marginLeft: 6, fontFamily: "PoppinsRegular"},
    row: {flexDirection: "row", alignItems: "center", marginTop: 10},
    chatButton: {
        backgroundColor: "#fff",
        padding: 8,
        borderRadius: 20,
        marginLeft: "auto",
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowOffset: {width: 0, height: 2},
        shadowRadius: 4,
        elevation: 3,
    },
    badge: {
        position: "absolute",
        top: -5,
        right: -5,
        backgroundColor: "#FF5252",
        borderRadius: 8,
        paddingHorizontal: 4,
        paddingVertical: 1
    },
    badgeText: {color: "#fff", fontSize: 10, fontFamily: "PoppinsBold"},
    headerIcons: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    iconButton: {
        padding: 4,
    },
    modalBackground: {flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center"},
    modalCard: {backgroundColor: "#EDEDED", borderRadius: 16, padding: 16, width: "90%", maxHeight: "85%"},
    closeBtn: {alignSelf: "flex-end", marginBottom: 10},
});
