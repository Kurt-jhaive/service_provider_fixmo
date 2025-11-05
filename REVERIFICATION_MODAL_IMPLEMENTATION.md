# Re-Verification Modal Implementation Guide

## 📋 Overview
The ReVerificationModal is now implemented with the same location selection functionality used in the edit profile. This allows service providers to resubmit verification documents when their previous submission was rejected.

---

## 🎯 Features Implemented

✅ **Cascading Location Dropdowns**
- District → City → Barangay selection (NCR only)
- Automatic reset of child selections when parent changes
- Uses the same philippines.json data as signup/edit profile

✅ **Auto-Geocoding**
- Automatically geocodes location when barangay is selected
- Fallback to city-level if barangay geocoding fails
- Default to Metro Manila center if all geocoding fails

✅ **Interactive Map Pin**
- LocationMapPicker component integration
- Pin exact location on map after address selection
- Real-time coordinate display

✅ **Form Validation**
- Age validation (18-100 years)
- Required field checks
- Complete location validation
- Image upload validation

✅ **Document Upload**
- Profile photo (1:1 aspect ratio)
- Valid ID (4:3 aspect ratio)
- Image preview
- Quality optimization (0.8)

---

## 🚀 Usage Example

### In your component (e.g., ProviderProfile.tsx):

```tsx
import React, { useState } from 'react';
import { ReVerificationModal } from '@/components';

export default function ProviderProfile() {
    const [showReVerificationModal, setShowReVerificationModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [verificationStatus, setVerificationStatus] = useState('');

    // Fetch verification status from backend
    const fetchProviderProfile = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await fetch(`${BACKEND_URL}/auth/provider-profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            
            const result = await response.json();
            if (result.success && result.data) {
                setVerificationStatus(result.data.verification_status || 'pending');
                setRejectionReason(result.data.rejection_reason || '');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    return (
        <View>
            {/* Show verification warning if rejected */}
            {verificationStatus === 'rejected' && (
                <View style={styles.warningBanner}>
                    <Ionicons name="warning" size={24} color="#ff4444" />
                    <Text style={styles.warningText}>
                        Your verification was rejected. Please resubmit.
                    </Text>
                    <TouchableOpacity 
                        style={styles.verifyButton}
                        onPress={() => setShowReVerificationModal(true)}
                    >
                        <Text style={styles.verifyButtonText}>Verify Now</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Re-Verification Modal */}
            <ReVerificationModal
                visible={showReVerificationModal}
                onClose={() => setShowReVerificationModal(false)}
                onSuccess={() => {
                    fetchProviderProfile(); // Refresh profile
                    Alert.alert(
                        'Success',
                        'Your verification has been resubmitted. Please wait for admin approval.'
                    );
                }}
                rejectionReason={rejectionReason}
            />
        </View>
    );
}
```

---

## 📡 Backend Endpoint

The modal submits to:
```
POST /api/verification/service-provider/resubmit
```

### Request Format (FormData):
```javascript
{
  profile_photo: File,           // Image file
  valid_id: File,                // Image file
  first_name: string,            // "Juan"
  last_name: string,             // "Dela Cruz"
  birthday: string,              // "1995-06-15" (YYYY-MM-DD)
  user_location: string,         // "Barangay San Antonio, Makati City, NCR District - First"
  exact_location: string         // "14.5547,121.0244" (lat,lng)
}
```

### Expected Response:
```json
{
  "success": true,
  "message": "Verification documents resubmitted successfully! Your documents will be reviewed within 24-48 hours.",
  "data": {
    "verification_status": "pending",
    "submitted_at": "2024-01-15T10:30:00Z"
  }
}
```

---

## 🔧 Location Selection Flow

### 1. User selects District
```
NCR District - First
NCR District - Second
NCR District - Third
... etc
```

### 2. City dropdown activates
```
Based on selected district:
- Manila
- Quezon City
- Makati City
... etc
```

### 3. Barangay dropdown activates
```
Based on selected city:
- Barangay San Antonio
- Barangay Poblacion
- Barangay San Isidro
... etc
```

### 4. Auto-Geocoding Triggers
- Automatically finds coordinates for selected barangay
- Falls back to city-level if barangay not found
- Defaults to Metro Manila center if all fails

### 5. Map Picker Opens
- Shows LocationMapPicker component
- User can adjust pin position
- Coordinates displayed in real-time

---

## 🎨 Props Interface

```typescript
interface ReVerificationModalProps {
    visible: boolean;           // Show/hide modal
    onClose: () => void;        // Called when modal closes
    onSuccess: () => void;      // Called after successful submission
    rejectionReason?: string;   // Admin's rejection reason (optional)
}
```

---

## 📱 User Flow

1. **User sees rejection warning** → "Verify Now" button
2. **Modal opens** → Shows rejection reason (if provided)
3. **Fill personal info** → First name, Last name, Birthday
4. **Select location** → District → City → Barangay (cascading)
5. **Auto-geocoding** → System finds coordinates automatically
6. **Pin on map** → User adjusts exact location
7. **Upload documents** → Profile photo + Valid ID
8. **Submit** → FormData sent to backend
9. **Success** → Modal closes, profile refreshes

---

## 🔒 Validation Rules

### Age Validation
- ✅ Minimum: 18 years old
- ✅ Maximum: 100 years old

### Location Validation
- ✅ District must be selected
- ✅ City must be selected
- ✅ Barangay must be selected
- ✅ Coordinates must be pinned

### Document Validation
- ✅ Profile photo required
- ✅ Valid ID required
- ✅ Image format: JPEG/PNG
- ✅ Quality: 0.8 compression

---

## 🐛 Troubleshooting

### Issue: Geocoding fails
**Solution:** Modal automatically falls back to city-level, then Metro Manila center. User can always manually pin location.

### Issue: LocationMapPicker not showing
**Solution:** Ensure coordinates are set before map picker is rendered. Check `locationCoordinates` state.

### Issue: Images not uploading
**Solution:** Verify file URI format. Android uses direct URI, iOS needs `file://` prefix.

### Issue: Cascading dropdowns not resetting
**Solution:** Check `useEffect` hooks that reset child selections when parent changes.

---

## 📁 File Structure

```
src/
├── components/
│   ├── modals/
│   │   ├── ReVerificationModal.tsx   ← Main modal component
│   │   └── CompleteServiceModal.tsx
│   ├── maps/
│   │   └── LocationMapPicker.tsx     ← Map component
│   └── index.ts                      ← Export file
app/
└── assets/
    └── data/
        └── philippines.json          ← Location data (NCR)
```

---

## 🎯 Key Features from Edit Profile

The modal uses the exact same location selection implementation as `editprofile.tsx`:

✅ Same cascading dropdown logic
✅ Same district name mapping
✅ Same geocoding strategy
✅ Same philippines.json data source
✅ Same LocationMapPicker component
✅ Same auto-geocoding on barangay selection

---

## 🚀 Next Steps

1. **Backend Implementation:**
   - Create `/api/verification/service-provider/resubmit` endpoint
   - Handle FormData with images
   - Validate all fields
   - Update verification_status to "pending"
   - Store rejection_reason history

2. **Admin Panel:**
   - Review resubmitted documents
   - Approve/Reject with reasons
   - Send notifications to provider

3. **Testing:**
   - Test cascading dropdowns
   - Test geocoding with various addresses
   - Test map pin adjustment
   - Test image uploads
   - Test form validation

---

## ✅ Implementation Complete

The ReVerificationModal is now ready to use with the same proven location selection system from edit profile!

**Location:** `src/components/modals/ReVerificationModal.tsx`  
**Lines:** ~1000+  
**Status:** ✅ Ready for integration
