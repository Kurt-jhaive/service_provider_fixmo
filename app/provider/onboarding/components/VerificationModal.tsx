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
import LocationMapPicker from "../../../../src/components/maps/LocationMapPicker";

const BACKEND_URL = API_CONFIG.BASE_URL;

// Philippines location data (NCR only)
const philippinesData = require("../../../assets/data/philippines.json");

interface VerificationModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    rejectionReason?: string;
    currentUserData?: {
        first_name?: string;
        last_name?: string;
        birthday?: string;
        location?: string;
        exact_location?: string;
        profile_photo?: string;
        valid_id?: string;
        uli?: string;
    };
}

const VerificationModal: React.FC<VerificationModalProps> = ({
    visible,
    onClose,
    onSuccess,
    rejectionReason,
    currentUserData,
}) => {
    const [firstName, setFirstName] = useState(currentUserData?.first_name || "");
    const [lastName, setLastName] = useState(currentUserData?.last_name || "");
    const [birthday, setBirthday] = useState<Date | null>(
        currentUserData?.birthday ? new Date(currentUserData.birthday) : null
    );
    const [uliNumber, setUliNumber] = useState(currentUserData?.uli || ""); // ULI field
    const [showUliTooltip, setShowUliTooltip] = useState(false); // ULI tooltip
    const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(
        currentUserData?.profile_photo || null
    );
    const [validIdUri, setValidIdUri] = useState<string | null>(currentUserData?.valid_id || null);
    const [isDatePickerVisible, setDatePickerVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Location cascading states (using NCR districts like editprofile)
    const [selectedDistrict, setSelectedDistrict] = useState("");
    const [selectedCity, setSelectedCity] = useState("");
    const [selectedBarangay, setSelectedBarangay] = useState("");
    const [showDistrictModal, setShowDistrictModal] = useState(false);
    const [showCityModal, setShowCityModal] = useState(false);
    const [showBarangayModal, setShowBarangayModal] = useState(false);
    const [isGeocoding, setIsGeocoding] = useState(false);
    
    // Location coordinates for map
    const [locationCoordinates, setLocationCoordinates] = useState<{ lat: number; lng: number } | undefined>();

    // District name mapping (same as editprofile)
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

    // Calculate age from birthday
    const calculateAge = (birthDate: Date): number => {
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    // Parse location on mount if currentUserData has location
    useEffect(() => {
        if (visible && currentUserData?.location && currentUserData?.exact_location) {
            // Parse location string (format: "Barangay, City, District")
            const parts = currentUserData.location.split(', ').map(p => p.trim());
            if (parts.length >= 3) {
                const barangay = parts[0];
                const city = parts[1];
                const districtDisplay = parts[2];
                
                // Find the matching district key from display name
                const districtKey = Object.keys(districtDisplayNames).find(
                    key => districtDisplayNames[key] === districtDisplay
                );
                
                if (districtKey) {
                    setSelectedDistrict(districtKey);
                    setSelectedCity(city);
                    setSelectedBarangay(barangay);
                }
            }
            
            // Parse exact_location (format: "lat,lng")
            const coords = currentUserData.exact_location.split(',').map(c => parseFloat(c.trim()));
            if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                setLocationCoordinates({ lat: coords[0], lng: coords[1] });
            }
        }
    }, [visible, currentUserData]);

    const pickProfilePhoto = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permission Denied", "Gallery permission is required");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setProfilePhotoUri(result.assets[0].uri);
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
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled) {
            setValidIdUri(result.assets[0].uri);
        }
    };

    // Location helper functions (NCR districts like editprofile)
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

    // Geocoding function (same as editprofile)
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
                } else {
                    // Default to Metro Manila center
                    setLocationCoordinates({
                        lat: 14.5995,
                        lng: 120.9842
                    });
                }
            }
        } catch (error) {
            console.error('Geocoding error:', error);
            // Default to Metro Manila center
            setLocationCoordinates({
                lat: 14.5995,
                lng: 120.9842
            });
        } finally {
            setIsGeocoding(false);
        }
    };

    const handleSubmit = async () => {
        // Validation
        if (!firstName.trim() || !lastName.trim()) {
            Alert.alert("Validation Error", "First name and last name are required");
            return;
        }

        if (!birthday) {
            Alert.alert("Validation Error", "Birthday is required");
            return;
        }

        if (!selectedDistrict || !selectedCity || !selectedBarangay) {
            Alert.alert("Validation Error", "Please select complete location (District, City, and Barangay)");
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

        // Validate ULI (required and must be 19 characters in format ULI-XXX-XX-XXX-XXXXX-XXX)
        if (!uliNumber || uliNumber.replace(/-/g, '').length < 19) {
            Alert.alert("Validation Error", "Please complete the ULI format: ULI-XXX-XX-XXX-XXXXX-XXX");
            return;
        }

        setSubmitting(true);

        try {
            const token = await AsyncStorage.getItem("providerToken");
            if (!token) {
                Alert.alert("Error", "Please login first");
                return;
            }

            const formData = new FormData();
            
            // Provider information fields (matching backend API spec)
            formData.append("provider_first_name", firstName);
            formData.append("provider_last_name", lastName);
            formData.append("provider_birthday", birthday.toISOString().split("T")[0]);
            formData.append("provider_uli", uliNumber);
            
            // Format location as "Barangay, City, District"
            const userLocation = `${selectedBarangay}, ${selectedCity}, ${districtDisplayNames[selectedDistrict] || selectedDistrict}`;
            formData.append("provider_location", userLocation);

            // Add exact_location from map coordinates
            formData.append("exact_location", `${locationCoordinates.lat},${locationCoordinates.lng}`);

            // Handle profile photo
            if (profilePhotoUri.startsWith("http")) {
                // Existing Cloudinary URL
                formData.append("profile_photo_url", profilePhotoUri);
            } else {
                // New photo selected
                const photoExt = profilePhotoUri.split(".").pop()?.toLowerCase() || "jpg";
                const photoType = photoExt === "png" ? "image/png" : "image/jpeg";
                formData.append("profile_photo", {
                    uri: Platform.OS === "android" ? profilePhotoUri : profilePhotoUri.replace("file://", ""),
                    type: photoType,
                    name: `profile_${Date.now()}.${photoExt}`,
                } as any);
            }

            // Handle valid ID
            if (validIdUri.startsWith("http")) {
                // Existing Cloudinary URL
                formData.append("valid_id_url", validIdUri);
            } else {
                // New ID selected
                const idExt = validIdUri.split(".").pop()?.toLowerCase() || "jpg";
                const idType = idExt === "png" ? "image/png" : "image/jpeg";
                formData.append("valid_id", {
                    uri: Platform.OS === "android" ? validIdUri : validIdUri.replace("file://", ""),
                    type: idType,
                    name: `valid_id_${Date.now()}.${idExt}`,
                } as any);
            }

            // Log formData for debugging
            console.log("=== Submitting Verification Resubmit ===");
            console.log("First Name:", firstName);
            console.log("Last Name:", lastName);
            console.log("ULI:", uliNumber);
            console.log("Birthday:", birthday.toISOString().split("T")[0]);
            console.log("Location:", userLocation);
            console.log("Exact Location:", `${locationCoordinates.lat},${locationCoordinates.lng}`);
            console.log("Profile Photo:", profilePhotoUri.startsWith("http") ? "URL" : "New Upload");
            console.log("Valid ID:", validIdUri.startsWith("http") ? "URL" : "New Upload");
            console.log("========================================");

            const response = await fetch(`${BACKEND_URL}/api/verification/provider/resubmit`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });

            const responseData = await response.json();
            console.log("Backend response:", responseData);

            if (response.ok) {
                Alert.alert(
                    "Success",
                    rejectionReason
                        ? "Verification documents resubmitted successfully! Your documents will be reviewed again."
                        : "Verification documents submitted successfully! Please wait for admin approval.",
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
                Alert.alert("Error", responseData.message || "Failed to submit verification");
                console.error("Submission error:", responseData);
            }
        } catch (error) {
            console.error("Error submitting verification:", error);
            Alert.alert("Error", "Network error while submitting verification");
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color="#008080" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        {rejectionReason ? "Re-verify Account" : "Submit Verification"}
                    </Text>
                    <View style={{ width: 40 }} />
                </View>

                {rejectionReason && (
                    <View style={styles.rejectionBanner}>
                        <Ionicons name="alert-circle" size={28} color="#ff4444" />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.rejectionTitle}>Previous Submission Rejected</Text>
                            <Text style={styles.rejectionReason}>{rejectionReason}</Text>
                            <Text style={styles.rejectionHint}>Please provide correct information below.</Text>
                        </View>
                    </View>
                )}

                <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
                    {/* Instructions */}
                    <View style={styles.instructionBox}>
                        <Ionicons name="information-circle" size={24} color="#008080" />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.instructionTitle}>Required Documents</Text>
                            <Text style={styles.instructionText}>
                                Please provide accurate information. All fields marked with * are required.
                            </Text>
                        </View>
                    </View>

                    {/* First Name */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            First Name <Text style={styles.required}>*</Text>
                        </Text>
                        <TextInput
                            style={styles.input}
                            value={firstName}
                            onChangeText={setFirstName}
                            placeholder="Enter first name"
                        />
                    </View>

                    {/* Last Name */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            Last Name <Text style={styles.required}>*</Text>
                        </Text>
                        <TextInput
                            style={styles.input}
                            value={lastName}
                            onChangeText={setLastName}
                            placeholder="Enter last name"
                        />
                    </View>

                    {/* Birthday */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            Birthday (Must be 18+) <Text style={styles.required}>*</Text>
                        </Text>
                        <TouchableOpacity
                            style={styles.dateButton}
                            onPress={() => setDatePickerVisible(true)}
                        >
                            <Ionicons name="calendar-outline" size={20} color="#008080" style={{ marginRight: 8 }} />
                            <Text style={[styles.dateButtonText, !birthday && styles.dateButtonPlaceholder]}>
                                {birthday ? birthday.toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                }) : "Select your birthday"}
                            </Text>
                        </TouchableOpacity>
                        {birthday && (
                            <Text style={styles.helperText}>
                                Age: {calculateAge(birthday)} years old
                            </Text>
                        )}
                    </View>

                    <DateTimePickerModal
                        isVisible={isDatePickerVisible}
                        mode="date"
                        onConfirm={(date) => {
                            const age = calculateAge(date);
                            if (age < 18) {
                                Alert.alert(
                                    'Invalid Age',
                                    'You must be at least 18 years old to register as a service provider.',
                                    [{ text: 'OK' }]
                                );
                                setDatePickerVisible(false);
                                return;
                            }
                            if (age > 100) {
                                Alert.alert(
                                    'Invalid Date',
                                    'Please enter a valid date of birth.',
                                    [{ text: 'OK' }]
                                );
                                setDatePickerVisible(false);
                                return;
                            }
                            setBirthday(date);
                            setDatePickerVisible(false);
                        }}
                        onCancel={() => setDatePickerVisible(false)}
                        maximumDate={(() => {
                            const eighteenYearsAgo = new Date();
                            eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
                            return eighteenYearsAgo;
                        })()}
                    />

                    {/* ULI Number */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            Unique Learner Identifier (ULI Format) <Text style={styles.required}>*</Text>
                        </Text>
                        <View style={styles.uliRow}>
                            <TextInput
                                style={[styles.input, { flex: 1 }]}
                                placeholder="ULI-XXX-XX-XXX-XXXXX-XXX"
                                keyboardType="default"
                                maxLength={29}
                                value={uliNumber}
                                onChangeText={(val) => {
                                    // Remove all non-alphanumeric characters except dashes
                                    let cleanText = val.replace(/[^A-Z0-9-]/gi, '').toUpperCase();
                                    
                                    // If user is deleting, just update with cleaned text
                                    if (cleanText.length < uliNumber.length) {
                                        setUliNumber(cleanText);
                                        return;
                                    }
                                    
                                    // Remove dashes to work with raw characters
                                    const rawText = cleanText.replace(/-/g, '');
                                    
                                    // Auto-add "ULI" prefix if not present
                                    let formatted = '';
                                    if (!rawText.startsWith('ULI')) {
                                        formatted = 'ULI';
                                        // Add the characters after ULI
                                        const remaining = rawText;
                                        
                                        // Format: ULI-MNG-03-062-03014-001
                                        // Positions: ULI(3)-MNG(3)-03(2)-062(3)-03014(5)-001(3) = 19 chars total
                                        if (remaining.length > 0) {
                                            formatted += '-' + remaining.substring(0, 3); // MNG
                                        }
                                        if (remaining.length > 3) {
                                            formatted += '-' + remaining.substring(3, 5); // 03
                                        }
                                        if (remaining.length > 5) {
                                            formatted += '-' + remaining.substring(5, 8); // 062
                                        }
                                        if (remaining.length > 8) {
                                            formatted += '-' + remaining.substring(8, 13); // 03014
                                        }
                                        if (remaining.length > 13) {
                                            formatted += '-' + remaining.substring(13, 16); // 001
                                        }
                                    } else {
                                        // If it already has ULI, format the entire string
                                        formatted = 'ULI';
                                        const remaining = rawText.substring(3);
                                        
                                        if (remaining.length > 0) {
                                            formatted += '-' + remaining.substring(0, 3);
                                        }
                                        if (remaining.length > 3) {
                                            formatted += '-' + remaining.substring(3, 5);
                                        }
                                        if (remaining.length > 5) {
                                            formatted += '-' + remaining.substring(5, 8);
                                        }
                                        if (remaining.length > 8) {
                                            formatted += '-' + remaining.substring(8, 13);
                                        }
                                        if (remaining.length > 13) {
                                            formatted += '-' + remaining.substring(13, 16);
                                        }
                                    }
                                    
                                    setUliNumber(formatted);
                                }}
                            />
                            <TouchableOpacity onPress={() => setShowUliTooltip(!showUliTooltip)}>
                                <Ionicons
                                    name="help-circle-outline"
                                    size={20}
                                    color="#008080"
                                />
                            </TouchableOpacity>
                        </View>
                        {showUliTooltip && (
                            <View style={styles.tooltipBox}>
                                <Text style={styles.tooltipText}>
                                    Unified Learner Identifier (ULI) issued by TESDA. Format: ULI-XXX-XX-XXX-XXXXX-XXX
                                </Text>
                            </View>
                        )}
                        {uliNumber && uliNumber.replace(/-/g, '').length < 19 && (
                            <Text style={styles.errorText}>
                                Complete format: ULI-XXX-XX-XXX-XXXXX-XXX ({uliNumber.replace(/-/g, '').length}/19 characters)
                            </Text>
                        )}
                    </View>

                    {/* Location Cascading - NCR Districts */}
                    <Text style={styles.sectionTitle}>Location (NCR Only)</Text>
                    
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>District *</Text>
                        <TouchableOpacity
                            style={styles.selectButton}
                            onPress={() => setShowDistrictModal(true)}
                        >
                            <Text style={selectedDistrict ? styles.selectText : styles.selectPlaceholder}>
                                {selectedDistrict ? districtDisplayNames[selectedDistrict] || selectedDistrict : "Select District"}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color="#666" />
                        </TouchableOpacity>
                    </View>

                    {selectedDistrict && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>City *</Text>
                            <TouchableOpacity
                                style={styles.selectButton}
                                onPress={() => setShowCityModal(true)}
                            >
                                <Text
                                    style={selectedCity ? styles.selectText : styles.selectPlaceholder}
                                >
                                    {selectedCity || "Select City"}
                                </Text>
                                <Ionicons name="chevron-down" size={20} color="#666" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {selectedCity && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Barangay *</Text>
                            <TouchableOpacity
                                style={styles.selectButton}
                                onPress={() => setShowBarangayModal(true)}
                            >
                                <Text style={selectedBarangay ? styles.selectText : styles.selectPlaceholder}>
                                    {selectedBarangay || "Select Barangay"}
                                </Text>
                                <Ionicons name="chevron-down" size={20} color="#666" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Map Pin Location */}
                    {selectedBarangay && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Pin Exact Location *</Text>
                            
                            {isGeocoding && (
                                <View style={styles.geocodingIndicator}>
                                    <ActivityIndicator size="small" color="#008080" />
                                    <Text style={styles.geocodingText}>Finding location...</Text>
                                </View>
                            )}
                            
                            {!locationCoordinates && !isGeocoding && (
                                <TouchableOpacity
                                    style={styles.geocodeButton}
                                    onPress={geocodeLocation}
                                >
                                    <Ionicons name="search" size={20} color="#008080" />
                                    <Text style={styles.geocodeButtonText}>Find Location on Map</Text>
                                </TouchableOpacity>
                            )}
                            
                            {locationCoordinates && (
                                <>
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
                                </>
                            )}
                        </View>
                    )}

                    {/* Profile Photo */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Profile Photo *</Text>
                        <TouchableOpacity style={styles.photoButton} onPress={pickProfilePhoto}>
                            {profilePhotoUri ? (
                                <Image source={{ uri: profilePhotoUri }} style={styles.photoPreview} />
                            ) : (
                                <View style={styles.photoPlaceholder}>
                                    <Ionicons name="camera" size={40} color="#999" />
                                    <Text style={styles.photoPlaceholderText}>Tap to upload</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Valid ID */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Valid ID *</Text>
                        <TouchableOpacity style={styles.photoButton} onPress={pickValidId}>
                            {validIdUri ? (
                                <Image source={{ uri: validIdUri }} style={styles.photoPreview} />
                            ) : (
                                <View style={styles.photoPlaceholder}>
                                    <Ionicons name="card" size={40} color="#999" />
                                    <Text style={styles.photoPlaceholderText}>Tap to upload</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>

                <TouchableOpacity
                    style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitButtonText}>Submit for Review</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Location Selection Modals */}
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
                                        {districtDisplayNames[district] || district}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

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
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 16,
        paddingTop: 50,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
        backgroundColor: "#fff",
    },
    closeButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#333",
    },
    rejectionBanner: {
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: "#fff0f0",
        padding: 16,
        margin: 16,
        marginBottom: 0,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#ff4444",
        borderLeftWidth: 4,
    },
    rejectionTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#ff4444",
        marginBottom: 6,
    },
    rejectionReason: {
        fontSize: 14,
        color: "#333",
        lineHeight: 20,
        marginBottom: 6,
    },
    rejectionHint: {
        fontSize: 12,
        color: "#666",
        fontStyle: "italic",
    },
    instructionBox: {
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: "#e8f5f7",
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: "#008080",
    },
    instructionTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#008080",
        marginBottom: 4,
    },
    instructionText: {
        fontSize: 13,
        color: "#333",
        lineHeight: 18,
    },
    form: {
        flex: 1,
        padding: 16,
        backgroundColor: "#f8f9fa",
    },
    inputGroup: {
        marginBottom: 20,
        backgroundColor: "#fff",
        padding: 16,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 10,
        color: "#333",
    },
    required: {
        color: "#ff4444",
        fontWeight: "700",
    },
    input: {
        borderWidth: 1,
        borderColor: "#e0e0e0",
        borderRadius: 8,
        padding: 14,
        fontSize: 16,
        color: "#333",
        backgroundColor: "#fff",
    },
    dateButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        padding: 12,
        backgroundColor: "#fff",
    },
    dateButtonText: {
        fontSize: 16,
        color: "#333",
        flex: 1,
    },
    dateButtonPlaceholder: {
        color: "#999",
    },
    helperText: {
        fontSize: 12,
        color: "#008080",
        marginTop: 6,
        fontStyle: "italic",
    },
    tooltipBox: {
        backgroundColor: "#e8f5f5",
        padding: 12,
        borderRadius: 8,
        marginBottom: 10,
        borderLeftWidth: 3,
        borderLeftColor: "#008080",
    },
    tooltipText: {
        fontSize: 13,
        color: "#333",
        lineHeight: 18,
    },
    errorText: {
        fontSize: 12,
        color: "#ff4444",
        marginTop: 6,
    },
    uliRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    selectButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        padding: 12,
    },
    selectText: {
        fontSize: 16,
        color: "#333",
    },
    selectPlaceholder: {
        fontSize: 16,
        color: "#999",
    },
    photoButton: {
        borderWidth: 2,
        borderColor: "#008080",
        borderRadius: 12,
        overflow: "hidden",
        borderStyle: "dashed",
    },
    photoPreview: {
        width: "100%",
        height: 220,
        resizeMode: "cover",
    },
    photoPlaceholder: {
        height: 220,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f0f8f8",
    },
    photoPlaceholderText: {
        marginTop: 12,
        fontSize: 15,
        color: "#008080",
        fontWeight: "600",
    },
    submitButton: {
        backgroundColor: "#008080",
        margin: 16,
        marginTop: 8,
        padding: 18,
        borderRadius: 12,
        alignItems: "center",
        shadowColor: "#008080",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#333",
        marginBottom: 16,
        marginTop: 8,
        paddingBottom: 8,
        borderBottomWidth: 2,
        borderBottomColor: "#008080",
    },
    coordinatesText: {
        fontSize: 13,
        color: "#008080",
        marginTop: 10,
        textAlign: "center",
        fontWeight: "600",
        backgroundColor: "#f0f8f8",
        padding: 8,
        borderRadius: 6,
    },
    geocodingIndicator: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
        backgroundColor: "#f0f8f8",
        borderRadius: 8,
        marginTop: 8,
        marginBottom: 12,
    },
    geocodingText: {
        fontSize: 14,
        color: "#008080",
        marginLeft: 8,
    },
    geocodeButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f0f8f8",
        padding: 16,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: "#008080",
        borderStyle: "dashed",
    },
    geocodeButtonText: {
        fontSize: 16,
        color: "#008080",
        fontWeight: "600",
        marginLeft: 8,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    locationModalContent: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        height: "70%",
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

export default VerificationModal;
