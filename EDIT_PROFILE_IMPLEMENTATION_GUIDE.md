# Edit Profile Implementation Guide

## Overview

This document provides a comprehensive guide on how the **Edit Profile** feature is implemented in the **User App** (`editprofile.tsx`). You can use this as a reference to implement the same functionality in the **Service Provider App**.

---

## 📋 Table of Contents

1. [Feature Overview](#feature-overview)
2. [Key Features](#key-features)
3. [Architecture & Flow](#architecture--flow)
4. [Implementation Steps](#implementation-steps)
5. [API Endpoints Required](#api-endpoints-required)
6. [Code Structure](#code-structure)
7. [Step-by-Step Guide](#step-by-step-guide)
8. [UI Components](#ui-components)
9. [Security Features](#security-features)
10. [Testing Checklist](#testing-checklist)

---

## Feature Overview

The Edit Profile feature allows users to update their profile information with:
- **OTP-based security verification**
- **Two-step email change process**
- **Cascading location dropdowns** (Province → Municipality → Barangay)
- **Interactive map location picker**
- **Approval status checks** (only approved users can edit)
- **Field-level restrictions** (some fields editable only after OTP verification)

---

## Key Features

### 1. **OTP Security System**
- Users must request a verification code before editing
- Code sent to current email address
- 10-minute expiration timer
- Resend functionality

### 2. **Two-Step Email Change**
- Step 1: Verify old email with OTP
- Step 2: Verify new email with OTP
- Prevents unauthorized email changes

### 3. **Location Management**
- Cascading dropdowns (Metro Manila locations)
- Automatic address string generation
- Geocoding to convert address → coordinates
- Interactive map for pinpoint location selection

### 4. **Approval Status Control**
- Only approved users can edit profile
- Warning banners for pending/rejected accounts
- Special handling for rejected accounts (resubmission)

### 5. **Form Validation**
- Phone number format validation (11 digits)
- Email format validation
- Required fields checking
- OTP format validation (6 digits)

---

## Architecture & Flow

```
┌─────────────────────────────────────────────────────────┐
│                    Edit Profile Screen                   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  Check Verification Status            │
        │  - approved → Allow editing           │
        │  - pending → Show warning, block      │
        │  - rejected → Allow resubmission      │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  Request OTP                          │
        │  - Sends code to current email        │
        │  - 10-minute expiration timer         │
        │  - Unlocks form fields                │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  User Edits Profile                   │
        │  - Phone, Location, etc.              │
        │  - Email change triggers 2-step flow  │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  Click Save                           │
        │  - Validates fields                   │
        │  - Shows OTP modal                    │
        └───────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
            Email                    No Email
            Changed?                 Change
                │                       │
                ▼                       ▼
    ┌──────────────────────┐   ┌──────────────────────┐
    │ Step 1: Verify old   │   │ Verify OTP           │
    │ email OTP            │   │                      │
    └──────────────────────┘   │ Update Profile       │
                │              │                      │
                ▼              └──────────────────────┘
    ┌──────────────────────┐
    │ Step 2: Verify new   │
    │ email OTP            │
    └──────────────────────┘
                │
                ▼
    ┌──────────────────────┐
    │ Update Profile       │
    └──────────────────────┘
                │
                ▼
        ┌───────────────────────────────────────┐
        │  Success!                             │
        │  - Show success message               │
        │  - Navigate back to profile           │
        └───────────────────────────────────────┘
```

---

## API Endpoints Required

### For User App (already implemented):

| Endpoint | Method | Purpose | Request Body | Response |
|----------|--------|---------|--------------|----------|
| `/auth/customer-profile` | GET | Load user profile | None | User data object |
| `/auth/customer-profile/request-otp` | POST | Request OTP code | None | `{ success, maskedEmail }` |
| `/auth/customer-profile` | PUT | Update profile | `{ phone_number, user_location, exact_location, otp }` | `{ success, message }` |
| `/auth/verify-email-change-step1` | POST | Verify old email OTP | `{ new_email }` + `?otp={code}` | `{ success, message }` |
| `/auth/verify-email-change-step2` | POST | Verify new email OTP | `{ new_email }` + `?otp={code}` | `{ success, message }` |

### For Service Provider App (you need to implement):

| Endpoint | Method | Purpose | Request Body | Response |
|----------|--------|---------|--------------|----------|
| `/auth/provider-profile` | GET | Load provider profile | None | Provider data object |
| `/auth/provider-profile/request-otp` | POST | Request OTP code | None | `{ success, maskedEmail }` |
| `/auth/provider-profile` | PUT | Update profile | `{ phone_number, provider_location, provider_exact_location, otp }` | `{ success, message }` |
| `/auth/verify-provider-email-change-step1` | POST | Verify old email OTP | `{ new_email }` + `?otp={code}` | `{ success, message }` |
| `/auth/verify-provider-email-change-step2` | POST | Verify new email OTP | `{ new_email }` + `?otp={code}` | `{ success, message }` |

---

## Code Structure

```
serviceprovider/
├── app/
│   ├── editprofile.tsx              ← Main edit profile screen
│   ├── components/
│   │   ├── PageHeader.tsx           ← Reusable header component
│   │   └── LocationMapPicker.tsx    ← Map picker component
│   └── data/
│       └── metro-manila-locations.json  ← Location data
└── utils/
    └── (any utility functions)
```

---

## Step-by-Step Guide

### Step 1: Create the Edit Profile Component

**File:** `serviceprovider/app/editprofile.tsx`

```tsx
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useState, useEffect } from "react";
import {
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import PageHeader from "./components/PageHeader";
import LocationMapPicker from "./components/LocationMapPicker";
import MapView from 'react-native-maps';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_LINK || process.env.BACKEND_LINK || 'http://localhost:3000';

// Import Metro Manila locations data
const metroManilaLocations = require('./data/metro-manila-locations.json');
```

### Step 2: Define Interface

```tsx
interface ProviderData {
  provider_id: number;
  provider_first_name: string;
  provider_last_name: string;
  provider_email: string;
  provider_phone_number: string;
  provider_location: string;
  provider_profile_photo?: string;
  provider_valid_id?: string;
  provider_birthday?: string;
  gender?: string;
  verification_status?: string;
  rejection_reason?: string;
  provider_isVerified?: boolean;
  provider_exact_location?: string;
}
```

### Step 3: Set Up State Variables

```tsx
export default function EditProfile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providerData, setProviderData] = useState<ProviderData | null>(null);
  
  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profileUri, setProfileUri] = useState<string | null>(null);
  const [locationCoordinates, setLocationCoordinates] = useState<{ lat: number; lng: number } | undefined>();

  // Location cascading states
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedMunicipality, setSelectedMunicipality] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [showProvincePicker, setShowProvincePicker] = useState(false);
  const [showMunicipalityPicker, setShowMunicipalityPicker] = useState(false);
  const [showBarangayPicker, setShowBarangayPicker] = useState(false);

  // OTP states
  const [otpRequested, setOtpRequested] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [originalEmail, setOriginalEmail] = useState('');
  
  // Email change states
  const [showSecondOtpModal, setShowSecondOtpModal] = useState(false);
  const [secondOtp, setSecondOtp] = useState('');
  const [newEmailForVerification, setNewEmailForVerification] = useState('');
  
  // Map picker state
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const mapRef = React.useRef<MapView>(null);

  useEffect(() => {
    loadProviderProfile();
  }, []);

  // OTP Timer countdown
  useEffect(() => {
    if (otpTimer > 0) {
      const interval = setInterval(() => {
        setOtpTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [otpTimer]);

  // ... rest of the code
}
```

### Step 4: Location Helper Functions

```tsx
// Location helper functions
const getProvinces = () => {
  if (!metroManilaLocations.NCR?.province_list) return [];
  return Object.keys(metroManilaLocations.NCR.province_list);
};

const getMunicipalities = () => {
  if (!selectedProvince || !metroManilaLocations.NCR?.province_list[selectedProvince]?.municipality_list) return [];
  return Object.keys(metroManilaLocations.NCR.province_list[selectedProvince].municipality_list);
};

const getBarangays = () => {
  if (!selectedProvince || !selectedMunicipality) return [];
  const municipalityData = metroManilaLocations.NCR?.province_list[selectedProvince]?.municipality_list[selectedMunicipality];
  return municipalityData?.barangay_list || [];
};

// Reset cascading selections when parent changes
useEffect(() => {
  setSelectedMunicipality('');
  setSelectedBarangay('');
}, [selectedProvince]);

useEffect(() => {
  setSelectedBarangay('');
}, [selectedMunicipality]);

// Update homeAddress when location is selected
useEffect(() => {
  if (selectedBarangay && selectedMunicipality && selectedProvince) {
    const locationString = `${selectedBarangay}, ${selectedMunicipality}, ${selectedProvince}`;
    setHomeAddress(locationString);
  }
}, [selectedBarangay, selectedMunicipality, selectedProvince]);
```

### Step 5: Load Profile Function

```tsx
const loadProviderProfile = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      Alert.alert('Error', 'Please login first');
      router.replace('/login');
      return;
    }

    // ⚠️ CHANGE THIS ENDPOINT for service provider
    const response = await fetch(`${BACKEND_URL}/auth/provider-profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const result = await response.json();
      const data = result.data;
      setProviderData(data);
      
      // Populate form fields - USE PROVIDER FIELD NAMES
      setFirstName(data.provider_first_name || '');
      setLastName(data.provider_last_name || '');
      setEmail(data.provider_email || '');
      setOriginalEmail(data.provider_email || '');
      setPhone(data.provider_phone_number ? data.provider_phone_number.replace('+63', '') : '');
      setHomeAddress(data.provider_location || '');
      
      // Parse location to pre-populate cascading dropdowns
      if (data.provider_location) {
        const locationParts = data.provider_location.split(', ');
        if (locationParts.length === 3) {
          setSelectedBarangay(locationParts[0].trim());
          setSelectedMunicipality(locationParts[1].trim());
          setSelectedProvince(locationParts[2].trim());
        }
      }
      
      // Set profile photo
      if (data.provider_profile_photo) {
        const photoUrl = data.provider_profile_photo.startsWith('http') 
          ? data.provider_profile_photo 
          : `${BACKEND_URL}/${data.provider_profile_photo}`;
        setProfileUri(photoUrl);
      }
      
      // Parse exact location coordinates
      if (data.provider_exact_location) {
        const [lat, lng] = data.provider_exact_location.split(',').map(parseFloat);
        if (!isNaN(lat) && !isNaN(lng)) {
          setLocationCoordinates({ lat, lng });
        }
      }
    } else if (response.status === 401) {
      Alert.alert('Session Expired', 'Please login again');
      router.replace('/login');
    } else {
      Alert.alert('Error', 'Failed to load profile');
    }
  } catch (error) {
    console.error('Error loading profile:', error);
    Alert.alert('Error', 'Network error while loading profile');
  } finally {
    setLoading(false);
  }
};
```

### Step 6: Request OTP Function

```tsx
const requestOTP = async () => {
  try {
    // Check if provider is approved
    if (providerData?.verification_status !== 'approved') {
      Alert.alert(
        'Profile Edit Restricted',
        'You can only edit your profile once your account is approved. Current status: ' + 
        (providerData?.verification_status || 'pending'),
        [{ text: 'OK' }]
      );
      return;
    }

    setRequestingOtp(true);
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      Alert.alert('Error', 'Please login first');
      return;
    }

    // ⚠️ CHANGE THIS ENDPOINT for service provider
    const response = await fetch(`${BACKEND_URL}/auth/provider-profile/request-otp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const result = await response.json();
    console.log('OTP Request Response:', result);

    if (!response.ok) {
      Alert.alert('Error', result.message || `Server error: ${response.status}`);
      return;
    }

    if (result.success) {
      const maskedEmailValue = result.data?.maskedEmail || result.maskedEmail || 'your email';
      setMaskedEmail(maskedEmailValue);
      setOtpRequested(true);
      setOtpTimer(600); // 10 minutes = 600 seconds
      Alert.alert(
        'Verification Code Sent',
        `A 6-digit code has been sent to ${maskedEmailValue}. It will expire in 10 minutes.`,
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert('Error', result.message || 'Failed to send verification code');
    }
  } catch (error) {
    console.error('Error requesting OTP:', error);
    Alert.alert('Error', 'Network error while requesting verification code');
  } finally {
    setRequestingOtp(false);
  }
};
```

### Step 7: Geocoding Function

```tsx
const geocodeAddress = async () => {
  if (!selectedProvince || !selectedMunicipality || !selectedBarangay) {
    Alert.alert('Missing Location', 'Please select Province, Municipality, and Barangay first');
    return;
  }

  setIsGeocoding(true);
  try {
    // Construct address string
    const address = `${selectedBarangay}, ${selectedMunicipality}, ${selectedProvince}, Philippines`;
    
    // Use Nominatim OpenStreetMap geocoding API (free, no key required)
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
      {
        headers: {
          'User-Agent': 'FixMoApp/1.0', // Required by Nominatim
        },
      }
    );

    const data = await response.json();

    if (data && data.length > 0) {
      const { lat, lon } = data[0];
      const newLat = parseFloat(lat);
      const newLng = parseFloat(lon);
      
      // Set coordinates for the map
      setLocationCoordinates({ lat: newLat, lng: newLng });
      
      Alert.alert(
        'Location Found',
        'Map will center on your area. You can adjust the pin to your exact location.',
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'Location Not Found',
        'Could not find exact coordinates. The map will open for you to manually pin your location.',
        [{ text: 'OK' }]
      );
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    Alert.alert(
      'Geocoding Error',
      'Failed to locate address. You can manually pin your location on the map.',
      [{ text: 'OK' }]
    );
  } finally {
    setIsGeocoding(false);
    // Open map picker after geocoding attempt
    setShowMapPicker(true);
  }
};
```

### Step 8: Save Handler

```tsx
const handleSave = async () => {
  // Check if provider is approved
  if (providerData?.verification_status !== 'approved') {
    Alert.alert(
      'Profile Edit Restricted',
      'You can only edit your profile once your account is approved.',
      [{ text: 'OK' }]
    );
    return;
  }

  // Check if OTP was requested
  if (!otpRequested) {
    Alert.alert(
      'Verification Required',
      'Please request a verification code first before saving changes.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Request Code', onPress: requestOTP }
      ]
    );
    return;
  }

  // Validation
  if (!firstName || !lastName) {
    Alert.alert('Validation Error', 'First name and last name are required');
    return;
  }

  if (!phone || phone.length !== 10) { // Note: without +63
    Alert.alert('Validation Error', 'Please enter a valid 10-digit phone number');
    return;
  }

  if (!homeAddress) {
    Alert.alert('Validation Error', 'Home address is required');
    return;
  }

  // Show OTP modal for verification before saving
  setShowOtpModal(true);
};
```

### Step 9: Submit Profile Update

```tsx
const submitProfileUpdate = async () => {
  // Validate OTP
  const trimmedOtp = otp.trim();
  
  if (!trimmedOtp || trimmedOtp.length !== 6) {
    Alert.alert('Error', 'Please enter a valid 6-digit verification code');
    return;
  }

  // Check if email is being changed
  const isEmailChanging = email !== originalEmail;

  if (isEmailChanging) {
    // Start email change flow
    await handleEmailChangeFlow(trimmedOtp);
  } else {
    // Regular profile update
    await performProfileUpdate(false, trimmedOtp);
  }
};
```

### Step 10: Email Change Flow (Two-Step Process)

```tsx
const handleEmailChangeFlow = async (otpCode: string) => {
  setSaving(true);
  setShowOtpModal(false);

  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      Alert.alert('Error', 'Please login first');
      setSaving(false);
      return;
    }

    // ⚠️ CHANGE THIS ENDPOINT for service provider
    // Step 1: Verify OTP with current email
    const step1Response = await fetch(`${BACKEND_URL}/auth/verify-provider-email-change-step1?otp=${otpCode}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ new_email: email }),
    });

    const step1Result = await step1Response.json();

    if (!step1Result.success) {
      Alert.alert('Error', step1Result.message || 'Failed to verify current email');
      setShowOtpModal(true);
      setSaving(false);
      return;
    }

    // Step 1 successful - now prompt for second OTP
    setNewEmailForVerification(email);
    setSecondOtp('');
    setShowSecondOtpModal(true);
    setSaving(false);

  } catch (error) {
    console.error('Error in email change flow:', error);
    Alert.alert('Error', 'Network error during email verification');
    setSaving(false);
  }
};

const verifySecondEmailOtp = async () => {
  if (!secondOtp || secondOtp.length !== 6) {
    Alert.alert('Error', 'Please enter a valid 6-digit code');
    return;
  }

  setSaving(true);
  setShowSecondOtpModal(false);

  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      Alert.alert('Error', 'Please login first');
      setSaving(false);
      return;
    }

    // ⚠️ CHANGE THIS ENDPOINT for service provider
    // Step 2: Verify OTP with new email and complete email change
    const step2Response = await fetch(`${BACKEND_URL}/auth/verify-provider-email-change-step2?otp=${secondOtp}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ new_email: newEmailForVerification }),
    });

    const step2Result = await step2Response.json();

    if (step2Result.success) {
      // Email change successful, now update rest of profile
      await performProfileUpdate(true);
    } else {
      Alert.alert('Error', step2Result.message || 'Failed to verify new email', [
        { text: 'Try Again', onPress: () => setShowSecondOtpModal(true) },
        { text: 'Cancel', style: 'cancel', onPress: () => setSaving(false) }
      ]);
    }
  } catch (error) {
    console.error('Error verifying second email OTP:', error);
    Alert.alert('Error', 'Network error during new email verification', [
      { text: 'Try Again', onPress: () => setShowSecondOtpModal(true) },
      { text: 'Cancel', style: 'cancel', onPress: () => setSaving(false) }
    ]);
  }
};
```

### Step 11: Perform Profile Update

```tsx
const performProfileUpdate = async (emailAlreadyUpdated: boolean = false, otpCode?: string) => {
  if (!emailAlreadyUpdated) {
    setSaving(true);
    setShowOtpModal(false);
  }

  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      Alert.alert('Error', 'Please login first');
      setSaving(false);
      return;
    }

    // ⚠️ CHANGE THIS ENDPOINT and FIELD NAMES for service provider
    const useOtp = otpCode || otp.trim();
    const endpoint = `${BACKEND_URL}/auth/provider-profile`;
    
    const updateData: any = {
      provider_phone_number: `+63${phone}`,  // ⚠️ Use provider field name
      provider_location: homeAddress,         // ⚠️ Use provider field name
      otp: !emailAlreadyUpdated ? useOtp : undefined, // Only send OTP if not already verified
    };

    // Add email if changed and not already updated
    if (!emailAlreadyUpdated && email !== originalEmail) {
      updateData.provider_email = email;  // ⚠️ Use provider field name
    }

    // Add exact location coordinates
    if (locationCoordinates) {
      updateData.provider_exact_location = `${locationCoordinates.lat},${locationCoordinates.lng}`;
    }

    console.log('Sending update with data:', updateData);

    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    const result = await response.json();

    if (result.success) {
      // Profile updated successfully
      Alert.alert(
        'Success',
        emailAlreadyUpdated ? 'Profile and email updated successfully!' : 'Profile updated successfully!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
      
      // Reset OTP state
      setOtp('');
      setOtpRequested(false);
      setOtpTimer(0);
    } else {
      Alert.alert('Error', result.message || 'Failed to update profile');
      if (!emailAlreadyUpdated) {
        setShowOtpModal(true); // Show modal again for retry
      }
    }
  } catch (error) {
    console.error('Error saving profile:', error);
    Alert.alert('Error', 'Network error while saving profile');
    if (!emailAlreadyUpdated) {
      setShowOtpModal(true); // Show modal again for retry
    }
  } finally {
    setSaving(false);
  }
};
```

---

## UI Components

### 1. OTP Request Section

```tsx
{/* OTP Request Section - Only for approved providers */}
{providerData?.verification_status === 'approved' && (
  <View style={{ marginHorizontal: 20, marginTop: 15 }}>
    {!otpRequested ? (
      <View style={{
        backgroundColor: '#e6f7ff',
        borderRadius: 10,
        padding: 15,
        borderWidth: 1,
        borderColor: '#008080',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <Ionicons name="shield-checkmark" size={24} color="#008080" style={{ marginRight: 10 }} />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#008080', flex: 1 }}>
            Security Verification Required
          </Text>
        </View>
        <Text style={{ fontSize: 14, color: '#333', marginBottom: 15 }}>
          For your security, we need to verify your identity before making changes to your profile.
        </Text>
        <TouchableOpacity
          onPress={requestOTP}
          disabled={requestingOtp}
          style={{
            backgroundColor: requestingOtp ? '#ccc' : '#008080',
            borderRadius: 10,
            paddingVertical: 12,
            alignItems: 'center',
          }}
        >
          {requestingOtp ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
              Request Verification Code
            </Text>
          )}
        </TouchableOpacity>
      </View>
    ) : (
      <View style={{
        backgroundColor: '#e8f5e9',
        borderRadius: 10,
        padding: 15,
        borderWidth: 1,
        borderColor: '#4caf50',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
          <Ionicons name="checkmark-circle" size={24} color="#4caf50" style={{ marginRight: 10 }} />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#4caf50' }}>
            Code Sent
          </Text>
        </View>
        <Text style={{ fontSize: 14, color: '#333', marginBottom: 5 }}>
          Verification code sent to: {maskedEmail}
        </Text>
        <Text style={{ fontSize: 13, color: '#666' }}>
          {otpTimer > 0 
            ? `Code expires in ${Math.floor(otpTimer / 60)}:${(otpTimer % 60).toString().padStart(2, '0')}`
            : 'Code expired'}
        </Text>
        {otpTimer <= 0 && (
          <TouchableOpacity
            onPress={requestOTP}
            disabled={requestingOtp}
            style={{
              backgroundColor: '#008080',
              borderRadius: 10,
              paddingVertical: 10,
              alignItems: 'center',
              marginTop: 10,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
              Resend Code
            </Text>
          </TouchableOpacity>
        )}
      </View>
    )}
  </View>
)}
```

### 2. Status Warning Banners

```tsx
{/* Not Approved Warning */}
{providerData?.verification_status !== 'approved' && (
  <View style={{
    marginHorizontal: 20,
    marginTop: 15,
    backgroundColor: '#fff3e0',
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: '#ff9800',
  }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <Ionicons name="lock-closed" size={24} color="#ff9800" style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#ff9800', marginBottom: 5 }}>
          Profile Editing Restricted
        </Text>
        <Text style={{ fontSize: 14, color: '#333' }}>
          You can only edit your profile once your account is approved.
          {providerData?.verification_status === 'pending' && ' Your verification is currently under review.'}
          {providerData?.verification_status === 'rejected' && ' Please resubmit your verification documents.'}
        </Text>
      </View>
    </View>
  </View>
)}
```

### 3. Cascading Location Dropdowns

```tsx
{/* Home Address */}
<View style={{ marginBottom: 20 }}>
  <Text style={{ fontWeight: "bold", marginBottom: 5, fontSize: 14 }}>
    Business Address *
  </Text>
  <Text style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>
    Select your Province, Municipality, and Barangay
  </Text>
  
  {/* Province Picker */}
  <TouchableOpacity
    onPress={() => setShowProvincePicker(true)}
    disabled={providerData?.verification_status === 'approved' && !otpRequested}
    style={{
      backgroundColor: "#e7ecec",
      borderRadius: 10,
      paddingHorizontal: 15,
      paddingVertical: 12,
      marginBottom: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      opacity: (providerData?.verification_status === 'approved' && !otpRequested) ? 0.5 : 1,
    }}
  >
    <Text style={{ fontSize: 16, color: selectedProvince ? '#000' : '#999' }}>
      {selectedProvince || 'Choose your Province/District'}
    </Text>
    <Ionicons name="chevron-down" size={20} color="#008080" />
  </TouchableOpacity>

  {/* Municipality Picker */}
  <TouchableOpacity
    onPress={() => setShowMunicipalityPicker(true)}
    disabled={!selectedProvince || (providerData?.verification_status === 'approved' && !otpRequested)}
    style={{
      backgroundColor: "#e7ecec",
      borderRadius: 10,
      paddingHorizontal: 15,
      paddingVertical: 12,
      marginBottom: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      opacity: (!selectedProvince || (providerData?.verification_status === 'approved' && !otpRequested)) ? 0.5 : 1,
    }}
  >
    <Text style={{ fontSize: 16, color: selectedMunicipality ? '#000' : '#999' }}>
      {selectedMunicipality || 'Choose your City/Municipality'}
    </Text>
    <Ionicons name="chevron-down" size={20} color="#008080" />
  </TouchableOpacity>

  {/* Barangay Picker */}
  <TouchableOpacity
    onPress={() => setShowBarangayPicker(true)}
    disabled={!selectedMunicipality || (providerData?.verification_status === 'approved' && !otpRequested)}
    style={{
      backgroundColor: "#e7ecec",
      borderRadius: 10,
      paddingHorizontal: 15,
      paddingVertical: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      opacity: (!selectedMunicipality || (providerData?.verification_status === 'approved' && !otpRequested)) ? 0.5 : 1,
    }}
  >
    <Text style={{ fontSize: 16, color: selectedBarangay ? '#000' : '#999' }}>
      {selectedBarangay || 'Choose your Barangay'}
    </Text>
    <Ionicons name="chevron-down" size={20} color="#008080" />
  </TouchableOpacity>

  {homeAddress && (
    <Text style={{ fontSize: 12, color: '#008080', marginTop: 5 }}>
      ✓ {homeAddress}
    </Text>
  )}
  
  {/* Map Picker Button */}
  {homeAddress && (
    <TouchableOpacity
      onPress={geocodeAddress}
      disabled={(providerData?.verification_status === 'approved' && !otpRequested) || isGeocoding}
      style={{
        backgroundColor: isGeocoding ? '#ccc' : '#fff',
        borderWidth: 2,
        borderColor: '#008080',
        borderRadius: 10,
        paddingHorizontal: 15,
        paddingVertical: 12,
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: (providerData?.verification_status === 'approved' && !otpRequested) ? 0.5 : 1,
      }}
    >
      {isGeocoding ? (
        <ActivityIndicator size="small" color="#008080" style={{ marginRight: 8 }} />
      ) : (
        <Ionicons name="map" size={20} color="#008080" style={{ marginRight: 8 }} />
      )}
      <Text style={{ fontSize: 14, color: '#008080', fontWeight: '600' }}>
        {isGeocoding ? 'Finding Location...' : (locationCoordinates ? 'Update Pin Location on Map' : 'Pin Exact Location on Map')}
      </Text>
    </TouchableOpacity>
  )}
  
  {locationCoordinates && (
    <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
      <Ionicons name="location" size={16} color="#4caf50" />
      <Text style={{ fontSize: 11, color: '#4caf50', marginLeft: 4 }}>
        Exact location pinned: {locationCoordinates.lat.toFixed(6)}, {locationCoordinates.lng.toFixed(6)}
      </Text>
    </View>
  )}
</View>
```

### 4. OTP Modal

```tsx
{/* OTP Verification Modal */}
<Modal
  visible={showOtpModal}
  transparent={true}
  animationType="fade"
  onRequestClose={() => setShowOtpModal(false)}
>
  <View style={{
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  }}>
    <View style={{
      backgroundColor: 'white',
      borderRadius: 20,
      padding: 25,
      width: '85%',
      maxWidth: 400,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <Ionicons name="shield-checkmark" size={32} color="#008080" />
        <Text style={{ fontSize: 20, fontWeight: 'bold', marginLeft: 10, flex: 1 }}>
          Verify Identity
        </Text>
        <TouchableOpacity onPress={() => setShowOtpModal(false)}>
          <Ionicons name="close-circle" size={28} color="#999" />
        </TouchableOpacity>
      </View>

      <Text style={{ fontSize: 14, color: '#666', marginBottom: 15 }}>
        Enter the 6-digit verification code sent to:
      </Text>
      <Text style={{ fontSize: 14, color: '#008080', fontWeight: '600', marginBottom: 20 }}>
        {maskedEmail}
      </Text>

      <TextInput
        placeholder="Enter 6-digit code"
        value={otp}
        onChangeText={(text) => {
          const cleaned = text.replace(/[^0-9]/g, '').slice(0, 6);
          setOtp(cleaned);
        }}
        keyboardType="number-pad"
        maxLength={6}
        style={{
          borderWidth: 2,
          borderColor: '#008080',
          borderRadius: 10,
          padding: 15,
          fontSize: 18,
          textAlign: 'center',
          letterSpacing: 8,
          fontWeight: '600',
          marginBottom: 15,
        }}
        placeholderTextColor="#999"
        autoFocus={true}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
        <Text style={{ fontSize: 13, color: '#666' }}>
          {otpTimer > 0 
            ? `Expires in ${Math.floor(otpTimer / 60)}:${(otpTimer % 60).toString().padStart(2, '0')}`
            : 'Code expired'}
        </Text>
        {otpTimer <= 0 && (
          <TouchableOpacity onPress={async () => {
            setShowOtpModal(false);
            await requestOTP();
          }}>
            <Text style={{ fontSize: 13, color: '#008080', fontWeight: '600' }}>
              Resend Code
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        onPress={submitProfileUpdate}
        disabled={saving || !otp || otp.trim().length !== 6}
        style={{
          backgroundColor: (saving || !otp || otp.trim().length !== 6) ? '#ccc' : '#008080',
          borderRadius: 10,
          paddingVertical: 15,
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
            Verify & Save Changes
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          setShowOtpModal(false);
          setOtp('');
        }}
        style={{
          borderRadius: 10,
          paddingVertical: 12,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#666', fontSize: 14 }}>
          Cancel
        </Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
```

---

## Security Features

### 1. **OTP-Based Verification**
- 6-digit numeric code
- 10-minute expiration
- Server-side generation and validation
- Email delivery

### 2. **Two-Step Email Change**
- Verify old email ownership (Step 1)
- Verify new email ownership (Step 2)
- Prevents unauthorized email changes

### 3. **Approval Status Checks**
- Only approved users can edit
- Pending users see warning
- Rejected users can resubmit

### 4. **Field-Level Access Control**
- Fields disabled until OTP requested
- Visual indicators (opacity, disabled state)
- Helper text explaining restrictions

### 5. **Token-Based Authentication**
- All API calls require Bearer token
- Token stored in AsyncStorage
- 401 redirects to login

---

## Testing Checklist

### Functional Testing

- [ ] Profile loads correctly with all fields populated
- [ ] Approval status warnings display correctly
- [ ] OTP request button works
- [ ] OTP email is received
- [ ] OTP timer counts down correctly
- [ ] OTP resend works after expiration
- [ ] Form fields unlock after OTP request
- [ ] Cascading location dropdowns work
- [ ] Province selection enables municipality picker
- [ ] Municipality selection enables barangay picker
- [ ] Address string updates correctly
- [ ] Geocoding finds correct coordinates
- [ ] Map picker opens and centers correctly
- [ ] Map pin can be moved
- [ ] Coordinates save correctly
- [ ] Phone number validation works (10 digits)
- [ ] Email format validation works
- [ ] OTP validation works (6 digits)
- [ ] Regular profile update works (no email change)
- [ ] Email change triggers two-step flow
- [ ] Step 1 OTP verification works
- [ ] Step 2 OTP verification works
- [ ] Profile saves successfully
- [ ] Success message displays
- [ ] Navigation back to profile works

### Security Testing

- [ ] Unapproved users cannot edit
- [ ] Fields are disabled without OTP
- [ ] Invalid OTP is rejected
- [ ] Expired OTP is rejected
- [ ] Email change requires two verifications
- [ ] Token expiration redirects to login
- [ ] Unauthorized access is prevented

### UI/UX Testing

- [ ] Loading indicator shows while fetching profile
- [ ] Saving indicator shows during update
- [ ] Error messages are clear and helpful
- [ ] Success messages are displayed
- [ ] OTP timer is visible and accurate
- [ ] Disabled fields have visual indicators
- [ ] Modals can be dismissed
- [ ] Keyboard behavior is correct
- [ ] ScrollView works properly
- [ ] Map picker is fullscreen and usable

---

## Key Differences: User App vs Service Provider App

| Aspect | User App | Service Provider App |
|--------|----------|----------------------|
| **Profile Endpoint** | `/auth/customer-profile` | `/auth/provider-profile` |
| **OTP Request** | `/auth/customer-profile/request-otp` | `/auth/provider-profile/request-otp` |
| **Email Change Step 1** | `/auth/verify-email-change-step1` | `/auth/verify-provider-email-change-step1` |
| **Email Change Step 2** | `/auth/verify-email-change-step2` | `/auth/verify-provider-email-change-step2` |
| **Field Names** | `user_location`, `exact_location`, `phone_number` | `provider_location`, `provider_exact_location`, `provider_phone_number` |
| **Data Interface** | `UserData` | `ProviderData` |
| **State Variable** | `userData` | `providerData` |

---

## Common Pitfalls & Solutions

### ❌ Pitfall 1: Using Wrong Field Names

**Problem:** Using `user_location` instead of `provider_location`

**Solution:** Always use provider-prefixed field names:
```tsx
// ❌ Wrong
user_location: homeAddress

// ✅ Correct
provider_location: homeAddress
```

### ❌ Pitfall 2: Not Parsing Coordinates

**Problem:** Saving coordinates as object instead of string

**Solution:**
```tsx
// ❌ Wrong
provider_exact_location: locationCoordinates

// ✅ Correct
provider_exact_location: `${locationCoordinates.lat},${locationCoordinates.lng}`
```

### ❌ Pitfall 3: Not Handling Email Change

**Problem:** Not detecting email changes and triggering two-step flow

**Solution:**
```tsx
const isEmailChanging = email !== originalEmail;
if (isEmailChanging) {
  await handleEmailChangeFlow(trimmedOtp);
} else {
  await performProfileUpdate(false, trimmedOtp);
}
```

### ❌ Pitfall 4: Not Disabling Fields

**Problem:** Users can edit before OTP verification

**Solution:**
```tsx
editable={providerData?.verification_status !== 'approved' || otpRequested}
disabled={providerData?.verification_status === 'approved' && !otpRequested}
```

---

## Summary

The Edit Profile implementation in the User App follows this pattern:

1. **Load profile** from backend
2. **Check approval status** - block if not approved
3. **Request OTP** to unlock editing
4. **Edit fields** with validations
5. **Geocode address** to get coordinates
6. **Pin location** on interactive map
7. **Submit with OTP** verification
8. **Handle email change** with two-step flow
9. **Save profile** to backend
10. **Show success** and navigate back

To implement this in the Service Provider App:

1. Copy `editprofile.tsx` to service provider app
2. Replace all field names with provider-prefixed versions
3. Update API endpoints to provider-specific ones
4. Update interface from `UserData` to `ProviderData`
5. Test all functionality thoroughly

---

**Document Version:** 1.0  
**Last Updated:** November 5, 2025  
**Author:** FixMo Development Team  
**Reference File:** `user/app/editprofile.tsx`

---

## Next Steps

1. Review this documentation thoroughly
2. Copy the component structure to service provider app
3. Update all API endpoints and field names
4. Implement backend endpoints for service provider
5. Test each feature individually
6. Test email change flow
7. Test on different devices
8. Deploy and monitor

Good luck with the implementation! 🚀
