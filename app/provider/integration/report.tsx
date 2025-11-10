import { getDetailedProviderProfile } from '@/api/auth.api';
import { submitProviderReport } from '@/api/reports.api';
import { API_CONFIG } from "@/constants/config";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getStatusText } from '../../../src/utils/penaltyHelpers';
import { getPenaltyInfo, getViolationHistory, submitAppeal } from '../../../src/utils/penaltyService';

const BACKEND_URL = API_CONFIG.BASE_URL;

interface Appointment {
  appointment_id: number;
  scheduled_date: string;
  service_title?: string;
  customer_first_name?: string;
  customer_last_name?: string;
  customer_id?: number;
  customer_email?: string;
  customer_phone?: string;
}

const ProviderReportForm = () => {
  const router = useRouter();
  
  // Form states
  const [reporterName, setReporterName] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  const [reportType, setReportType] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [appointmentId, setAppointmentId] = useState("");
  const [customerId, setCustomerId] = useState("");
  
  // Penalty/violation selection
  const [selectedViolationId, setSelectedViolationId] = useState("");
  const [violations, setViolations] = useState<any[]>([]);
  const [penaltyAction, setPenaltyAction] = useState<"report" | "appeal">("report"); // New: track if reporting or appealing
  
  // Appeal-specific states
  const [appealReason, setAppealReason] = useState("");
  const [appealEvidence, setAppealEvidence] = useState<any[]>([]);
  
  // Customer information (auto-filled from selected appointment)
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isDeactivated, setIsDeactivated] = useState(false);
  
  // Penalty/Fix-Score information
  const [penaltyScore, setPenaltyScore] = useState<number>(100);
  const [isSuspended, setIsSuspended] = useState<boolean>(false);
  const [penaltyStatus, setPenaltyStatus] = useState<string>('GOOD STANDING');

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

  // Load provider data and appointments
  useEffect(() => {
    loadProviderData();
  }, []);

  // Load violations when "Penalties" report type is selected
  useEffect(() => {
    if (reportType === 'penalties') {
      loadViolations();
    }
  }, [reportType]);

  const loadViolations = async () => {
    try {
      console.log('📋 Loading violations for penalty report...');
      const response = await getViolationHistory(null, 50, 0); // Get up to 50 violations
      if (response.success && response.data && response.data.violations) {
        setViolations(response.data.violations);
        console.log('✅ Loaded violations:', response.data.violations.length);
      } else {
        console.error('❌ Failed to load violations:', response.error);
        setViolations([]);
      }
    } catch (error) {
      console.error('❌ Error loading violations:', error);
      setViolations([]);
    }
  };

  const loadProviderData = async () => {
    try {
      setLoadingProfile(true);
      const token = await AsyncStorage.getItem('providerToken');
      
      if (!token) {
        console.error('❌ No provider token found');
        Alert.alert('Error', 'Please log in again');
        return;
      }

      console.log('🔄 Loading provider profile data...');
      
      try {
        // Fetch provider profile using the proper API function
        const providerData = await getDetailedProviderProfile(token);
        
        console.log('✅ Provider profile loaded:', {
          firstName: providerData.first_name,
          lastName: providerData.last_name,
          email: providerData.email,
          phone: providerData.phone_number
        });

        if (providerData) {
          const fullName = `${providerData.first_name || ''} ${providerData.last_name || ''}`.trim();
          setReporterName(fullName || 'N/A');
          setReporterEmail(providerData.email || '');
          setReporterPhone(providerData.phone_number || '');
          
          // Check if account is deactivated
          setIsDeactivated(providerData.is_activated === false);
          
          console.log('✅ Reporter fields set:', {
            name: fullName,
            email: providerData.email,
            phone: providerData.phone_number
          });
        } else {
          console.error('❌ No provider data returned from API');
          Alert.alert('Error', 'Failed to load profile data');
        }
      } catch (profileError: any) {
        console.error('❌ Error loading provider profile:', profileError);
        Alert.alert('Profile Error', profileError.message || 'Failed to load your profile information');
      }

      // Fetch penalty/Fix-Score information
      try {
        const penaltyResponse = await getPenaltyInfo();
        if (penaltyResponse.success && penaltyResponse.data) {
          const score = penaltyResponse.data.current_score || penaltyResponse.data.penalty_points || 100;
          const suspended = penaltyResponse.data.is_suspended || false;
          
          setPenaltyScore(score);
          setIsSuspended(suspended);
          setPenaltyStatus(getStatusText(score, suspended));
          
          console.log('📊 Fix-Score loaded for report:', { score, suspended, status: getStatusText(score, suspended) });
        }
      } catch (penaltyError) {
        console.error('⚠️ Error loading penalty info (non-critical):', penaltyError);
        // Don't show error to user, penalty info is optional
      }

      // Fetch provider's appointments
      try {
        const providerId = await AsyncStorage.getItem('providerId');
        if (providerId) {
          console.log('🔄 Loading appointments for provider:', providerId);
          const appointmentsResponse = await fetch(`${BACKEND_URL}/api/appointments/provider/${providerId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (appointmentsResponse.ok) {
            const appointmentsResult = await appointmentsResponse.json();
            if (appointmentsResult.success && appointmentsResult.data) {
              const formattedAppointments = appointmentsResult.data.map((apt: any) => ({
                appointment_id: apt.appointment_id,
                scheduled_date: apt.scheduled_date,
                service_title: apt.service?.service_title || apt.service_title,
                customer_first_name: apt.user?.first_name,
                customer_last_name: apt.user?.last_name,
                customer_id: apt.user?.user_id || apt.customer_id,
                customer_email: apt.user?.email,
                customer_phone: apt.user?.phone_number,
              }));
              setAppointments(formattedAppointments);
              console.log('✅ Loaded appointments:', formattedAppointments.length);
            }
          } else {
            console.warn('⚠️ Failed to load appointments:', appointmentsResponse.status);
          }
        } else {
          console.warn('⚠️ No provider ID found in storage');
        }
      } catch (appointmentsError) {
        console.error('⚠️ Error loading appointments (non-critical):', appointmentsError);
        // Don't show error to user, appointments are optional
      }
    } catch (error) {
      console.error('❌ Error in loadProviderData:', error);
      Alert.alert('Error', 'Failed to load some data. Please try again.');
    } finally {
      setLoadingProfile(false);
    }
  };

  // Handle appointment selection - auto-fill customer information
  const handleAppointmentChange = (value: string) => {
    setAppointmentId(value);
    if (value) {
      const selectedAppointment = appointments.find(a => a.appointment_id.toString() === value);
      if (selectedAppointment) {
        // Auto-fill customer ID
        if (selectedAppointment.customer_id) {
          setCustomerId(selectedAppointment.customer_id.toString());
        }
        
        // Auto-fill customer name
        if (selectedAppointment.customer_first_name && selectedAppointment.customer_last_name) {
          setCustomerName(`${selectedAppointment.customer_first_name} ${selectedAppointment.customer_last_name}`);
        }
        
        // Auto-fill customer email
        if (selectedAppointment.customer_email) {
          setCustomerEmail(selectedAppointment.customer_email);
        }
        
        // Auto-fill customer phone
        if (selectedAppointment.customer_phone) {
          setCustomerPhone(selectedAppointment.customer_phone);
        }
      }
    } else {
      // Clear customer info when no appointment selected
      setCustomerId('');
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
    }
  };

  // Pick images from gallery - supports multiple selection
  const pickImages = async () => {
    if (images.length >= 5) {
      Alert.alert("Limit Reached", "You can only upload up to 5 images");
      return;
    }

    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5 - images.length, // Only allow remaining slots
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.slice(0, 5 - images.length); // Ensure we don't exceed 5
        setImages([...images, ...newImages]);
        
        if (result.assets.length > newImages.length) {
          Alert.alert("Limit Reached", `Only ${newImages.length} image(s) added. Maximum 5 images allowed.`);
        }
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert("Error", "Failed to pick images. Please try again.");
    }
  };

  // Remove image
  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  // Pick appeal evidence images
  const pickAppealEvidence = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to upload evidence.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5 - appealEvidence.length,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.slice(0, 5 - appealEvidence.length);
        setAppealEvidence([...appealEvidence, ...newImages]);
        
        if (result.assets.length > newImages.length) {
          Alert.alert("Limit Reached", `Only ${newImages.length} image(s) added. Maximum 5 images allowed.`);
        }
      }
    } catch (error) {
      console.error('Error picking appeal evidence:', error);
      Alert.alert("Error", "Failed to pick images. Please try again.");
    }
  };

  // Remove appeal evidence
  const removeAppealEvidence = (index: number) => {
    setAppealEvidence(appealEvidence.filter((_, i) => i !== index));
  };

  // Handle appeal submission
  const handleAppealSubmit = async () => {
    if (!selectedViolationId) {
      Alert.alert("Error", "Please select a penalty violation to appeal");
      return;
    }
    if (!appealReason.trim()) {
      Alert.alert("Error", "Please provide a reason for your appeal");
      return;
    }
    if (appealReason.trim().length < 10) {
      Alert.alert("Error", "Appeal reason must be at least 10 characters long");
      return;
    }

    setLoading(true);

    try {
      console.log('⚖️ Submitting penalty appeal...');
      console.log('📋 Violation ID:', selectedViolationId);
      console.log('📝 Appeal Reason Length:', appealReason.trim().length);
      console.log('📎 Evidence Files:', appealEvidence.length);
      
      // Prepare evidence files if provided
      let evidenceFiles: Array<{ uri: string; type: string; name: string }> | undefined = undefined;
      
      if (appealEvidence.length > 0) {
        evidenceFiles = appealEvidence.map((image, index) => {
          let imageUri = image.uri;
          if (Platform.OS === 'ios' && imageUri.startsWith('file://')) {
            imageUri = imageUri.replace('file://', '');
          }

          const uriParts = imageUri.split('/');
          const fileName = image.fileName || uriParts[uriParts.length - 1] || `appeal_evidence_${index}.jpg`;
          
          let mimeType = 'image/jpeg';
          if (fileName.endsWith('.png')) mimeType = 'image/png';
          else if (fileName.endsWith('.gif')) mimeType = 'image/gif';
          else if (fileName.endsWith('.webp')) mimeType = 'image/webp';

          console.log(`📎 Evidence ${index + 1}:`, {
            uri: imageUri.substring(0, 50) + '...',
            type: mimeType,
            name: fileName
          });

          return {
            uri: imageUri,
            type: mimeType,
            name: fileName,
          };
        });
      }

      // Submit appeal with evidence files
      const result = await submitAppeal(
        parseInt(selectedViolationId),
        appealReason.trim(),
        evidenceFiles
      );

      if (result.success) {
        Alert.alert(
          "Appeal Submitted",
          "Your penalty appeal has been submitted successfully. Admin will review your appeal and respond within 2-3 business days.",
          [
            {
              text: "OK",
              onPress: () => {
                router.replace('/provider/onboarding/pre_homepage');
              },
            }
          ]
        );
      } else {
        Alert.alert(
          "Appeal Failed",
          result.error || "Failed to submit appeal. Please try again."
        );
      }
    } catch (error) {
      console.error('❌ Error submitting appeal:', error);
      Alert.alert("Error", "Failed to submit appeal. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (!reporterName.trim()) {
      Alert.alert("Error", "Please enter your name");
      return false;
    }
    if (!reporterEmail.trim()) {
      Alert.alert("Error", "Please enter your email");
      return false;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(reporterEmail)) {
      Alert.alert("Error", "Please enter a valid email address");
      return false;
    }
    if (!reporterPhone.trim()) {
      Alert.alert("Error", "Please enter your phone number");
      return false;
    }
    if (!reportType) {
      Alert.alert("Error", "Please select a report type");
      return false;
    }
    // If Penalties report type, require violation selection
    if (reportType === 'penalties' && !selectedViolationId) {
      Alert.alert("Error", "Please select a penalty violation to report");
      return false;
    }
    if (!subject.trim()) {
      Alert.alert("Error", "Please enter a subject");
      return false;
    }
    if (!description.trim()) {
      Alert.alert("Error", "Please enter a description");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      console.log('[Report] Submitting provider report...');
      console.log('- Report Type:', reportType);
      console.log('- Appointment ID:', appointmentId || 'None');
      console.log('- Images:', images.length);

      // Prepare images for FormData - React Native specific format
      const preparedImages = images.map((image, index) => {
        // Get the URI without file:// prefix for iOS
        let imageUri = image.uri;
        if (Platform.OS === 'ios' && imageUri.startsWith('file://')) {
          imageUri = imageUri.replace('file://', '');
        }

        // Extract filename from URI if not provided
        const uriParts = imageUri.split('/');
        const fileName = image.fileName || uriParts[uriParts.length - 1] || `report_image_${index}.jpg`;
        
        // Determine MIME type from filename extension
        let mimeType = 'image/jpeg';
        if (fileName.endsWith('.png')) {
          mimeType = 'image/png';
        } else if (fileName.endsWith('.gif')) {
          mimeType = 'image/gif';
        } else if (fileName.endsWith('.webp')) {
          mimeType = 'image/webp';
        }

        console.log(`[Report] Preparing image ${index + 1}:`, {
          originalUri: image.uri.substring(0, 50) + '...',
          processedUri: imageUri.substring(0, 50) + '...',
          fileName,
          mimeType
        });

        return {
          uri: imageUri,
          type: mimeType,
          name: fileName,
        };
      });

      console.log('[Report] Calling API with', preparedImages.length, 'images');

      // Call the API helper
      const result = await submitProviderReport({
        reporter_name: reporterName.trim(),
        reporter_email: reporterEmail.trim(),
        reporter_phone: reporterPhone.trim() || undefined,
        reporter_type: 'provider',
        report_type: reportType,
        subject: subject.trim(),
        description: description.trim(),
        priority: priority as 'low' | 'medium' | 'high' | 'urgent',
        appointment_id: appointmentId || undefined,
        customer_id: customerId || undefined,
        customer_name: customerName.trim() || undefined,
        customer_email: customerEmail.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        violation_id: selectedViolationId || undefined, // Include violation ID for penalties reports
        images: preparedImages.length > 0 ? preparedImages : undefined,
      });

      if (result.success) {
        const appointmentInfo = appointmentId 
          ? `\nBooking ID: #${appointmentId}`
          : '';
        
        Alert.alert(
          "Report Submitted",
          `Your report (ID: ${result.data?.report_id}) has been submitted successfully.${appointmentInfo}\n\nAdmin will review and respond via email within 24-48 hours.`,
          [
            {
              text: "OK",
              onPress: () => {
                // Always go to pre_homepage for safety - avoids otp.tsx issue
                router.replace('/provider/onboarding/pre_homepage');
              },
            }
          ]
        );
      } else {
        Alert.alert(
          "Submission Failed",
          result.message || "Failed to submit report. Please try again."
        );
      }
    } catch (error) {
      console.error('[Report] Error submitting report:', error);
      
      // More detailed error message
      let errorMessage = "Network error. Please check your connection and try again.";
      
      if (error instanceof Error) {
        if (error.message.includes('Network request failed')) {
          errorMessage = `Cannot connect to server at ${BACKEND_URL}.\n\nPlease ensure:\n1. Backend server is running\n2. You're on the same network\n3. Firewall is not blocking the connection`;
        } else if (error.message.includes('Invalid response')) {
          errorMessage = "Server returned an invalid response. Please try again.";
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert(
        "Error",
        errorMessage,
        [
          { text: "OK" },
          { 
            text: "Retry", 
            onPress: () => handleSubmit() 
          }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  if (loadingProfile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#008080" />
        <Text style={{ marginTop: 10, fontFamily: "PoppinsRegular" }}>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: '#e7ecec' }} />
        
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 15,
          backgroundColor: '#e7ecec',
          borderBottomWidth: 1,
          borderBottomColor: '#ddd',
        }}>
          <TouchableOpacity 
            onPress={() => {
              // Always go to pre_homepage for safety - avoids otp.tsx issue
              router.replace('/provider/onboarding/pre_homepage');
            }} 
            style={{ marginRight: 15 }}
          >
            <Ionicons name="arrow-back" size={24} color="#008080" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'black', flex: 1, fontFamily: "PoppinsSemiBold" }}>
            Report an Issue
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.description}>
            Submit a report about bugs, complaints, feedback, or other issues. Our admin team will review and respond via email.
          </Text>

          {/* Fix-Score/Penalty Information Banner */}
          <View style={[
            styles.penaltyInfoBox,
            isSuspended || penaltyScore <= 50 ? styles.penaltyInfoDeactivated :
            penaltyScore <= 60 ? styles.penaltyInfoSevere :
            penaltyScore <= 70 ? styles.penaltyInfoLimited :
            styles.penaltyInfoGood
          ]}>
            <View style={styles.penaltyInfoHeader}>
              <Ionicons 
                name={isSuspended || penaltyScore <= 50 ? "alert-circle" : 
                      penaltyScore <= 60 ? "warning" : 
                      penaltyScore <= 70 ? "information-circle" : 
                      "checkmark-circle"} 
                size={24} 
                color="#FFFFFF" 
              />
              <Text style={styles.penaltyInfoTitle}>Your Fix-Score Information</Text>
            </View>
            <View style={styles.penaltyInfoContent}>
              <View style={styles.penaltyInfoRow}>
                <Text style={styles.penaltyInfoLabel}>Fix-Score:</Text>
                <Text style={styles.penaltyInfoValue}>{penaltyScore} / 100</Text>
              </View>
              <View style={styles.penaltyInfoRow}>
                <Text style={styles.penaltyInfoLabel}>Status:</Text>
                <Text style={styles.penaltyInfoValue}>{penaltyStatus}</Text>
              </View>
              {(isSuspended || penaltyScore <= 50) && (
                <View style={styles.penaltyWarning}>
                  <Text style={styles.penaltyWarningText}>
                    ⚠️ Your account is deactivated. This information will be included in your report.
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Reporter Name */}
          <Text style={styles.label}>
            Your Name <Text style={{ color: "red" }}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            placeholder="Enter your full name"
            value={reporterName}
            onChangeText={setReporterName}
            editable={false}
          />

          {/* Reporter Email */}
          <Text style={styles.label}>
            Email Address <Text style={{ color: "red" }}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            placeholder="your.email@example.com"
            value={reporterEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            onChangeText={setReporterEmail}
            editable={false}
          />

          {/* Reporter Phone (Now Required) */}
          <Text style={styles.label}>
            Phone Number <Text style={{ color: "red" }}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            placeholder="+63 9XX XXX XXXX"
            value={reporterPhone}
            keyboardType="phone-pad"
            onChangeText={setReporterPhone}
            editable={false}
          />

          {/* Report Type */}
          <Text style={styles.label}>
            Report Type <Text style={{ color: "red" }}>*</Text>
          </Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={reportType}
              onValueChange={(val) => setReportType(val)}
            >
              <Picker.Item label="Select report type..." value="" />
              <Picker.Item label="🐛 Bug Report" value="bug" />
              <Picker.Item label="😠 Complaint" value="complaint" />
              <Picker.Item label="💭 Feedback / Suggestion" value="feedback" />
              <Picker.Item label="👤 Account Issue" value="account_issue" />
              <Picker.Item label="👥 Customer Issue" value="customer_issue" />
              <Picker.Item label="⚠️ Safety Concern" value="safety_concern" />
              <Picker.Item label="⚡ Penalties" value="penalties" />
              <Picker.Item label="📋 Other" value="other" />
            </Picker>
          </View>

          {/* Violation Selection - Show when Penalties report type is selected */}
          {reportType === 'penalties' && (
            <>
              <Text style={styles.label}>
                Select Penalty Violation <Text style={{ color: "red" }}>*</Text>
              </Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={selectedViolationId}
                  onValueChange={(val) => setSelectedViolationId(val)}
                >
                  <Picker.Item label="Select a penalty violation..." value="" />
                  {violations.map((violation) => {
                    const date = new Date(violation.created_at || violation.violation_date).toLocaleDateString();
                    const points = violation.points_deducted || violation.penalty_points || 0;
                    const reason = violation.violation_reason || violation.reason || 'Violation';
                    const status = violation.status || 'PENDING';
                    const label = `${reason} (-${points} pts) - ${date} [${status}]`;
                    return (
                      <Picker.Item 
                        key={violation.violation_id || violation.id} 
                        label={label} 
                        value={(violation.violation_id || violation.id).toString()} 
                      />
                    );
                  })}
                  {violations.length === 0 && (
                    <Picker.Item label="No penalty violations found" value="" />
                  )}
                </Picker>
              </View>
              
              {selectedViolationId && (
                <>
                  <View style={styles.infoBox}>
                    <Ionicons name="information-circle" size={20} color="#008080" />
                    <Text style={styles.infoText}>
                      You selected a penalty violation. Choose an action below.
                    </Text>
                  </View>

                  {/* Action Selection: Report or Appeal */}
                  <Text style={styles.label}>
                    Action <Text style={{ color: "red" }}>*</Text>
                  </Text>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        penaltyAction === 'report' && styles.actionButtonActive
                      ]}
                      onPress={() => setPenaltyAction('report')}
                    >
                      <Ionicons 
                        name="flag" 
                        size={20} 
                        color={penaltyAction === 'report' ? '#FFFFFF' : '#008080'} 
                      />
                      <Text style={[
                        styles.actionButtonText,
                        penaltyAction === 'report' && styles.actionButtonTextActive
                      ]}>
                        Report Issue
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        penaltyAction === 'appeal' && styles.actionButtonActive
                      ]}
                      onPress={() => setPenaltyAction('appeal')}
                    >
                      <Ionicons 
                        name="scale" 
                        size={20} 
                        color={penaltyAction === 'appeal' ? '#FFFFFF' : '#008080'} 
                      />
                      <Text style={[
                        styles.actionButtonText,
                        penaltyAction === 'appeal' && styles.actionButtonTextActive
                      ]}>
                        Appeal Penalty
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {penaltyAction === 'appeal' && (
                    <View style={styles.appealInfoBox}>
                      <Ionicons name="information-circle" size={20} color="#2196F3" />
                      <Text style={styles.appealInfoText}>
                        Submit an appeal if you believe this penalty was issued incorrectly. Include a detailed explanation and supporting evidence.
                      </Text>
                    </View>
                  )}
                </>
              )}
            </>
          )}

          {/* Appointment Selection - Conditional */}
          {(reportType === 'complaint' || reportType === 'customer_issue' || reportType === 'payment_issue') && (
            <>
              <Text style={styles.label}>Related Booking (Optional)</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={appointmentId || ''}
                  onValueChange={handleAppointmentChange}
                >
                  <Picker.Item label="Select a booking (optional)..." value="" />
                  {appointments.map((apt) => {
                    const date = new Date(apt.scheduled_date).toLocaleDateString();
                    const customerName = apt.customer_first_name && apt.customer_last_name 
                      ? `${apt.customer_first_name} ${apt.customer_last_name}` 
                      : 'Customer';
                    const label = `Booking #${apt.appointment_id} - ${apt.service_title} - ${customerName} on ${date}`;
                    return (
                      <Picker.Item 
                        key={apt.appointment_id} 
                        label={label} 
                        value={apt.appointment_id.toString()} 
                      />
                    );
                  })}
                </Picker>
              </View>
              {appointmentId && (
                <Text style={styles.helperText}>
                  Customer will be automatically notified if selected.
                </Text>
              )}
              
              {/* Customer Information Display - Auto-filled */}
              {appointmentId && customerName && (
                <View style={styles.customerInfoBox}>
                  <View style={styles.customerInfoHeader}>
                    <Ionicons name="person-circle-outline" size={20} color="#008080" />
                    <Text style={styles.customerInfoTitle}>Customer Information</Text>
                  </View>
                  
                  {customerName && (
                    <View style={styles.customerInfoRow}>
                      <Ionicons name="person" size={16} color="#666" />
                      <Text style={styles.customerInfoLabel}>Name:</Text>
                      <Text style={styles.customerInfoValue}>{customerName}</Text>
                    </View>
                  )}
                  
                  {customerEmail && (
                    <View style={styles.customerInfoRow}>
                      <Ionicons name="mail" size={16} color="#666" />
                      <Text style={styles.customerInfoLabel}>Email:</Text>
                      <Text style={styles.customerInfoValue}>{customerEmail}</Text>
                    </View>
                  )}
                  
                  {customerPhone && (
                    <View style={styles.customerInfoRow}>
                      <Ionicons name="call" size={16} color="#666" />
                      <Text style={styles.customerInfoLabel}>Phone:</Text>
                      <Text style={styles.customerInfoValue}>{customerPhone}</Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          {/* Conditional: Show appeal form or regular report form */}
          {reportType === 'penalties' && penaltyAction === 'appeal' ? (
            <>
              {/* Appeal Reason */}
              <Text style={styles.label}>
                Appeal Reason <Text style={{ color: "red" }}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Explain why you believe this penalty was issued incorrectly..."
                value={appealReason}
                onChangeText={setAppealReason}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
              <Text style={styles.helperText}>
                Provide a detailed explanation with relevant facts and context.
              </Text>

              {/* Appeal Evidence Upload */}
              <Text style={styles.label}>Supporting Evidence (Optional but Recommended)</Text>
              <TouchableOpacity 
                style={styles.imageButton} 
                onPress={pickAppealEvidence}
                disabled={appealEvidence.length >= 5}
              >
                <Ionicons name="document-attach" size={24} color={appealEvidence.length >= 5 ? "#999" : "#2196F3"} />
                <Text style={[styles.imageButtonText, appealEvidence.length >= 5 && { color: "#999" }]}>
                  Add Evidence ({appealEvidence.length}/5)
                </Text>
              </TouchableOpacity>
              
              {appealEvidence.length > 0 && (
                <View style={styles.imagePreviewContainer}>
                  {appealEvidence.map((image, index) => (
                    <View key={index} style={styles.imagePreview}>
                      <Image source={{ uri: image.uri }} style={styles.previewImage} />
                      <TouchableOpacity 
                        style={styles.removeImageButton}
                        onPress={() => removeAppealEvidence(index)}
                      >
                        <Ionicons name="close-circle" size={24} color="#ff4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              
              <Text style={styles.helperText}>
                Upload screenshots, photos, or documents that support your appeal.
              </Text>
            </>
          ) : (
            <>
              {/* Regular Report Form Fields */}
              {/* Image Upload */}
              <Text style={styles.label}>Attach Images (Optional)</Text>
              <TouchableOpacity 
                style={styles.imageButton} 
                onPress={pickImages}
                disabled={images.length >= 5}
              >
                <Ionicons name="camera-outline" size={24} color={images.length >= 5 ? "#999" : "#008080"} />
                <Text style={[styles.imageButtonText, images.length >= 5 && { color: "#999" }]}>
                  Add Images ({images.length}/5)
                </Text>
              </TouchableOpacity>
              
              {images.length > 0 && (
                <View style={styles.imagePreviewContainer}>
                  {images.map((image, index) => (
                    <View key={index} style={styles.imagePreview}>
                      <Image source={{ uri: image.uri }} style={styles.previewImage} />
                      <TouchableOpacity 
                        style={styles.removeImageButton}
                        onPress={() => removeImage(index)}
                      >
                        <Ionicons name="close-circle" size={24} color="#ff4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              
              <Text style={styles.helperText}>
                Max 5 images, 5MB each. Supported: JPEG, PNG, GIF, WebP
              </Text>

              {/* Subject */}
              <Text style={styles.label}>
                Subject <Text style={{ color: "red" }}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Brief summary of the issue"
                value={subject}
                onChangeText={setSubject}
              />
            </>
          )}

          {/* Priority - Show for both */}
          {!(reportType === 'penalties' && penaltyAction === 'appeal') && (
            <>
              {/* Priority */}
              <Text style={styles.label}>
                Priority <Text style={{ color: "red" }}>*</Text>
              </Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={priority}
                  onValueChange={(val) => setPriority(val)}
                >
                  <Picker.Item label="🟢 Low - Can Wait" value="low" />
                  <Picker.Item label="🟡 Normal - Standard Priority" value="normal" />
                  <Picker.Item label="🟠 High - Needs Attention Soon" value="high" />
                  <Picker.Item label="🔴 Urgent - Immediate Attention" value="urgent" />
                </Picker>
              </View>

              {/* Description */}
              <Text style={styles.label}>
                Description <Text style={{ color: "red" }}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, { height: 120, textAlignVertical: "top" }]}
                placeholder="Describe the issue in detail. Include steps to reproduce if it's a bug, or relevant details for complaints/feedback..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={6}
              />
            </>
          )}

          {/* Information Box */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color="#008080" style={{ marginRight: 8 }} />
            <Text style={styles.infoText}>
              {reportType === 'penalties' && penaltyAction === 'appeal'
                ? 'Your appeal will be reviewed by the admin team within 2-3 business days.'
                : 'Our admin team will review your report and respond via email within 24-48 hours.'}
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity 
            style={[styles.button, loading && { opacity: 0.6 }]} 
            onPress={reportType === 'penalties' && penaltyAction === 'appeal' ? handleAppealSubmit : handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {reportType === 'penalties' && penaltyAction === 'appeal' ? 'Submit Appeal' : 'Submit Report'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  description: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
    lineHeight: 20,
    fontFamily: "PoppinsRegular",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
    fontFamily: "PoppinsSemiBold",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d1d1",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 14,
    backgroundColor: "#fafafa",
    fontFamily: "PoppinsRegular",
  },
  inputDisabled: {
    backgroundColor: "#f5f5f5",
    color: "#666",
  },
  // Penalty/Fix-Score Info Styles
  penaltyInfoBox: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  penaltyInfoGood: {
    backgroundColor: '#10B981',
  },
  penaltyInfoLimited: {
    backgroundColor: '#FB923C',
  },
  penaltyInfoSevere: {
    backgroundColor: '#EF4444',
  },
  penaltyInfoDeactivated: {
    backgroundColor: '#DC2626',
  },
  penaltyInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.3)',
  },
  penaltyInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 10,
    fontFamily: 'PoppinsBold',
  },
  penaltyInfoContent: {
    gap: 8,
  },
  penaltyInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  penaltyInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'PoppinsSemiBold',
  },
  penaltyInfoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'PoppinsBold',
  },
  penaltyWarning: {
    marginTop: 8,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
  },
  penaltyWarningText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: 'PoppinsSemiBold',
    lineHeight: 18,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#d1d1d1",
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: "#fafafa",
  },
  helperText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 16,
    fontStyle: 'italic',
    fontFamily: "PoppinsRegular",
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: "#008080",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#f0fafa",
  },
  imageButtonText: {
    fontSize: 14,
    color: "#008080",
    fontWeight: "600",
    marginLeft: 8,
    fontFamily: "PoppinsSemiBold",
  },
  imagePreviewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
    gap: 8,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f5f5f5',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#e6f7f7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#008080",
    lineHeight: 18,
    fontFamily: "PoppinsRegular",
  },
  customerInfoBox: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#b3e0ff',
  },
  customerInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#d9ecff',
  },
  customerInfoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#008080',
    marginLeft: 8,
    fontFamily: 'PoppinsSemiBold',
  },
  customerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  customerInfoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginLeft: 8,
    width: 60,
    fontFamily: 'PoppinsSemiBold',
  },
  customerInfoValue: {
    fontSize: 13,
    color: '#333',
    flex: 1,
    fontFamily: 'PoppinsRegular',
  },
  button: {
    backgroundColor: "#008080",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "PoppinsSemiBold",
  },
  // Action button styles for Report vs Appeal
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#008080',
    backgroundColor: '#fff',
    gap: 8,
  },
  actionButtonActive: {
    backgroundColor: '#008080',
    borderColor: '#008080',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#008080',
    fontFamily: 'PoppinsSemiBold',
  },
  actionButtonTextActive: {
    color: '#FFFFFF',
  },
  appealInfoBox: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    alignItems: 'flex-start',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  appealInfoText: {
    flex: 1,
    fontSize: 13,
    color: "#1976D2",
    lineHeight: 18,
    fontFamily: "PoppinsRegular",
    marginLeft: 8,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
});

export default ProviderReportForm;
