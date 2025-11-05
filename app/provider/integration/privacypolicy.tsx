import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { BackHandler, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const PrivacyPolicy = () => {
    const router = useRouter();

    // Override Android back button behavior
    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                router.replace('/provider/onboarding/providerprofile');
                return true; // Prevent default back behavior
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

            return () => subscription.remove();
        }, [])
    );

    return (
        <View style={styles.wrapper}>
            {/* Header with Back Button */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.replace('/provider/onboarding/providerprofile')} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#008080" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Privacy Policy</Text>
            </View>

            <ScrollView contentContainerStyle={styles.container}>
                {/* Introduction Card */}
                <View style={styles.introCard}>
                    <Ionicons name="shield-checkmark" size={40} color="#008080" />
                    <Text style={styles.introTitle}>Your Privacy Matters</Text>
                    <Text style={styles.introText}>
                        We are committed to protecting your personal information and your right to privacy
                    </Text>
                </View>

                {/* Section 1 */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.numberBadge}>
                            <Text style={styles.numberText}>1</Text>
                        </View>
                        <Text style={styles.sectionTitle}>Information We Collect</Text>
                    </View>
                    <Text style={styles.text}>
                        We may collect your name, email, phone number, address, payment details, service requests, booking
                        history, device information, and usage data.
                    </Text>
                </View>

                {/* Section 2 */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.numberBadge}>
                            <Text style={styles.numberText}>2</Text>
                        </View>
                        <Text style={styles.sectionTitle}>How We Use Your Information</Text>
                    </View>
                    <Text style={styles.text}>
                        To provide and improve services, process bookings/payments, communicate updates, analyze usage, and
                        comply with legal obligations.
                    </Text>
                </View>

                {/* Section 3 */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.numberBadge}>
                            <Text style={styles.numberText}>3</Text>
                        </View>
                        <Text style={styles.sectionTitle}>Sharing Your Information</Text>
                    </View>
                    <Text style={styles.text}>
                        We do not sell your data. We may share with service providers, legal authorities, or in business
                        transfers.
                    </Text>
                </View>

                {/* Section 4 */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.numberBadge}>
                            <Text style={styles.numberText}>4</Text>
                        </View>
                        <Text style={styles.sectionTitle}>Security & Retention</Text>
                    </View>
                    <Text style={styles.text}>
                        We implement reasonable measures to protect your data and retain it only as long as necessary.
                    </Text>
                </View>

                {/* Section 5 */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.numberBadge}>
                            <Text style={styles.numberText}>5</Text>
                        </View>
                        <Text style={styles.sectionTitle}>Your Rights</Text>
                    </View>
                    <Text style={styles.text}>
                        You may access, update, or request deletion of your personal data and opt-out of marketing
                        communications.
                    </Text>
                </View>

                {/* Section 6 */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.numberBadge}>
                            <Text style={styles.numberText}>6</Text>
                        </View>
                        <Text style={styles.sectionTitle}>Contact Us</Text>
                    </View>
                    <View style={styles.contactBox}>
                        <Ionicons name="mail-outline" size={18} color="#008080" />
                        <Text style={styles.contactText}>support@fixmo.com</Text>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Ionicons name="information-circle-outline" size={20} color="#666" />
                    <Text style={styles.footerText}>
                        Last updated: January 2025
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    backButton: {
        marginRight: 15,
        padding: 5,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    container: {
        padding: 20,
        paddingBottom: 40,
    },
    introCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        marginBottom: 20,
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    introTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#008080',
        marginTop: 12,
        marginBottom: 8,
    },
    introText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
    sectionCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        borderLeftWidth: 4,
        borderLeftColor: '#008080',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    numberBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#E0F2F1',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    numberText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#008080',
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#333',
        flex: 1,
    },
    text: {
        fontSize: 15,
        color: '#555',
        lineHeight: 24,
        paddingLeft: 44,
    },
    contactBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E0F2F1',
        padding: 12,
        borderRadius: 8,
        marginTop: 8,
        marginLeft: 44,
    },
    contactText: {
        fontSize: 15,
        color: '#008080',
        marginLeft: 8,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    footerText: {
        fontSize: 13,
        color: '#666',
        marginLeft: 8,
    },
});

export default PrivacyPolicy;
