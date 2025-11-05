// Example Integration: Provider Profile Screen with Re-Verification Modal
// File: app/provider/onboarding/providerprofile.tsx (example)

import { ReVerificationModal } from '@/components';
import { API_CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const BACKEND_URL = API_CONFIG.BASE_URL;

export default function ProviderProfileScreen() {
    // Verification states
    const [verificationStatus, setVerificationStatus] = useState<string>('');
    const [rejectionReason, setRejectionReason] = useState<string>('');
    const [showReVerificationModal, setShowReVerificationModal] = useState(false);

    // Fetch provider profile data
    const fetchProviderProfile = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${BACKEND_URL}/auth/provider-profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    // Store verification status and rejection reason
                    setVerificationStatus(result.data.verification_status || 'pending');
                    setRejectionReason(result.data.rejection_reason || '');
                }
            }
        } catch (error) {
            console.error('Error fetching provider profile:', error);
        }
    };

    // Load profile on screen focus
    useFocusEffect(
        useCallback(() => {
            fetchProviderProfile();
        }, [])
    );

    return (
        <View style={styles.container}>
            {/* Verification Status Banner */}
            {verificationStatus === 'pending' && (
                <View style={[styles.statusBanner, styles.pendingBanner]}>
                    <Ionicons name="time" size={24} color="#ff9800" />
                    <View style={styles.statusContent}>
                        <Text style={styles.statusTitle}>Verification Pending</Text>
                        <Text style={styles.statusText}>
                            Your documents are being reviewed. Please wait for admin approval.
                        </Text>
                    </View>
                </View>
            )}

            {verificationStatus === 'rejected' && (
                <View style={[styles.statusBanner, styles.rejectedBanner]}>
                    <Ionicons name="warning" size={24} color="#ff4444" />
                    <View style={styles.statusContent}>
                        <Text style={styles.statusTitle}>Verification Rejected</Text>
                        <Text style={styles.statusText}>
                            Your verification was rejected. Please review and resubmit.
                        </Text>
                        {rejectionReason && (
                            <Text style={styles.rejectionReasonText}>
                                Reason: {rejectionReason}
                            </Text>
                        )}
                        <TouchableOpacity
                            style={styles.verifyButton}
                            onPress={() => setShowReVerificationModal(true)}
                        >
                            <Ionicons name="checkmark-circle" size={20} color="white" />
                            <Text style={styles.verifyButtonText}>Verify Now</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {verificationStatus === 'approved' && (
                <View style={[styles.statusBanner, styles.approvedBanner]}>
                    <Ionicons name="checkmark-circle" size={24} color="#4caf50" />
                    <View style={styles.statusContent}>
                        <Text style={styles.statusTitle}>Account Verified ✓</Text>
                        <Text style={styles.statusText}>
                            Your account has been verified and approved!
                        </Text>
                    </View>
                </View>
            )}

            {/* Rest of your profile content */}
            <View style={styles.content}>
                {/* Your existing profile UI */}
            </View>

            {/* Re-Verification Modal */}
            <ReVerificationModal
                visible={showReVerificationModal}
                onClose={() => setShowReVerificationModal(false)}
                onSuccess={() => {
                    // Refresh profile after successful submission
                    fetchProviderProfile();
                    Alert.alert(
                        'Success',
                        'Your verification has been resubmitted successfully! Please wait for admin approval.',
                        [{ text: 'OK' }]
                    );
                }}
                rejectionReason={rejectionReason}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    statusBanner: {
        flexDirection: 'row',
        padding: 16,
        margin: 16,
        borderRadius: 12,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    pendingBanner: {
        backgroundColor: '#fff8e1',
        borderLeftColor: '#ff9800',
    },
    rejectedBanner: {
        backgroundColor: '#ffebee',
        borderLeftColor: '#ff4444',
    },
    approvedBanner: {
        backgroundColor: '#e8f5e9',
        borderLeftColor: '#4caf50',
    },
    statusContent: {
        flex: 1,
        marginLeft: 12,
    },
    statusTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    statusText: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    rejectionReasonText: {
        fontSize: 13,
        color: '#ff4444',
        fontStyle: 'italic',
        marginTop: 8,
        padding: 8,
        backgroundColor: '#fff0f0',
        borderRadius: 6,
    },
    verifyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#008080',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginTop: 12,
        alignSelf: 'flex-start',
    },
    verifyButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: 'white',
        marginLeft: 8,
    },
    content: {
        flex: 1,
        padding: 16,
    },
});

// Alternative: Simpler integration with just a button
export function SimpleIntegrationExample() {
    const [showModal, setShowModal] = useState(false);

    return (
        <View>
            <TouchableOpacity 
                style={styles.verifyButton}
                onPress={() => setShowModal(true)}
            >
                <Text style={styles.verifyButtonText}>Re-verify Account</Text>
            </TouchableOpacity>

            <ReVerificationModal
                visible={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={() => {
                    Alert.alert('Success', 'Documents resubmitted!');
                }}
                rejectionReason="Previous ID photo was unclear"
            />
        </View>
    );
}
