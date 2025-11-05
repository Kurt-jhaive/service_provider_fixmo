import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { BackHandler, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const termsList = [
  {
    title: "Eligibility",
    description: "Users must be at least 18 years old to create an account and use FixMo services."
  },
  {
    title: "Verified Providers",
    description: "Only TESDA-certified and FixMo-approved service providers may offer their services on the platform."
  },
  {
    title: "About FixMo",
    description: "FixMo is a mobile and web-based booking application that connects users with qualified home and tech service providers."
  },
  {
    title: "User Responsibilities",
    description: "Users must provide accurate booking details, ensure safe premises for service providers, and comply with scheduled appointments."
  },
  {
    title: "Provider Responsibilities",
    description: "Providers must deliver quality service, arrive on time, maintain professionalism, and adhere to FixMo's verification and conduct policies."
  },
  {
    title: "Service Guarantee",
    description: "FixMo verifies providers and allows user reviews but is not liable for service outcomes beyond verification, warranty handling, and the rating system."
  },
  {
    title: "Warranty & Backjobs",
    description: "Services may include a limited warranty period. Users may request backjobs within this period, subject to provider evaluation."
  },
  {
    title: "Data Privacy",
    description: "All personal and transactional data are handled in accordance with the Philippine Data Privacy Act of 2012 and FixMo's Privacy Policy."
  },
  {
    title: "Prohibited Activities",
    description: "Fraudulent activities, platform misuse, harassment, false claims, or manipulation of reviews will result in account suspension or termination."
  },
  {
    title: "Liability",
    description: "FixMo acts solely as a booking intermediary and does not directly employ or control service providers. All services are performed under the provider's responsibility."
  },
  {
    title: "Account Security",
    description: "Users are responsible for maintaining the confidentiality of their login credentials and must immediately report any unauthorized access to their account."
  },
  {
    title: "Dispute Resolution",
    description: "Any disputes between users and providers should first be reported to FixMo's support team for mediation before escalating to formal legal action."
  },
  {
    title: "Termination",
    description: "FixMo reserves the right to suspend or terminate accounts that violate these Terms or engage in suspicious or harmful activities."
  },
  {
    title: "System Maintenance",
    description: "FixMo may temporarily suspend operations for updates or maintenance. Users will be notified of scheduled downtimes when possible."
  },
  {
    title: "Intellectual Property",
    description: "All content, trademarks, and system designs on FixMo are owned by FixMo and may not be copied, reproduced, or distributed without authorization."
  },
  {
    title: "Third-Party Services",
    description: "FixMo may integrate third-party tools or APIs (e.g., maps, payment gateways). Users agree to the terms of those third parties when applicable."
  },
  {
    title: "Updates",
    description: "FixMo reserves the right to modify or update these Terms & Conditions at any time. Users will be notified of significant changes via in-app or email notice."
  },
  {
    title: "Governing Law",
    description: "These Terms & Conditions shall be governed by and interpreted under the laws of the Republic of the Philippines."
  }
];

const TermsAndConditions = () => {
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
                <Text style={styles.headerTitle}>Terms and Conditions</Text>
            </View>

            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                {/* Introduction Card */}
                <View style={styles.introCard}>
                    <Ionicons name="document-text" size={40} color="#008080" />
                    <Text style={styles.introTitle}>FixMo Terms & Conditions</Text>
                    <Text style={styles.introText}>
                        Please read these terms carefully before using our service
                    </Text>
                </View>

                {termsList.map((item, idx) => (
                    <View key={idx} style={styles.termCard}>
                        <View style={styles.termHeader}>
                            <View style={styles.numberBadge}>
                                <Text style={styles.numberText}>{idx + 1}</Text>
                            </View>
                            <Text style={styles.termTitle}>{item.title}</Text>
                        </View>
                        <Text style={styles.termDescription}>{item.description}</Text>
                    </View>
                ))}

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
    termCard: {
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
    termHeader: {
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
    termTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#333',
        flex: 1,
    },
    termDescription: {
        fontSize: 15,
        color: '#555',
        lineHeight: 24,
        paddingLeft: 44,
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

export default TermsAndConditions;
