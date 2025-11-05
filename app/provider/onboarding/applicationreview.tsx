import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { verifyAndRegisterProvider } from '../../../src/api/auth.api';

export default function ApplicationReview() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const clearOnboardingData = async () => {
        try {
            const keys = [
                'location_district',
                'location_city',
                'location_barangay',
                'location_coordinates',
                'idVerification_idType',
                'idVerification_idPhotoFront'
            ];
            await AsyncStorage.multiRemove(keys);
            console.log('Onboarding data cleared from AsyncStorage');
        } catch (error) {
            console.error('Error clearing onboarding data:', error);
        }
    };

    const handleSubmitRegistration = async () => {
        if (isSubmitting || isSubmitted) return;

        setIsSubmitting(true);

        try {
            // Create FormData with all collected information
            const formData = new FormData();

            // Add OTP and email
            formData.append('otp', params.otp as string);
            formData.append('provider_email', params.email as string);

            // Add basic information from basicinfo screen
            formData.append('provider_password', params.password as string);
            formData.append('provider_first_name', params.firstName as string);
            formData.append('provider_last_name', params.lastName as string);
            formData.append('provider_userName', params.username as string);
            formData.append('provider_phone_number', params.phone as string);
            formData.append('provider_birthday', params.dob as string);

            // Add location information from LocationScreen
            formData.append('provider_location', params.provider_location as string || '');
            formData.append('provider_exact_location', params.provider_exact_location as string || '');

            // Add ULI if provided
            if (params.uliNumber) {
                formData.append('provider_uli', params.uliNumber as string);
            }

            // Add profile photo from basicinfo
            if (params.photo) {
                formData.append('provider_profile_photo', {
                    uri: params.photo as string,
                    type: 'image/jpeg',
                    name: 'profile.jpg',
                } as any);
            }

            // Add valid ID from id-verification
            if (params.idPhotoFront) {
                formData.append('provider_valid_id', {
                    uri: params.idPhotoFront as string,
                    type: 'image/jpeg',
                    name: 'id.jpg',
                } as any);
            }

            // Parse arrays from ncupload (now comma-separated strings)
            const certificateNames = params.certificateNames ? (params.certificateNames as string).split(',') : [];
            const certificateNumbers = params.certificateNumbers ? (params.certificateNumbers as string).split(',') : [];
            const expiryDates = params.expiryDates ? (params.expiryDates as string).split(',') : [];
            const certificateFiles = params.certificateFiles ? (params.certificateFiles as string).split(',') : [];
            const professions = params.professions ? (params.professions as string).split(',') : [];
            const experiences = params.experiences ? (params.experiences as string).split(',') : [];
            
            // Add certificate details as JSON strings (backend expects JSON arrays)
            formData.append('certificateNames', JSON.stringify(certificateNames));
            formData.append('certificateNumbers', JSON.stringify(certificateNumbers));
            formData.append('expiryDates', JSON.stringify(expiryDates));

            // Add certificate images (backend handles Cloudinary upload automatically)
            certificateFiles.forEach((fileUri: string, index: number) => {
                if (fileUri) {
                    formData.append('certificate_images', {
                        uri: fileUri,
                        type: 'image/jpeg',
                        name: `certificate_${index}.jpg`,
                    } as any);
                }
            });

            // Add professions and experiences
            formData.append('professions', JSON.stringify(professions));
            formData.append('experiences', JSON.stringify(experiences));

            // Submit registration
            const response = await verifyAndRegisterProvider(formData);

            // Only set submitted if successful
            if (response && response.success !== false) {
                setIsSubmitted(true);
                setError(null);
                // Clear AsyncStorage after successful registration
                await clearOnboardingData();
            } else {
                throw new Error(response?.message || 'Registration failed');
            }
            
        } catch (error: any) {
            console.error('Registration submission error:', error);
            setError(error.message || 'An error occurred during registration');
            setIsSubmitted(false);
            
            // Show detailed error alert
            Alert.alert(
                'Registration Error', 
                error.message || 'An error occurred during registration. Please try again.',
                [
                    {
                        text: 'Try Again',
                        onPress: () => {
                            setError(null);
                            handleSubmitRegistration();
                        }
                    },
                    {
                        text: 'Go Back to Edit',
                        onPress: () => router.back(),
                        style: 'cancel'
                    }
                ]
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleContinue = () => {
        router.push('/provider/onboarding/locationpermission');
    };

    if (isSubmitting) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#008080" />
                <Text style={styles.loadingText}>Submitting your application...</Text>
                <Text style={styles.subText}>Please wait, this may take a moment.</Text>
            </View>
        );
    }

    // Show error screen if there's an error
    if (error && !isSubmitted) {
        return (
            <View style={styles.container}>
                <Ionicons name="alert-circle" size={100} color="#ff4444" />
                <Text style={styles.errorTitle}>Registration Error</Text>
                <Text style={styles.errorMessage}>{error}</Text>
                
                <TouchableOpacity 
                    style={[styles.button, styles.retryButton]} 
                    onPress={() => {
                        setError(null);
                        handleSubmitRegistration();
                    }}
                >
                    <Text style={styles.buttonText}>Try Again</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[styles.button, styles.backButton]} 
                    onPress={() => router.back()}
                >
                    <Text style={[styles.buttonText, {color: '#008080'}]}>Go Back to Edit</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Show success screen after submission
    if (isSubmitted) {
        return (
            <View style={styles.container}>
                {/* Logo */}
                <Image
                    source={require('../../assets/images/fixmo-logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />

                {/* Message */}
                <Text style={styles.title}>Application Submitted!</Text>
                <Text style={styles.message}>
                    Thanks for applying to join FixMo. Our team is reviewing your details.
                    You'll be notified once your application is approved.
                </Text>

                {/* Continue Button */}
                <TouchableOpacity style={styles.button} onPress={handleContinue}>
                    <Text style={styles.buttonText}>Continue</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Show review screen before submission
    const professions = params.professions ? (params.professions as string).split(',') : [];
    const experiences = params.experiences ? (params.experiences as string).split(',') : [];
    const certificateNames = params.certificateNames ? (params.certificateNames as string).split(',') : [];

    return (
        <View style={{flex: 1, backgroundColor: '#fff'}}>
            <ScrollView contentContainerStyle={styles.reviewContainer}>
                <Text style={styles.reviewTitle}>Review Your Application</Text>
                <Text style={styles.reviewSubtitle}>Please review your information before submitting</Text>

                {/* Personal Information */}
                <View style={styles.reviewSection}>
                    <Text style={styles.sectionTitle}>Personal Information</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Name:</Text>
                        <Text style={styles.value}>{params.firstName} {params.lastName}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Email:</Text>
                        <Text style={styles.value}>{params.email}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Phone:</Text>
                        <Text style={styles.value}>{params.phone}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Birthday:</Text>
                        <Text style={styles.value}>{params.dob}</Text>
                    </View>
                </View>

                {/* Location */}
                <View style={styles.reviewSection}>
                    <Text style={styles.sectionTitle}>Location</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Address:</Text>
                        <Text style={styles.value}>{params.provider_location}</Text>
                    </View>
                </View>

                {/* Professional Information */}
                <View style={styles.reviewSection}>
                    <Text style={styles.sectionTitle}>Professional Information</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>ULI:</Text>
                        <Text style={styles.value}>{params.uliNumber}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Professions:</Text>
                        <Text style={styles.value}>{professions.join(', ')}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Experience (years):</Text>
                        <Text style={styles.value}>{experiences.join(', ')}</Text>
                    </View>
                </View>

                {/* Certificates */}
                <View style={styles.reviewSection}>
                    <Text style={styles.sectionTitle}>TESDA Certificates</Text>
                    {certificateNames.map((name, index) => (
                        <View key={index} style={styles.certificateItem}>
                            <Ionicons name="document-text" size={20} color="#008080" />
                            <Text style={styles.certificateName}>{name}</Text>
                        </View>
                    ))}
                </View>

                {/* Action Buttons */}
                <View style={styles.buttonContainer}>
                    <TouchableOpacity 
                        style={styles.editButton} 
                        onPress={() => router.back()}
                    >
                        <Ionicons name="arrow-back" size={20} color="#008080" />
                        <Text style={styles.editButtonText}>Go Back to Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.submitButton} 
                        onPress={handleSubmitRegistration}
                        disabled={isSubmitting}
                    >
                        <Text style={styles.submitButtonText}>Submit Application</Text>
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    reviewContainer: {
        padding: 20,
        paddingBottom: 40,
    },
    reviewTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#008080',
        marginBottom: 8,
        textAlign: 'center',
    },
    reviewSubtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 24,
        textAlign: 'center',
    },
    reviewSection: {
        backgroundColor: '#f9f9f9',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#008080',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#008080',
        marginBottom: 12,
    },
    infoRow: {
        flexDirection: 'row',
        marginBottom: 8,
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        minWidth: 100,
    },
    value: {
        fontSize: 14,
        color: '#333',
        flex: 1,
    },
    certificateItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    certificateName: {
        fontSize: 14,
        color: '#333',
    },
    buttonContainer: {
        marginTop: 24,
        gap: 12,
    },
    editButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: '#008080',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 30,
        gap: 8,
    },
    editButtonText: {
        color: '#008080',
        fontSize: 16,
        fontWeight: 'bold',
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#008080',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 30,
        gap: 8,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    header: {
        color: '#888',
        fontSize: 16,
        marginBottom: 20,
    },
    logo: {
        width: 200,
        height: 200,
        marginBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: '#444',
        textAlign: 'center',
        marginBottom: 30,
        paddingHorizontal: 10,
    },
    button: {
        backgroundColor: '#008080',
        paddingVertical: 14,
        paddingHorizontal: 40,
        borderRadius: 30,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    loadingText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginTop: 20,
    },
    subText: {
        fontSize: 14,
        color: '#666',
        marginTop: 10,
        textAlign: 'center',
    },
    errorTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#ff4444',
        marginTop: 20,
        marginBottom: 12,
        textAlign: 'center',
    },
    errorMessage: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
        marginBottom: 30,
        paddingHorizontal: 20,
        lineHeight: 22,
    },
    retryButton: {
        backgroundColor: '#008080',
        marginBottom: 10,
    },
    backButton: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: '#008080',
    },
});