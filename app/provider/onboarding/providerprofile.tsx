import { useUserContext } from "@/context/UserContext";
import ApprovedScreenWrapper from "@/navigation/ApprovedScreenWrapper";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Easing,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { getDetailedProviderProfile, ProviderProfile as ProviderProfileType } from "../../../src/api/auth.api";
import { unregisterPushToken } from "../../../src/utils/notificationhelper";
import VerificationModal from "./components/VerificationModal";

type MenuItem = {
    label: string;
    icon: string;
    route?: string;
};

const alwaysAvailable: MenuItem[] = [
    {label: "Edit Profile", icon: "create", route: "/provider/onboarding/editprofile"},
    {label: "Certificates", icon: "document-text", route: "/provider/onboarding/mycertificate"},
    {label: "Services", icon: "list", route: "/provider/onboarding/services"},
    {label: "Fix-Score", icon: "speedometer", route: "/provider/integration/penalty-score-details"},
    {label: "Report an Issue", icon: "flag", route: "/provider/integration/report"},
    {label: "Privacy Policy", icon: "shield", route: "/provider/integration/privacypolicy"},
    {label: "Terms and Conditions", icon: "document-text-outline", route: "/provider/integration/termsandconditions"},
    {label: "Log Out", icon: "log-out"}, // triggers logout modal

];

const restrictedItems: MenuItem[] = [
    {label: "Ratings", icon: "star-outline", route: "/provider/integration/ratingscreen"},
];

export default function ProviderProfile() {
    const scrollRef = useRef<ScrollView>(null);
    const router = useRouter();
    const {user, logout} = useUserContext();
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [showVerificationModal, setShowVerificationModal] = useState(false);
    const [providerProfile, setProviderProfile] = useState<ProviderProfileType | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const isApproved = user?.status === "approved";

    // Animated bottom sheet
    const slideAnim = useState(new Animated.Value(300))[0];

    // Fetch provider profile on mount
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                setLoading(true);
                setError(null);
                
                const token = await AsyncStorage.getItem('providerToken');
                if (!token) {
                    setError('No authentication token found');
                    return;
                }

                const profileData = await getDetailedProviderProfile(token);
                setProviderProfile(profileData);
            } catch (err: any) {
                console.error('Failed to fetch provider profile:', err);
                setError(err.message || 'Failed to load profile');
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, []);

    const openLogout = () => {
        setShowLogoutModal(true);
        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
        }).start();
    };

    const closeLogout = () => {
        Animated.timing(slideAnim, {
            toValue: 300,
            duration: 200,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
        }).start(() => setShowLogoutModal(false));
    };

    const handleLogout = async () => {
        try {
            // Get token before clearing storage
            const token = await AsyncStorage.getItem('providerToken');
            
            // Unregister push token (non-blocking)
            if (token) {
                unregisterPushToken(token).catch(error => {
                    console.error('Failed to unregister push token:', error);
                });
            }

            // Clear storage and logout (includes message session cleanup)
            await logout();
            closeLogout();
            router.replace("/");
        } catch (error) {
            console.error('Logout error:', error);
            // Still proceed with logout even if push cleanup fails
            await logout();
            closeLogout();
            router.replace("/");
        }
    };

    const renderMenuItem = (item: MenuItem, restricted = false) => {
        const isBlocked = restricted && !isApproved;

        return (
            <TouchableOpacity
                key={item.label}
                style={styles.menuItem}
                onPress={() => {
                    if (item.label === "Log Out") return openLogout();
                    if (isBlocked) return alert("Your account is pending approval.");
                    if (item.route) return router.push(item.route as any);
                    alert("This feature is not yet available.");
                }}
                disabled={isBlocked}
            >
                <View style={styles.menuLeft}>
                    <Ionicons
                        name={item.icon as any}
                        size={25}
                        color={isBlocked ? "#999" : "#008080"}
                    />
                    <Text
                        style={[
                            styles.menuLabel,
                            item.label === "Log Out" && {
                                color: "#008080",
                                fontFamily: "PoppinsSemiBold",
                            },
                            isBlocked && {color: "#999"},
                        ]}
                    >
                        {item.label}
                    </Text>
                </View>
                {!isBlocked && item.label !== "Log Out" && (
                    <Ionicons name="chevron-forward-outline" size={20} color="#008080"/>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <ApprovedScreenWrapper activeTab="profile" isApproved={isApproved}>
            {/* Profile Title */}
            <View style={styles.titleContainer}>
                <Text style={styles.title}>Profile</Text>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#008080" />
                    <Text style={styles.loadingText}>Loading profile...</Text>
                </View>
            ) : error ? (
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={64} color="#E53935" />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity 
                        style={styles.retryButton}
                        onPress={() => {
                            setLoading(true);
                            setError(null);
                            // Re-fetch will be triggered by useEffect
                        }}
                    >
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView ref={scrollRef} contentContainerStyle={{paddingBottom: 120}}>
                    {/* Rejection Banner */}
                    {providerProfile?.verification_status === 'rejected' && (
                        <View style={styles.rejectionBanner}>
                            <View style={styles.rejectionBannerContent}>
                                <Ionicons name="alert-circle" size={32} color="#E53935" />
                                <View style={styles.rejectionTextContainer}>
                                    <Text style={styles.rejectionTitle}>Account Verification Rejected</Text>
                                    <Text style={styles.rejectionReason}>
                                        {providerProfile?.rejection_reason || 'Your verification was rejected. Please resubmit your documents.'}
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.resubmitButton}
                                        onPress={() => setShowVerificationModal(true)}
                                    >
                                        <Text style={styles.resubmitButtonText}>Resubmit Documents</Text>
                                        <Ionicons name="arrow-forward" size={16} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Pending Banner */}
                    {providerProfile?.verification_status === 'pending' && (
                        <View style={styles.pendingBanner}>
                            <Ionicons name="time-outline" size={24} color="#FF9800" />
                            <View style={styles.bannerTextContainer}>
                                <Text style={styles.pendingTitle}>Verification Pending</Text>
                                <Text style={styles.pendingMessage}>
                                    Your documents are being reviewed. You'll be notified once approved.
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Header */}
                    <View style={styles.header}>
                        {providerProfile?.profile_photo ? (
                            <Image 
                                source={{uri: providerProfile.profile_photo}} 
                                style={styles.profileImage}
                            />
                        ) : (
                            <Ionicons name="person-circle" size={80} color="#008080"/>
                        )}
                        
                        {/* Verification Badge */}
                        {providerProfile?.is_verified && (
                            <View style={styles.verificationBadge}>
                                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                                <Text style={styles.verifiedText}>Verified</Text>
                            </View>
                        )}
                        
                        {providerProfile?.verification_status === 'pending' && (
                            <View style={[styles.verificationBadge, styles.pendingBadge]}>
                                <Ionicons name="time-outline" size={20} color="#FF9800" />
                                <Text style={[styles.verifiedText, styles.pendingText]}>Verification Pending</Text>
                            </View>
                        )}
                        
                        {providerProfile?.verification_status === 'rejected' && (
                            <View style={[styles.verificationBadge, styles.rejectedBadge]}>
                                <Ionicons name="close-circle" size={20} color="#E53935" />
                                <Text style={[styles.verifiedText, styles.rejectedText]}>Verification Rejected</Text>
                            </View>
                        )}

                        <Text style={styles.name}>
                            {providerProfile?.full_name || `${providerProfile?.first_name} ${providerProfile?.last_name}`}
                        </Text>
                        <Text style={styles.phone}>{providerProfile?.phone_number || "+63 000 000 0000"}</Text>
                        <Text style={styles.phone}>{providerProfile?.email || "No Email Provided"}</Text>
                    </View>

                    {/* Menu Items */}
                    <View style={styles.menuList}>
                        {restrictedItems.map((item) => renderMenuItem(item, true /* restricted */))}
                        {alwaysAvailable.map((item) => renderMenuItem(item))}
                    </View>
                </ScrollView>
            )}

            {/* Logout Modal */}
            <Modal transparent visible={showLogoutModal} animationType="none" onRequestClose={closeLogout}>
                <View style={styles.modalOverlay}>
                    <Animated.View style={[styles.modalContainer, {transform: [{translateY: slideAnim}]}]}>
                        <Text style={styles.modalTitle}>Logout</Text>
                        <Text style={styles.modalMessage}>Are you sure you want to Log Out?</Text>
                        <View style={styles.modalButtons}>
                            <Pressable style={[styles.button, styles.cancelButton]} onPress={closeLogout}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={[styles.button, styles.confirmButton]} onPress={handleLogout}>
                                <Text style={styles.confirmText}>Yes</Text>
                            </Pressable>
                        </View>
                    </Animated.View>
                </View>
            </Modal>

            {/* Verification Resubmission Modal */}
            <VerificationModal
                visible={showVerificationModal}
                onClose={() => setShowVerificationModal(false)}
                onSuccess={() => {
                    setShowVerificationModal(false);
                    // Reload profile to get updated verification status
                    fetchProfile();
                }}
                rejectionReason={providerProfile?.rejection_reason || undefined}
                currentUserData={{
                    first_name: providerProfile?.first_name,
                    last_name: providerProfile?.last_name,
                    birthday: providerProfile?.birthday || undefined,
                    location: providerProfile?.location || undefined,
                    exact_location: providerProfile?.exact_location || undefined,
                    profile_photo: providerProfile?.profile_photo || undefined,
                    valid_id: providerProfile?.valid_id || undefined,
                }}
            />
        </ApprovedScreenWrapper>
    );

    // Helper function to fetch profile (can be called from multiple places)
    async function fetchProfile() {
        try {
            setLoading(true);
            setError(null);
            
            const token = await AsyncStorage.getItem('providerToken');
            if (!token) {
                setError('No authentication token found');
                return;
            }

            const profileData = await getDetailedProviderProfile(token);
            setProviderProfile(profileData);
        } catch (err: any) {
            console.error('Failed to fetch provider profile:', err);
            setError(err.message || 'Failed to load profile');
        } finally {
            setLoading(false);
        }
    }
}

const styles = StyleSheet.create({
    titleContainer: {
        paddingTop: 50,
        paddingBottom: 10,
        alignItems: "center",
        backgroundColor: "#fff",
    },
    title: {
        fontSize: 18,
        color: "#333",
        fontFamily: "PoppinsSemiBold",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 100,
    },
    loadingText: {
        fontSize: 14,
        color: "#666",
        fontFamily: "PoppinsRegular",
        marginTop: 12,
    },
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 100,
        paddingHorizontal: 40,
    },
    errorText: {
        fontSize: 14,
        color: "#E53935",
        fontFamily: "PoppinsRegular",
        textAlign: "center",
        marginTop: 12,
        marginBottom: 20,
    },
    retryButton: {
        backgroundColor: "#008080",
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 8,
    },
    retryText: {
        color: "#fff",
        fontSize: 14,
        fontFamily: "PoppinsSemiBold",
    },
    header: {
        alignItems: "center",
        marginTop: 20,
        marginBottom: 30,
    },
    profileImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 12,
    },
    verificationBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#E8F5E9",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#4CAF50",
    },
    pendingBadge: {
        backgroundColor: "#FFF3E0",
        borderColor: "#FF9800",
    },
    rejectedBadge: {
        backgroundColor: "#FFEBEE",
        borderColor: "#E53935",
    },
    verifiedText: {
        fontSize: 13,
        color: "#4CAF50",
        fontFamily: "PoppinsSemiBold",
        marginLeft: 6,
    },
    pendingText: {
        color: "#FF9800",
    },
    rejectedText: {
        color: "#E53935",
    },
    name: {
        fontSize: 16,
        color: "#333",
        fontFamily: "PoppinsSemiBold",
    },
    phone: {
        fontSize: 14,
        color: "#666",
        fontFamily: "PoppinsRegular",
    },
    fixScoreContainer: {
        marginTop: 10,
        marginBottom: 20,
    },
    menuList: {
        paddingHorizontal: 20,
    },
    menuItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 16,
    },
    menuLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
    menuLabel: {
        marginLeft: 12,
        fontSize: 16,
        color: "#333",
        fontFamily: "PoppinsRegular",
    },
    modalOverlay: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0,0,0,0.4)",
    },
    modalContainer: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 20,
    },
    modalTitle: {
        fontSize: 18,
        color: "#008080",
        textAlign: "center",
        marginBottom: 10,
        fontFamily: "PoppinsSemiBold",
    },
    modalMessage: {
        fontSize: 15,
        color: "#333",
        textAlign: "center",
        marginBottom: 20,
        fontFamily: "PoppinsRegular",
    },
    modalButtons: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    button: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        marginHorizontal: 5,
        alignItems: "center",
    },
    cancelButton: {
        backgroundColor: "#E0F2F1",
    },
    confirmButton: {
        backgroundColor: "#008080",
    },
    cancelText: {
        color: "#008080",
        fontFamily: "PoppinsSemiBold",
    },
    confirmText: {
        color: "#fff",
        fontFamily: "PoppinsSemiBold",
    },
    rejectionBanner: {
        backgroundColor: "#FFEBEE",
        margin: 16,
        marginTop: 0,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E53935",
    },
    rejectionBannerContent: {
        flexDirection: "row",
        padding: 16,
        alignItems: "flex-start",
    },
    rejectionTextContainer: {
        flex: 1,
        marginLeft: 12,
    },
    rejectionTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#E53935",
        fontFamily: "PoppinsSemiBold",
        marginBottom: 6,
    },
    rejectionReason: {
        fontSize: 14,
        color: "#666",
        fontFamily: "PoppinsRegular",
        marginBottom: 12,
        lineHeight: 20,
    },
    resubmitButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#E53935",
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignSelf: "flex-start",
    },
    resubmitButtonText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
        fontFamily: "PoppinsSemiBold",
        marginRight: 6,
    },
    pendingBanner: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF3E0",
        margin: 16,
        marginTop: 0,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#FF9800",
    },
    bannerTextContainer: {
        flex: 1,
        marginLeft: 12,
    },
    pendingTitle: {
        fontSize: 15,
        fontWeight: "600",
        color: "#FF9800",
        fontFamily: "PoppinsSemiBold",
        marginBottom: 4,
    },
    pendingMessage: {
        fontSize: 13,
        color: "#666",
        fontFamily: "PoppinsRegular",
        lineHeight: 18,
    },
});
