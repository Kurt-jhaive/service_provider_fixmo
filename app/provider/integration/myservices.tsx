import {
    Poppins_400Regular,
    Poppins_600SemiBold,
    useFonts,
} from "@expo-google-fonts/poppins";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    getProviderServices,
    toggleServiceAvailability,
    updateService
} from "../../../src/api/services.api";
import { getCertificates } from "../../../src/api/certificates.api";
import type { Service } from "../../../src/types/service";
import type { Certificate } from "../../../src/types/certificate";
import certificateServicesJson from "../../assets/data/certificateservices.json";

type CertificateService = {
    id: string;
    title: string;
    services: {
        title: string;
        description: string;
        startingPrice: {
            min: number;
            max: number;
        };
    }[];
};

const certificateServices: CertificateService[] = certificateServicesJson;

export default function MyServices() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [services, setServices] = useState<Service[]>([]);
    const [certificates, setCertificates] = useState<Certificate[]>([]);
    const [expiredCertificateIds, setExpiredCertificateIds] = useState<number[]>([]);
    
    // Edit modal state
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [editDescription, setEditDescription] = useState("");
    const [editPrice, setEditPrice] = useState("");
    const [editWarrantyDays, setEditWarrantyDays] = useState("");
    const [priceRange, setPriceRange] = useState<{ min: number; max: number } | null>(null);
    const [updating, setUpdating] = useState(false);
    
    // Photo management state
    const [existingPhotos, setExistingPhotos] = useState<{id: number; imageUrl: string}[]>([]);
    const [photosToRemove, setPhotosToRemove] = useState<number[]>([]);
    const [newPhotos, setNewPhotos] = useState<{uri: string; name: string; type: string}[]>([]);

    let [fontsLoaded] = useFonts({
        Poppins_400Regular,
        Poppins_600SemiBold,
    });

    useEffect(() => {
        fetchServices();
    }, []);

    const fetchServices = async () => {
        try {
            const token = await AsyncStorage.getItem("providerToken");
            if (!token) {
                Alert.alert("Error", "Authentication required. Please log in again.");
                return;
            }

            // Fetch services
            const data = await getProviderServices(token);
            
            // Fetch certificates to check for expired ones
            const certsData = await getCertificates(token);
            setCertificates(certsData);
            
            // Check for expired certificates
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const expired = certsData
                .filter(cert => {
                    if (!cert.expiry_date) return false;
                    const expiryDate = new Date(cert.expiry_date);
                    expiryDate.setHours(0, 0, 0, 0);
                    return expiryDate < today;
                })
                .map(cert => cert.certificate_id);
            
            setExpiredCertificateIds(expired);
            console.log('Expired certificate IDs:', expired);
            
            // Normalize services and auto-deactivate services with expired certificates
            const normalizedData = data.map(service => {
                const isExpired = service.certificate_id && expired.includes(service.certificate_id);
                
                // If certificate is expired and service is active, force it to inactive
                const shouldBeActive = isExpired ? false : Boolean(service.servicelisting_isActive);
                
                if (isExpired && service.servicelisting_isActive) {
                    console.log(`⚠️ Service ${service.service_id} (${service.service_title}) has expired certificate ${service.certificate_id} - setting to inactive`);
                }
                
                return {
                    ...service,
                    servicelisting_isActive: shouldBeActive
                };
            });
            
            console.log('Fetched services:', normalizedData.map(s => ({
                id: s.service_id,
                title: s.service_title,
                isActive: s.servicelisting_isActive,
                isActiveType: typeof s.servicelisting_isActive,
                certificateId: s.certificate_id
            })));
            
            setServices(normalizedData);
            setLoading(false);
            setRefreshing(false);
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to load services");
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchServices();
    };

    const handleToggleActive = async (service: Service) => {
        try {
            // Check if this service's certificate is expired
            if (expiredCertificateIds.includes(service.certificate_id)) {
                const expiredCert = certificates.find(c => c.certificate_id === service.certificate_id);
                Alert.alert(
                    "Certificate Expired",
                    `Cannot activate this service because your certificate "${expiredCert?.certificate_name || 'certificate'}" has expired${expiredCert?.expiry_date ? ` on ${new Date(expiredCert.expiry_date).toLocaleDateString()}` : ''}.\n\nPlease resubmit a valid certificate to reactivate this service.`,
                    [
                        {
                            text: "Resubmit Certificate",
                            onPress: () => router.push("/provider/integration/addnewcertificate")
                        },
                        {
                            text: "Cancel",
                            style: "cancel"
                        }
                    ]
                );
                return;
            }

            const token = await AsyncStorage.getItem("providerToken");
            if (!token) {
                Alert.alert("Error", "Authentication required.");
                return;
            }

            console.log('Toggling service:', service.service_id, 'Current status:', service.servicelisting_isActive);

            const result = await toggleServiceAvailability(service.service_id, token);

            console.log('Toggle result:', result);

            // Ensure the returned value is a proper boolean
            const newIsActive = Boolean(result.servicelisting_isActive);

            // Update local state with the new status from backend
            setServices(services.map(s => 
                s.service_id === service.service_id 
                    ? { ...s, servicelisting_isActive: newIsActive }
                    : s
            ));

            Alert.alert(
                "Success",
                `Service ${newIsActive ? "activated" : "deactivated"} successfully!`
            );
        } catch (error: any) {
            console.error('Toggle error:', error);
            Alert.alert("Error", error.message || "Failed to update service status");
        }
    };

    const openEditModal = (service: Service) => {
        setSelectedService(service);
        setEditDescription(service.service_description);
        setEditPrice(service.service_startingprice.toString());
        setEditWarrantyDays(service.warranty_days?.toString() || "");
        
        // Initialize photos
        const photos = service.service_photos?.map((photo: any, index: number) => ({
            id: photo.id || index,
            imageUrl: typeof photo === 'string' ? photo : photo.imageUrl
        })) || [];
        setExistingPhotos(photos);
        setPhotosToRemove([]);
        setNewPhotos([]);

        // Find price range from certificateservices.json
        let foundRange: { min: number; max: number } | null = null;
        
        for (const cert of certificateServices) {
            const serviceDetail = cert.services.find(
                s => s.title.toLowerCase() === service.service_title.toLowerCase()
            );
            if (serviceDetail) {
                foundRange = serviceDetail.startingPrice;
                break;
            }
        }
        
        setPriceRange(foundRange);
        setEditModalVisible(true);
    };

    const handlePickPhotos = async () => {
        const remainingSlots = 5 - (existingPhotos.length - photosToRemove.length + newPhotos.length);
        
        if (remainingSlots <= 0) {
            Alert.alert("Photo Limit Reached", "You can have maximum 5 photos per service.");
            return;
        }

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.8,
                aspect: [16, 9],
            });

            if (!result.canceled && result.assets) {
                const photosToAdd = result.assets.slice(0, remainingSlots);
                const formattedPhotos = photosToAdd.map(asset => ({
                    uri: asset.uri,
                    name: asset.fileName || `photo_${Date.now()}.jpg`,
                    type: asset.type === 'image' ? 'image/jpeg' : 'image/jpeg',
                }));
                
                setNewPhotos([...newPhotos, ...formattedPhotos]);
                
                if (result.assets.length > remainingSlots) {
                    Alert.alert(
                        "Photo Limit", 
                        `Only ${remainingSlots} photo(s) can be added. Maximum 5 photos per service.`
                    );
                }
            }
        } catch (error) {
            console.error('Image picker error:', error);
            Alert.alert('Error', 'Failed to pick photos. Please try again.');
        }
    };

    const handleRemoveExistingPhoto = (photoId: number) => {
        Alert.alert(
            "Remove Photo",
            "Are you sure you want to remove this photo?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: () => {
                        setPhotosToRemove([...photosToRemove, photoId]);
                    }
                }
            ]
        );
    };

    const handleUndoRemovePhoto = (photoId: number) => {
        setPhotosToRemove(photosToRemove.filter(id => id !== photoId));
    };

    const handleRemoveNewPhoto = (index: number) => {
        setNewPhotos(newPhotos.filter((_, i) => i !== index));
    };

    const handleUpdateService = async () => {
        if (!selectedService) return;

        // Validation
        if (!editDescription || editDescription.trim() === "") {
            Alert.alert("Invalid Input", "Please provide a service description.");
            return;
        }
        if (!editPrice || isNaN(parseFloat(editPrice))) {
            Alert.alert("Invalid Input", "Please enter a valid price.");
            return;
        }
        
        // Validate warranty days if provided
        if (editWarrantyDays && editWarrantyDays.trim() !== "") {
            const warrantyNum = parseInt(editWarrantyDays);
            if (isNaN(warrantyNum) || warrantyNum < 7 || warrantyNum > 14) {
                Alert.alert("Invalid Warranty Days", "Warranty days must be between 7 and 14 days.");
                return;
            }
        }

        const priceNum = parseFloat(editPrice);

        // Validate price range if available
        if (priceRange) {
            if (priceNum < priceRange.min || priceNum > priceRange.max) {
                Alert.alert(
                    "Price Out of Range",
                    `Starting price must be between ₱${priceRange.min} and ₱${priceRange.max} for this service.`
                );
                return;
            }
        }
        
        // Validate photo count
        const finalPhotoCount = existingPhotos.length - photosToRemove.length + newPhotos.length;
        if (finalPhotoCount > 5) {
            Alert.alert(
                "Too Many Photos",
                `Maximum 5 photos allowed. You currently have ${existingPhotos.length} photo(s), removing ${photosToRemove.length}, and adding ${newPhotos.length}.`
            );
            return;
        }
        
        if (finalPhotoCount === 0) {
            Alert.alert("No Photos", "Service must have at least one photo.");
            return;
        }

        setUpdating(true);

        try {
            const token = await AsyncStorage.getItem("providerToken");
            if (!token) {
                Alert.alert("Error", "Authentication required.");
                setUpdating(false);
                return;
            }

            const updateData: any = {
                service_description: editDescription.trim(),
                service_startingprice: priceNum,
            };
            
            // Add warranty days if provided
            if (editWarrantyDays && editWarrantyDays.trim() !== "") {
                updateData.warranty_days = parseInt(editWarrantyDays);
            }
            
            // Add photo changes if any
            if (photosToRemove.length > 0) {
                updateData.photosToRemove = photosToRemove;
            }
            if (newPhotos.length > 0) {
                updateData.newPhotos = newPhotos;
            }

            const updatedService = await updateService(selectedService.service_id, updateData, token);

            // Update local state with the full updated service from backend
            setServices(services.map(s =>
                s.service_id === selectedService.service_id
                    ? updatedService
                    : s
            ));

            setEditModalVisible(false);
            Alert.alert("Success", "Service updated successfully!");
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to update service");
        } finally {
            setUpdating(false);
        }
    };

    const getTotalPhotoCount = () => {
        return existingPhotos.length - photosToRemove.length + newPhotos.length;
        return existingPhotos.length - photosToRemove.length + newPhotos.length;
    };

    if (!fontsLoaded || loading) {
        return (
            <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
                <StatusBar barStyle="dark-content" />
                <ActivityIndicator size="large" color="#1e6355" />
                <Text style={styles.loadingText}>Loading services...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" />
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push("/provider/integration/fixmoto")}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Services</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContainer}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {services.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="briefcase-outline" size={80} color="#ccc" />
                        <Text style={styles.emptyText}>No services added yet</Text>
                        <TouchableOpacity
                            style={styles.addServiceButton}
                            onPress={() => router.push("/provider/onboarding/services")}
                        >
                            <Text style={styles.addServiceButtonText}>Add Service</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {services.map((service) => {
                            const isExpired = expiredCertificateIds.includes(service.certificate_id);
                            const expiredCert = isExpired 
                                ? certificates.find(c => c.certificate_id === service.certificate_id)
                                : null;
                            
                            return (
                            <View key={service.service_id} style={styles.serviceCard}>
                                {/* Expired Certificate Banner */}
                                {isExpired && (
                                    <View style={styles.expiredBanner}>
                                        <Ionicons name="alert-circle" size={20} color="#D32F2F" />
                                        <View style={{flex: 1, marginLeft: 8}}>
                                            <Text style={styles.expiredBannerTitle}>Certificate Expired</Text>
                                            <Text style={styles.expiredBannerText}>
                                                {expiredCert?.certificate_name} expired on {expiredCert?.expiry_date ? new Date(expiredCert.expiry_date).toLocaleDateString() : 'N/A'}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => router.push("/provider/integration/addnewcertificate")}
                                            style={styles.expiredBannerButton}
                                        >
                                            <Text style={styles.expiredBannerButtonText}>Resubmit</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Service Header */}
                                <View style={styles.serviceHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.serviceTitle}>
                                            {service.service_title}
                                        </Text>
                                        <Text style={styles.servicePrice}>
                                            ₱{service.service_startingprice}
                                        </Text>
                                        {service.warranty_days !== undefined && service.warranty_days > 0 && (
                                            <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 4}}>
                                                <Ionicons name="shield-checkmark" size={14} color="#1e6355" />
                                                <Text style={{fontSize: 12, color: "#666", marginLeft: 4}}>
                                                    {service.warranty_days} days warranty
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.switchContainer}>
                                        <Text style={[styles.switchLabel, isExpired && {color: '#D32F2F'}]}>
                                            {service.servicelisting_isActive ? "Active" : "Inactive"}
                                        </Text>
                                        <Switch
                                            value={service.servicelisting_isActive}
                                            onValueChange={() => handleToggleActive(service)}
                                            trackColor={{ false: "#ccc", true: isExpired ? "#ccc" : "#1e6355" }}
                                            thumbColor={isExpired ? "#D32F2F" : "#fff"}
                                            disabled={isExpired}
                                        />
                                    </View>
                                </View>

                                {/* Service Description */}
                                <Text style={styles.serviceDescription} numberOfLines={3}>
                                    {service.service_description}
                                </Text>

                                {/* Service Images */}
                                {service.service_photos && service.service_photos.length > 0 && (
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        style={styles.imagesContainer}
                                    >
                                        {service.service_photos
                                            .filter((photo) => photo && typeof photo === 'string' && photo.trim() !== '')
                                            .map((photo, index) => (
                                                <Image
                                                    key={index}
                                                    source={{ uri: photo }}
                                                    style={styles.serviceImage}
                                                    onError={(error) => {
                                                        console.log('Image load error:', error.nativeEvent.error);
                                                    }}
                                                />
                                            ))
                                        }
                                    </ScrollView>
                                )}

                                {/* Edit Button */}
                                <TouchableOpacity
                                    style={styles.editButton}
                                    onPress={() => openEditModal(service)}
                                >
                                    <Ionicons name="create-outline" size={18} color="#1e6355" />
                                    <Text style={styles.editButtonText}>Edit Service</Text>
                                </TouchableOpacity>
                            </View>
                            );
                        })}
                    </>
                )}
            </ScrollView>

            {/* Floating Add Button - Only show when services exist */}
            {services.length > 0 && (
                <TouchableOpacity
                    style={styles.floatingAddButton}
                    onPress={() => router.push("/provider/onboarding/services")}
                >
                    <Ionicons name="add" size={32} color="#fff" />
                </TouchableOpacity>
            )}

            {/* Edit Modal */}
            <Modal
                visible={editModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Service</Text>
                            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                                <Ionicons name="close" size={28} color="#000" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView>
                            {selectedService && (
                                <>
                                    <Text style={styles.modalServiceTitle}>
                                        {selectedService.service_title}
                                    </Text>

                                    {/* Description */}
                                    <Text style={styles.label}>Description*</Text>
                                    <TextInput
                                        style={styles.textArea}
                                        multiline
                                        placeholder="Describe your service..."
                                        placeholderTextColor="#A0A0A0"
                                        value={editDescription}
                                        onChangeText={setEditDescription}
                                    />

                                    {/* Price */}
                                    <Text style={styles.label}>Starting Price (₱)*</Text>
                                    {priceRange && (
                                        <Text style={styles.priceRangeText}>
                                            Allowed range: ₱{priceRange.min} - ₱{priceRange.max}
                                        </Text>
                                    )}
                                    <TextInput
                                        style={styles.inputBox}
                                        keyboardType="numeric"
                                        placeholder="Enter starting price"
                                        placeholderTextColor="#A0A0A0"
                                        value={editPrice}
                                        onChangeText={setEditPrice}
                                    />

                                    {/* Warranty Days */}
                                    <Text style={styles.label}>Warranty Days (7-14)</Text>
                                    <TextInput
                                        style={styles.inputBox}
                                        keyboardType="numeric"
                                        placeholder="Enter warranty days (optional)"
                                        placeholderTextColor="#A0A0A0"
                                        value={editWarrantyDays}
                                        onChangeText={(val) => {
                                            const numericValue = val.replace(/[^0-9]/g, '');
                                            setEditWarrantyDays(numericValue);
                                        }}
                                        maxLength={2}
                                    />

                                    {/* Photo Management */}
                                    <Text style={styles.label}>
                                        Service Photos ({getTotalPhotoCount()} of 5)
                                    </Text>
                                    
                                    {/* Existing Photos */}
                                    <View style={styles.photoGrid}>
                                        {existingPhotos.map((photo) => {
                                            const isMarkedForRemoval = photosToRemove.includes(photo.id);
                                            return (
                                                <View key={photo.id} style={styles.photoContainer}>
                                                    <Image 
                                                        source={{ uri: photo.imageUrl }} 
                                                        style={[
                                                            styles.photoThumbnail,
                                                            isMarkedForRemoval && styles.photoMarkedForRemoval
                                                        ]} 
                                                    />
                                                    {isMarkedForRemoval ? (
                                                        <TouchableOpacity
                                                            style={styles.undoButton}
                                                            onPress={() => handleUndoRemovePhoto(photo.id)}
                                                        >
                                                            <Ionicons name="arrow-undo" size={18} color="#fff" />
                                                        </TouchableOpacity>
                                                    ) : (
                                                        <TouchableOpacity
                                                            style={styles.removePhotoButton}
                                                            onPress={() => handleRemoveExistingPhoto(photo.id)}
                                                        >
                                                            <Ionicons name="close-circle" size={24} color="#ff6b6b" />
                                                        </TouchableOpacity>
                                                    )}
                                                    {isMarkedForRemoval && (
                                                        <View style={styles.removedOverlay}>
                                                            <Text style={styles.removedText}>To be removed</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            );
                                        })}
                                        
                                        {/* New Photos */}
                                        {newPhotos.map((photo, index) => (
                                            <View key={`new-${index}`} style={styles.photoContainer}>
                                                <Image 
                                                    source={{ uri: photo.uri }} 
                                                    style={styles.photoThumbnail} 
                                                />
                                                <TouchableOpacity
                                                    style={styles.removePhotoButton}
                                                    onPress={() => handleRemoveNewPhoto(index)}
                                                >
                                                    <Ionicons name="close-circle" size={24} color="#ff6b6b" />
                                                </TouchableOpacity>
                                                <View style={styles.newBadge}>
                                                    <Text style={styles.newBadgeText}>NEW</Text>
                                                </View>
                                            </View>
                                        ))}
                                        
                                        {/* Add Photo Button */}
                                        {getTotalPhotoCount() < 5 && (
                                            <TouchableOpacity
                                                style={styles.addPhotoButton}
                                                onPress={handlePickPhotos}
                                            >
                                                <Ionicons name="add-circle-outline" size={32} color="#1e6355" />
                                                <Text style={styles.addPhotoText}>Add Photo</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    {getTotalPhotoCount() === 0 && (
                                        <Text style={styles.photoWarning}>
                                            ⚠️ Service must have at least one photo
                                        </Text>
                                    )}

                                    {/* Update Button */}
                                    <TouchableOpacity
                                        style={[styles.updateButton, updating && { opacity: 0.6 }]}
                                        onPress={handleUpdateService}
                                        disabled={updating}
                                    >
                                        {updating ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <Text style={styles.updateButtonText}>Update Service</Text>
                                        )}
                                    </TouchableOpacity>
                                </>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#ddd",
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: "Poppins_600SemiBold",
    },
    scrollContainer: {
        padding: 16,
        paddingBottom: 100,
    },
    loadingText: {
        marginTop: 12,
        fontFamily: "Poppins_400Regular",
        color: "#666",
    },
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        fontFamily: "Poppins_400Regular",
        color: "#888",
        marginTop: 16,
        marginBottom: 24,
    },
    addServiceButton: {
        backgroundColor: "#1e6355",
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 30,
    },
    addServiceButtonText: {
        color: "#fff",
        fontFamily: "Poppins_600SemiBold",
        fontSize: 14,
    },
    floatingAddButton: {
        position: "absolute",
        bottom: 24,
        right: 24,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "#1e6355",
        justifyContent: "center",
        alignItems: "center",
        elevation: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    serviceCard: {
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#e0e0e0",
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    serviceHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 12,
    },
    serviceTitle: {
        fontSize: 16,
        fontFamily: "Poppins_600SemiBold",
        color: "#000",
        marginBottom: 4,
    },
    servicePrice: {
        fontSize: 18,
        fontFamily: "Poppins_600SemiBold",
        color: "#1e6355",
    },
    switchContainer: {
        alignItems: "flex-end",
    },
    switchLabel: {
        fontSize: 12,
        fontFamily: "Poppins_400Regular",
        color: "#666",
        marginBottom: 4,
    },
    serviceDescription: {
        fontSize: 14,
        fontFamily: "Poppins_400Regular",
        color: "#666",
        marginBottom: 12,
        lineHeight: 20,
    },
    imagesContainer: {
        marginBottom: 12,
    },
    serviceImage: {
        width: 100,
        height: 100,
        borderRadius: 8,
        marginRight: 8,
    },
    editButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#e0f7f7",
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginTop: 8,
    },
    editButtonText: {
        fontSize: 14,
        fontFamily: "Poppins_600SemiBold",
        color: "#1e6355",
        marginLeft: 6,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: "80%",
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontFamily: "Poppins_600SemiBold",
    },
    modalServiceTitle: {
        fontSize: 16,
        fontFamily: "Poppins_600SemiBold",
        color: "#1e6355",
        marginBottom: 20,
    },
    label: {
        fontFamily: "Poppins_400Regular",
        fontSize: 14,
        marginBottom: 6,
        marginTop: 12,
    },
    priceRangeText: {
        fontSize: 12,
        fontFamily: "Poppins_400Regular",
        color: "#1e6355",
        marginBottom: 8,
    },
    textArea: {
        borderWidth: 1,
        borderColor: "#E0E0E0",
        borderRadius: 12,
        padding: 12,
        minHeight: 100,
        textAlignVertical: "top",
        fontFamily: "Poppins_400Regular",
    },
    inputBox: {
        borderWidth: 1,
        borderColor: "#E0E0E0",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontFamily: "Poppins_400Regular",
    },
    updateButton: {
        backgroundColor: "#1e6355",
        paddingVertical: 14,
        borderRadius: 30,
        alignItems: "center",
        marginTop: 24,
        marginBottom: 20,
    },
    updateButtonText: {
        color: "#fff",
        fontFamily: "Poppins_600SemiBold",
        fontSize: 16,
    },
    expiredBanner: {
        backgroundColor: "#FFEBEE",
        padding: 12,
        borderRadius: 8,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: "#D32F2F",
    },
    expiredBannerTitle: {
        fontSize: 14,
        fontFamily: "Poppins_600SemiBold",
        color: "#D32F2F",
        marginBottom: 2,
    },
    expiredBannerText: {
        fontSize: 12,
        fontFamily: "Poppins_400Regular",
        color: "#C62828",
    },
    expiredBannerButton: {
        backgroundColor: "#D32F2F",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    expiredBannerButtonText: {
        color: "#fff",
        fontSize: 12,
        fontFamily: "Poppins_600SemiBold",
    },
    // Photo Management Styles
    photoGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        marginTop: 8,
        marginBottom: 16,
    },
    photoContainer: {
        width: 100,
        height: 100,
        position: "relative",
    },
    photoThumbnail: {
        width: 100,
        height: 100,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: "#E0E0E0",
    },
    photoMarkedForRemoval: {
        opacity: 0.4,
    },
    removePhotoButton: {
        position: "absolute",
        top: -8,
        right: -8,
        backgroundColor: "#fff",
        borderRadius: 12,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    undoButton: {
        position: "absolute",
        top: -8,
        right: -8,
        backgroundColor: "#FF9800",
        borderRadius: 12,
        padding: 4,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    removedOverlay: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "rgba(255, 107, 107, 0.9)",
        padding: 4,
        borderBottomLeftRadius: 6,
        borderBottomRightRadius: 6,
    },
    removedText: {
        color: "#fff",
        fontSize: 10,
        fontFamily: "Poppins_600SemiBold",
        textAlign: "center",
    },
    newBadge: {
        position: "absolute",
        top: 4,
        left: 4,
        backgroundColor: "#4CAF50",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    newBadgeText: {
        color: "#fff",
        fontSize: 10,
        fontFamily: "Poppins_600SemiBold",
    },
    addPhotoButton: {
        width: 100,
        height: 100,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: "#1e6355",
        borderStyle: "dashed",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f0fafa",
    },
    addPhotoText: {
        fontSize: 12,
        color: "#1e6355",
        fontFamily: "Poppins_600SemiBold",
        marginTop: 4,
    },
    photoWarning: {
        fontSize: 12,
        color: "#ff6b6b",
        fontFamily: "Poppins_400Regular",
        marginTop: -8,
        marginBottom: 12,
        fontStyle: "italic",
    },
});
