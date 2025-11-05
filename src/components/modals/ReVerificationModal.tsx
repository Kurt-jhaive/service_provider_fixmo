import { API_CONFIG } from "@/constants/config";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import LocationMapPicker from "../maps/LocationMapPicker";

const BACKEND_URL = API_CONFIG.BASE_URL;

// Philippines location data (NCR only)
const philippinesData = require("../../../app/assets/data/philippines.json");

interface ReVerificationModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    rejectionReason?: string;
}

export default function ReVerificationModal({
    visible,
    onClose,
    onSuccess,
    rejectionReason,
}: ReVerificationModalProps) {
    // Personal Information
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [birthday, setBirthday] = useState<Date | null>(null);

    // Images
    const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
    const [validIdUri, setValidIdUri] = useState<string | null>(null);

    // Location cascading states (using NCR districts)
    const [selectedDistrict, setSelectedDistrict] = useState("");
    const [selectedCity, setSelectedCity] = useState("");
    const [selectedBarangay, setSelectedBarangay] = useState("");
    const [showDistrictModal, setShowDistrictModal] = useState(false);
    const [showCityModal, setShowCityModal] = useState(false);
    const [showBarangayModal, setShowBarangayModal] = useState(false);

    // Location coordinates
    const [locationCoordinates, setLocationCoordinates] = useState<{ lat: number; lng: number } | undefined>();

    // UI States
    const [isDatePickerVisible, setDatePickerVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [isGeocoding, setIsGeocoding] = useState(false);

    // District name mapping (same as signup)
    const districtDisplayNames: { [key: string]: string } = {
        "NATIONAL CAPITAL REGION - FIRST DISTRICT": "NCR District - First",
        "NATIONAL CAPITAL REGION - SECOND DISTRICT": "NCR District - Second",
        "NATIONAL CAPITAL REGION - THIRD DISTRICT": "NCR District - Third",
        "NATIONAL CAPITAL REGION - FOURTH DISTRICT": "NCR District - Fourth",
        "NATIONAL CAPITAL REGION - CALOOCAN": "NCR District - Caloocan",
        "NATIONAL CAPITAL REGION - LAS PIÑAS": "NCR District - Las Piñas",
        "NATIONAL CAPITAL REGION - MALABON": "NCR District - Malabon",
        "NATIONAL CAPITAL REGION - MANDALUYONG": "NCR District - Mandaluyong",
        "NATIONAL CAPITAL REGION - MARIKINA": "NCR District - Marikina",
        "NATIONAL CAPITAL REGION - MUNTINLUPA": "NCR District - Muntinlupa",
        "NATIONAL CAPITAL REGION - NAVOTAS": "NCR District - Navotas",
        "NATIONAL CAPITAL REGION - PARAÑAQUE": "NCR District - Parañaque",
        "NATIONAL CAPITAL REGION - PASAY": "NCR District - Pasay",
        "NATIONAL CAPITAL REGION - PASIG": "NCR District - Pasig",
        "NATIONAL CAPITAL REGION - PATEROS": "NCR District - Pateros",
        "NATIONAL CAPITAL REGION - QUEZON CITY": "NCR District - Quezon City",
        "NATIONAL CAPITAL REGION - SAN JUAN": "NCR District - San Juan",
        "NATIONAL CAPITAL REGION - TAGUIG": "NCR District - Taguig",
        "NATIONAL CAPITAL REGION - VALENZUELA": "NCR District - Valenzuela",
    };

    // Location helper functions
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

    // Reset cascading selections when parent changes
    useEffect(() => {
        setSelectedCity("");
        setSelectedBarangay("");
    }, [selectedDistrict]);

    useEffect(() => {
        setSelectedBarangay("");
    }, [selectedCity]);

    // Geocoding function
    const geocodeLocation = async () => {
        if (!selectedDistrict || !selectedCity || !selectedBarangay) {
            Alert.alert("Missing Location", "Please select District, City, and Barangay first");
            return;
        }

        setIsGeocoding(true);
        try {
            // Try full address with barangay
            const addressQuery = `${selectedBarangay}, ${selectedCity}, Philippines`;
            const encodedAddress = encodeURIComponent(addressQuery);
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
                {
                    headers: {
                        "User-Agent": "FixmoServiceProviderApp/1.0",
                    },
                }
            );

            if (!response.ok) {
                throw new Error("Geocoding failed");
            }

            const data = await response.json();

            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                const coords = {
                    lat: parseFloat(lat),
                    lng: parseFloat(lon),
                };
                setLocationCoordinates(coords);
                Alert.alert("Success", "Location found! You can now pin your exact location on the map.");
            } else {
                // Fallback to city-level if barangay not found
                const cityQuery = `${selectedCity}, Philippines`;
                const cityResponse = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
                        cityQuery
                    )}&limit=1`,
                    {
                        headers: {
                            "User-Agent": "FixmoServiceProviderApp/1.0",
                        },
                    }
                );
                const cityData = await cityResponse.json();
                if (cityData && cityData.length > 0) {
                    const { lat, lon } = cityData[0];
                    setLocationCoordinates({
                        lat: parseFloat(lat),
                        lng: parseFloat(lon),
                    });
                    Alert.alert("Success", "City location found! Please pin your exact location on the map.");
                } else {
                    // Default to Metro Manila center
                    setLocationCoordinates({
                        lat: 14.5995,
                        lng: 120.9842,
                    });
                    Alert.alert("Location Ready", "Please pin your exact location on the map.");
                }
            }
        } catch (error) {
            console.error("Geocoding error:", error);
            // Default to Metro Manila center
            setLocationCoordinates({
                lat: 14.5995,
                lng: 120.9842,
            });
            Alert.alert("Map Ready", "Please navigate and pin your exact location manually.");
        } finally {
            setIsGeocoding(false);
        }
    };

    const handleDistrictSelect = (district: string) => {
        setSelectedDistrict(district);
        setSelectedCity("");
        setSelectedBarangay("");
        setShowDistrictModal(false);
    };

    const handleCitySelect = (city: string) => {
        setSelectedCity(city);
        setSelectedBarangay("");
        setShowCityModal(false);
    };

    const handleBarangaySelect = (barangay: string) => {
        setSelectedBarangay(barangay);
        setShowBarangayModal(false);
        // Auto-trigger geocoding when barangay is selected
        setTimeout(() => {
            geocodeLocation();
        }, 500);
    };

    // Image Picker Functions
    const pickProfilePhoto = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permission Denied", "Gallery permission is required");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1], // Square format for profile
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets[0]) {
            const uri = result.assets[0].uri;
            console.log("📸 Profile photo selected:", uri);
            setProfilePhotoUri(uri);
        }
    };

    const pickValidId = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permission Denied", "Gallery permission is required");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3], // Standard ID format
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets[0]) {
            const uri = result.assets[0].uri;
            console.log("🆔 Valid ID selected:", uri);
            setValidIdUri(uri);
        }
    };

    // Age Validation
    const calculateAge = (birthDate: Date): number => {
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const handleDateConfirm = (date: Date) => {
        const age = calculateAge(date);
        if (age < 18) {
            Alert.alert("Invalid Age", "You must be at least 18 years old to register.");
            setDatePickerVisible(false);
            return;
        }
        if (age > 100) {
            Alert.alert("Invalid Age", "Please enter a valid date of birth.");
            setDatePickerVisible(false);
            return;
        }
        setBirthday(date);
        setDatePickerVisible(false);
    };

    const formatDate = (date: Date | null): string => {
        if (!date) return "Select Birthday";
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    // Form Submission
    const handleSubmit = async () => {
        // Validation
        if (!firstName || !lastName) {
            Alert.alert("Validation Error", "First name and last name are required");
            return;
        }

        if (!birthday) {
            Alert.alert("Validation Error", "Birthday is required");
            return;
        }

        const age = calculateAge(birthday);
        if (age < 18 || age > 100) {
            Alert.alert("Validation Error", "Age must be between 18 and 100 years old");
            return;
        }

        if (!selectedDistrict || !selectedCity || !selectedBarangay) {
            Alert.alert(
                "Validation Error",
                "Please select your complete location (District, City, and Barangay)"
            );
            return;
        }

        if (!locationCoordinates?.lat || !locationCoordinates?.lng) {
            Alert.alert("Validation Error", "Please pin your exact location on the map");
            return;
        }

        if (!profilePhotoUri) {
            Alert.alert("Validation Error", "Profile photo is required");
            return;
        }

        if (!validIdUri) {
            Alert.alert("Validation Error", "Valid ID is required");
            return;
        }

        setSubmitting(true);

        try {
            const token = await AsyncStorage.getItem("token");
            if (!token) {
                Alert.alert("Error", "Please login first");
                setSubmitting(false);
                return;
            }

            // Build FormData
            const formData = new FormData();

            // Add files with proper formatting
            const photoExt = profilePhotoUri.split(".").pop()?.toLowerCase() || "jpg";
            const photoType = photoExt === "png" ? "image/png" : "image/jpeg";

            formData.append("profile_photo", {
                uri: Platform.OS === "android" ? profilePhotoUri : `file://${profilePhotoUri}`,
                type: photoType,
                name: `profile_photo_${Date.now()}.${photoExt}`,
            } as any);

            const idExt = validIdUri.split(".").pop()?.toLowerCase() || "jpg";
            const idType = idExt === "png" ? "image/png" : "image/jpeg";

            formData.append("valid_id", {
                uri: Platform.OS === "android" ? validIdUri : `file://${validIdUri}`,
                type: idType,
                name: `valid_id_${Date.now()}.${idExt}`,
            } as any);

            // Add text fields
            formData.append("first_name", firstName);
            formData.append("last_name", lastName);
            formData.append("birthday", birthday.toISOString().split("T")[0]);
            
            // Format location as "Barangay, City, District"
            const userLocation = `${selectedBarangay}, ${selectedCity}, ${districtDisplayNames[selectedDistrict] || selectedDistrict}`;
            formData.append("user_location", userLocation);
            formData.append("exact_location", `${locationCoordinates.lat},${locationCoordinates.lng}`);

            // Submit to backend
            const response = await fetch(`${BACKEND_URL}/api/verification/service-provider/resubmit`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    // Don't set Content-Type - let fetch set it with boundary
                },
                body: formData,
            });

            const responseData = await response.json();

            if (response.ok && responseData.success) {
                Alert.alert(
                    "Success",
                    responseData.message ||
                        "Verification documents resubmitted successfully! Your documents will be reviewed within 24-48 hours.",
                    [
                        {
                            text: "OK",
                            onPress: () => {
                                onSuccess();
                                handleClose();
                            },
                        },
                    ]
                );
            } else {
                const errorMsg = responseData.message || responseData.error || "Failed to submit verification";
                Alert.alert("Submission Failed", errorMsg);
            }
        } catch (error) {
            console.error("Error submitting verification:", error);

            let errorMessage = "An unexpected error occurred";
            if (error instanceof Error) {
                errorMessage = error.message;
            }

            // Check if it's a network error
            if (errorMessage.includes("Network request failed")) {
                errorMessage = "Network error. Please check your internet connection and try again.";
            }

            Alert.alert("Error", errorMessage);
        } finally {
            setSubmitting(false);
        }
    };

    // Form Reset
    const handleClose = () => {
        // Reset form
        setFirstName("");
        setLastName("");
        setBirthday(null);
        setSelectedDistrict("");
        setSelectedCity("");
        setSelectedBarangay("");
        setProfilePhotoUri(null);
        setValidIdUri(null);
        setLocationCoordinates(undefined);
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleClose}>
                        <Ionicons name="close" size={28} color="#008080" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Re-verify Account</Text>
                    <View style={{ width: 28 }} />
                </View>

                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                    {/* Rejection Banner */}
                    {rejectionReason && (
                        <View style={styles.rejectionBanner}>
                            <Ionicons
                                name="warning"
                                size={24}
                                color="#ff4444"
                                style={{ marginRight: 10 }}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rejectionTitle}>Previous Submission Rejected</Text>
                                <Text style={styles.rejectionText}>{rejectionReason}</Text>
                                <Text style={styles.rejectionHint}>
                                    Please provide correct information below.
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Instructions */}
                    <View style={styles.instructionBox}>
                        <Ionicons name="information-circle" size={24} color="#008080" />
                        <Text style={styles.instructionText}>
                            Please fill in all required fields with accurate information. Your documents
                            will be reviewed by our admin team.
                        </Text>
                    </View>

                    {/* Personal Information Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Personal Information</Text>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.label}>
                                First Name <Text style={styles.required}>*</Text>
                            </Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your first name"
                                value={firstName}
                                onChangeText={setFirstName}
                                autoCapitalize="words"
                            />
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.label}>
                                Last Name <Text style={styles.required}>*</Text>
                            </Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your last name"
                                value={lastName}
                                onChangeText={setLastName}
                                autoCapitalize="words"
                            />
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.label}>
                                Birthday <Text style={styles.required}>*</Text>
                            </Text>
                            <TouchableOpacity
                                style={styles.datePickerButton}
                                onPress={() => setDatePickerVisible(true)}
                            >
                                <Ionicons name="calendar" size={20} color="#008080" />
                                <Text
                                    style={[
                                        styles.datePickerText,
                                        !birthday && styles.datePickerPlaceholder,
                                    ]}
                                >
                                    {formatDate(birthday)}
                                </Text>
                                <Ionicons name="chevron-down" size={20} color="#999" />
                            </TouchableOpacity>
                        </View>

                        <DateTimePickerModal
                            isVisible={isDatePickerVisible}
                            mode="date"
                            onConfirm={handleDateConfirm}
                            onCancel={() => setDatePickerVisible(false)}
                            maximumDate={new Date()}
                        />
                    </View>

                    {/* Location Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Location</Text>
                        <Text style={styles.sectionSubtitle}>
                            Select your location (NCR only)
                        </Text>

                        {/* District Dropdown */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.label}>
                                District <Text style={styles.required}>*</Text>
                            </Text>
                            <TouchableOpacity
                                style={styles.locationButton}
                                onPress={() => setShowDistrictModal(true)}
                            >
                                <Text
                                    style={
                                        selectedDistrict
                                            ? styles.locationButtonTextSelected
                                            : styles.locationButtonText
                                    }
                                >
                                    {selectedDistrict
                                        ? districtDisplayNames[selectedDistrict] || selectedDistrict
                                        : "Select District"}
                                </Text>
                                <Ionicons name="chevron-down" size={20} color="#999" />
                            </TouchableOpacity>
                        </View>

                        {/* City Dropdown */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.label}>
                                City <Text style={styles.required}>*</Text>
                            </Text>
                            <TouchableOpacity
                                style={[
                                    styles.locationButton,
                                    !selectedDistrict && styles.locationButtonDisabled,
                                ]}
                                onPress={() => selectedDistrict && setShowCityModal(true)}
                                disabled={!selectedDistrict}
                            >
                                <Text
                                    style={
                                        selectedCity
                                            ? styles.locationButtonTextSelected
                                            : styles.locationButtonText
                                    }
                                >
                                    {selectedCity || "Select City"}
                                </Text>
                                <Ionicons name="chevron-down" size={20} color="#999" />
                            </TouchableOpacity>
                        </View>

                        {/* Barangay Dropdown */}
                        <View style={styles.fieldContainer}>
                            <Text style={styles.label}>
                                Barangay <Text style={styles.required}>*</Text>
                            </Text>
                            <TouchableOpacity
                                style={[
                                    styles.locationButton,
                                    !selectedCity && styles.locationButtonDisabled,
                                ]}
                                onPress={() => selectedCity && setShowBarangayModal(true)}
                                disabled={!selectedCity}
                            >
                                <Text
                                    style={
                                        selectedBarangay
                                            ? styles.locationButtonTextSelected
                                            : styles.locationButtonText
                                    }
                                >
                                    {selectedBarangay || "Select Barangay"}
                                </Text>
                                <Ionicons name="chevron-down" size={20} color="#999" />
                            </TouchableOpacity>
                        </View>

                        {/* Map Pin Location */}
                        {locationCoordinates && (
                            <View style={styles.fieldContainer}>
                                <Text style={styles.label}>
                                    Pin Exact Location <Text style={styles.required}>*</Text>
                                </Text>
                                <LocationMapPicker
                                    district={selectedDistrict}
                                    city={selectedCity}
                                    barangay={selectedBarangay}
                                    initialCoordinates={{
                                        latitude: locationCoordinates.lat,
                                        longitude: locationCoordinates.lng,
                                    }}
                                    onLocationUpdate={(coords) => {
                                        setLocationCoordinates({
                                            lat: coords.latitude,
                                            lng: coords.longitude,
                                        });
                                    }}
                                    disabled={!selectedBarangay}
                                />
                                <Text style={styles.coordinatesText}>
                                    📍 {locationCoordinates.lat.toFixed(6)}, {locationCoordinates.lng.toFixed(6)}
                                </Text>
                            </View>
                        )}

                        {isGeocoding && (
                            <View style={styles.geocodingIndicator}>
                                <ActivityIndicator size="small" color="#008080" />
                                <Text style={styles.geocodingText}>Finding location...</Text>
                            </View>
                        )}
                    </View>

                    {/* Documents Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Documents</Text>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.label}>
                                Profile Photo <Text style={styles.required}>*</Text>
                            </Text>
                            <TouchableOpacity style={styles.uploadButton} onPress={pickProfilePhoto}>
                                {profilePhotoUri ? (
                                    <View style={styles.uploadedPreview}>
                                        <Image
                                            source={{ uri: profilePhotoUri }}
                                            style={styles.previewImage}
                                        />
                                        <Text style={styles.uploadedText}>✓ Photo uploaded</Text>
                                    </View>
                                ) : (
                                    <>
                                        <Ionicons name="camera" size={24} color="#008080" />
                                        <Text style={styles.uploadButtonText}>Upload Profile Photo</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.label}>
                                Valid ID <Text style={styles.required}>*</Text>
                            </Text>
                            <TouchableOpacity style={styles.uploadButton} onPress={pickValidId}>
                                {validIdUri ? (
                                    <View style={styles.uploadedPreview}>
                                        <Image source={{ uri: validIdUri }} style={styles.previewImageId} />
                                        <Text style={styles.uploadedText}>✓ ID uploaded</Text>
                                    </View>
                                ) : (
                                    <>
                                        <Ionicons name="card" size={24} color="#008080" />
                                        <Text style={styles.uploadButtonText}>Upload Valid ID</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle" size={24} color="white" />
                                <Text style={styles.submitButtonText}>Submit Re-Verification</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <View style={{ height: 40 }} />
                </ScrollView>

                {/* District Modal */}
                <Modal
                    visible={showDistrictModal}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setShowDistrictModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Select District</Text>
                                <TouchableOpacity onPress={() => setShowDistrictModal(false)}>
                                    <Ionicons name="close" size={24} color="#333" />
                                </TouchableOpacity>
                            </View>
                            <ScrollView>
                                {getDistricts().map((district) => (
                                    <TouchableOpacity
                                        key={district}
                                        style={styles.modalItem}
                                        onPress={() => handleDistrictSelect(district)}
                                    >
                                        <Text style={styles.modalItemText}>
                                            {districtDisplayNames[district] || district}
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
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Select City</Text>
                                <TouchableOpacity onPress={() => setShowCityModal(false)}>
                                    <Ionicons name="close" size={24} color="#333" />
                                </TouchableOpacity>
                            </View>
                            <ScrollView>
                                {getCities().map((city) => (
                                    <TouchableOpacity
                                        key={city}
                                        style={styles.modalItem}
                                        onPress={() => handleCitySelect(city)}
                                    >
                                        <Text style={styles.modalItemText}>{city}</Text>
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
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Select Barangay</Text>
                                <TouchableOpacity onPress={() => setShowBarangayModal(false)}>
                                    <Ionicons name="close" size={24} color="#333" />
                                </TouchableOpacity>
                            </View>
                            <ScrollView>
                                {getBarangays().map((barangay: string) => (
                                    <TouchableOpacity
                                        key={barangay}
                                        style={styles.modalItem}
                                        onPress={() => handleBarangaySelect(barangay)}
                                    >
                                        <Text style={styles.modalItemText}>{barangay}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
        backgroundColor: "#fff",
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#333",
    },
    scrollView: {
        flex: 1,
        backgroundColor: "#f5f5f5",
    },
    rejectionBanner: {
        flexDirection: "row",
        backgroundColor: "#fff0f0",
        padding: 16,
        margin: 16,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: "#ff4444",
    },
    rejectionTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#ff4444",
        marginBottom: 4,
    },
    rejectionText: {
        fontSize: 14,
        color: "#333",
        marginBottom: 8,
    },
    rejectionHint: {
        fontSize: 12,
        color: "#666",
        fontStyle: "italic",
    },
    instructionBox: {
        flexDirection: "row",
        backgroundColor: "#f0f8f8",
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: "#008080",
    },
    instructionText: {
        flex: 1,
        fontSize: 14,
        color: "#333",
        marginLeft: 12,
        lineHeight: 20,
    },
    section: {
        backgroundColor: "#fff",
        padding: 16,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 12,
        color: "#666",
        marginBottom: 16,
    },
    fieldContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: "#333",
        marginBottom: 8,
    },
    required: {
        color: "#ff4444",
    },
    input: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: "#fff",
    },
    datePickerButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        padding: 12,
        backgroundColor: "#fff",
    },
    datePickerText: {
        flex: 1,
        fontSize: 16,
        color: "#333",
        marginLeft: 8,
    },
    datePickerPlaceholder: {
        color: "#999",
    },
    locationButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        padding: 12,
        backgroundColor: "#fff",
    },
    locationButtonDisabled: {
        backgroundColor: "#f5f5f5",
        opacity: 0.6,
    },
    locationButtonText: {
        fontSize: 16,
        color: "#999",
    },
    locationButtonTextSelected: {
        fontSize: 16,
        color: "#333",
    },
    coordinatesText: {
        fontSize: 12,
        color: "#666",
        marginTop: 8,
        textAlign: "center",
    },
    geocodingIndicator: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
        backgroundColor: "#f0f8f8",
        borderRadius: 8,
        marginTop: 8,
    },
    geocodingText: {
        fontSize: 14,
        color: "#008080",
        marginLeft: 8,
    },
    uploadButton: {
        borderWidth: 2,
        borderColor: "#008080",
        borderStyle: "dashed",
        borderRadius: 12,
        padding: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f0f8f8",
    },
    uploadButtonText: {
        fontSize: 16,
        color: "#008080",
        fontWeight: "600",
        marginTop: 8,
    },
    uploadedPreview: {
        alignItems: "center",
    },
    previewImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 8,
    },
    previewImageId: {
        width: 160,
        height: 120,
        borderRadius: 8,
        marginBottom: 8,
    },
    uploadedText: {
        fontSize: 14,
        color: "#4caf50",
        fontWeight: "600",
    },
    submitButton: {
        backgroundColor: "#008080",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        borderRadius: 12,
        marginHorizontal: 16,
        marginTop: 20,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        fontSize: 18,
        fontWeight: "bold",
        color: "white",
        marginLeft: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: "80%",
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#333",
    },
    modalItem: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
    },
    modalItemText: {
        fontSize: 16,
        color: "#333",
    },
});
