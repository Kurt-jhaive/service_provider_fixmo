import {
    Poppins_400Regular,
    Poppins_600SemiBold,
    useFonts,
} from "@expo-google-fonts/poppins";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import * as SplashScreen from 'expo-splash-screen';
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { getCertificates } from "../../../src/api/certificates.api";
import { createService, getProviderServices } from "../../../src/api/services.api";
import certificateServicesJson from "../../assets/data/certificateservices.json";

// ---------- Types ----------
type ServiceDetail = {
    title: string;
    description: string;
    startingPrice: {
        min: number;
        max: number;
    };
};

type CertificateService = {
    id: string;
    title: string;
    services: ServiceDetail[];
};

type LocalCertificate = {
    id: number;
    title: string;
};

const certificateServices: CertificateService[] = certificateServicesJson;

export default function AddServices() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [approvedCertificates, setApprovedCertificates] = useState<LocalCertificate[]>([]);
    const [existingServices, setExistingServices] = useState<string[]>([]);
    const [availableServices, setAvailableServices] = useState<ServiceDetail[]>([]);
    const [selectedService, setSelectedService] = useState("");
    const [selectedServiceDetail, setSelectedServiceDetail] = useState<ServiceDetail | null>(null);
    const [selectedCertificate, setSelectedCertificate] = useState<LocalCertificate | null>(null);
    const [showApprovedList, setShowApprovedList] = useState(false);
    const [description, setDescription] = useState("");
    const [price, setPrice] = useState("");
    const [images, setImages] = useState<{uri: string; name: string; type: string}[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const token = await AsyncStorage.getItem('providerToken');
            if (!token) {
                Alert.alert('Error', 'Authentication required. Please log in again.');
                setLoading(false);
                return;
            }

            // Fetch approved certificates
            const certs = await getCertificates(token);
            const approved = certs.filter(c => c.certificate_status === 'Approved');
            
            const mappedCerts: LocalCertificate[] = approved.map(c => ({
                id: c.certificate_id,
                title: c.certificate_name,
            }));
            
            setApprovedCertificates(mappedCerts);

            // Auto-select if only one approved certificate
            if (mappedCerts.length === 1) {
                handleCertificateSelect(mappedCerts[0]);
            }

            // Fetch existing services to check for duplicates
            const services = await getProviderServices(token);
            const serviceTitles = services.map(s => s.service_title);
            setExistingServices(serviceTitles);

            setLoading(false);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to load data');
            setLoading(false);
        }
    };

    // Filter services based on selected certificate
    const handleCertificateSelect = (cert: LocalCertificate) => {
        setSelectedCertificate(cert);
        setShowApprovedList(false);
        setSelectedService("");
        setSelectedServiceDetail(null);
        setPrice("");

        console.log('Selected certificate:', cert.title);
        console.log('Available certificate services in JSON:', certificateServices.map(cs => cs.title));

        // Find matching certificate services (case-insensitive and normalize titles)
        // Try exact match first
        let certService = certificateServices.find(
            cs => cs.title.toLowerCase().trim() === cert.title.toLowerCase().trim()
        );

        // If no exact match, try partial match (contains)
        if (!certService) {
            certService = certificateServices.find(cs => {
                const certTitle = cert.title.toLowerCase().trim();
                const serviceTitle = cs.title.toLowerCase().trim();
                return certTitle.includes(serviceTitle) || serviceTitle.includes(certTitle);
            });
        }

        if (certService) {
            console.log('✅ Found certificate service:', certService.title, 'with', certService.services.length, 'services');
            // Filter out already added services
            const available = certService.services.filter(
                s => !existingServices.includes(s.title)
            );
            setAvailableServices(available);
            console.log('✅ Available services after filtering:', available.length, available.map(s => s.title));
        } else {
            console.log('❌ No matching certificate service found for:', cert.title);
            console.log('Available certificates:', certificateServices.map(cs => cs.title));
            setAvailableServices([]);
            Alert.alert(
                'Certificate Not Supported',
                `No services found for "${cert.title}". Please contact support to add services for this certificate.`,
                [{ text: 'OK' }]
            );
        }
    };

    // Handle service selection and set price range
    const handleServiceSelect = (serviceTitle: string) => {
        setSelectedService(serviceTitle);
        const service = availableServices.find(s => s.title === serviceTitle);
        setSelectedServiceDetail(service || null);
        setPrice(""); // Reset price when service changes
    };

    let [fontsLoaded] = useFonts({
        Poppins_400Regular,
        Poppins_600SemiBold,
    });
    if (!fontsLoaded) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" color="#1e6355" />
                <Text style={{ marginTop: 12, fontFamily: "Poppins_400Regular" }}>Loading...</Text>
            </SafeAreaView>
        );
    }

    // Pick image (max 5)
    const pickImage = async () => {
        if (images.length >= 5) {
            Alert.alert("Limit Reached", "You can upload up to 5 images only.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
        if (!result.canceled) {
            const asset = result.assets[0];
            setImages([...images, {
                uri: asset.uri,
                name: asset.fileName || `service_image_${Date.now()}.jpg`,
                type: asset.type === 'image' ? 'image/jpeg' : 'image/jpeg',
            }]);
        }
    };

    // Final submit with validation
    const handleAddServices = async () => {
        // Validation
        if (!selectedCertificate) {
            Alert.alert("Missing Certificate", "Please select a certificate.");
            return;
        }
        if (!selectedService) {
            Alert.alert("Missing Service", "Please select a service.");
            return;
        }
        if (!description || description.trim() === "") {
            Alert.alert("Missing Description", "Please provide a service description.");
            return;
        }
        if (!price || isNaN(parseFloat(price))) {
            Alert.alert("Invalid Price", "Please enter a valid price.");
            return;
        }
        if (images.length === 0) {
            Alert.alert("Missing Images", "Please upload at least one service image.");
            return;
        }

        // Check for duplicate service title
        if (existingServices.includes(selectedService)) {
            Alert.alert("Duplicate Service", "This service has already been added to your account.");
            return;
        }

        // Validate price range
        if (selectedServiceDetail) {
            const priceNum = parseFloat(price);
            const minPrice = selectedServiceDetail.startingPrice.min;
            const maxPrice = selectedServiceDetail.startingPrice.max;

            if (priceNum < minPrice || priceNum > maxPrice) {
                Alert.alert(
                    "Price Out of Range",
                    `Starting price must be between ₱${minPrice} and ₱${maxPrice} for this service.`
                );
                return;
            }
        }

        setUploading(true);

        try {
            const token = await AsyncStorage.getItem('providerToken');
            if (!token) {
                Alert.alert('Error', 'Authentication required. Please log in again.');
                setUploading(false);
                return;
            }

            // Find the category_id from certificateservices.json
            const certService = certificateServices.find(
                cs => cs.title.toLowerCase().trim() === selectedCertificate.title.toLowerCase().trim()
            );

            if (!certService) {
                Alert.alert('Error', 'Certificate service category not found.');
                setUploading(false);
                return;
            }

            const serviceData = {
                category_id: certService.id, // Use the id from certificateservices.json as string
                service_title: selectedService,
                service_description: description.trim(),
                service_startingprice: parseFloat(price),
                certificate_id: selectedCertificate.id,
                service_photos: images,
            } as any; // Type assertion since backend accepts string category_id

            console.log('Submitting service data:', {
                ...serviceData,
                photoCount: images.length,
            });

            await createService(serviceData, token);

            Alert.alert(
                'Success',
                'Service added successfully!',
                [
                    {
                        text: 'OK',
                        onPress: () => router.replace('./pre_homepage'),
                    },
                ]
            );
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to add service';
            if (errorMessage.toLowerCase().includes('duplicate') || 
                errorMessage.toLowerCase().includes('already exists')) {
                Alert.alert('Duplicate Service', 'This service has already been added.');
            } else {
                Alert.alert('Error', errorMessage);
            }
        } finally {
            setUploading(false);
        }
    };

    if (!fontsLoaded || loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" color="#1e6355" />
                <Text style={{ marginTop: 12, fontFamily: "Poppins_400Regular" }}>Loading...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push("/provider/integration/myservices")}>
                    <Text style={styles.headerTitle}>Add Services</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContainer}>
                {/* Certificates Section - FIRST */}
                <Text style={styles.label}>Certificate*</Text>
                <Text style={{ color: "#666", fontSize: 12, marginBottom: 8 }}>
                    Select which certificate this service is for
                </Text>
                {selectedCertificate ? (
                    <View style={styles.certificateCard}>
                        <Ionicons name="document-text-outline" size={20} color="#1e6355" />
                        <Text style={{ marginLeft: 8, flex: 1 }}>{selectedCertificate.title}</Text>
                        {approvedCertificates.length > 1 && (
                            <TouchableOpacity onPress={() => setShowApprovedList(!showApprovedList)}>
                                <Ionicons name="pencil" size={18} color="#1e6355" />
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <View>
                        <Text style={{ color: "#888", marginTop: 8, marginBottom: 8 }}>
                            No certificate selected.
                        </Text>
                        <TouchableOpacity
                            onPress={() => setShowApprovedList(!showApprovedList)}
                            style={styles.addButton}
                        >
                            <Text style={styles.addButtonText}>Select Certificate</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Show Approved Certificates Dropdown */}
                {showApprovedList && (
                    <View style={styles.dropdownWrapper}>
                        {approvedCertificates.length === 0 ? (
                            <Text style={{ padding: 12, color: '#888' }}>
                                No approved certificates found. Please upload and wait for approval.
                            </Text>
                        ) : (
                            approvedCertificates.map((cert) => (
                                <TouchableOpacity
                                    key={cert.id}
                                    style={styles.certOption}
                                    onPress={() => handleCertificateSelect(cert)}
                                >
                                    <Text>{cert.title}</Text>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                )}

                {/* Service Selection - SECOND (filtered based on certificate) */}
                {selectedCertificate && (
                    <>
                        <Text style={styles.label}>Service*</Text>
                        <Text style={{ color: "#666", fontSize: 12, marginBottom: 8 }}>
                            Choose from available services for {selectedCertificate.title}
                        </Text>
                        <View style={[
                            styles.pickerContainer,
                            availableServices.length === 0 && { backgroundColor: '#f5f5f5' }
                        ]}>
                            <Picker
                                selectedValue={selectedService}
                                onValueChange={(val) => handleServiceSelect(val)}
                                style={styles.picker}
                                enabled={availableServices.length > 0}
                            >
                                <Picker.Item 
                                    label={availableServices.length === 0 ? "No services available" : "Select a service"} 
                                    value="" 
                                />
                                {availableServices.map((srv, i) => (
                                    <Picker.Item key={i} label={srv.title} value={srv.title} />
                                ))}
                            </Picker>
                        </View>
                        
                        {/* Show price range when service is selected */}
                        {selectedServiceDetail && (
                            <Text style={styles.priceRange}>
                                Price range: ₱{selectedServiceDetail.startingPrice.min} - ₱{selectedServiceDetail.startingPrice.max}
                            </Text>
                        )}
                        
                        {availableServices.length === 0 && (
                            <Text style={{ color: "#ff6b6b", marginTop: 8, fontSize: 12 }}>
                                No services available for this certificate or all services have been added.
                            </Text>
                        )}
                    </>
                )}

                {/* Description */}
                <Text style={styles.label}>Service Description*</Text>
                <TextInput
                    style={styles.textArea}
                    multiline
                    placeholder="Describe your service..."
                    placeholderTextColor="#A0A0A0"
                    value={description}
                    onChangeText={setDescription}
                />

                {/* Image Upload */}
                <Text style={styles.label}>Service Image*</Text>
                <TouchableOpacity style={styles.imageUpload} onPress={pickImage}>
                    <Ionicons name="cloud-upload-outline" size={32} color="#1e6355" />
                    <Text style={styles.uploadText}>
                        Add up to 5 images {"\n"}(Landscape only)
                    </Text>
                </TouchableOpacity>
                <View style={styles.imageRow}>
                    {images.map((img, i) => (
                        <Image key={i} source={{ uri: img.uri }} style={styles.uploadedImage} />
                    ))}
                </View>

                {/* Price */}
                <Text style={styles.label}>Starting Price (₱)*</Text>
                <TextInput
                    style={styles.inputBox}
                    keyboardType="numeric"
                    placeholder="Enter starting price"
                    placeholderTextColor="#A0A0A0"
                    value={price}
                    onChangeText={setPrice}
                />
            </ScrollView>

            {/* Fixed Add Button */}
            <View style={styles.fixedButtonContainer}>
                <TouchableOpacity 
                    style={[styles.submitBtn, uploading && { opacity: 0.6 }]} 
                    onPress={handleAddServices}
                    disabled={uploading}
                >
                    {uploading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitText}>Add Services</Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#ddd",
        justifyContent: "center",
    },
    headerTitle: { fontSize: 18, fontFamily: "Poppins_600SemiBold" },
    scrollContainer: {
        flexGrow: 1,
        padding: 20,
        paddingBottom: 140,
    },
    label: {
        fontFamily: "Poppins_400Regular",
        fontSize: 14,
        marginBottom: 6,
        marginTop: 12,
    },
    priceRange: {
        fontFamily: "Poppins_400Regular",
        fontSize: 12,
        color: "#1e6355",
        marginTop: 4,
        marginBottom: 8,
    },
    inputBox: {
        borderWidth: 1,
        borderColor: "#E0E0E0",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 10,
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: "#E0E0E0",
        borderRadius: 12,
        marginBottom: 10,
        overflow: "hidden",
    },
    picker: {
        height: 50,
    },
    certificateCard: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        marginTop: 10,
        borderRadius: 10,
        backgroundColor: "#e0f7f7",
    },
    addButton: {
        backgroundColor: "#e0f7f7",
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 30,
        alignSelf: "center",
        marginTop: 20,
    },
    addButtonText: { color: "#1e6355", fontWeight: "bold", fontSize: 14 },
    dropdownWrapper: {
        marginTop: 10,
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 10,
        backgroundColor: "#fafafa",
    },
    certOption: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    textArea: {
        borderWidth: 1,
        borderColor: "#E0E0E0",
        borderRadius: 12,
        padding: 12,
        minHeight: 80,
        textAlignVertical: "top",
        fontFamily: "Poppins_400Regular",
    },
    imageUpload: {
        alignItems: "center",
        padding: 15,
        borderWidth: 1,
        borderColor: "#E0E0E0",
        borderRadius: 12,
        marginBottom: 10,
    },
    uploadText: {
        fontSize: 12,
        textAlign: "center",
        marginTop: 6,
        color: "#888",
        fontFamily: "Poppins_400Regular",
    },
    imageRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginVertical: 10,
    },
    uploadedImage: {
        width: 70,
        height: 70,
        borderRadius: 8,
        marginRight: 10,
    },
    fixedButtonContainer: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        backgroundColor: "#fff",
    },
    submitBtn: {
        backgroundColor: "#1e6355",
        paddingVertical: 14,
        borderRadius: 30,
        alignItems: "center",
    },
    submitText: {
        color: "#fff",
        fontFamily: "Poppins_600SemiBold",
        fontSize: 16,
    },
});
