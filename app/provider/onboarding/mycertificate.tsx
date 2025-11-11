import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    LayoutAnimation,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    UIManager,
    View,
} from "react-native";
import { getCertificates } from "../../../src/api/certificates.api";

type Certificate = {
    id: string;
    name: string;
    certificateNumber: string;
    uploadedAt: string;
    expiryDate: string;
    fileUri?: string;
    status: "Approved" | "Pending" | "Rejected" | "Expired";
};

if (Platform.OS === "android") {
    UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

export default function MyCertificates() {
    const router = useRouter();
    const [certificates, setCertificates] = useState<Certificate[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [mockCertificates] = useState<Certificate[]>([
        {
            id: "1",
            name: "Electrical NC II",
            certificateNumber: "ELEC12345",
            uploadedAt: "2025-06-01",
            expiryDate: "2027-06-01",
            status: "Approved",
            fileUri: "https://via.placeholder.com/150",
        },
        {
            id: "2",
            name: "Plumbing NC II",
            certificateNumber: "PLUM54321",
            uploadedAt: "2025-06-05",
            expiryDate: "2027-06-05",
            status: "Pending",
            fileUri: "https://via.placeholder.com/150",
        },
        {
            id: "3",
            name: "Aircon Servicing NC II",
            certificateNumber: "AC98765",
            uploadedAt: "2025-06-08",
            expiryDate: "2027-06-08",
            status: "Rejected",
            fileUri: "https://via.placeholder.com/150",
        },
    ]);

    const [activeTab, setActiveTab] = useState<"Approved" | "Pending" | "Rejected" | "Expired">("Approved");
    const [expandedCertId, setExpandedCertId] = useState<string | null>(null);

    useEffect(() => {
        fetchCertificates();
    }, []);

    const fetchCertificates = async () => {
        try {
            const token = await AsyncStorage.getItem('providerToken');
            if (!token) {
                Alert.alert('Error', 'Authentication required. Please log in again.');
                setCertificates(mockCertificates);
                setLoading(false);
                return;
            }

            const data = await getCertificates(token);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Map API data to local Certificate type
            const mappedData: Certificate[] = data.map(cert => {
                let status: "Approved" | "Pending" | "Rejected" | "Expired" = cert.certificate_status;
                
                // Check if certificate is expired
                if (cert.expiry_date) {
                    const expiryDate = new Date(cert.expiry_date);
                    expiryDate.setHours(0, 0, 0, 0);
                    
                    if (expiryDate < today && status === 'Approved') {
                        status = 'Expired';
                    }
                }

                return {
                    id: cert.certificate_id.toString(),
                    name: cert.certificate_name,
                    certificateNumber: cert.certificate_number,
                    uploadedAt: new Date(cert.created_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                    }),
                    expiryDate: cert.expiry_date 
                        ? new Date(cert.expiry_date).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                        }) 
                        : 'No expiry date',
                    fileUri: cert.certificate_file_path,
                    status: status as "Approved" | "Pending" | "Rejected" | "Expired",
                };
            });
            setCertificates(mappedData);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to load certificates');
            setCertificates(mockCertificates);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchCertificates();
    };

    const tabs: ("Approved" | "Pending" | "Rejected" | "Expired")[] = ["Approved", "Pending", "Rejected", "Expired"];
    const filteredCertificates = certificates.filter((c) => c.status === activeTab);

    const toggleCertificate = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedCertId(expandedCertId === id ? null : id);
    };

    const statusColors: Record<string, string> = {
        Approved: "#4CAF50",
        Pending: "#FBC02D",
        Rejected: "#E53935",
        Expired: "#FF6B6B",
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color="#00796B" />
                <Text style={styles.loadingText}>Loading certificates...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Certificates</Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabsRow}>
                {tabs.map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        onPress={() => setActiveTab(tab)}
                        style={styles.tabButton}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                            {tab}
                        </Text>
                        {activeTab === tab && <View style={styles.tabIndicator}/>}
                    </TouchableOpacity>
                ))}
            </View>

            {/* Certificates List */}
            <ScrollView 
                contentContainerStyle={{paddingBottom: 120, paddingHorizontal: 16}}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#00796B"]} />
                }
            >
                {filteredCertificates.length > 0 ? (
                    filteredCertificates.map((cert) => {
                        const isExpanded = expandedCertId === cert.id;
                        return (
                            <TouchableOpacity
                                key={cert.id}
                                style={[
                                    styles.card,
                                    isExpanded && styles.expandedCard,
                                    cert.status !== "Approved" && {backgroundColor: "#f2f2f2"} // fallback for non-approved
                                ]}
                                onPress={() => toggleCertificate(cert.id)}
                                activeOpacity={0.9}
                            >
                                <View style={[styles.statusTag, {backgroundColor: statusColors[cert.status]}]}>
                                    <Text style={styles.statusText}>
                                        {cert.status === "Approved" ? "Accepted" : cert.status}
                                    </Text>
                                </View>

                                <Text style={styles.cardTitle}>{cert.name}</Text>
                                <Text style={styles.cardText}>
                                    Certificate Number:{" "}
                                    <Text style={styles.cardHighlight}>{cert.certificateNumber}</Text>
                                </Text>
                                <Text style={styles.cardText}>Uploaded: {cert.uploadedAt}</Text>

                                {isExpanded && (
                                    <>
                                        <Text style={styles.cardText}>Expiry Date: {cert.expiryDate}</Text>
                                        {cert.fileUri && (
                                            <Image source={{uri: cert.fileUri}} style={styles.certificateImage}/>
                                        )}
                                        {cert.status === "Rejected" && (
                                            <TouchableOpacity 
                                                style={styles.resubmitButton}
                                                onPress={() => router.push('/provider/integration/addnewcertificate')}
                                            >
                                                <Ionicons name="cloud-upload-outline" size={18} color="#fff"/>
                                                <Text style={styles.resubmitText}>Submit New Certificate</Text>
                                            </TouchableOpacity>
                                        )}
                                        {cert.status === "Expired" && (
                                            <>
                                                <View style={styles.expiredWarning}>
                                                    <Ionicons name="alert-circle" size={20} color="#FF6B6B" />
                                                    <Text style={styles.expiredWarningText}>
                                                        This certificate has expired. Services linked to this certificate have been deactivated.
                                                    </Text>
                                                </View>
                                                <TouchableOpacity 
                                                    style={[styles.resubmitButton, {backgroundColor: "#FF6B6B"}]}
                                                    onPress={() => router.push('/provider/integration/addnewcertificate')}
                                                >
                                                    <Ionicons name="refresh-outline" size={18} color="#fff"/>
                                                    <Text style={styles.resubmitText}>Renew Certificate</Text>
                                                </TouchableOpacity>
                                            </>
                                        )}
                                    </>
                                )}
                            </TouchableOpacity>
                        );
                    })
                ) : (
                    <Text style={styles.placeholder}>No {activeTab} Certificates</Text>
                )}
            </ScrollView>

            {/* Floating Add Button */}
            <TouchableOpacity 
                style={styles.fabButton}
                onPress={() => router.push('/provider/integration/addnewcertificate')}
            >
                <Ionicons name="add" size={28} color="#fff"/>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
        paddingTop: 50,
    },
    centerContent: {
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        fontFamily: "Poppins-Regular",
        color: "#666",
    },

    // Header
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
        marginBottom: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: "Poppins-SemiBold",
        color: "#333",
    },

    // Tabs
    tabsRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        marginBottom: 16,
    },
    tabButton: {
        alignItems: "center",
        paddingVertical: 8,
    },
    tabText: {
        fontSize: 14,
        fontFamily: "Poppins-Medium",
        color: "#999",
    },
    tabTextActive: {
        fontFamily: "Poppins-SemiBold",
        color: "#00796B",
    },
    tabIndicator: {
        marginTop: 4,
        height: 2,
        width: "100%",
        backgroundColor: "#00796B",
        borderRadius: 2,
    },

    // Certificate Card
    card: {
        backgroundColor: "#f2f2f2",
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
    },
    expandedCard: {
        backgroundColor: "#e0f7f7",
    },
    statusTag: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: "flex-start",
        marginBottom: 8,
    },
    statusText: {
        color: "#fff",
        fontFamily: "Poppins-Bold",
        fontSize: 12,
    },
    cardTitle: {
        fontSize: 16,
        fontFamily: "Poppins-SemiBold",
        color: "#333",
        marginBottom: 4,
    },
    cardText: {
        fontSize: 14,
        fontFamily: "Poppins-Regular",
        color: "#555",
        marginTop: 4,
    },
    cardHighlight: {
        color: "#00796B",
        fontFamily: "Poppins-SemiBold",
    },
    certificateImage: {
        width: "100%",
        height: 200,
        borderRadius: 12,
        marginTop: 12,
        backgroundColor: "#f5f5f5",
    },
    resubmitButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#d32f2f",
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 12,
        gap: 8,
    },
    resubmitText: {
        color: "#fff",
        fontSize: 14,
        fontFamily: "Poppins-SemiBold",
    },
    expiredWarning: {
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: "#FFEBEE",
        padding: 12,
        borderRadius: 8,
        marginTop: 12,
        gap: 8,
        borderLeftWidth: 4,
        borderLeftColor: "#FF6B6B",
    },
    expiredWarningText: {
        flex: 1,
        fontSize: 13,
        fontFamily: "Poppins-Regular",
        color: "#C62828",
        lineHeight: 18,
    },

    // Placeholder
    placeholder: {
        textAlign: "center",
        color: "#999",
        marginTop: 30,
        fontFamily: "Poppins-Regular",
    },

    // Floating Add Button
    fabButton: {
        position: "absolute",
        bottom: 30,
        right: 20,
        backgroundColor: "#00796B",
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowOffset: {width: 0, height: 3},
        shadowRadius: 4,
        elevation: 5,
    },
});