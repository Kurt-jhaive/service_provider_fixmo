import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFonts } from 'expo-font';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { addTimeRangeAvailability, deleteAvailability, getProviderAvailability, toggleDayAvailability, toggleTimeSlot } from '../../src/api/availability.api';
import ApprovedScreenWrapper from '../../src/navigation/ApprovedScreenWrapper';
import type { Availability, DayOfWeek } from '../../src/types/availability';

const DAYS_OF_WEEK: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const DAY_ICONS: Record<DayOfWeek, string> = {
  Monday: 'calendar',
  Tuesday: 'calendar',
  Wednesday: 'calendar',
  Thursday: 'calendar',
  Friday: 'calendar',
  Saturday: 'calendar-outline',
  Sunday: 'calendar-outline',
};

export default function AvailabilityScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Record<DayOfWeek, boolean>>({
    Monday: false,
    Tuesday: false,
    Wednesday: false,
    Thursday: false,
    Friday: false,
    Saturday: false,
    Sunday: false,
  });

  const [fontsLoaded] = useFonts({
    PoppinsRegular: require('../assets/fonts/Poppins-Regular.ttf'),
    PoppinsBold: require('../assets/fonts/Poppins-Bold.ttf'),
    PoppinsSemiBold: require('../assets/fonts/Poppins-SemiBold.ttf'),
    PoppinsMedium: require('../assets/fonts/Poppins-SemiBold.ttf'),
  });

  const fetchAvailability = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('providerToken');
      const providerIdStr = await AsyncStorage.getItem('providerId');

      if (!token || !providerIdStr) {
        Alert.alert('Error', 'Authentication required. Please log in again.');
        return;
      }

      const providerId = parseInt(providerIdStr, 10);
      const data = await getProviderAvailability(providerId, token);
      
      console.log('Fetched availability data:', JSON.stringify(data));
      
      setAvailabilities(data);
    } catch (error: any) {
      console.error('Fetch availability error:', error);
      Alert.alert('Error', error.message || 'Failed to load availability');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      fetchAvailability();
    }
  }, [fontsLoaded, fetchAvailability]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAvailability();
  };

  // Get time slots for a specific day (include both active and inactive)
  const getTimeSlotsForDay = (day: DayOfWeek): Availability[] => {
    return availabilities.filter(
      (avail) => avail.dayOfWeek === day
    );
  };

  // Get only active time slots for a specific day (for overlap checking)
  const getActiveTimeSlotsForDay = (day: DayOfWeek): Availability[] => {
    return availabilities.filter(
      (avail) => avail.dayOfWeek === day && avail.availability_isActive
    );
  };

  // Check if time slot overlaps with existing ACTIVE slots
  const checkTimeOverlap = (day: DayOfWeek, newStart: string, newEnd: string): boolean => {
    const existingSlots = getActiveTimeSlotsForDay(day);
    
    const newStartMinutes = timeToMinutes(newStart);
    const newEndMinutes = timeToMinutes(newEnd);

    return existingSlots.some((slot) => {
      const slotStartMinutes = timeToMinutes(slot.startTime);
      const slotEndMinutes = timeToMinutes(slot.endTime);

      // Check for overlap
      return (
        (newStartMinutes < slotEndMinutes && newEndMinutes > slotStartMinutes)
      );
    });
  };

  // Convert time string to minutes for comparison
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Convert Date to HH:MM string
  const dateToTimeString = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Convert HH:MM string to Date object (today's date with that time)
  const timeStringToDate = (timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  // Find next available time slot that doesn't overlap
  const findNextAvailableTime = (day: DayOfWeek, proposedStart: Date, duration: number = 60): { start: Date; end: Date } => {
    const existingSlots = getTimeSlotsForDay(day).sort((a, b) => 
      timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    );

    let currentStart = new Date(proposedStart);
    let currentEnd = new Date(currentStart.getTime() + duration * 60000); // duration in minutes

    // Keep trying until we find a non-overlapping slot
    for (let attempt = 0; attempt < 20; attempt++) {
      const startStr = dateToTimeString(currentStart);
      const endStr = dateToTimeString(currentEnd);
      
      const hasOverlap = existingSlots.some((slot) => {
        const slotStartMinutes = timeToMinutes(slot.startTime);
        const slotEndMinutes = timeToMinutes(slot.endTime);
        const currentStartMinutes = timeToMinutes(startStr);
        const currentEndMinutes = timeToMinutes(endStr);

        return currentStartMinutes < slotEndMinutes && currentEndMinutes > slotStartMinutes;
      });

      if (!hasOverlap) {
        return { start: currentStart, end: currentEnd };
      }

      // Move to after the conflicting slot
      const conflictingSlot = existingSlots.find((slot) => {
        const slotStartMinutes = timeToMinutes(slot.startTime);
        const slotEndMinutes = timeToMinutes(slot.endTime);
        const currentStartMinutes = timeToMinutes(startStr);
        return currentStartMinutes < slotEndMinutes;
      });

      if (conflictingSlot) {
        currentStart = timeStringToDate(conflictingSlot.endTime);
        currentEnd = new Date(currentStart.getTime() + duration * 60000);
      } else {
        break;
      }
    }

    return { start: currentStart, end: currentEnd };
  };

  // Open add time slot modal
  const openAddModal = (day: DayOfWeek) => {
    setSelectedDay(day);
    
    // Find next available time starting from 9 AM
    const proposedStart = new Date();
    proposedStart.setHours(9, 0, 0, 0);
    
    const { start, end } = findNextAvailableTime(day, proposedStart, 480); // 8 hours default
    
    setStartTime(start);
    setEndTime(end);
    setShowAddModal(true);
  };

  // Handle time picker changes - auto-adjust to avoid overlaps
  const handleStartTimeChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    
    if (selectedDate && selectedDay) {
      // Calculate duration between current start and end
      const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 60000); // in minutes
      
      // Find next available slot with this start time
      const { start, end } = findNextAvailableTime(selectedDay, selectedDate, Math.max(duration, 60));
      
      setStartTime(start);
      setEndTime(end);
    }
  };

  const handleEndTimeChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    
    if (selectedDate && selectedDay) {
      const startStr = dateToTimeString(startTime);
      const endStr = dateToTimeString(selectedDate);
      
      // Check if this end time creates overlap
      if (checkTimeOverlap(selectedDay, startStr, endStr)) {
        // If overlap, find next available end time
        const duration = Math.floor((selectedDate.getTime() - startTime.getTime()) / 60000);
        const { end } = findNextAvailableTime(selectedDay, startTime, Math.max(duration, 60));
        setEndTime(end);
        
        Alert.alert(
          'Time Adjusted',
          'End time was automatically adjusted to avoid overlapping with existing time slots.'
        );
      } else if (selectedDate <= startTime) {
        Alert.alert('Invalid Time', 'End time must be after start time');
      } else {
        setEndTime(selectedDate);
      }
    }
  };

  // Handle adding a new time slot
  const handleAddTimeSlot = async () => {
    if (!selectedDay) return;

    const startStr = dateToTimeString(startTime);
    const endStr = dateToTimeString(endTime);

    // Validate time range
    if (startTime >= endTime) {
      Alert.alert('Invalid Time Range', 'End time must be after start time');
      return;
    }

    // Calculate duration in minutes
    const durationInMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);
    const minimumDuration = 3 * 60; // 3 hours = 180 minutes

    // Validate minimum duration (3 hours)
    if (durationInMinutes < minimumDuration) {
      Alert.alert(
        'Invalid Duration',
        `Time slot must be at least 3 hours long. Current duration: ${Math.floor(durationInMinutes / 60)} hours ${durationInMinutes % 60} minutes.`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Final check for overlap (should not happen with auto-adjustment)
    if (checkTimeOverlap(selectedDay, startStr, endStr)) {
      Alert.alert(
        'Time Conflict',
        `This time range overlaps with an existing time slot on ${selectedDay}. Please choose a different time.`
      );
      return;
    }

    try {
      const token = await AsyncStorage.getItem('providerToken');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      await addTimeRangeAvailability(selectedDay, startStr, endStr, token);
      
      setShowAddModal(false);
      fetchAvailability();
      
      Alert.alert('Success', 'Time slot added successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add time slot');
    }
  };

  // Handle deleting a time slot
  const handleDeleteTimeSlot = (slot: Availability) => {
    Alert.alert(
      'Delete Time Slot',
      `Remove ${slot.dayOfWeek} ${slot.startTime}-${slot.endTime}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('providerToken');
              if (!token) {
                Alert.alert('Error', 'Authentication required');
                return;
              }

              await deleteAvailability(slot.availability_id!, token);
              fetchAvailability();
              Alert.alert('Success', 'Time slot removed successfully');
            } catch (error: any) {
              // Check if it's a constraint error with scheduled appointments
              if (error.message.includes('Cannot delete this time slot')) {
                Alert.alert(
                  'Cannot Delete Time Slot',
                  error.message,
                  [
                    { 
                      text: 'OK', 
                      style: 'default' 
                    }
                  ]
                );
              } else {
                Alert.alert('Error', error.message || 'Failed to delete time slot');
              }
            }
          },
        },
      ]
    );
  };

  // Toggle day expansion
  const toggleDayExpansion = (day: DayOfWeek) => {
    setExpandedDays((prev) => ({
      ...prev,
      [day]: !prev[day],
    }));
  };

  // Handle toggling individual time slot
  const handleToggleTimeSlot = async (slot: Availability, newValue: boolean) => {
    try {
      const token = await AsyncStorage.getItem('providerToken');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      await toggleTimeSlot(slot.availability_id!, newValue, token);
      
      // Update local state immediately for better UX
      setAvailabilities(prev => 
        prev.map(a => 
          a.availability_id === slot.availability_id 
            ? { ...a, slot_isActive: newValue }
            : a
        )
      );

      // Optionally show success message
      // Alert.alert('Success', `Time slot ${newValue ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      // Revert optimistic update on error
      fetchAvailability();
      
      Alert.alert(
        newValue ? 'Cannot Enable' : 'Cannot Disable',
        error.message || 'Failed to toggle time slot',
        [{ text: 'OK' }]
      );
    }
  };

  // Toggle entire day availability on/off
  const handleToggleDayAvailability = async (day: DayOfWeek, newValue: boolean) => {
    try {
      const token = await AsyncStorage.getItem('providerToken');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      const daySlots = getTimeSlotsForDay(day);

      if (daySlots.length === 0 && newValue) {
        // No time slots exist, show message to add time slots first
        Alert.alert(
          'No Time Slots',
          'Please add time slots for this day first before enabling it.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Call the toggle day API
      await toggleDayAvailability(day, newValue, token);
      await fetchAvailability();

      Alert.alert(
        'Success',
        `${day} availability ${newValue ? 'enabled' : 'disabled'} successfully`
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update day availability');
    }
  };

  if (!fontsLoaded || loading) {
    return (
      <ApprovedScreenWrapper activeTab="calendar">
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color="#00796B" />
          <Text style={styles.loadingText}>Loading availability...</Text>
        </View>
      </ApprovedScreenWrapper>
    );
  }

  return (
    <ApprovedScreenWrapper activeTab="calendar">
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#00796B']} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Weekly Availability</Text>
          <Text style={styles.subtitle}>
            Add time slots for each day you're available
          </Text>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#00796B" />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>Day Availability</Text>
            <Text style={styles.infoText}>
              Add time slots for each day, then use the toggle to enable/disable the entire day. Disabled days cannot be booked.
            </Text>
          </View>
        </View>

        {/* Days List */}
        <View style={styles.daysContainer}>
          {DAYS_OF_WEEK.map((day) => {
            const timeSlots = getTimeSlotsForDay(day);
            const isExpanded = expandedDays[day];
            const isDayEnabled = timeSlots.length > 0 && timeSlots.every(slot => slot.availability_isActive);

            return (
              <View key={day} style={styles.dayCard}>
                {/* Day Header with Toggle */}
                <View style={styles.dayHeaderContainer}>
                  <TouchableOpacity
                    style={styles.dayHeader}
                    onPress={() => toggleDayExpansion(day)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dayInfo}>
                      <View style={styles.dayIconContainer}>
                        <Ionicons
                          name={DAY_ICONS[day] as any}
                          size={24}
                          color={isDayEnabled ? '#00796B' : '#999'}
                        />
                      </View>
                      <View style={styles.dayTextContainer}>
                        <Text
                          style={[
                            styles.dayName,
                            isDayEnabled && styles.dayNameActive,
                          ]}
                        >
                          {day}
                        </Text>
                        <Text style={styles.dayStatus}>
                          {timeSlots.length > 0
                            ? `${timeSlots.length} time slot${timeSlots.length > 1 ? 's' : ''} ${isDayEnabled ? '(Active)' : '(Disabled)'}`
                            : 'No time slots'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color="#666"
                    />
                  </TouchableOpacity>

                  {/* Toggle Switch */}
                  {timeSlots.length > 0 && (
                    <View style={styles.toggleContainer}>
                      <Switch
                        value={isDayEnabled}
                        onValueChange={(value) => handleToggleDayAvailability(day, value)}
                        trackColor={{ false: '#E0E0E0', true: '#80CBC4' }}
                        thumbColor={isDayEnabled ? '#00796B' : '#f4f3f4'}
                        ios_backgroundColor="#E0E0E0"
                      />
                    </View>
                  )}
                </View>

                {/* Expanded Content */}
                {isExpanded && (
                  <View style={styles.expandedContent}>
                    {/* Time Slots */}
                    {timeSlots.map((slot) => (
                      <View 
                        key={slot.availability_id} 
                        style={[
                          styles.timeSlotCard,
                          !slot.slot_isActive && styles.timeSlotCardInactive
                        ]}
                      >
                        <View style={styles.timeSlotInfo}>
                          <Ionicons 
                            name="time-outline" 
                            size={20} 
                            color={slot.slot_isActive ? '#00796B' : '#999'} 
                          />
                          <View style={styles.timeSlotTextContainer}>
                            <Text style={[
                              styles.timeSlotText,
                              !slot.slot_isActive && styles.timeSlotTextInactive
                            ]}>
                              {slot.startTime} - {slot.endTime}
                            </Text>
                            {!slot.slot_isActive && (
                              <Text style={styles.inactiveBadge}>Disabled</Text>
                            )}
                          </View>
                        </View>
                        
                        <View style={styles.timeSlotActions}>
                          {/* Individual Slot Toggle */}
                          <View style={styles.slotToggleContainer}>
                            <Switch
                              value={slot.slot_isActive ?? true}
                              onValueChange={(value) => handleToggleTimeSlot(slot, value)}
                              trackColor={{ false: '#E0E0E0', true: '#80CBC4' }}
                              thumbColor={slot.slot_isActive ? '#00796B' : '#f4f3f4'}
                              ios_backgroundColor="#E0E0E0"
                              disabled={!slot.availability_isActive}
                            />
                          </View>
                          
                          {/* Delete Button */}
                          <TouchableOpacity
                            onPress={() => handleDeleteTimeSlot(slot)}
                            style={styles.deleteButton}
                          >
                            <Ionicons name="trash-outline" size={20} color="#E53935" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}

                    {/* Add Time Slot Button */}
                    <TouchableOpacity
                      style={styles.addTimeSlotButton}
                      onPress={() => openAddModal(day)}
                    >
                      <Ionicons name="add-circle-outline" size={20} color="#00796B" />
                      <Text style={styles.addTimeSlotText}>Add Time Slot</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Total Time Slots</Text>
          <Text style={styles.summaryCount}>
            {availabilities.filter((a) => a.availability_isActive).length} slots
          </Text>
        </View>
      </ScrollView>

      {/* Add Time Slot Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Time Slot</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDayText}>
              {selectedDay}
            </Text>

            {/* Start Time */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Start Time</Text>
              <TouchableOpacity 
                style={styles.timePickerButton}
                onPress={() => setShowStartPicker(true)}
              >
                <Ionicons name="time-outline" size={20} color="#00796B" />
                <Text style={styles.timePickerText}>
                  {dateToTimeString(startTime)}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
              <Text style={styles.inputHint}>Tap to select time</Text>
            </View>

            {/* End Time */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>End Time</Text>
              <TouchableOpacity 
                style={styles.timePickerButton}
                onPress={() => setShowEndPicker(true)}
              >
                <Ionicons name="time-outline" size={20} color="#00796B" />
                <Text style={styles.timePickerText}>
                  {dateToTimeString(endTime)}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
              <Text style={styles.inputHint}>Tap to select time</Text>
            </View>

            {/* Auto-adjustment hint */}
            <View style={styles.autoAdjustHint}>
              <Ionicons name="information-circle-outline" size={16} color="#00796B" />
              <Text style={styles.autoAdjustText}>
                Times will auto-adjust to avoid overlaps
              </Text>
            </View>

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAddTimeSlot}
              >
                <Text style={styles.saveButtonText}>Add Slot</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Start Time Picker */}
      {showStartPicker && (
        <DateTimePicker
          value={startTime}
          mode="time"
          is24Hour={true}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleStartTimeChange}
        />
      )}

      {/* End Time Picker */}
      {showEndPicker && (
        <DateTimePicker
          value={endTime}
          mode="time"
          is24Hour={true}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleEndTimeChange}
        />
      )}
    </ApprovedScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'PoppinsRegular',
    color: '#666',
    marginTop: 12,
  },
  header: {
    marginBottom: 20,
    marginTop: 40,
  },
  title: {
    fontSize: 24,
    fontFamily: 'PoppinsBold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'PoppinsRegular',
    color: '#666',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#E0F2F1',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontFamily: 'PoppinsSemiBold',
    color: '#00796B',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    fontFamily: 'PoppinsRegular',
    color: '#00796B',
    lineHeight: 18,
  },
  daysContainer: {
    marginBottom: 24,
  },
  dayCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  dayHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  toggleContainer: {
    paddingRight: 16,
    paddingVertical: 16,
  },
  dayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dayIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  dayName: {
    fontSize: 16,
    fontFamily: 'PoppinsSemiBold',
    color: '#666',
    marginBottom: 2,
  },
  dayNameActive: {
    color: '#00796B',
  },
  dayStatus: {
    fontSize: 12,
    fontFamily: 'PoppinsRegular',
    color: '#999',
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  timeSlotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  timeSlotInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timeSlotTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  timeSlotText: {
    fontSize: 14,
    fontFamily: 'PoppinsMedium',
    color: '#333',
  },
  timeSlotCardInactive: {
    opacity: 0.6,
    backgroundColor: '#FAFAFA',
  },
  timeSlotTextInactive: {
    color: '#999',
  },
  timeSlotActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slotToggleContainer: {
    marginRight: 8,
  },
  inactiveBadge: {
    fontSize: 10,
    fontFamily: 'PoppinsSemiBold',
    color: '#999',
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  deleteButton: {
    padding: 4,
  },
  addTimeSlotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00796B',
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addTimeSlotText: {
    fontSize: 14,
    fontFamily: 'PoppinsSemiBold',
    color: '#00796B',
    marginLeft: 8,
  },
  summaryCard: {
    backgroundColor: '#00796B',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 14,
    fontFamily: 'PoppinsMedium',
    color: '#fff',
    marginBottom: 4,
  },
  summaryCount: {
    fontSize: 28,
    fontFamily: 'PoppinsBold',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'PoppinsBold',
    color: '#333',
  },
  modalDayText: {
    fontSize: 16,
    fontFamily: 'PoppinsSemiBold',
    color: '#00796B',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'PoppinsSemiBold',
    color: '#333',
    marginBottom: 8,
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  timePickerText: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'PoppinsSemiBold',
    color: '#00796B',
    marginLeft: 12,
  },
  inputHint: {
    fontSize: 12,
    fontFamily: 'PoppinsRegular',
    color: '#999',
    marginTop: 4,
  },
  autoAdjustHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2F1',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  autoAdjustText: {
    fontSize: 12,
    fontFamily: 'PoppinsRegular',
    color: '#00796B',
    marginLeft: 8,
    flex: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    fontSize: 14,
    fontFamily: 'PoppinsSemiBold',
    color: '#666',
  },
  saveButton: {
    backgroundColor: '#00796B',
  },
  saveButtonText: {
    fontSize: 14,
    fontFamily: 'PoppinsSemiBold',
    color: '#fff',
  },
});

