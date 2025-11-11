import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { verifyOTPAndResetPassword } from "../../../src/api/auth.api";

export default function CreateNewPassword() {
    const router = useRouter();
    const {email, otp} = useLocalSearchParams<{ email: string; otp: string }>();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);

    // Password validation function
    const isPasswordValid = (password: string) => {
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

    // Prevent back navigation
    useFocusEffect(
        React.useCallback(() => {
            const onBackPress = () => {
                Alert.alert(
                    "Exit Password Reset?",
                    "Going back will cancel the password reset process.",
                    [
                        { text: "Stay", style: "cancel" },
                        {
                            text: "Exit",
                            onPress: () => router.replace("/provider/onboarding/forgot-password"),
                            style: "destructive"
                        }
                    ]
                );
                return true; // Prevent default back behavior
            };

            const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);

            return () => backHandler.remove();
        }, [])
    );

    const handleResetPassword = async () => {
        if (!password.trim()) {
            Alert.alert("Missing Password", "Please enter a new password.");
            return;
        }

        if (!isPasswordValid(password)) {
            Alert.alert(
                "Invalid Password", 
                "Password must be 10-16 characters and include uppercase, lowercase, number, and special character."
            );
            return;
        }

        if (password !== confirm) {
            Alert.alert("Mismatch", "Passwords do not match.");
            return;
        }

        if (!otp) {
            Alert.alert("Error", "OTP not found. Please start the process again.");
            router.replace("/provider/onboarding/forgot-password");
            return;
        }

        setLoading(true);

        try {
            await verifyOTPAndResetPassword(email, otp, password);
            
            Alert.alert(
                "Success",
                "Your password has been reset successfully! Please login with your new password.",
                [
                    {
                        text: "OK",
                        onPress: () => {
                            router.replace({
                                pathname: "/provider/onboarding/signin",
                                params: { fromPasswordReset: "true" }
                            });
                        }
                    }
                ]
            );
        } catch (error: any) {
            Alert.alert(
                "Error",
                error.message || "Failed to reset password. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Create New Password</Text>
            <Text style={styles.subtitle}>
                Set a strong password for {email}
            </Text>

            {/* New Password */}
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="New Password"
                    placeholderTextColor="#aaa"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                />
                <TouchableOpacity
                    style={styles.icon}
                    onPress={() => setShowPassword(!showPassword)}
                >
                    <Ionicons
                        name={showPassword ? "eye-off" : "eye"}
                        size={20}
                        color="#666"
                    />
                </TouchableOpacity>
            </View>

            {/* Dynamic Password Validation */}
            {password.length > 0 && (
                <View style={styles.validationContainer}>
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

            {/* Confirm Password */}
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
                    placeholderTextColor="#aaa"
                    secureTextEntry={!showConfirm}
                    value={confirm}
                    onChangeText={setConfirm}
                />
                <TouchableOpacity
                    style={styles.icon}
                    onPress={() => setShowConfirm(!showConfirm)}
                >
                    <Ionicons
                        name={showConfirm ? "eye-off" : "eye"}
                        size={20}
                        color="#666"
                    />
                </TouchableOpacity>
            </View>

            {/* Password Match Indicator */}
            {confirm.length > 0 && (
                <View style={styles.validationRow}>
                    <Ionicons 
                        name={password === confirm ? "checkmark-circle" : "close-circle"} 
                        size={16} 
                        color={password === confirm ? "#4CAF50" : "#F44336"} 
                    />
                    <Text style={[styles.validationText, {color: password === confirm ? "#4CAF50" : "#F44336"}]}>
                        {password === confirm ? "Passwords match" : "Passwords do not match"}
                    </Text>
                </View>
            )}

            <TouchableOpacity 
                style={[styles.button, loading && styles.buttonDisabled]} 
                onPress={handleResetPassword}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.buttonText}>Continue</Text>
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        padding: 20,
        backgroundColor: "#fff",
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 10,
        textAlign: "center",
    },
    subtitle: {
        fontSize: 14,
        color: "#666",
        marginBottom: 30,
        textAlign: "center",
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 10,
        marginBottom: 20,
        paddingHorizontal: 10,
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 16,
    },
    icon: {
        padding: 5,
    },
    validationContainer: {
        marginBottom: 20,
    },
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
    button: {
        backgroundColor: "#008080",
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: "center",
    },
    buttonDisabled: {
        backgroundColor: "#ccc",
        opacity: 0.6,
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
    },
});
