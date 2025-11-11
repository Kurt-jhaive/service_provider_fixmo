import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import * as DocumentPicker from "expo-document-picker";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { uploadCertificate } from "../../../src/api/certificates.api";
import certificateServicesJson from "../../assets/data/certificateservices.json";

// ---------- Types ----------
type CertificateService = {
    id: string;
    title: string;
    services: {
        title: string;
        description: string;
    }[];
};

type Certificate = {
    type: string;
    number: string;
    expiry: Date | null;
    file: {
        uri: string;
        name: string;
        type: string;
        size?: number;
    } | null;
};

// ---------- Data ----------
const certificateServices: CertificateService[] = certificateServicesJson;

export default function AddNewCertificate() {
    const router = useRouter();
    const [certificate, setCertificate] = useState<Certificate>({
        type: "",
        number: "",
        expiry: null,
        file: null,
    });
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Prevent back to OTP screen - navigate to profile instead
    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                router.replace('/provider/onboarding/providerprofile');
                return true;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

            return () => subscription.remove();
        }, [])
    );

    const handleAdd = async () => {
        // Validation - ALL fields are now required
        if (!certificate.type) {
            Alert.alert("Required Field", "Please select a certificate type.");
            return;
        }
        if (!certificate.number || certificate.number.trim() === "") {
            Alert.alert("Required Field", "Please enter the certificate number.");
            return;
        }
        if (!certificate.expiry) {
            Alert.alert("Required Field", "Please select an expiry date.");
            return;
        }
        if (!certificate.file) {
            Alert.alert("Required Field", "Please upload the certificate file.");
            return;
        }

        setUploading(true);

        try {
            const token = await AsyncStorage.getItem('providerToken');
            if (!token) {
                Alert.alert('Error', 'Authentication required. Please log in again.');
                setUploading(false);
                return;
            }

            const certificateData = {
                certificate_name: certificate.type,
                certificate_number: certificate.number.trim(),
                expiry_date: certificate.expiry.toISOString().split('T')[0],
                certificateFile: {
                    uri: certificate.file.uri,
                    name: certificate.file.name,
                    type: certificate.file.type,
                },
            };

            await uploadCertificate(certificateData, token);

            Alert.alert(
                'Success',
                'Certificate uploaded successfully!',
                [
                    {
                        text: 'OK',
                        onPress: () => router.push('/provider/onboarding/mycertificate'),
                    },
                ]
            );
        } catch (error: any) {
            // Handle errors including duplicate certificates
            const errorMessage = error.message || 'Failed to upload certificate';
            
            // Check if it's a duplicate certificate error
            if (errorMessage.toLowerCase().includes('duplicate') || 
                errorMessage.toLowerCase().includes('already have')) {
                Alert.alert(
                    'Certificate Already Exists', 
                    'You already have this certificate type. You can only upload a new certificate if your existing one is rejected or expired. Please check your certificates list.',
                    [
                        {
                            text: 'View Certificates',
                            onPress: () => router.push('/provider/onboarding/mycertificate'),
                        },
                        {
                            text: 'Cancel',
                            style: 'cancel',
                        }
                    ]
                );
            } else if (errorMessage.toLowerCase().includes('already exists') ||
                errorMessage.toLowerCase().includes('already uploaded')) {
                Alert.alert(
                    'Duplicate Certificate', 
                    'This certificate has already been uploaded to your account.'
                );
            } else {
                Alert.alert('Upload Error', errorMessage);
            }
        } finally {
            setUploading(false);
        }
    };

    return (
        <SafeAreaView style={{flex: 1, backgroundColor: "#fff"}}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.replace('/provider/onboarding/mycertificate')}>
                    <Ionicons name="arrow-back" size={24} color="#333"/>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add Certificate</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.contentWrapper}>
                    <View style={styles.section}>
                        <View style={styles.labelRow}>
                            <Text style={styles.title}>Certificate Type</Text>
                            <Text style={styles.required}>*</Text>
                        </View>
                        <View style={styles.pickerWrapper}>
                            <Picker
                                selectedValue={certificate.type}
                                onValueChange={(val) => setCertificate({...certificate, type: val})}
                            >
                                <Picker.Item label="Select Certificate" value=""/>
                                {certificateServices.map((cat, i) => (
                                    <Picker.Item key={i} label={cat.title} value={cat.title}/>
                                ))}
                            </Picker>
                        </View>

                        <View style={styles.labelRow}>
                            <Text style={styles.title}>Certificate Number</Text>
                            <Text style={styles.required}>*</Text>
                        </View>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter 14-digit certificate number"
                            value={certificate.number}
                            onChangeText={(val) => {
                                // Only allow numbers and limit to 14 digits
                                const numericValue = val.replace(/[^0-9]/g, '');
                                if (numericValue.length <= 14) {
                                    setCertificate({...certificate, number: numericValue});
                                }
                            }}
                            keyboardType="numeric"
                            maxLength={14}
                        />

                        <View style={styles.labelRow}>
                            <Text style={styles.title}>Expiry Date</Text>
                            <Text style={styles.required}>*</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setShowDatePicker(true)}
                            style={styles.input}
                        >
                            <Text style={certificate.expiry ? styles.dateText : styles.placeholderText}>
                                {certificate.expiry ? certificate.expiry.toDateString() : "Select expiry date"}
                            </Text>
                        </TouchableOpacity>

                        {showDatePicker && (
                            <DateTimePicker
                                value={certificate.expiry || new Date()}
                                mode="date"
                                display="default"
                                minimumDate={new Date()}
                                onChange={(event, selectedDate) => {
                                    setShowDatePicker(false);
                                    if (selectedDate) {
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        
                                        const selected = new Date(selectedDate);
                                        selected.setHours(0, 0, 0, 0);
                                        
                                        // Check if date is in the past
                                        if (selected < today) {
                                            Alert.alert(
                                                "Invalid Date",
                                                "Certificate expiry date cannot be in the past."
                                            );
                                            return;
                                        }
                                        
                                        // Check if certificate is expiring within 1 month (warning only)
                                        const oneMonthFromNow = new Date();
                                        oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
                                        oneMonthFromNow.setHours(0, 0, 0, 0);
                                        
                                        if (selected <= oneMonthFromNow) {
                                            Alert.alert(
                                                "Certificate Expiring Soon",
                                                "This certificate will expire within 1 month. You can still add it, but please renew it soon to avoid service interruption.",
                                                [
                                                    {
                                                        text: "OK",
                                                        onPress: () => {
                                                            setCertificate({...certificate, expiry: selectedDate});
                                                        }
                                                    }
                                                ]
                                            );
                                        } else {
                                            setCertificate({...certificate, expiry: selectedDate});
                                        }
                                    }
                                }}
                            />
                        )}

                        {/* Show expiry warning if date is within 1 month */}
                        {certificate.expiry && (() => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const expiry = new Date(certificate.expiry);
                            expiry.setHours(0, 0, 0, 0);
                            const oneMonthFromNow = new Date();
                            oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
                            oneMonthFromNow.setHours(0, 0, 0, 0);
                            
                            if (expiry <= oneMonthFromNow && expiry >= today) {
                                return (
                                    <View style={{backgroundColor: '#FFF3E0', padding: 10, borderRadius: 8, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8}}>
                                        <Ionicons name="warning" size={20} color="#FF9800" />
                                        <Text style={{color: '#E65100', fontSize: 12, flex: 1}}>
                                            Certificate expires soon. Please renew to avoid service interruption.
                                        </Text>
                                    </View>
                                );
                            }
                            return null;
                        })()}

                        <View style={styles.labelRow}>
                            <Text style={styles.title}>Upload Certificate File</Text>
                            <Text style={styles.required}>*</Text>
                        </View>
                        <View style={{alignItems: "center"}}>
                            <TouchableOpacity
                                onPress={async () => {
                                    try {
                                        const result = await DocumentPicker.getDocumentAsync({
                                            type: ["application/pdf", "image/*", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
                                            copyToCacheDirectory: true,
                                        });
                                        
                                        if (
                                            "assets" in result &&
                                            result.assets &&
                                            result.assets.length > 0
                                        ) {
                                            const file = result.assets[0];
                                            
                                            // Validate file size (10MB max)
                                            const maxSize = 10 * 1024 * 1024;
                                            if (file.size && file.size > maxSize) {
                                                Alert.alert('File Too Large', 'Please select a file smaller than 10MB.');
                                                return;
                                            }
                                            
                                            setCertificate({
                                                ...certificate,
                                                file: {
                                                    uri: file.uri,
                                                    name: file.name,
                                                    type: file.mimeType || 'application/octet-stream',
                                                    size: file.size,
                                                }
                                            });
                                        }
                                    } catch (error) {
                                        console.error('Document picker error:', error);
                                        Alert.alert('Error', 'Failed to pick document. Please try again.');
                                    }
                                }}
                                style={styles.circleButton}
                            >
                                <Ionicons name="cloud-upload-outline" size={40} color="#008080"/>
                            </TouchableOpacity>
                        </View>

                        {certificate.file && (
                            <View>
                                <Text style={styles.note}>
                                    Selected File: {certificate.file.name}
                                </Text>
                                {certificate.file.size && (
                                    <Text style={styles.note}>
                                        Size: {(certificate.file.size / 1024 / 1024).toFixed(2)} MB
                                    </Text>
                                )}
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* Fixed Add Button */}
            <View style={styles.fixedButtonContainer}>
                <TouchableOpacity 
                    style={[styles.nextButton, uploading && styles.nextButtonDisabled]} 
                    onPress={handleAdd}
                    disabled={uploading}
                >
                    {uploading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.nextText}>Add</Text>
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
        backgroundColor: "#fff",
    },
    headerTitle: {fontSize: 18, fontWeight: "600", marginLeft: 12},
    scrollContainer: {
        flexGrow: 1,
        padding: 20,
        paddingBottom: 140,
    },
    contentWrapper: {flex: 1},
    section: {marginBottom: 40},
    labelRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 10,
    },
    title: {fontSize: 16, fontWeight: "bold", marginBottom: 8},
    required: {
        color: "red",
        fontSize: 16,
        fontWeight: "bold",
        marginLeft: 4,
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: "#eee",
        borderRadius: 30,
        padding: 12,
        fontSize: 16,
        backgroundColor: "#f0f0f0",
        marginTop: 10,
    },
    dateText: {
        color: "#000",
        fontSize: 16,
    },
    placeholderText: {
        color: "#999",
        fontSize: 16,
    },
    pickerWrapper: {
        borderWidth: 1,
        borderColor: "#eee",
        borderRadius: 30,
        backgroundColor: "#f0f0f0",
        marginTop: 10,
        overflow: "hidden",
    },
    circleButton: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "#f0f0f0",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 12,
    },
    note: {
        fontSize: 12, 
        color: "#888", 
        textAlign: "center", 
        marginTop: 4,
    },
    fixedButtonContainer: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        backgroundColor: "#fff",
    },
    nextButton: {
        backgroundColor: "#008080",
        paddingVertical: 14,
        borderRadius: 30,
        alignItems: "center",
    },
    nextButtonDisabled: {
        backgroundColor: "#ccc",
    },
    nextText: {color: "#fff", fontSize: 16, fontWeight: "bold"},
});
