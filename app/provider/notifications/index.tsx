import { markAllNotificationsAsRead, markNotificationAsRead } from '@/api/notifications.api';
import { useNotifications } from '@/context/NotificationContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    BackHandler,
    FlatList,
    RefreshControl,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface Notification {
    id: number;
    type: string;
    title: string;
    body: string;
    data: any;
    read: boolean;
    created_at: string;
}

export default function NotificationsScreen() {
    const insets = useSafeAreaInsets();
    const { refreshUnreadCount } = useNotifications();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Prevent back to OTP screen - navigate to home instead
    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                router.replace('/provider/integration/fixmoto');
                return true;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

            return () => subscription.remove();
        }, [])
    );

    // Notification fetching is disabled as the backend endpoint doesn't exist
    const fetchNotifications = async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            
            const token = await AsyncStorage.getItem('providerToken');
            if (!token) {
                console.log('No auth token found');
                return;
            }

            // Backend endpoint /api/notifications does not exist
            // Notifications are handled via push notifications only
            console.log('Notification history endpoint not available');
            setNotifications([]);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        // Don't fetch notifications on mount since the endpoint doesn't exist
        setLoading(false);
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchNotifications(false);
    }, []);

    const handleNotificationPress = async (notification: Notification) => {
        try {
            const token = await AsyncStorage.getItem('providerToken');
            if (!token) return;

            // Mark as read if unread
            if (!notification.read) {
                await markNotificationAsRead(notification.id, token);
                
                // Update local state
                setNotifications(prev =>
                    prev.map(n =>
                        n.id === notification.id ? { ...n, read: true } : n
                    )
                );
                
                // Refresh unread count
                await refreshUnreadCount();
            }

            // Navigate based on notification type
            const { type, data } = notification;

            if (type === 'booking' || type === 'completion') {
                router.push('/provider/integration/fixmoto');
            } else if (type === 'message' && data?.conversationId) {
                router.push({
                    pathname: '/messaging/chat',
                    params: {
                        conversationId: data.conversationId,
                        customerName: data.customerName || 'Customer',
                    },
                });
            } else if (type === 'verification' || type === 'certificate') {
                router.push('/provider/onboarding/providerprofile');
            } else if (type === 'backjob') {
                router.push('/provider/integration/fixmoto');
            }
        } catch (error) {
            console.error('Failed to handle notification press:', error);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            const token = await AsyncStorage.getItem('providerToken');
            if (!token) return;

            await markAllNotificationsAsRead(token);
            
            // Update local state
            setNotifications(prev =>
                prev.map(n => ({ ...n, read: true }))
            );
            
            // Refresh unread count
            await refreshUnreadCount();
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'booking':
                return 'calendar';
            case 'message':
                return 'chatbubble';
            case 'verification':
                return 'checkmark-circle';
            case 'certificate':
                return 'document';
            case 'completion':
                return 'checkmark-done';
            case 'backjob':
                return 'repeat';
            default:
                return 'notifications';
        }
    };

    const getNotificationColor = (type: string) => {
        switch (type) {
            case 'booking':
                return '#2196F3';
            case 'message':
                return '#4CAF50';
            case 'verification':
                return '#FF9800';
            case 'certificate':
                return '#9C27B0';
            case 'completion':
                return '#00BCD4';
            case 'backjob':
                return '#FFC107';
            default:
                return '#757575';
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInMs = now.getTime() - date.getTime();
        const diffInMinutes = Math.floor(diffInMs / 60000);
        const diffInHours = Math.floor(diffInMinutes / 60);
        const diffInDays = Math.floor(diffInHours / 24);

        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInHours < 24) return `${diffInHours}h ago`;
        if (diffInDays < 7) return `${diffInDays}d ago`;
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const renderNotification = ({ item }: { item: Notification }) => (
        <TouchableOpacity
            style={[styles.notificationCard, !item.read && styles.unreadCard]}
            onPress={() => handleNotificationPress(item)}
            activeOpacity={0.7}
        >
            <View style={[styles.iconContainer, { backgroundColor: getNotificationColor(item.type) }]}>
                <Ionicons name={getNotificationIcon(item.type)} size={24} color="#FFF" />
            </View>
            
            <View style={styles.contentContainer}>
                <View style={styles.headerRow}>
                    <Text style={[styles.title, !item.read && styles.unreadTitle]} numberOfLines={1}>
                        {item.title}
                    </Text>
                    {!item.read && <View style={styles.unreadDot} />}
                </View>
                
                <Text style={styles.body} numberOfLines={2}>
                    {item.body}
                </Text>
                
                <Text style={styles.timestamp}>
                    {formatDate(item.created_at)}
                </Text>
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
                <StatusBar barStyle="dark-content" />
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Notifications</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#00796B" />
                </View>
            </SafeAreaView>
        );
    }

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" />
            
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                {unreadCount > 0 && (
                    <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllButton}>
                        <Text style={styles.markAllText}>Mark all</Text>
                    </TouchableOpacity>
                )}
                {unreadCount === 0 && <View style={{ width: 40 }} />}
            </View>

            {/* Notifications List */}
            {notifications.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="notifications-off-outline" size={64} color="#BDBDBD" />
                    <Text style={styles.emptyTitle}>No notifications yet</Text>
                    <Text style={styles.emptyText}>
                        You'll see notifications here when you receive them
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    renderItem={renderNotification}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#00796B']}
                            tintColor="#00796B"
                        />
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
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
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#000',
    },
    markAllButton: {
        padding: 8,
    },
    markAllText: {
        color: '#00796B',
        fontSize: 14,
        fontWeight: '600',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
    },
    notificationCard: {
        flexDirection: 'row',
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    unreadCard: {
        backgroundColor: '#E8F5E9',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    contentContainer: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
        flex: 1,
    },
    unreadTitle: {
        fontWeight: 'bold',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#00796B',
        marginLeft: 8,
    },
    body: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
        lineHeight: 20,
    },
    timestamp: {
        fontSize: 12,
        color: '#999',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#000',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
});
