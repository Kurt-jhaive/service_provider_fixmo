import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
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

// Using arrays for API compatibility
type CertificateData = {
    certificateNames: string[];
    certificateNumbers: string[];
    expiryDates: string[];
    certificateFiles: string[];
};

type CertificateEntry = {
    name: string;
    number: string;
    expiry: Date | null;
    file: string | null;
};

// ---------- Data ----------//
const certificateServices: CertificateService[] = certificateServicesJson;

export default function RequirementsUpload() {
    const router = useRouter();
    const params = useLocalSearchParams();

    // Professional Info - Initialize from params if navigating back
    const [uliNumber, setUliNumber] = useState((params.savedUliNumber as string) || "");
    const [showTooltip, setShowTooltip] = useState(false);

    // Professions and Experiences - Initialize from params
    const [professions, setProfessions] = useState<string[]>(
        params.savedProfessions 
            ? JSON.parse(params.savedProfessions as string)
            : [""]
    );
    const [experiences, setExperiences] = useState<string[]>(
        params.savedExperiences 
            ? JSON.parse(params.savedExperiences as string)
            : [""]
    );

    // Security - Initialize from params if navigating back
    const [password, setPassword] = useState((params.savedPassword as string) || "");
    const [confirmPassword, setConfirmPassword] = useState((params.savedConfirmPassword as string) || "");

    // TESDA Certificates - Initialize from params if navigating back
    const [certificates, setCertificates] = useState<CertificateEntry[]>(
        params.savedCertificates 
            ? JSON.parse(params.savedCertificates as string)
            : [{name: "", number: "", expiry: null, file: null}]
    );

    const [showDatePicker, setShowDatePicker] = useState<number | null>(null);

    // Add new certificate
    const addCertificate = () => {
        setCertificates([
            ...certificates,
            {name: "", number: "", expiry: null, file: null},
        ]);
    };

    // Add profession field
    const addProfession = () => {
        setProfessions([...professions, ""]);
    };

    // Remove profession field
    const removeProfession = (index: number) => {
        if (professions.length > 1) {
            setProfessions(professions.filter((_, i) => i !== index));
        }
    };

    // Add experience field
    const addExperience = () => {
        setExperiences([...experiences, ""]);
    };

    // Remove experience field
    const removeExperience = (index: number) => {
        if (experiences.length > 1) {
            setExperiences(experiences.filter((_, i) => i !== index));
        }
    };

    const isPasswordValid = (password: string) => {
        // Password must be 10-16 characters with uppercase, lowercase, number, and special character
        if (password.length < 10 || password.length > 16) return false;
        
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSpecialChar = /[\W_]/.test(password);
        
        return hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
    };

    // Get password validation status for dynamic feedback
    const getPasswordValidation = (password: string) => {
        return {
            length: password.length >= 10 && password.length <= 16,
            hasUpperCase: /[A-Z]/.test(password),
            hasLowerCase: /[a-z]/.test(password),
            hasNumber: /\d/.test(password),
            hasSpecialChar: /[\W_]/.test(password),
        };
    };

    const handleNext = () => {
        // Validate ULI format (19 characters without dashes)
        const cleanUli = uliNumber.replace(/-/g, '');
        if (cleanUli.length !== 19 || !cleanUli.startsWith('ULI')) {
            Alert.alert(
                "Invalid ULI",
                "ULI must be in format: ULI-MNG-03-062-03014-001"
            );
            return;
        }

        // Validate certificate numbers are 14 digits
        const invalidCertNumbers = certificates.filter(cert => cert.number && cert.number.length !== 14);
        if (invalidCertNumbers.length > 0) {
            Alert.alert(
                "Invalid Certificate Number",
                "All certificate numbers must be exactly 14 digits."
            );
            return;
        }

        if (
            !uliNumber ||
            !password ||
            !confirmPassword ||
            professions.some(p => !p.trim()) ||
            experiences.some(e => !e.trim()) ||
            certificates.some(
                (cert) =>
                    !cert.name || !cert.number || !cert.expiry || !cert.file
            )
        ) {
            Alert.alert(
                "Missing Information",
                "Please complete all required fields."
            );
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert("Password Mismatch", "Passwords do not match.");
            return;
        }

        if (!isPasswordValid(password)) {
            Alert.alert(
                "Invalid Password",
                "Password must be 10-16 characters and include uppercase, lowercase, number, and special character."
            );
            return;
        }

        // Convert certificates to arrays for API
        const certificateNames = certificates.map(c => c.name);
        const certificateNumbers = certificates.map(c => c.number);
        const expiryDates = certificates.map(c => 
            c.expiry ? c.expiry.toISOString().split('T')[0] : ''
        );
        const certificateFiles = certificates.map(c => c.file || '');

        router.push({
            pathname: "/provider/onboarding/applicationreview",
            params: {
                ...params,
                password,
                uliNumber,
                // Pass as comma-separated strings, not JSON arrays
                professions: professions.filter(p => p.trim()).join(','),
                experiences: experiences.filter(e => e.trim()).join(','),
                certificateNames: certificateNames.join(','),
                certificateNumbers: certificateNumbers.join(','),
                expiryDates: expiryDates.join(','),
                certificateFiles: certificateFiles.join(','),
                // Keep for back navigation
                savedCertificates: JSON.stringify(certificates),
                savedProfessions: JSON.stringify(professions),
                savedExperiences: JSON.stringify(experiences),
                savedUliNumber: uliNumber,
                savedPassword: password,
                savedConfirmPassword: confirmPassword,
            }
        });
    };

    return (
        <View style={{flex: 1}}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.contentWrapper}>
                    {/* Professional Info */}
                    <Text style={styles.sectionHeader}>Professional Information</Text>
                    <View style={styles.section}>
                        <Text style={styles.title}>Unique Learner Identifier (ULI Format)</Text>
                        <View style={styles.uliRow}>
                            <TextInput
                                style={styles.input}
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
                            <TouchableOpacity onPress={() => setShowTooltip(true)}>
                                <Ionicons
                                    name="help-circle-outline"
                                    size={20}
                                    color="#008080"
                                />
                            </TouchableOpacity>
                        </View>
                        {uliNumber && uliNumber.replace(/-/g, '').length < 19 && (
                            <Text style={{color: '#F44336', fontSize: 12, marginTop: 4}}>
                                Complete format: ULI-XXX-XX-XXX-XXXXX-XXX ({uliNumber.replace(/-/g, '').length}/19 characters)
                            </Text>
                        )}
                    </View>

                    {/* Professions */}
                    <Text style={styles.sectionHeader}>Professions</Text>
                    <View style={styles.section}>
                        {professions.map((profession, index) => (
                            <View key={index} style={{marginBottom: 10}}>
                                <View style={styles.fieldRow}>
                                    <TextInput
                                        style={[styles.input, {flex: 1}]}
                                        placeholder="e.g. Electrician, Plumber"
                                        value={profession}
                                        onChangeText={(val) => {
                                            const updated = [...professions];
                                            updated[index] = val;
                                            setProfessions(updated);
                                        }}
                                    />
                                    {professions.length > 1 && (
                                        <TouchableOpacity
                                            onPress={() => removeProfession(index)}
                                            style={{padding: 5}}
                                        >
                                            <Ionicons name="close-circle" size={24} color="#ff4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        ))}
                        <TouchableOpacity 
                            onPress={addProfession} 
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: 12,
                                backgroundColor: "#e0f7f4",
                                borderRadius: 8,
                                marginTop: 10,
                                gap: 8,
                            }}
                        >
                            <Ionicons name="add-circle-outline" size={20} color="#008080" />
                            <Text style={{color: "#008080", fontSize: 14, fontWeight: "600"}}>Add Another Profession</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Experiences */}
                    <Text style={styles.sectionHeader}>Years of Experience</Text>
                    <View style={styles.section}>
                        {experiences.map((experience, index) => (
                            <View key={index} style={{marginBottom: 10}}>
                                <View style={styles.fieldRow}>
                                    <TextInput
                                        style={[styles.input, {flex: 1}]}
                                        placeholder="e.g. 5"
                                        keyboardType="numeric"
                                        value={experience}
                                        onChangeText={(val) => {
                                            // Only allow numbers
                                            const numericText = val.replace(/[^0-9]/g, '');
                                            const updated = [...experiences];
                                            updated[index] = numericText;
                                            setExperiences(updated);
                                        }}
                                    />
                                    {experiences.length > 1 && (
                                        <TouchableOpacity
                                            onPress={() => removeExperience(index)}
                                            style={{padding: 5}}
                                        >
                                            <Ionicons name="close-circle" size={24} color="#ff4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        ))}
                        <TouchableOpacity 
                            onPress={addExperience} 
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: 12,
                                backgroundColor: "#e0f7f4",
                                borderRadius: 8,
                                marginTop: 10,
                                gap: 8,
                            }}
                        >
                            <Ionicons name="add-circle-outline" size={20} color="#008080" />
                            <Text style={{color: "#008080", fontSize: 14, fontWeight: "600"}}>Add More Experience</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Security */}
                    <Text style={styles.sectionHeader}>Security</Text>
                    <View style={styles.section}>
                        <Text style={styles.title}>Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter password"
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                        />
                        
                        {/* Dynamic Password Validation */}
                        {password.length > 0 && (
                            <View style={{marginTop: 8, marginBottom: 12}}>
                                <View style={styles.validationRow}>
                                    <Ionicons 
                                        name={getPasswordValidation(password).length ? "checkmark-circle" : "close-circle"} 
                                        size={16} 
                                        color={getPasswordValidation(password).length ? "#4CAF50" : "#F44336"} 
                                    />
                                    <Text style={[styles.validationText, {color: getPasswordValidation(password).length ? "#4CAF50" : "#F44336"}]}>
                                        10-16 characters
                                    </Text>
                                </View>
                                <View style={styles.validationRow}>
                                    <Ionicons 
                                        name={getPasswordValidation(password).hasUpperCase ? "checkmark-circle" : "close-circle"} 
                                        size={16} 
                                        color={getPasswordValidation(password).hasUpperCase ? "#4CAF50" : "#F44336"} 
                                    />
                                    <Text style={[styles.validationText, {color: getPasswordValidation(password).hasUpperCase ? "#4CAF50" : "#F44336"}]}>
                                        Uppercase letter (A-Z)
                                    </Text>
                                </View>
                                <View style={styles.validationRow}>
                                    <Ionicons 
                                        name={getPasswordValidation(password).hasLowerCase ? "checkmark-circle" : "close-circle"} 
                                        size={16} 
                                        color={getPasswordValidation(password).hasLowerCase ? "#4CAF50" : "#F44336"} 
                                    />
                                    <Text style={[styles.validationText, {color: getPasswordValidation(password).hasLowerCase ? "#4CAF50" : "#F44336"}]}>
                                        Lowercase letter (a-z)
                                    </Text>
                                </View>
                                <View style={styles.validationRow}>
                                    <Ionicons 
                                        name={getPasswordValidation(password).hasNumber ? "checkmark-circle" : "close-circle"} 
                                        size={16} 
                                        color={getPasswordValidation(password).hasNumber ? "#4CAF50" : "#F44336"} 
                                    />
                                    <Text style={[styles.validationText, {color: getPasswordValidation(password).hasNumber ? "#4CAF50" : "#F44336"}]}>
                                        Number (0-9)
                                    </Text>
                                </View>
                                <View style={styles.validationRow}>
                                    <Ionicons 
                                        name={getPasswordValidation(password).hasSpecialChar ? "checkmark-circle" : "close-circle"} 
                                        size={16} 
                                        color={getPasswordValidation(password).hasSpecialChar ? "#4CAF50" : "#F44336"} 
                                    />
                                    <Text style={[styles.validationText, {color: getPasswordValidation(password).hasSpecialChar ? "#4CAF50" : "#F44336"}]}>
                                        Special character (!@#$%^&*)
                                    </Text>
                                </View>
                            </View>
                        )}

                        <Text style={styles.title}>Confirm Password</Text>
                        <TextInput
                            style={[
                                styles.input,
                                confirmPassword.length > 0 && {
                                    borderColor: password === confirmPassword ? "#4CAF50" : "#F44336",
                                    borderWidth: 2,
                                }
                            ]}
                            placeholder="Confirm password"
                            secureTextEntry
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                        />
                        
                        {/* Password Match Indicator */}
                        {confirmPassword.length > 0 && (
                            <View style={styles.validationRow}>
                                <Ionicons 
                                    name={password === confirmPassword ? "checkmark-circle" : "close-circle"} 
                                    size={16} 
                                    color={password === confirmPassword ? "#4CAF50" : "#F44336"} 
                                />
                                <Text style={[styles.validationText, {color: password === confirmPassword ? "#4CAF50" : "#F44336"}]}>
                                    {password === confirmPassword ? "Passwords match" : "Passwords do not match"}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* TESDA Certificates */}
                    <Text style={styles.sectionHeader}>TESDA Certificates</Text>
                    {certificates.map((cert, index) => (
                        <View key={index} style={styles.section}>
                            <Text style={styles.title}>Certificate Type</Text>
                            <View style={styles.pickerWrapper}>
                                <Picker
                                    selectedValue={cert.name}
                                    onValueChange={(val) => {
                                        const updated = [...certificates];
                                        updated[index].name = val;
                                        setCertificates(updated);
                                    }}
                                >
                                    <Picker.Item label="Select Certificate" value=""/>
                                    {certificateServices.map(
                                        (cat: CertificateService, i: number) => (
                                            <Picker.Item
                                                key={i}
                                                label={cat.title}
                                                value={cat.title}
                                            />
                                        )
                                    )}
                                </Picker>
                            </View>

                            {/* Certificate Number */}
                            <Text style={styles.title}>Certificate Number (14 digits)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter 14-digit certificate number"
                                keyboardType="numeric"
                                maxLength={14}
                                value={cert.number}
                                onChangeText={(val) => {
                                    // Only allow numbers
                                    const numericText = val.replace(/[^0-9]/g, '');
                                    const updated = [...certificates];
                                    updated[index].number = numericText;
                                    setCertificates(updated);
                                }}
                            />
                            {cert.number && cert.number.length < 14 && (
                                <Text style={{color: '#F44336', fontSize: 12, marginTop: -8, marginBottom: 8}}>
                                    Certificate number must be 14 digits ({cert.number.length}/14)
                                </Text>
                            )}

                            {/* Expiry Date */}
                            <Text style={styles.title}>Expiry Date</Text>
                            <TouchableOpacity
                                onPress={() => setShowDatePicker(index)}
                                style={styles.input}
                            >
                                <Text>
                                    {cert.expiry
                                        ? cert.expiry.toDateString()
                                        : "Select expiry date"}
                                </Text>
                            </TouchableOpacity>

                            {showDatePicker === index && (
                                <DateTimePicker
                                    value={cert.expiry || new Date()}
                                    mode="date"
                                    display="default"
                                    onChange={(event, selectedDate) => {
                                        setShowDatePicker(null);
                                        if (selectedDate) {
                                            const updated = [...certificates];
                                            updated[index].expiry = selectedDate;
                                            setCertificates(updated);
                                        }
                                    }}
                                />
                            )}

                            {/* Upload Certificate */}
                            <Text style={styles.title}>Upload Certificate File</Text>
                            <TouchableOpacity
                                onPress={async () => {
                                    const result =
                                        await DocumentPicker.getDocumentAsync({
                                            type: "*/*",
                                            copyToCacheDirectory: true,
                                        });
                                    if (
                                        "assets" in result &&
                                        result.assets &&
                                        result.assets.length > 0
                                    ) {
                                        const updated = [...certificates];
                                        updated[index].file = result.assets[0].uri;
                                        setCertificates(updated);
                                    }
                                }}
                                style={styles.circleButton}
                            >
                                <Ionicons
                                    name="cloud-upload-outline"
                                    size={40}
                                    color="#008080"
                                />
                            </TouchableOpacity>

                            {cert.file && (
                                <Text style={styles.note}>
                                    Selected File: {cert.file.split("/").pop()}
                                </Text>
                            )}

                            {/* Remove Button */}
                            {certificates.length > 1 && (
                                <TouchableOpacity
                                    style={styles.removeButton}
                                    onPress={() => {
                                        const updated = certificates.filter(
                                            (_, i) => i !== index
                                        );
                                        setCertificates(updated);
                                    }}
                                >
                                    <Ionicons name="trash-outline" size={16} color="red"/>
                                    <Text style={styles.removeText}>Remove</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}

                    {/* Add Certificate */}
                    <TouchableOpacity
                        onPress={addCertificate}
                        style={styles.addButton}
                    >
                        <Text style={styles.addButtonText}>+ Add Certificate</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Fixed Next Button */}
            <View style={styles.fixedButtonContainer}>
                <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                    <Text style={styles.nextText}>Next</Text>
                </TouchableOpacity>
            </View>

            {/* Tooltip */}
            <Modal visible={showTooltip} transparent animationType="fade">
                <TouchableOpacity
                    style={styles.modalOverlay}
                    onPress={() => setShowTooltip(false)}
                >
                    <View style={styles.tooltipBox}>
                        <Text style={styles.tooltipText}>
                            The Unique Learner Identifier (ULI) is assigned to every student or trainee enrolled in TESDA programs. Format: ULI-MNG-03-062-03014-001
                        </Text>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
    scrollContainer: {
        flexGrow: 1,
        padding: 20,
        backgroundColor: "#fff",
        paddingBottom: 140,
    },
    contentWrapper: {flex: 1},
    section: {marginBottom: 40},
    sectionHeader: {
        fontSize: 22,
        fontWeight: "bold",
        marginTop: 30,
        marginBottom: 10,
        color: "#555",
    },
    title: {fontSize: 16, fontWeight: "bold", marginBottom: 8, marginTop: 10},
    uliRow: {flexDirection: "row", alignItems: "center"},
    input: {
        borderWidth: 1,
        borderColor: "#eee",
        borderRadius: 30,
        padding: 12,
        fontSize: 16,
        backgroundColor: "#f0f0f0",
        marginTop: 10,
    },
    pickerWrapper: {
        borderWidth: 1,
        borderColor: "#eee",
        borderRadius: 30,
        backgroundColor: "#f0f0f0",
        marginTop: 10,
        overflow: "hidden",
    },
    passwordNote: {fontSize: 12, color: "#888", marginTop: 4, marginBottom: 12},
    validationRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 6,
        gap: 6,
    },
    validationText: {
        fontSize: 12,
        fontWeight: "500",
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
    note: {fontSize: 12, color: "#888", textAlign: "center", marginTop: 8},
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
    nextText: {color: "#fff", fontSize: 16, fontWeight: "bold"},
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    tooltipBox: {
        backgroundColor: "#fff",
        padding: 16,
        borderRadius: 10,
        maxWidth: 300,
    },
    tooltipText: {fontSize: 14, color: "#333"},
    addButton: {
        backgroundColor: "#e0f7f7",
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 30,
        alignSelf: "center",
        marginBottom: 20,
    },
    addButtonText: {color: "#008080", fontWeight: "bold", fontSize: 14},
    fieldRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    removeButton: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 10,
        alignSelf: "flex-end",
        gap: 4,
    },
    removeText: {color: "red", fontSize: 12, fontWeight: "600"},
});
