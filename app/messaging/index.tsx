import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format, parseISO } from "date-fns";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Socket } from "socket.io-client";
import { getConversations } from "../../src/api/messages.api";
import type { Conversation } from "../../src/types/message";
import { MessageService } from "../../src/utils/messageAPI";

export default function MessagesListScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const socketRef = useRef<Socket | null>(null);
    const currentUserIdRef = useRef<string | null>(null);
    
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isConnected, setIsConnected] = useState(false);

    // Refresh conversations when screen is focused
    useFocusEffect(
        useCallback(() => {
            checkUserAndRefresh();
        }, [])
    );

    const checkUserAndRefresh = async () => {
        const providerId = await AsyncStorage.getItem("provider_id");
        
        // If user has changed, clear conversations and reload
        if (currentUserIdRef.current !== null && currentUserIdRef.current !== providerId) {
            console.log('🔄 Different user detected, clearing conversations');
            setConversations([]);
            setFilteredConversations([]);
            setLoading(true);
            
            // Disconnect old socket
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            
            // Reset MessageService completely to clear any cached data
            MessageService.reset();
            console.log('🧹 MessageService reset for new user in conversations list');
            
            // Reinitialize for new user
            await initializeMessaging();
        } else if (!currentUserIdRef.current) {
            // First load
            await initializeMessaging();
        } else {
            // Same user, just refresh
            await fetchConversations();
        }
        
        currentUserIdRef.current = providerId;
    };

    useEffect(() => {
        initializeMessaging();

        return () => {
            // Cleanup on unmount
            if (socketRef.current) {
                console.log('🧹 Disconnecting socket from messages list');
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        // Filter conversations based on search query
        if (searchQuery.trim() === "") {
            setFilteredConversations(conversations);
        } else {
            const query = searchQuery.toLowerCase();
            const filtered = conversations.filter((conv) => {
                const customerName = conv.customer
                    ? `${conv.customer.first_name} ${conv.customer.last_name}`.toLowerCase()
                    : "";
                const lastMessageContent = conv.last_message?.content?.toLowerCase() || "";
                return customerName.includes(query) || lastMessageContent.includes(query);
            });
            setFilteredConversations(filtered);
        }
    }, [searchQuery, conversations]);

    const initializeMessaging = async () => {
        const token = await AsyncStorage.getItem("providerToken");
        const providerId = await AsyncStorage.getItem("provider_id");

        if (!token) {
            Alert.alert("Error", "Authentication required. Please log in again.");
            return;
        }

        // Initialize MessageService - always reset and create fresh instance to ensure no cache
        let messageAPI = MessageService.getInstance();
        if (!messageAPI) {
            console.log('🚀 Creating new MessageService instance for conversations');
            messageAPI = MessageService.initialize(token);
        } else {
            // Update token in existing instance
            console.log('🔄 Updating token in existing MessageService instance');
            MessageService.updateToken(token);
        }

        // Fetch conversations for THIS user
        await fetchConversations();

        // Setup Socket.IO for real-time updates
        setupSocketIO(messageAPI, parseInt(providerId || '0'));
    };

    const setupSocketIO = (messageAPI: any, userId: number) => {
        console.log('🔌 Setting up Socket.IO for conversations list...');
        
        // Always create a fresh Socket.IO connection for safety
        // Don't reuse old connections that might have stale data
        const socket = messageAPI.createSocketIOConnection();
        
        if (!socket) {
            console.error('Failed to create socket connection');
            return;
        }
        
        // Store the new socket
        MessageService.setSocket(socket);
        socketRef.current = socket;

        // Connection events
        socket.on('connect', () => {
            console.log('✅ Conversations list: Socket connected');
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            console.log('🔌 Conversations list: Socket disconnected');
            setIsConnected(false);
        });

        socket.on('authenticated', (data: any) => {
            console.log('✅ Conversations list: Socket authenticated:', data);
        });

        // Listen for new messages in any conversation
        socket.on('new_message', (data: any) => {
            console.log('📨 New message in conversations list:', data);
            if (data.message) {
                updateConversationWithNewMessage(data.message);
            }
        });

        // Listen for message read events
        socket.on('message_read', (data: any) => {
            if (data.conversationId) {
                // Optionally update unread count
                updateConversationReadStatus(data.conversationId, data.messageId);
            }
        });

        socket.on('authentication_failed', (error: any) => {
            console.error('❌ Socket authentication failed:', error);
        });
    };

    const updateConversationWithNewMessage = (message: any) => {
        setConversations((prev) => {
            // Find the conversation
            const updated = prev.map((conv) => {
                if (conv.conversation_id === message.conversation_id) {
                    return {
                        ...conv,
                        last_message: message,
                        last_message_at: message.created_at,
                        unread_count: message.sender_type === 'customer' 
                            ? conv.unread_count + 1 
                            : conv.unread_count,
                    };
                }
                return conv;
            });

            // Sort by last_message_at
            return updated.sort((a, b) => {
                const dateA = a.last_message_at || a.updated_at;
                const dateB = b.last_message_at || b.updated_at;
                return new Date(dateB).getTime() - new Date(dateA).getTime();
            });
        });
    };

    const updateConversationReadStatus = (conversationId: number, messageId: number) => {
        setConversations((prev) =>
            prev.map((conv) => {
                if (conv.conversation_id === conversationId) {
                    // Decrease unread count if message was unread
                    return {
                        ...conv,
                        unread_count: Math.max(0, conv.unread_count - 1),
                    };
                }
                return conv;
            })
        );
    };

    const fetchConversations = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem("providerToken");
            if (!token) {
                Alert.alert("Error", "Authentication required. Please log in again.");
                return;
            }

            console.log('📥 Fetching conversations...');
            const data = await getConversations(token, 1, 50, true);
            console.log('📊 Received conversations:', data.length);
            
            // Log first conversation for debugging
            if (data.length > 0) {
                console.log('🔍 First conversation sample:', {
                    conversation_id: data[0].conversation_id,
                    customer_id: data[0].customer_id,
                    provider_id: data[0].provider_id,
                    has_customer: !!data[0].customer,
                    customer_name: data[0].customer ? `${data[0].customer.first_name} ${data[0].customer.last_name}` : 'N/A',
                    status: data[0].status,
                    unread_count: data[0].unread_count,
                    last_message: data[0].last_message
                });
            }
            
            // Sort by last_message_at or updated_at, most recent first
            const sorted = data.sort((a, b) => {
                const dateA = a.last_message_at || a.updated_at;
                const dateB = b.last_message_at || b.updated_at;
                return new Date(dateB).getTime() - new Date(dateA).getTime();
            });
            
            setConversations(sorted);
            setFilteredConversations(sorted);
        } catch (error: any) {
            console.error('❌ Error fetching conversations:', error);
            Alert.alert("Error", error.message || "Failed to load conversations");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchConversations();
    };

    const openConversation = (conversation: Conversation) => {
        console.log('🔍 Opening conversation:', {
            conversation_id: conversation.conversation_id,
            customer_id: conversation.customer_id,
            provider_id: conversation.provider_id,
            customer: conversation.customer,
            participant: conversation.participant,
            status: conversation.status,
            fullConversation: conversation
        });

        // Validate required data before navigation
        if (!conversation.conversation_id) {
            console.error('❌ Missing conversation_id');
            Alert.alert("Error", "Invalid conversation data: Missing conversation ID");
            return;
        }

        // Handle both 'customer' and 'participant' fields (API might return either)
        const customerData = conversation.customer || conversation.participant;
        
        if (!customerData) {
            console.error('❌ Missing customer/participant data');
            Alert.alert("Error", "Invalid conversation data: Missing customer information");
            return;
        }

        // Extract customer_id from the customer object if not directly provided
        let customerId = conversation.customer_id;
        if (!customerId && customerData && 'user_id' in customerData) {
            customerId = customerData.user_id;
            console.log('✅ Extracted customer_id from customer.user_id:', customerId);
        }

        if (!customerId) {
            console.error('❌ Missing customer_id and could not extract from customer object');
            Alert.alert("Error", "Invalid conversation data: Missing customer ID");
            return;
        }

        // Extract customer name from either structure
        let customerName = "Customer";
        let customerPhone = "";
        let customerPhoto = "";

        if ('first_name' in customerData) {
            // CustomerProfile format
            customerName = `${customerData.first_name} ${customerData.last_name}`;
            customerPhone = customerData.phone_number || "";
            customerPhoto = customerData.profile_photo || "";
        } else if ('provider_first_name' in customerData) {
            // If participant is actually provider data (shouldn't happen but handle it)
            customerName = `${customerData.provider_first_name} ${customerData.provider_last_name}`;
            customerPhone = customerData.provider_phone_number || "";
            customerPhoto = customerData.provider_profile_photo || "";
        }

        const params = {
            conversationId: conversation.conversation_id.toString(),
            customerId: customerId.toString(),
            customerName,
            customerPhone,
            customerPhoto,
            appointmentStatus: conversation.appointment_status || 'active',
        };

        console.log('📤 Navigating with params:', params);

        router.push({
            pathname: "/messaging/chat",
            params,
        });
    };

    const formatTimestamp = (dateString?: string) => {
        if (!dateString) return "";
        try {
            const date = parseISO(dateString);
            const now = new Date();
            const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

            if (diffInHours < 24) {
                return format(date, "h:mm a");
            } else if (diffInHours < 48) {
                return "Yesterday";
            } else if (diffInHours < 168) {
                return format(date, "EEE");
            } else {
                return format(date, "MMM d");
            }
        } catch {
            return "";
        }
    };

    const renderConversationItem = ({ item }: { item: Conversation }) => {
        // Handle both 'customer' and 'participant' fields
        const customerData = item.customer || item.participant;
        
        let customerName = "Customer";
        let customerPhoto: string | undefined;

        if (customerData) {
            if ('first_name' in customerData) {
                customerName = `${customerData.first_name} ${customerData.last_name}`;
                customerPhoto = customerData.profile_photo;
            } else if ('provider_first_name' in customerData) {
                // If participant is provider data (edge case)
                customerName = `${customerData.provider_first_name} ${customerData.provider_last_name}`;
                customerPhoto = customerData.provider_profile_photo;
            }
        }

        const lastMessage = item.last_message?.content || "No messages yet";
        const unreadCount = item.unread_count || 0;
        const timestamp = formatTimestamp(item.last_message_at || item.updated_at);
        const isUnread = unreadCount > 0;

        // Debug logging for unread count
        if (unreadCount > 0) {
            console.log('📬 Conversation with unread messages:', {
                conversation_id: item.conversation_id,
                customer_name: customerName,
                unread_count: unreadCount,
                raw_unread_count: item.unread_count,
                last_message: lastMessage
            });
        }

        return (
            <TouchableOpacity
                style={[styles.conversationItem, isUnread && styles.unreadItem]}
                onPress={() => openConversation(item)}
                activeOpacity={0.7}
            >
                <View style={styles.avatarContainer}>
                    {customerPhoto ? (
                        <Image
                            source={{ uri: customerPhoto }}
                            style={styles.avatar}
                        />
                    ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                            <Text style={styles.avatarText}>
                                {customerName.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    )}
                    {isUnread && <View style={styles.onlineIndicator} />}
                </View>

                <View style={styles.conversationContent}>
                    <View style={styles.headerRow}>
                        <Text
                            style={[
                                styles.customerName,
                                isUnread && styles.unreadText,
                            ]}
                            numberOfLines={1}
                        >
                            {customerName}
                        </Text>
                        <Text style={styles.timestamp}>{timestamp}</Text>
                    </View>

                    <View style={styles.messageRow}>
                        {item.last_message?.message_type === "image" && (
                            <Ionicons
                                name="image-outline"
                                size={14}
                                color="#666"
                                style={styles.messageTypeIcon}
                            />
                        )}
                        {item.last_message?.message_type === "document" && (
                            <Ionicons
                                name="document-outline"
                                size={14}
                                color="#666"
                                style={styles.messageTypeIcon}
                            />
                        )}
                        <Text
                            style={[
                                styles.lastMessage,
                                isUnread && styles.unreadText,
                            ]}
                            numberOfLines={1}
                        >
                            {item.last_message?.sender_type === "provider" && "You: "}
                            {lastMessage}
                        </Text>
                    </View>
                </View>

                {isUnread && (
                    <View style={styles.unreadBadge}>
                        <Text style={styles.unreadCount}>
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
                <StatusBar barStyle="dark-content" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#00796B" />
                    <Text style={styles.loadingText}>Loading conversations...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" />
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.replace('/provider/onboarding/pre_homepage')}
                    style={styles.backButton}
                >
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Messages</Text>
                {isConnected && (
                    <View style={styles.connectionIndicator}>
                        <View style={styles.connectionDot} />
                    </View>
                )}
                {!isConnected && <View style={{ width: 24 }} />}
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search conversations..."
                    placeholderTextColor="#999"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                        <Ionicons name="close-circle" size={20} color="#999" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Conversations List */}
            {filteredConversations.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="chatbubbles-outline" size={80} color="#ccc" />
                    <Text style={styles.emptyText}>
                        {searchQuery ? "No conversations found" : "No messages yet"}
                    </Text>
                    <Text style={styles.emptySubtext}>
                        {searchQuery
                            ? "Try a different search term"
                            : "Your conversations with customers will appear here"}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filteredConversations}
                    renderItem={renderConversationItem}
                    keyExtractor={(item) => item.conversation_id.toString()}
                    contentContainerStyle={styles.listContainer}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={["#1e6355"]}
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
        backgroundColor: "#f5f5f5",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: "#666",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#e0e0e0",
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: "600",
        color: "#000",
    },
    connectionIndicator: {
        width: 24,
        height: 24,
        justifyContent: "center",
        alignItems: "center",
    },
    connectionDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#4CAF50",
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        marginHorizontal: 16,
        marginVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#e0e0e0",
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 10,
        fontSize: 16,
        color: "#000",
    },
    listContainer: {
        paddingBottom: 16,
    },
    conversationItem: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
    },
    unreadItem: {
        backgroundColor: "#f8fffe",
    },
    avatarContainer: {
        position: "relative",
        marginRight: 12,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    avatarPlaceholder: {
        backgroundColor: "#1e6355",
        justifyContent: "center",
        alignItems: "center",
    },
    avatarText: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "600",
    },
    onlineIndicator: {
        position: "absolute",
        bottom: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: "#4CAF50",
        borderWidth: 2,
        borderColor: "#fff",
    },
    conversationContent: {
        flex: 1,
        justifyContent: "center",
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
    customerName: {
        fontSize: 16,
        fontWeight: "500",
        color: "#000",
        flex: 1,
    },
    timestamp: {
        fontSize: 12,
        color: "#999",
        marginLeft: 8,
    },
    messageRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    messageTypeIcon: {
        marginRight: 4,
    },
    lastMessage: {
        fontSize: 14,
        color: "#666",
        flex: 1,
    },
    unreadText: {
        fontWeight: "600",
        color: "#000",
    },
    unreadBadge: {
        backgroundColor: "#1e6355",
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 6,
        marginLeft: 8,
    },
    unreadCount: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "600",
    },
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 32,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: "600",
        color: "#666",
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: "#999",
        textAlign: "center",
        marginTop: 8,
    },
});
