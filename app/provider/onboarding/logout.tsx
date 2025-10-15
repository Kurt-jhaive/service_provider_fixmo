import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from "expo-router";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const Logout = () => {
    const router = useRouter();

    const handleLogout = async (): Promise<void> => {
        try {
            // Remove common auth/session keys. Adjust keys if your app uses different names.
            await AsyncStorage.multiRemove([
                'providerToken',
                'token',
                'providerId',
                'userId',
                'providerProfile',
                'userProfile'
            ]);
            console.log('User logged out - cleared AsyncStorage keys');
        } catch (error) {
            console.error('Error clearing AsyncStorage during logout:', error);
        }

        // Navigate back to login screen (use actual auth route)
        router.replace('/auth/SignInScreen');
    };

    const confirmLogout = (): void => {
        Alert.alert(
            "Logout",
            "Are you sure you want to log out?",
            [
                {text: "Cancel", style: "cancel"},
                {text: "Yes, Log Out", onPress: handleLogout},
            ],
            {cancelable: true}
        );
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.logoutButton} onPress={confirmLogout}>
                <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
        </View>
    );
};

export default Logout;

// ---------- Styles ----------
const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#fff",
    },
    logoutButton: {
        backgroundColor: "#d32f2f",
        paddingVertical: 14,
        paddingHorizontal: 40,
        borderRadius: 30,
        elevation: 3,
    },
    logoutText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 16,
        textAlign: "center",
    },
});