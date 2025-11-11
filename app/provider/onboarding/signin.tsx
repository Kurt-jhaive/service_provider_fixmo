import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { loginProvider } from "../../../src/api/auth.api";
import { registerPushTokenWithBackend } from "../../../src/utils/notificationhelper";

export default function SignIn() {
    const router = useRouter();
    const params = useLocalSearchParams<{ fromPasswordReset?: string }>();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // Immediate check on mount - before any delay
    React.useEffect(() => {
        (async () => {
            const immediateToken = await AsyncStorage.getItem('providerToken');
            const immediateId = await AsyncStorage.getItem('providerId');
            console.log('🚨 IMMEDIATE CHECK on signin mount - Token:', immediateToken ? 'EXISTS' : 'null', 'ID:', immediateId ? 'EXISTS' : 'null');
        })();
    }, []);

    // Check if user is already logged in on mount
    React.useEffect(() => {
        // Skip auto-redirect if coming from password reset
        if (params.fromPasswordReset === "true") {
            console.log('🔐 Coming from password reset - skipping auto-redirect');
            return;
        }

        const timer = setTimeout(() => {
            checkExistingSession();
        }, 500); // Longer delay to ensure AsyncStorage is fully updated after logout
        
        return () => clearTimeout(timer);
    }, [params.fromPasswordReset]);

    const checkExistingSession = async () => {
        try {
            const token = await AsyncStorage.getItem('providerToken');
            const providerId = await AsyncStorage.getItem('providerId');
            
            console.log('🔍 SignIn - Checking for existing session:', { hasToken: !!token, hasProviderId: !!providerId });
            
            if (token && providerId) {
                console.log('✅ Active session found, redirecting to home');
                // User already logged in, redirect to home
                router.replace("/provider/onboarding/pre_homepage");
            } else {
                console.log('❌ No active session, staying on signin');
            }
        } catch (error) {
            console.error('Error checking session:', error);
        }
    };

    const handleSignIn = async () => {
        // Validation
        if (!email.trim()) {
            Alert.alert('Error', 'Please enter your email address');
            return;
        }

        if (!password.trim()) {
            Alert.alert('Error', 'Please enter your password');
            return;
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            Alert.alert('Error', 'Please enter a valid email address');
            return;
        }

        setLoading(true);

        try {
            // Call login API
            const response = await loginProvider(email.trim(), password);

            if (response.success && response.token) {
                // Store token in AsyncStorage
                await AsyncStorage.setItem('providerToken', response.token);
                await AsyncStorage.setItem('providerId', response.providerId.toString());
                await AsyncStorage.setItem('providerUserName', response.providerUserName);

                // Register push notification token (non-blocking)
                registerPushTokenWithBackend(
                    response.providerId,
                    'provider',
                    response.token
                ).catch(error => {
                    console.error('Failed to register push token:', error);
                    // Don't block login flow if push registration fails
                });

                // Navigate to home screen with provider data
                router.replace({
                    pathname: "/provider/onboarding/pre_homepage",
                    params: {
                        providerId: response.providerId.toString(),
                        providerUserName: response.providerUserName,
                        firstName: response.provider.firstName,
                        lastName: response.provider.lastName,
                    },
                });
            } else {
                Alert.alert('Login Failed', response.message || 'Invalid credentials');
            }
        } catch (error: any) {
            console.error('Login error:', error);
            Alert.alert(
                'Login Failed',
                error.message || 'Unable to login. Please check your credentials and try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView
                style={styles.screen}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
            >
                <ScrollView 
                    contentContainerStyle={styles.container} 
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Image
                        source={require("../../../app/assets/images/fixmo-logo.png")}
                        style={styles.logo}
                        resizeMode="contain"
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Email address"
                        placeholderTextColor="#888"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                    />

                    <View style={styles.passwordContainer}>
                        <TextInput
                            style={[styles.input, styles.passwordInput]}
                            placeholder="Password"
                            placeholderTextColor="#888"
                            secureTextEntry={!showPassword}
                            value={password}
                            onChangeText={setPassword}
                        />
                        <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                            <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#555"/>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                        style={[styles.button, loading && styles.buttonDisabled]} 
                        onPress={handleSignIn}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Sign in</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => router.push("/provider/onboarding/forgot-password")}>
                        <Text style={styles.link}>Forgot the password?</Text>
                    </TouchableOpacity>

                    <View style={{height: 80}}/>

                    <TouchableOpacity onPress={() => router.push("/provider/onboarding/email")}>
                        <Text style={styles.link}>
                            Don't have an account? <Text style={styles.linkText}>Sign up</Text>
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#fff",
    },
    container: {
        flexGrow: 1,
        paddingHorizontal: 30,
        paddingTop: 60,
        paddingBottom: 30,
    },
    logo: {
        width: 120,
        height: 120,
        alignSelf: "center",
        marginBottom: 40,
        marginTop: 20,
    },
    input: {
        backgroundColor: "#f2f2f2",
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 16,
        marginBottom: 15,
        color: "#000",
    },
    passwordInput: {
        paddingRight: 45,
    },
    passwordContainer: {
        position: "relative",
    },
    eyeIcon: {
        position: "absolute",
        right: 15,
        top: 12,
    },
    button: {
        backgroundColor: "#399d9d",
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: "center",
        marginTop: 10,
    },
    buttonDisabled: {
        backgroundColor: "#7cc",
        opacity: 0.6,
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    link: {
        marginTop: 15,
        textAlign: "center",
        color: "#555",
        fontSize: 14,
    },
    linkText: {
        fontWeight: "bold",
        color: "#399d9d",
    },
});
