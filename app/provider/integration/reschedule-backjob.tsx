import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { getProviderAvailability } from "../../../src/api/availability.api";
import { rescheduleBackjob } from "../../../src/api/backjob.api";
import { getAppointmentsByProviderId } from "../../../src/api/booking.api";
import type { Appointment } from "../../../src/types/appointment";
import type { Availability } from "../../../src/types/availability";

interface MarkedDates {
    [date: string]: {
        selected?: boolean;
        marked?: boolean;
        selectedColor?: string;
        dotColor?: string;
        disabled?: boolean;
        disableTouchEvent?: boolean;
    };
}

export default function RescheduleBackjobScreen() {
    const params = useLocalSearchParams();
    const router = useRouter();
    
    const appointmentId = params.appointmentId as string;
    const backjobId = params.backjobId as string;
    const customerName = params.customerName as string;
    const serviceTitle = params.serviceTitle as string;
    const currentDate = params.currentDate as string;

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [selectedTime, setSelectedTime] = useState<string>("");
    const [availabilities, setAvailabilities] = useState<Availability[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [markedDates, setMarkedDates] = useState<MarkedDates>({});
    const [availableTimes, setAvailableTimes] = useState<string[]>([]);
    const [providerId, setProviderId] = useState<number | null>(null);

    // Fetch provider availability and existing appointments
    const fetchData = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem('providerToken');
            const providerIdStr = await AsyncStorage.getItem('providerId');

            if (!token || !providerIdStr) {
                Alert.alert('Error', 'Authentication required. Please log in again.');
                router.back();
                return;
            }

            const id = parseInt(providerIdStr, 10);
            setProviderId(id);

            // Fetch availability schedule
            const availData = await getProviderAvailability(id, token);
            setAvailabilities(availData);

            // Fetch existing appointments to check conflicts
            const appointmentsData = await getAppointmentsByProviderId(id, token);
            setAppointments(appointmentsData);

            // Calculate and mark available dates
            calculateAvailableDates(availData, appointmentsData);
        } catch (error: any) {
            console.error('Fetch data error:', error);
            Alert.alert('Error', error.message || 'Failed to load availability data');
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Calculate available dates based on provider's weekly schedule and existing appointments
    const calculateAvailableDates = (
        availData: Availability[],
        appointmentsData: Appointment[]
    ) => {
        const marked: MarkedDates = {};
        const today = new Date();
        const daysToShow = 60; // Show 2 months ahead

        // Map day names to numbers (0 = Sunday, 1 = Monday, etc.)
        const dayNameToNumber: Record<string, number> = {
            Sunday: 0,
            Monday: 1,
            Tuesday: 2,
            Wednesday: 3,
            Thursday: 4,
            Friday: 5,
            Saturday: 6,
        };

        // Get active availability days (only those with active slots)
        const activeDaysMap = new Map<number, boolean>();
        availData.forEach((av) => {
            const dayNum = dayNameToNumber[av.dayOfWeek];
            if (av.availability_isActive && av.slot_isActive !== false) {
                activeDaysMap.set(dayNum, true);
            }
        });
        const activeDays = Array.from(activeDaysMap.keys());

        // Get dates with existing appointments
        const bookedDates = new Set(
            appointmentsData
                .filter((apt) => 
                    apt.appointment_status === 'scheduled' || 
                    apt.appointment_status === 'approved' || 
                    apt.appointment_status === 'confirmed' ||
                    apt.appointment_status === 'in-progress' ||
                    apt.appointment_status === 'ongoing'
                )
                .map((apt) => apt.scheduled_date.split('T')[0])
        );

        // Mark dates for the next 60 days
        for (let i = 1; i <= daysToShow; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dateString = date.toISOString().split('T')[0];
            const dayOfWeek = date.getDay();

            // Check if provider is available on this day
            const isAvailableDay = activeDays.includes(dayOfWeek);
            const isBooked = bookedDates.has(dateString);

            if (isAvailableDay && !isBooked) {
                // Available and free
                marked[dateString] = {
                    marked: true,
                    dotColor: '#4CAF50',
                    disabled: false,
                };
            } else {
                // Not available or booked
                marked[dateString] = {
                    disabled: true,
                    disableTouchEvent: true,
                };
            }
        }

        setMarkedDates(marked);
    };

    // Handle date selection
    const handleDateSelect = (day: DateData) => {
        const dateString = day.dateString;

        // Check if date is available
        if (markedDates[dateString]?.disabled) {
            Alert.alert('Unavailable', 'You are not available on this date or it is already booked.');
            return;
        }

        // Update selected date
        const updated: MarkedDates = {};
        Object.keys(markedDates).forEach((date) => {
            updated[date] = {
                ...markedDates[date],
                selected: date === dateString,
                selectedColor: date === dateString ? '#00796B' : undefined,
            };
        });

        setMarkedDates(updated);
        setSelectedDate(dateString);

        // Calculate available times for selected date
        const selectedDay = new Date(dateString).getDay();
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = dayNames[selectedDay];

        // Filter availabilities for selected day that are both day-active and slot-active
        const dayAvailabilities = availabilities.filter(
            (av) => av.dayOfWeek === dayName && av.availability_isActive && av.slot_isActive !== false
        );

        if (dayAvailabilities.length > 0) {
            // Generate all available time slots from all active time ranges
            const allTimes = dayAvailabilities.flatMap((av) => 
                generateTimeSlots(av.startTime, av.endTime)
            );
            // Remove duplicates and sort
            const uniqueTimes = Array.from(new Set(allTimes)).sort();
            setAvailableTimes(uniqueTimes);
            setSelectedTime(""); // Reset selected time
        } else {
            setAvailableTimes([]);
            setSelectedTime("");
        }
    };

    // Generate time slots between start and end time (hourly slots)
    const generateTimeSlots = (startTime: string, endTime: string): string[] => {
        const slots: string[] = [];
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);

        let currentHour = startHour;
        const endHourActual = endMin > 0 ? endHour + 1 : endHour;

        while (currentHour < endHourActual) {
            const hour12 = currentHour % 12 || 12;
            const ampm = currentHour < 12 ? 'AM' : 'PM';
            const timeDisplay = `${hour12}:00 ${ampm}`;
            const timeValue = `${currentHour.toString().padStart(2, '0')}:00`;
            slots.push(timeValue);
            currentHour++;
        }

        return slots;
    };

    // Format time for display (HH:mm to 12-hour format)
    const formatTimeDisplay = (time: string): string => {
        const [hour, min] = time.split(':').map(Number);
        const hour12 = hour % 12 || 12;
        const ampm = hour < 12 ? 'AM' : 'PM';
        return `${hour12}:00 ${ampm}`;
    };

    // Handle reschedule submission
    const handleReschedule = async () => {
        if (!selectedDate || !selectedTime) {
            Alert.alert('Required', 'Please select both a date and time.');
            return;
        }

        if (!providerId) {
            Alert.alert('Error', 'Provider ID not found.');
            return;
        }

        Alert.alert(
            'Confirm Reschedule',
            `Reschedule backjob to ${selectedDate} at ${formatTimeDisplay(selectedTime)}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: async () => {
                        setSubmitting(true);
                        try {
                            const token = await AsyncStorage.getItem('providerToken');
                            if (!token) {
                                Alert.alert('Error', 'Authentication required');
                                return;
                            }

                            // Find the availability_id for the selected day and time slot
                            const selectedDay = new Date(selectedDate).getDay();
                            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                            
                            // Find the availability that matches the selected time slot
                            const [selectedHour] = selectedTime.split(':').map(Number);
                            const availability = availabilities.find((av) => {
                                if (av.dayOfWeek !== dayNames[selectedDay] || !av.availability_isActive || av.slot_isActive === false) {
                                    return false;
                                }
                                
                                // Check if selected time falls within this availability's time range
                                const [startHour] = av.startTime.split(':').map(Number);
                                const [endHour] = av.endTime.split(':').map(Number);
                                return selectedHour >= startHour && selectedHour < endHour;
                            });

                            if (!availability || !availability.availability_id) {
                                Alert.alert('Error', 'Availability not found for selected time slot');
                                return;
                            }

                            const newScheduledDate = `${selectedDate}T${selectedTime}:00Z`;

                            await rescheduleBackjob(
                                parseInt(appointmentId),
                                {
                                    new_scheduled_date: newScheduledDate,
                                    availability_id: availability.availability_id,
                                },
                                token
                            );

                            Alert.alert(
                                'Success',
                                'Backjob has been rescheduled successfully.',
                                [
                                    {
                                        text: 'OK',
                                        onPress: () => router.back(),
                                    },
                                ]
                            );
                        } catch (error: any) {
                            console.error('Reschedule error:', error);
                            Alert.alert('Error', error.message || 'Failed to reschedule backjob');
                        } finally {
                            setSubmitting(false);
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#00796B" />
                    <Text style={styles.loadingText}>Loading availability...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#00796B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Reschedule Backjob</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Appointment Info */}
                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Ionicons name="person" size={20} color="#00796B" />
                        <Text style={styles.infoLabel}>Customer:</Text>
                        <Text style={styles.infoValue}>{customerName}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="construct" size={20} color="#00796B" />
                        <Text style={styles.infoLabel}>Service:</Text>
                        <Text style={styles.infoValue}>{serviceTitle}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="calendar" size={20} color="#999" />
                        <Text style={styles.infoLabel}>Current:</Text>
                        <Text style={styles.currentDateText}>{currentDate}</Text>
                    </View>
                </View>

                {/* Instructions */}
                <View style={styles.instructionsCard}>
                    <Ionicons name="information-circle" size={20} color="#2196F3" />
                    <Text style={styles.instructionsText}>
                        Select a new date when you are available and not booked. Only your active time slots are shown.
                    </Text>
                </View>

                {/* Calendar */}
                <View style={styles.calendarCard}>
                    <Text style={styles.sectionTitle}>Select Date</Text>
                    <Calendar
                        markedDates={markedDates}
                        onDayPress={handleDateSelect}
                        theme={{
                            todayTextColor: '#00796B',
                            selectedDayBackgroundColor: '#00796B',
                            selectedDayTextColor: '#FFF',
                            arrowColor: '#00796B',
                            monthTextColor: '#00796B',
                            textMonthFontFamily: 'Poppins-SemiBold',
                            textDayFontFamily: 'Poppins-Regular',
                            textDayHeaderFontFamily: 'Poppins-Medium',
                            dotColor: '#4CAF50',
                            textDisabledColor: '#DDD',
                        }}
                        minDate={new Date().toISOString().split('T')[0]}
                        disableAllTouchEventsForDisabledDays={true}
                    />
                    <View style={styles.legend}>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
                            <Text style={styles.legendText}>Available</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: '#DDD' }]} />
                            <Text style={styles.legendText}>Unavailable/Booked</Text>
                        </View>
                    </View>
                </View>

                {/* Time Slots */}
                {selectedDate && availableTimes.length > 0 && (
                    <View style={styles.timeCard}>
                        <Text style={styles.sectionTitle}>Select Time</Text>
                        <View style={styles.timeGrid}>
                            {availableTimes.map((time) => (
                                <TouchableOpacity
                                    key={time}
                                    style={[
                                        styles.timeSlot,
                                        selectedTime === time && styles.timeSlotSelected,
                                    ]}
                                    onPress={() => setSelectedTime(time)}
                                >
                                    <Text
                                        style={[
                                            styles.timeSlotText,
                                            selectedTime === time && styles.timeSlotTextSelected,
                                        ]}
                                    >
                                        {formatTimeDisplay(time)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* No Time Slots Available Message */}
                {selectedDate && availableTimes.length === 0 && (
                    <View style={styles.noSlotsCard}>
                        <Ionicons name="time-outline" size={24} color="#FF9800" />
                        <Text style={styles.noSlotsText}>
                            No time slots available for this date. Please check your availability settings or select another date.
                        </Text>
                    </View>
                )}

                {/* Selected Info */}
                {selectedDate && selectedTime && (
                    <View style={styles.selectedCard}>
                        <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                        <View style={styles.selectedInfo}>
                            <Text style={styles.selectedLabel}>New Schedule:</Text>
                            <Text style={styles.selectedText}>
                                {selectedDate} at {formatTimeDisplay(selectedTime)}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Reschedule Button */}
                <TouchableOpacity
                    style={[
                        styles.rescheduleButton,
                        (!selectedDate || !selectedTime || submitting) && styles.rescheduleButtonDisabled,
                    ]}
                    onPress={handleReschedule}
                    disabled={!selectedDate || !selectedTime || submitting}
                >
                    {submitting ? (
                        <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                        <>
                            <Ionicons name="calendar-outline" size={20} color="#FFF" />
                            <Text style={styles.rescheduleButtonText}>Confirm Reschedule</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
        color: '#666',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Poppins-SemiBold',
        color: '#00796B',
    },
    placeholder: {
        width: 40,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    infoCard: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    infoLabel: {
        fontSize: 13,
        fontFamily: 'Poppins-Medium',
        color: '#666',
        marginLeft: 8,
        marginRight: 8,
    },
    infoValue: {
        fontSize: 13,
        fontFamily: 'Poppins-SemiBold',
        color: '#333',
        flex: 1,
    },
    currentDateText: {
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        color: '#999',
        flex: 1,
    },
    instructionsCard: {
        flexDirection: 'row',
        backgroundColor: '#E3F2FD',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#2196F3',
    },
    instructionsText: {
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        color: '#1976D2',
        marginLeft: 8,
        flex: 1,
        lineHeight: 18,
    },
    calendarCard: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: 'Poppins-SemiBold',
        color: '#00796B',
        marginBottom: 12,
    },
    legend: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 12,
        gap: 20,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 6,
    },
    legendText: {
        fontSize: 11,
        fontFamily: 'Poppins-Regular',
        color: '#666',
    },
    timeCard: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    timeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    timeSlot: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#00796B',
        backgroundColor: '#FFF',
    },
    timeSlotSelected: {
        backgroundColor: '#00796B',
        borderColor: '#00796B',
    },
    timeSlotText: {
        fontSize: 13,
        fontFamily: 'Poppins-Medium',
        color: '#00796B',
    },
    timeSlotTextSelected: {
        color: '#FFF',
    },
    selectedCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#4CAF50',
    },
    selectedInfo: {
        marginLeft: 12,
        flex: 1,
    },
    selectedLabel: {
        fontSize: 12,
        fontFamily: 'Poppins-Medium',
        color: '#2E7D32',
        marginBottom: 2,
    },
    selectedText: {
        fontSize: 14,
        fontFamily: 'Poppins-SemiBold',
        color: '#1B5E20',
    },
    noSlotsCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF3E0',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#FF9800',
    },
    noSlotsText: {
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        color: '#E65100',
        marginLeft: 12,
        flex: 1,
        lineHeight: 20,
    },
    rescheduleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#00796B',
        borderRadius: 12,
        paddingVertical: 16,
        marginBottom: 32,
        gap: 10,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 6,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    rescheduleButtonDisabled: {
        backgroundColor: '#CCC',
        opacity: 0.6,
    },
    rescheduleButtonText: {
        fontSize: 16,
        fontFamily: 'Poppins-SemiBold',
        color: '#FFF',
    },
});
