import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";

export default function Splash() {
    const router = useRouter();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        checkAuthAndRedirect();
    }, []);

    const checkAuthAndRedirect = async () => {
        try {
            // Check if user is already logged in
            const token = await AsyncStorage.getItem('providerToken');
            const providerId = await AsyncStorage.getItem('providerId');
            
            console.log('🔍 Checking auth status...', { hasToken: !!token, hasProviderId: !!providerId });
            
            // Delay for splash screen visibility
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            if (token && providerId) {
                // User is logged in, redirect to home
                console.log('✅ User is logged in, redirecting to home');
                router.replace("/provider/onboarding/pre_homepage");
            } else {
                // No active session, redirect to signin
                console.log('❌ No active session, redirecting to signin');
                router.replace("/provider/onboarding/signin");
            }
        } catch (error) {
            console.error('Error checking auth:', error);
            // On error, redirect to signin
            router.replace("/provider/onboarding/signin");
        } finally {
            setChecking(false);
        }
    };

    return (
        <View style={styles.container}>
            <Image
                source={require("../app/assets/images/fixmo-logo.png")}
                style={styles.logo}
                resizeMode="contain"
            />
            {checking && (
                <ActivityIndicator 
                    size="large" 
                    color="#008080" 
                    style={styles.loader} 
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
    },
    logo: {
        width: 150,
        height: 150,
        marginBottom: 20,
    },
    text: {
        fontSize: 28,
        color: "#fff",
        fontWeight: "bold",
    },
    loader: {
        marginTop: 20,
    },
});
