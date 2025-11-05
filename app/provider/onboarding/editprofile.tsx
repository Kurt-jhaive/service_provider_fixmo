import { getDetailedProviderProfile } from "@/api/auth.api";
import { API_CONFIG } from "@/constants/config";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import LocationMapPicker from "../../../src/components/maps/LocationMapPicker";

const BACKEND_URL = API_CONFIG.BASE_URL;

// Philippines location data (NCR only)
const philippinesData = require("../../assets/data/philippines.json");

interface UserData {
    provider_id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    location: string | null;
    provider_exact_location?: string | null;
    birthday?: string | null;
    profile_photo?: string | null;
    verification_status?: string;
}

export default function EditProfileScreen() {
    const router = useRouter();

    // User data
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form fields
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [homeAddress, setHomeAddress] = useState("");
    const [profileUri, setProfileUri] = useState<string | null>(null);
    const [birthday, setBirthday] = useState<Date | null>(null);
    const [locationCoordinates, setLocationCoordinates] = useState<{ lat: number; lng: number } | undefined>();

    // OTP states (for approved users)
    const [otpRequested, setOtpRequested] = useState(false);
    const [maskedEmail, setMaskedEmail] = useState("");
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otp, setOtp] = useState("");
    const [otpTimer, setOtpTimer] = useState(0);
    const [requestingOtp, setRequestingOtp] = useState(false);
    const [originalEmail, setOriginalEmail] = useState("");

    // Email change OTP states
    const [showSecondOtpModal, setShowSecondOtpModal] = useState(false);
    const [secondOtp, setSecondOtp] = useState("");
    const [newEmailForVerification, setNewEmailForVerification] = useState("");

    // Location cascading states (using NCR districts like signup)
    const [selectedDistrict, setSelectedDistrict] = useState("");
    const [selectedCity, setSelectedCity] = useState("");
    const [selectedBarangay, setSelectedBarangay] = useState("");
    const [showDistrictModal, setShowDistrictModal] = useState(false);
    const [showCityModal, setShowCityModal] = useState(false);
    const [showBarangayModal, setShowBarangayModal] = useState(false);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [manualLocationUpdate, setManualLocationUpdate] = useState(false);

    // Date picker
    const [isDatePickerVisible, setDatePickerVisible] = useState(false);

    // Load user profile
    useFocusEffect(
        useCallback(() => {
            loadUserProfile();
        }, [])
    );

    // Override Android back button behavior
    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                router.replace('/provider/onboarding/providerprofile');
                return true; // Prevent default back behavior
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

            return () => subscription.remove();
        }, [])
    );

    // OTP Timer countdown
    useEffect(() => {
        if (otpTimer > 0) {
            const interval = setInterval(() => {
                setOtpTimer((prev) => prev - 1);
            }, 1000);
            return () => clearInterval(interval);
        } else if (otpTimer === 0 && otpRequested) {
            setOtpRequested(false);
        }
    }, [otpTimer, otpRequested]);

    const loadUserProfile = async () => {
        try {
            const token = await AsyncStorage.getItem("providerToken");
            if (!token) {
                Alert.alert("Error", "Please login first");
                router.back();
                return;
            }

            console.log("Loading provider profile...");
            
            // Use the existing API function that has fallback logic
            const data = await getDetailedProviderProfile(token);
            
            console.log("Profile data loaded successfully");

            setUserData(data);
            setFirstName(data.first_name || "");
            setLastName(data.last_name || "");
            setEmail(data.email || "");
            setOriginalEmail(data.email || "");
            setPhone(data.phone_number || "");
            setHomeAddress(data.location || "");
            setProfileUri(data.profile_photo || null);

            // Parse birthday
            if (data.birthday) {
                setBirthday(new Date(data.birthday));
            }

            // Parse location coordinates
            if (data.exact_location) {
                const [lat, lng] = data.exact_location.split(",").map(Number);
                setLocationCoordinates({ lat, lng });
            }

            // Parse cascading location from location string
            parseLocationString(data.location || "");
            
        } catch (error) {
            console.error("Error loading profile:", error);
            Alert.alert(
                "Error Loading Profile", 
                error instanceof Error ? error.message : "Failed to load profile data. Please try again.",
                [
                    { text: "Go Back", onPress: () => router.back() },
                    { text: "Retry", onPress: () => loadUserProfile() }
                ]
            );
        } finally {
            setLoading(false);
        }
    };

    const parseLocationString = (locationStr: string) => {
        // Parse "Barangay, City, District" format
        const parts = locationStr.split(",").map((p) => p.trim());
        if (parts.length >= 3) {
            setSelectedBarangay(parts[0]);
            setSelectedCity(parts[1]);
            setSelectedDistrict(parts[2]);
        }
    };

    const requestOtp = async () => {
        // Only approved users need OTP
        if (userData?.verification_status !== "approved") {
            console.log("User not approved, skipping OTP request");
            return;
        }

        setRequestingOtp(true);

        try {
            const token = await AsyncStorage.getItem("providerToken");
            console.log("Requesting OTP from:", `${BACKEND_URL}/api/serviceProvider/profile/request-otp`);
            
            const response = await fetch(`${BACKEND_URL}/api/serviceProvider/profile/request-otp`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            console.log("OTP request response status:", response.status);
            const result = await response.json();
            console.log("OTP request result:", result);

            if (response.ok && result.success) {
                setOtpRequested(true);
                setMaskedEmail(result.email || "your email");
                setOtpTimer(600); // 10 minutes = 600 seconds
                Alert.alert(
                    "Verification Code Sent",
                    `A 6-digit code has been sent to ${result.email || "your email"}. It will expire in 10 minutes.`
                );
            } else {
                // Show detailed error for debugging
                const errorMsg = result.message || "Failed to send verification code";
                console.error("OTP request failed:", errorMsg, result);
                Alert.alert(
                    "Error", 
                    errorMsg
                );
            }
        } catch (error) {
            console.error("Error requesting OTP:", error);
            Alert.alert(
                "Network Error", 
                `Failed to connect to server.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        } finally {
            setRequestingOtp(false);
        }
    };

    const handleSave = async () => {
        // Check verification status
        if (userData?.verification_status !== "approved") {
            // For rejected/pending users → Direct resubmission (no OTP)
            Alert.alert(
                "Verification Resubmission",
                "Your account is not yet approved. Saving will resubmit your information for verification.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Resubmit",
                        onPress: () => handleVerificationResubmission(),
                    },
                ]
            );
            return;
        }

        // For approved users → OTP required
        if (!otpRequested) {
            Alert.alert(
                "Verification Required",
                "Please request a verification code first before saving changes.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Request Code",
                        onPress: () => requestOtp(),
                    },
                ]
            );
            return;
        }

        // Validation
        if (!firstName.trim() || !lastName.trim()) {
            Alert.alert("Validation Error", "First name and last name are required");
            return;
        }

        if (!phone.trim()) {
            Alert.alert("Validation Error", "Phone number is required");
            return;
        }

        if (!homeAddress.trim()) {
            Alert.alert("Validation Error", "Home address is required");
            return;
        }

        // Show OTP modal for verification before saving
        setShowOtpModal(true);
    };

    const verifyOtpAndSave = async () => {
        if (!otp || otp.length !== 6) {
            Alert.alert("Error", "Please enter a valid 6-digit verification code");
            return;
        }

        setSaving(true);
        setShowOtpModal(false);

        try {
            const token = await AsyncStorage.getItem("providerToken");
            if (!token) {
                Alert.alert("Error", "Please login first");
                setSaving(false);
                return;
            }

            // Prepare update data according to backend API
            const updateData: any = {
                otp: otp.trim(),
            };

            // Normalize phone numbers for comparison (remove all non-digit characters)
            const normalizePhone = (phoneStr: string) => phoneStr.replace(/\D/g, '');
            const currentPhone = normalizePhone(phone);
            const originalPhone = userData?.phone_number ? normalizePhone(userData.phone_number) : '';

            // Add phone if changed
            if (currentPhone && currentPhone !== originalPhone) {
                updateData.provider_phone_number = phone.startsWith('+') ? phone : `+63${phone}`;
            }

            // Add email if changed
            if (email && email !== originalEmail) {
                updateData.provider_email = email;
            }

            // Add location if changed
            if (homeAddress && homeAddress !== userData?.location) {
                updateData.provider_location = homeAddress;
            }

            // Add coordinates if changed
            const originalCoords = userData?.provider_exact_location || '';
            const newCoords = locationCoordinates ? `${locationCoordinates.lat},${locationCoordinates.lng}` : '';
            if (newCoords && newCoords !== originalCoords) {
                updateData.provider_exact_location = newCoords;
            }

            // Ensure at least one field is being updated besides OTP
            const hasChanges = updateData.provider_phone_number || 
                              updateData.provider_email || 
                              updateData.provider_location || 
                              updateData.provider_exact_location;

            if (!hasChanges) {
                Alert.alert("No Changes", "Please make at least one change before saving.");
                setSaving(false);
                return;
            }

            console.log("Updating profile with data:", updateData);

            const response = await fetch(`${BACKEND_URL}/api/serviceProvider/profile`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(updateData),
            });

            const result = await response.json();
            console.log("Profile update result:", result);

            if (result.success || response.ok) {
                Alert.alert(
                    "Success",
                    "Profile updated successfully!",
                    [
                        {
                            text: "OK",
                            onPress: () => {
                                setOtp("");
                                setOtpRequested(false);
                                setOtpTimer(0);
                                loadUserProfile(); // Reload profile
                                router.back();
                            },
                        },
                    ]
                );
            } else {
                Alert.alert("Error", result.message || "Failed to update profile");
                setShowOtpModal(true); // Show modal again for retry
            }
        } catch (error) {
            console.error("Error updating profile:", error);
            Alert.alert("Error", "Network error during update");
            setShowOtpModal(true); // Show modal again for retry
        } finally {
            setSaving(false);
        }
    };

    // Note: Two-step email verification is not currently supported by the backend
    // The following functions are kept for future implementation if needed
    /*
    const handleEmailChangeFlow = async (otpCode: string) => {
        // Reserved for future two-step email change implementation
    };

    const verifySecondEmailOtp = async () => {
        // Reserved for future two-step email change implementation
    };
    */

    const handleVerificationResubmission = async () => {
        setSaving(true);

        try {
            const token = await AsyncStorage.getItem("providerToken");

            const formData = new FormData();

            // Personal information
            formData.append("provider_first_name", firstName);
            formData.append("provider_last_name", lastName);

            if (birthday) {
                formData.append("birthday", birthday.toISOString().split("T")[0]);
            }

            formData.append("provider_location", homeAddress);

            if (locationCoordinates) {
                formData.append("provider_exact_location", `${locationCoordinates.lat},${locationCoordinates.lng}`);
            }

            // Profile photo (if new image selected)
            if (profileUri && !profileUri.startsWith("http")) {
                const photoExt = profileUri.split(".").pop();
                formData.append("provider_profile_photo", {
                    uri: profileUri,
                    type: `image/${photoExt}`,
                    name: `profile.${photoExt}`,
                } as any);
            } else if (profileUri) {
                // Existing Cloudinary URL
                formData.append("profile_photo_url", profileUri);
            }

            const response = await fetch(`${BACKEND_URL}/api/verification/provider/resubmit`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });

            if (response.ok) {
                Alert.alert(
                    "Success",
                    "Your information has been updated and submitted for review.",
                    [
                        {
                            text: "OK",
                            onPress: () => {
                                loadUserProfile();
                                router.back();
                            },
                        },
                    ]
                );
            } else {
                const errorData = await response.json();
                Alert.alert("Error", errorData.message || "Failed to update information");
            }
        } catch (error) {
            console.error("Error during resubmission:", error);
            Alert.alert("Error", "Network error during resubmission");
        } finally {
            setSaving(false);
        }
    };

    const pickImage = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert("Permission denied", "We need access to your photos.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets.length > 0) {
            setProfileUri(result.assets[0].uri);
        }
    };

    // Add district map for display names
    const districtMap: { [key: string]: string } = {
        "NATIONAL CAPITAL REGION - MANILA": "NCR District - Manila",
        "NATIONAL CAPITAL REGION - QUEZON CITY": "NCR District - Quezon City",
        "NATIONAL CAPITAL REGION - CALOOCAN": "NCR District - Caloocan",
        "NATIONAL CAPITAL REGION - LAS PIÑAS": "NCR District - Las Piñas",
        "NATIONAL CAPITAL REGION - MAKATI": "NCR District - Makati",
        "NATIONAL CAPITAL REGION - MALABON": "NCR District - Malabon",
        "NATIONAL CAPITAL REGION - MANDALUYONG": "NCR District - Mandaluyong",
        "NATIONAL CAPITAL REGION - MARIKINA": "NCR District - Marikina",
        "NATIONAL CAPITAL REGION - MUNTINLUPA": "NCR District - Muntinlupa",
        "NATIONAL CAPITAL REGION - NAVOTAS": "NCR District - Navotas",
        "NATIONAL CAPITAL REGION - PARAÑAQUE": "NCR District - Parañaque",
        "NATIONAL CAPITAL REGION - PASAY": "NCR District - Pasay",
        "NATIONAL CAPITAL REGION - PASIG": "NCR District - Pasig",
        "NATIONAL CAPITAL REGION - PATEROS": "NCR District - Pateros",
        "NATIONAL CAPITAL REGION - SAN JUAN": "NCR District - San Juan",
        "NATIONAL CAPITAL REGION - TAGUIG": "NCR District - Taguig",
        "NATIONAL CAPITAL REGION - VALENZUELA": "NCR District - Valenzuela",
    };

    const getDistricts = () => {
        if (philippinesData && philippinesData["NCR"]) {
            return Object.keys(philippinesData["NCR"].province_list);
        }
        return [];
    };

    const getCities = () => {
        if (!selectedDistrict || !philippinesData["NCR"]?.province_list[selectedDistrict]) return [];
        return Object.keys(philippinesData["NCR"].province_list[selectedDistrict].municipality_list);
    };

    const getBarangays = () => {
        if (
            !selectedDistrict ||
            !selectedCity ||
            !philippinesData["NCR"]?.province_list[selectedDistrict]?.municipality_list[selectedCity]
        )
            return [];
        return philippinesData["NCR"].province_list[selectedDistrict].municipality_list[selectedCity].barangay_list;
    };

    const handleDistrictSelect = (district: string) => {
        setSelectedDistrict(district);
        setSelectedCity("");
        setSelectedBarangay("");
        setShowDistrictModal(false);
        setManualLocationUpdate(false); // Reset when changing location selection
        updateHomeAddress(selectedBarangay, "", district);
    };

    const handleCitySelect = (city: string) => {
        setSelectedCity(city);
        setSelectedBarangay("");
        setShowCityModal(false);
        setManualLocationUpdate(false); // Reset when changing location selection
        updateHomeAddress(selectedBarangay, city, selectedDistrict);
    };

    const handleBarangaySelect = (barangay: string) => {
        setSelectedBarangay(barangay);
        setShowBarangayModal(false);
        setManualLocationUpdate(false); // Reset when changing location selection
        updateHomeAddress(barangay, selectedCity, selectedDistrict);
    };

    const updateHomeAddress = (barangay: string, municipality: string, province: string) => {
        const parts = [barangay, municipality, province].filter(Boolean);
        setHomeAddress(parts.join(", "));
    };

    // Geocoding function
    const geocodeLocation = async () => {
        if (!selectedDistrict || !selectedCity || !selectedBarangay) {
            return;
        }

        setIsGeocoding(true);
        try {
            const addressQuery = `${selectedBarangay}, ${selectedCity}, Philippines`;
            const encodedAddress = encodeURIComponent(addressQuery);
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
                {
                    headers: {
                        'User-Agent': 'FixmoServiceProviderApp/1.0',
                    },
                }
            );

            if (!response.ok) {
                throw new Error('Geocoding failed');
            }

            const data = await response.json();

            if (data && data.length > 0) {
                const {lat, lon} = data[0];
                const coords = {
                    lat: parseFloat(lat),
                    lng: parseFloat(lon)
                };
                setLocationCoordinates(coords);
            } else {
                // Fallback to city-level if barangay not found
                const cityQuery = `${selectedCity}, Philippines`;
                const cityResponse = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityQuery)}&limit=1`,
                    {
                        headers: {
                            'User-Agent': 'FixmoServiceProviderApp/1.0',
                        },
                    }
                );
                const cityData = await cityResponse.json();
                if (cityData && cityData.length > 0) {
                    const {lat, lon} = cityData[0];
                    setLocationCoordinates({
                        lat: parseFloat(lat),
                        lng: parseFloat(lon)
                    });
                }
            }
        } catch (error) {
            console.error('Geocoding error:', error);
        } finally {
            setIsGeocoding(false);
        }
    };

    // Auto-trigger geocoding when all location fields are selected
    useEffect(() => {
        // Only geocode if location was not manually updated
        if (selectedDistrict && selectedCity && selectedBarangay && !manualLocationUpdate) {
            geocodeLocation();
        }
    }, [selectedDistrict, selectedCity, selectedBarangay]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#008080" />
                <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            {/* Header */}
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.title}>Edit Profile</Text>

            {/* Show different UI based on verification status */}
            {userData?.verification_status === "approved" && (
                <View style={styles.otpSection}>
                    <Text style={styles.sectionTitle}>Security Verification Required</Text>
                    <Text style={styles.helperText}>
                        To protect your account, we need to verify your identity before making changes.
                    </Text>

                    {otpRequested ? (
                        <View style={styles.otpRequestedBox}>
                            <Ionicons name="checkmark-circle" size={24} color="#4caf50" />
                            <Text style={styles.otpRequestedText}>Code sent to {maskedEmail}</Text>
                            <Text style={styles.timerText}>
                                Expires in: {Math.floor(otpTimer / 60)}:{String(otpTimer % 60).padStart(2, "0")}
                            </Text>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.requestOtpButton}
                            onPress={requestOtp}
                            disabled={requestingOtp}
                        >
                            {requestingOtp ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="shield-checkmark" size={20} color="#fff" />
                                    <Text style={styles.requestOtpButtonText}>Request Verification Code</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Rejection warning for rejected/pending users */}
            {userData?.verification_status !== "approved" && (
                <View style={styles.warningBox}>
                    <Ionicons name="alert-circle" size={24} color="#FF9800" />
                    <Text style={styles.warningText}>
                        Your account verification is {userData?.verification_status}. Saving changes will resubmit
                        your information for review.
                    </Text>
                </View>
            )}

            {/* Info banner for approved users who haven't requested OTP */}
            {userData?.verification_status === "approved" && !otpRequested && (
                <View style={styles.infoBox}>
                    <Ionicons name="information-circle" size={24} color="#2196F3" />
                    <Text style={styles.infoText}>
                        Profile editing is locked. Please request a verification code above to unlock fields and make changes.
                    </Text>
                </View>
            )}

            {/* Avatar */}
            <TouchableOpacity 
                style={[
                    styles.avatarContainer,
                    styles.avatarDisabled // Always disabled
                ]} 
                onPress={pickImage}
                disabled={true} // Always disabled
            >
                {profileUri ? (
                    <Image source={{ uri: profileUri }} style={styles.avatarImage} />
                ) : (
                    <Ionicons name="person-circle-outline" size={80} color="#ccc" />
                )}
                <Text style={styles.changePhoto}>
                    Profile photo cannot be changed here
                </Text>
            </TouchableOpacity>

            {/* Form Fields */}
            <View style={styles.form}>
                {/* First Name */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                        First Name <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={[
                            styles.input,
                            styles.inputDisabled // Always disabled
                        ]}
                        value={firstName}
                        onChangeText={setFirstName}
                        placeholder="Enter first name"
                        editable={false} // Always disabled
                    />
                </View>

                {/* Last Name */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                        Last Name <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={[
                            styles.input,
                            styles.inputDisabled // Always disabled
                        ]}
                        value={lastName}
                        onChangeText={setLastName}
                        placeholder="Enter last name"
                        editable={false} // Always disabled
                    />
                </View>

                {/* Birthday */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Birthday</Text>
                    <TouchableOpacity
                        style={[
                            styles.dateButton,
                            styles.inputDisabled // Always disabled
                        ]}
                        onPress={() => setDatePickerVisible(true)}
                        disabled={true} // Always disabled
                    >
                        <Text style={styles.dateButtonText}>
                            {birthday ? birthday.toLocaleDateString() : "Select birthday"}
                        </Text>
                        <Ionicons name="calendar-outline" size={20} color="#666" />
                    </TouchableOpacity>
                </View>

                <DateTimePickerModal
                    isVisible={isDatePickerVisible}
                    mode="date"
                    onConfirm={(date) => {
                        setBirthday(date);
                        setDatePickerVisible(false);
                    }}
                    onCancel={() => setDatePickerVisible(false)}
                    maximumDate={new Date()}
                />

                {/* Email - Editable for approved users who requested OTP */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                        Email <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={[
                            styles.input,
                            userData?.verification_status === "approved" && !otpRequested && styles.inputDisabled
                        ]}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Enter email"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        editable={userData?.verification_status !== "approved" || otpRequested}
                    />
                </View>

                {/* Phone */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                        Phone Number <Text style={styles.required}>*</Text>
                    </Text>
                    <View style={[
                        styles.phoneInputContainer,
                        userData?.verification_status === "approved" && !otpRequested && styles.inputDisabled
                    ]}>
                        <Text style={styles.phonePrefix}>+63</Text>
                        <TextInput
                            style={styles.phoneInput}
                            value={phone}
                            onChangeText={(text) => {
                                // Remove +63 if user types it
                                const cleaned = text.replace(/^\+63/, "").replace(/\D/g, "");
                                setPhone(cleaned);
                            }}
                            placeholder="9XX XXX XXXX"
                            keyboardType="phone-pad"
                            maxLength={10}
                            editable={userData?.verification_status !== "approved" || otpRequested}
                        />
                    </View>
                </View>

                {/* Location Cascading */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                        District <Text style={styles.required}>*</Text>
                    </Text>
                    <TouchableOpacity
                        style={[
                            styles.selectButton,
                            userData?.verification_status === "approved" && !otpRequested && styles.inputDisabled
                        ]}
                        onPress={() => setShowDistrictModal(true)}
                        disabled={userData?.verification_status === "approved" && !otpRequested}
                    >
                        <Text style={selectedDistrict ? styles.selectButtonText : styles.selectPlaceholder}>
                            {selectedDistrict ? districtMap[selectedDistrict] || selectedDistrict : "Select District"}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#666" />
                    </TouchableOpacity>
                </View>

                {selectedDistrict && (
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            City <Text style={styles.required}>*</Text>
                        </Text>
                        <TouchableOpacity
                            style={[
                                styles.selectButton,
                                userData?.verification_status === "approved" && !otpRequested && styles.inputDisabled
                            ]}
                            onPress={() => setShowCityModal(true)}
                            disabled={userData?.verification_status === "approved" && !otpRequested}
                        >
                            <Text
                                style={selectedCity ? styles.selectButtonText : styles.selectPlaceholder}
                            >
                                {selectedCity || "Select City"}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color="#666" />
                        </TouchableOpacity>
                    </View>
                )}

                {selectedCity && (
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            Barangay <Text style={styles.required}>*</Text>
                        </Text>
                        <TouchableOpacity
                            style={[
                                styles.selectButton,
                                userData?.verification_status === "approved" && !otpRequested && styles.inputDisabled
                            ]}
                            onPress={() => setShowBarangayModal(true)}
                            disabled={userData?.verification_status === "approved" && !otpRequested}
                        >
                            <Text style={selectedBarangay ? styles.selectButtonText : styles.selectPlaceholder}>
                                {selectedBarangay || "Select Barangay"}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color="#666" />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Full Address Display */}
                {homeAddress && (
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Full Address</Text>
                        <Text style={styles.addressDisplay}>{homeAddress}</Text>
                    </View>
                )}

                {/* Geocoding and Map Picker */}
                {isGeocoding && (
                    <View style={styles.geocodingContainer}>
                        <ActivityIndicator size="small" color="#008080" />
                        <Text style={styles.geocodingText}>Finding location coordinates...</Text>
                    </View>
                )}

                {/* Map Section - Always show if we have location data */}
                {selectedDistrict && selectedCity && selectedBarangay && locationCoordinates && (
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Pin Your Exact Location on Map</Text>
                        <Text style={styles.coordinatesText}>
                            📍 {locationCoordinates.lat.toFixed(6)}, {locationCoordinates.lng.toFixed(6)}
                        </Text>
                        <Text style={styles.helperText}>
                            💡 Drag the pin on the map to set your exact location (within 1km of your barangay)
                        </Text>
                        <LocationMapPicker
                            district={selectedDistrict}
                            city={selectedCity}
                            barangay={selectedBarangay}
                            initialCoordinates={{
                                latitude: locationCoordinates.lat,
                                longitude: locationCoordinates.lng
                            }}
                            onLocationUpdate={(coords) => {
                                setManualLocationUpdate(true);
                                setLocationCoordinates({
                                    lat: coords.latitude,
                                    lng: coords.longitude
                                });
                            }}
                            disabled={userData?.verification_status === "approved" && !otpRequested}
                        />
                    </View>
                )}

                {/* Show message if location not set */}
                {selectedDistrict && selectedCity && selectedBarangay && !locationCoordinates && !isGeocoding && (
                    <View style={styles.warningBox}>
                        <Ionicons name="location-outline" size={24} color="#FF9800" />
                        <Text style={styles.warningText}>
                            Waiting for location coordinates. The map will appear once your location is geocoded.
                        </Text>
                    </View>
                )}
            </View>

            {/* Save Button - Only show if OTP requested (approved users) or not approved */}
            {(userData?.verification_status !== "approved" || otpRequested) && (
                <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.saveText}>Save Changes</Text>
                    )}
                </TouchableOpacity>
            )}

            {/* OTP Verification Modal */}
            <Modal
                visible={showOtpModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowOtpModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Enter Verification Code</Text>
                        <Text style={styles.modalDescription}>
                            Enter the 6-digit code sent to {maskedEmail}
                        </Text>

                        <TextInput
                            style={styles.otpInput}
                            value={otp}
                            onChangeText={setOtp}
                            placeholder="000000"
                            keyboardType="number-pad"
                            maxLength={6}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => setShowOtpModal(false)}
                            >
                                <Text style={styles.modalCancelButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.modalVerifyButton}
                                onPress={verifyOtpAndSave}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.modalVerifyButtonText}>Verify</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Note: Second OTP Modal removed - backend currently uses single-step verification */}
            {/* Two-step email verification can be added when backend supports it */}

            {/* District Modal */}
            <Modal
                visible={showDistrictModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowDistrictModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.locationModalContent}>
                        <View style={styles.locationModalHeader}>
                            <Text style={styles.locationModalTitle}>Select District</Text>
                            <TouchableOpacity onPress={() => setShowDistrictModal(false)}>
                                <Ionicons name="close" size={28} color="#333" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView>
                            {getDistricts().map((district) => (
                                <TouchableOpacity
                                    key={district}
                                    style={styles.locationItem}
                                    onPress={() => handleDistrictSelect(district)}
                                >
                                    <Text style={styles.locationItemText}>
                                        {districtMap[district] || district}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* City Modal */}
            <Modal
                visible={showCityModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowCityModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.locationModalContent}>
                        <View style={styles.locationModalHeader}>
                            <Text style={styles.locationModalTitle}>Select City</Text>
                            <TouchableOpacity onPress={() => setShowCityModal(false)}>
                                <Ionicons name="close" size={28} color="#333" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView>
                            {getCities().map((city) => (
                                <TouchableOpacity
                                    key={city}
                                    style={styles.locationItem}
                                    onPress={() => handleCitySelect(city)}
                                >
                                    <Text style={styles.locationItemText}>{city}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Barangay Modal */}
            <Modal
                visible={showBarangayModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowBarangayModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.locationModalContent}>
                        <View style={styles.locationModalHeader}>
                            <Text style={styles.locationModalTitle}>Select Barangay</Text>
                            <TouchableOpacity onPress={() => setShowBarangayModal(false)}>
                                <Ionicons name="close" size={28} color="#333" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView>
                            {getBarangays().map((barangay: string) => (
                                <TouchableOpacity
                                    key={barangay}
                                    style={styles.locationItem}
                                    onPress={() => handleBarangaySelect(barangay)}
                                >
                                    <Text style={styles.locationItemText}>{barangay}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        paddingTop: Platform.OS === "ios" ? 60 : 40,
        backgroundColor: "#fff",
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
        marginTop: 12,
    },
    backButton: {
        marginBottom: 10,
    },
    title: {
        fontSize: 22,
        fontWeight: "bold",
        marginBottom: 20,
    },
    otpSection: {
        backgroundColor: "#E8F5E9",
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "#4CAF50",
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#333",
        marginBottom: 8,
    },
    helperText: {
        fontSize: 13,
        color: "#666",
        marginBottom: 12,
    },
    otpRequestedBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        padding: 12,
        borderRadius: 8,
    },
    otpRequestedText: {
        fontSize: 14,
        color: "#333",
        marginLeft: 8,
        flex: 1,
    },
    timerText: {
        fontSize: 12,
        color: "#666",
    },
    requestOtpButton: {
        backgroundColor: "#008080",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
        borderRadius: 8,
        gap: 8,
    },
    requestOtpButtonText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
    },
    warningBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF3E0",
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "#FF9800",
    },
    warningText: {
        fontSize: 13,
        color: "#666",
        marginLeft: 12,
        flex: 1,
    },
    infoBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#E3F2FD",
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "#2196F3",
    },
    infoText: {
        fontSize: 13,
        color: "#666",
        marginLeft: 12,
        flex: 1,
    },
    avatarContainer: {
        alignItems: "center",
        marginBottom: 30,
    },
    avatarDisabled: {
        opacity: 0.5,
    },
    avatarImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
    },
    changePhoto: {
        fontSize: 12,
        color: "#008080",
        marginTop: 8,
    },
    form: {
        marginBottom: 20,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 8,
        color: "#333",
    },
    required: {
        color: "#FF0000",
        fontWeight: "bold",
    },
    input: {
        backgroundColor: "#f9f9f9",
        padding: 14,
        borderRadius: 30,
        fontSize: 16,
    },
    inputDisabled: {
        backgroundColor: "#e0e0e0",
        opacity: 0.6,
    },
    phoneInputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#f9f9f9",
        borderRadius: 30,
        paddingLeft: 14,
    },
    phonePrefix: {
        fontSize: 16,
        color: "#333",
        fontWeight: "600",
        marginRight: 8,
    },
    phoneInput: {
        flex: 1,
        padding: 14,
        fontSize: 16,
    },
    dateButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#f9f9f9",
        padding: 14,
        borderRadius: 30,
    },
    dateButtonText: {
        fontSize: 16,
        color: "#333",
    },
    selectButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#f9f9f9",
        padding: 14,
        borderRadius: 30,
    },
    selectButtonText: {
        fontSize: 16,
        color: "#333",
    },
    selectPlaceholder: {
        fontSize: 16,
        color: "#999",
    },
    addressDisplay: {
        fontSize: 14,
        color: "#666",
        padding: 12,
        backgroundColor: "#f0f0f0",
        borderRadius: 8,
    },
    saveButton: {
        backgroundColor: "#008080",
        paddingVertical: 15,
        borderRadius: 40,
        alignItems: "center",
        marginTop: 20,
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
    },
    modalOverlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    modalContent: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 24,
        width: "85%",
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#333",
        marginBottom: 8,
        textAlign: "center",
    },
    modalDescription: {
        fontSize: 14,
        color: "#666",
        marginBottom: 20,
        textAlign: "center",
    },
    otpInput: {
        backgroundColor: "#f9f9f9",
        padding: 14,
        borderRadius: 8,
        fontSize: 24,
        textAlign: "center",
        marginBottom: 20,
        letterSpacing: 8,
    },
    modalButtons: {
        flexDirection: "row",
        gap: 12,
    },
    modalCancelButton: {
        flex: 1,
        backgroundColor: "#E0F2F1",
        padding: 14,
        borderRadius: 8,
        alignItems: "center",
    },
    modalCancelButtonText: {
        color: "#008080",
        fontSize: 16,
        fontWeight: "600",
    },
    modalVerifyButton: {
        flex: 1,
        backgroundColor: "#008080",
        padding: 14,
        borderRadius: 8,
        alignItems: "center",
    },
    modalVerifyButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    geocodingContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backgroundColor: "#E0F2F1",
        borderRadius: 8,
        marginVertical: 12,
    },
    geocodingText: {
        marginLeft: 10,
        fontSize: 14,
        color: "#008080",
        fontWeight: "500",
    },
    coordinatesText: {
        fontSize: 15,
        color: "#008080",
        backgroundColor: "#E0F2F1",
        padding: 14,
        borderRadius: 12,
        fontWeight: "600",
        marginBottom: 8,
        textAlign: "center",
        borderWidth: 1,
        borderColor: "#B2DFDB",
    },
    locationModalContent: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        height: "70%",
        width: "100%",
    },
    locationModalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },
    locationModalTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#333",
    },
    locationItem: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    locationItemText: {
        fontSize: 16,
        color: "#333",
    },
});
