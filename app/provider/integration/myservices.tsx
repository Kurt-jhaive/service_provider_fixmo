import {
    Poppins_400Regular,
    Poppins_600SemiBold,
    useFonts,
} from "@expo-google-fonts/poppins";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import {
    getProviderServices,
    toggleServiceAvailability,
    updateService
} from "../../../src/api/services.api";
import type { Service } from "../../../src/types/service";
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

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [services, setServices] = useState<Service[]>([]);
    
    // Edit modal state
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [editDescription, setEditDescription] = useState("");
    const [editPrice, setEditPrice] = useState("");
    const [priceRange, setPriceRange] = useState<{ min: number; max: number } | null>(null);
    const [updating, setUpdating] = useState(false);

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

            const data = await getProviderServices(token);
            setServices(data);
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
            const token = await AsyncStorage.getItem("providerToken");
            if (!token) {
                Alert.alert("Error", "Authentication required.");
                return;
            }

            const result = await toggleServiceAvailability(service.service_id, token);

            // Update local state with the new status from backend
            setServices(services.map(s => 
                s.service_id === service.service_id 
                    ? { ...s, servicelisting_isActive: result.servicelisting_isActive }
                    : s
            ));

            Alert.alert(
                "Success",
                `Service ${result.servicelisting_isActive ? "activated" : "deactivated"} successfully!`
            );
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to update service status");
        }
    };

    const openEditModal = (service: Service) => {
        setSelectedService(service);
        setEditDescription(service.service_description);
        setEditPrice(service.service_startingprice.toString());

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

        setUpdating(true);

        try {
            const token = await AsyncStorage.getItem("providerToken");
            if (!token) {
                Alert.alert("Error", "Authentication required.");
                setUpdating(false);
                return;
            }

            const updateData = {
                service_description: editDescription.trim(),
                service_startingprice: priceNum,
            };

            await updateService(selectedService.service_id, updateData, token);

            // Update local state
            setServices(services.map(s =>
                s.service_id === selectedService.service_id
                    ? { 
                        ...s, 
                        service_description: editDescription.trim(),
                        service_startingprice: priceNum
                    }
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

    if (!fontsLoaded || loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#1e6355" />
                <Text style={styles.loadingText}>Loading services...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push("/provider/onboarding/pre_homepage")}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push("/provider/onboarding/services")}>
                    <Text style={styles.headerTitle}>My Services</Text>
                </TouchableOpacity>
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
                        {services.map((service) => (
                            <View key={service.service_id} style={styles.serviceCard}>
                                {/* Service Header */}
                                <View style={styles.serviceHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.serviceTitle}>
                                            {service.service_title}
                                        </Text>
                                        <Text style={styles.servicePrice}>
                                            ₱{service.service_startingprice}
                                        </Text>
                                    </View>
                                    <View style={styles.switchContainer}>
                                        <Text style={styles.switchLabel}>
                                            {service.servicelisting_isActive ? "Active" : "Inactive"}
                                        </Text>
                                        <Switch
                                            value={service.servicelisting_isActive}
                                            onValueChange={() => handleToggleActive(service)}
                                            trackColor={{ false: "#ccc", true: "#1e6355" }}
                                            thumbColor="#fff"
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
                                        {service.service_photos.map((photo, index) => (
                                            <Image
                                                key={index}
                                                source={{ uri: photo }}
                                                style={styles.serviceImage}
                                            />
                                        ))}
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
                        ))}
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
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#e8e8e8",
        elevation: 3,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
    },
    serviceHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
    },
    serviceTitle: {
        fontSize: 18,
        fontFamily: "Poppins_600SemiBold",
        color: "#1a1a1a",
        marginBottom: 6,
        lineHeight: 24,
    },
    servicePrice: {
        fontSize: 20,
        fontFamily: "Poppins_600SemiBold",
        color: "#1e6355",
    },
    switchContainer: {
        alignItems: "flex-end",
    },
    switchLabel: {
        fontSize: 13,
        fontFamily: "Poppins_600SemiBold",
        color: "#666",
        marginBottom: 6,
    },
    serviceDescription: {
        fontSize: 14,
        fontFamily: "Poppins_400Regular",
        color: "#555",
        marginBottom: 16,
        lineHeight: 22,
    },
    imagesContainer: {
        marginBottom: 16,
        marginHorizontal: -4,
    },
    serviceImage: {
        width: 110,
        height: 110,
        borderRadius: 12,
        marginHorizontal: 4,
        borderWidth: 1,
        borderColor: "#e8e8e8",
    },
    editButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#e8f5f3",
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 10,
        marginTop: 8,
        borderWidth: 1,
        borderColor: "#d0ebe7",
    },
    editButtonText: {
        fontSize: 14,
        fontFamily: "Poppins_600SemiBold",
        color: "#1e6355",
        marginLeft: 8,
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
});
