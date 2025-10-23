import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format, parseISO } from "date-fns";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Linking,
    Platform,
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
import {
    getMessages,
    markMessagesAsRead,
    sendMessage,
} from "../../src/api/messages.api";
import type { Message } from "../../src/types/message";
import { MessageService } from "../../src/utils/messageAPI";

export default function ChatScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const flatListRef = useRef<FlatList>(null);
    const socketRef = useRef<Socket | null>(null);
    const currentUserIdRef = useRef<string | null>(null);

    const conversationId = parseInt(params.conversationId as string);
    const customerId = parseInt(params.customerId as string);
    const customerName = params.customerName as string;
    const customerPhone = params.customerPhone as string;
    const customerPhoto = params.customerPhoto as string;
    const appointmentStatus = params.appointmentStatus as string;
    const isReadOnly = appointmentStatus === 'completed';

    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [messageText, setMessageText] = useState("");
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [providerId, setProviderId] = useState<number | null>(null);
    const [warrantyExpired, setWarrantyExpired] = useState(false);

    // Check for user changes when screen is focused
    useFocusEffect(
        useCallback(() => {
            checkUserAndRefresh();
        }, [])
    );

    const checkUserAndRefresh = async () => {
        const storedProviderId = await AsyncStorage.getItem("provider_id");
        
        // If logged out (no providerId), clear everything and go back
        if (!storedProviderId) {
            console.log('🚪 No provider ID found - user logged out, clearing chat');
            setMessages([]);
            setLoading(false);
            
            // Disconnect socket
            if (socketRef.current) {
                socketRef.current.removeAllListeners();
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            
            currentUserIdRef.current = null;
            // Navigate back since user is logged out
            router.back();
            return;
        }
        
        // If user has changed, clear messages and reload
        if (currentUserIdRef.current !== null && currentUserIdRef.current !== storedProviderId) {
            console.log('🔄 Different user detected in chat, clearing messages');
            console.log('   Previous user:', currentUserIdRef.current);
            console.log('   New user:', storedProviderId);
            
            setMessages([]);
            setLoading(true);
            
            // Disconnect old socket
            if (socketRef.current) {
                socketRef.current.removeAllListeners();
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            
            // Reinitialize for new user
            await initializeMessaging();
        }
        
        currentUserIdRef.current = storedProviderId;
    };

    useEffect(() => {
        initializeMessaging();
        return () => {
            // Cleanup on unmount
            if (socketRef.current) {
                console.log('🧹 Cleaning up socket connection');
                const messageAPI = MessageService.getInstance();
                if (messageAPI) {
                    messageAPI.leaveConversation(socketRef.current, conversationId);
                }
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        // Mark messages as read when messages change
        markUnreadMessages();
    }, [messages]);

    const initializeMessaging = async () => {
        try {
            const token = await AsyncStorage.getItem("providerToken");
            const storedProviderId = await AsyncStorage.getItem("provider_id");
            
            if (!token) {
                Alert.alert("Error", "Authentication required. Please log in again.");
                router.back();
                return;
            }

            if (storedProviderId) {
                setProviderId(parseInt(storedProviderId));
            }

            // Initialize MessageService
            let messageAPI = MessageService.getInstance();
            if (!messageAPI) {
                messageAPI = MessageService.initialize(token);
            }

            // Fetch initial messages
            await fetchMessages();

            // Setup Socket.IO for real-time updates
            setupSocketIO(messageAPI, parseInt(storedProviderId || '0'));
        } catch (error: any) {
            console.error('Initialization error:', error);
            Alert.alert("Error", "Failed to initialize messaging");
        }
    };

    const setupSocketIO = (messageAPI: any, userId: number) => {
        console.log('🔌 Setting up Socket.IO...');
        
        // Create Socket.IO connection
        const socket = messageAPI.createSocketIOConnection();
        socketRef.current = socket;

        // Store socket in service
        MessageService.setSocket(socket);

        // Connection events
        socket.on('connect', () => {
            console.log('✅ Socket connected');
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            console.log('🔌 Socket disconnected');
            setIsConnected(false);
        });

        socket.on('authenticated', (data: any) => {
            console.log('✅ Socket authenticated:', data);
            // Join this conversation room
            messageAPI.joinConversation(socket, conversationId, userId, 'provider');
        });

        socket.on('joined_conversation', (data: any) => {
            console.log('✅ Joined conversation:', data);
        });

        // Listen for new messages
        socket.on('new_message', (data: any) => {
            console.log('📨 New message received:', data);
            if (data.message && data.message.conversation_id === conversationId) {
                setMessages((prev) => {
                    // Avoid duplicates
                    if (prev.some(msg => msg.message_id === data.message.message_id)) {
                        return prev;
                    }
                    return [...prev, data.message];
                });

                // Auto-scroll to bottom
                setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                }, 100);

                // Auto-mark as read if from customer
                if (data.message.sender_type === 'customer') {
                    markSingleMessageAsRead(data.message.message_id);
                }
            }
        });

        // Listen for message read events
        socket.on('message_read', (data: any) => {
            console.log('✅ Message read:', data);
            if (data.messageId) {
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.message_id === data.messageId
                            ? { ...msg, is_read: true }
                            : msg
                    )
                );
            }
        });

        socket.on('authentication_failed', (error: any) => {
            console.error('❌ Socket authentication failed:', error);
            Alert.alert('Connection Error', 'Failed to authenticate messaging connection');
        });

        socket.on('join_conversation_failed', (error: any) => {
            // Handle different failure reasons gracefully
            if (error.reason === 'expired' || error.error?.includes('warranty period has expired')) {
                console.log('⏰ Conversation warranty period has expired - read-only mode');
                setWarrantyExpired(true);
                // Don't show error alert for expired warranties - this is expected
                // The conversation is still viewable but no new messages can be sent
                return;
            }
            
            if (error.reason === 'not_found') {
                console.warn('⚠️ Conversation not found:', error.conversationId);
                Alert.alert('Error', 'This conversation no longer exists.');
                return;
            }
            
            if (error.reason === 'unauthorized') {
                console.warn('⚠️ Unauthorized access to conversation');
                Alert.alert('Error', 'You do not have access to this conversation.');
                return;
            }
            
            // Log other errors as warnings
            console.warn('⚠️ Failed to join conversation:', error);
        });
    };

    const fetchMessages = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem("providerToken");
            if (!token) {
                Alert.alert("Error", "Authentication required. Please log in again.");
                return;
            }

            const response = await getMessages(conversationId, token, 1, 100);
            
            // Sort messages by created_at, oldest first (latest at bottom)
            const sortedMessages = response.messages.sort(
                (a, b) =>
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            
            setMessages(sortedMessages);

            // Scroll to bottom after loading messages
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: false });
            }, 100);
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to load messages");
        } finally {
            setLoading(false);
        }
    }, [conversationId]);

    const markUnreadMessages = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem("providerToken");
            if (!token) return;

            // Find all unread messages from customer
            const unreadMessages = messages.filter(
                (msg) => !msg.is_read && msg.sender_type === "customer"
            );

            if (unreadMessages.length > 0) {
                const messageIds = unreadMessages.map((msg) => msg.message_id);
                await markMessagesAsRead(conversationId, messageIds, token);
                
                // Update local state
                setMessages(prev => prev.map(msg => 
                    unreadMessages.some(um => um.message_id === msg.message_id)
                        ? { ...msg, is_read: true }
                        : msg
                ));
            }
        } catch (error) {
            // Fail silently for read receipts
            console.error("Mark as read error:", error);
        }
    }, [messages, conversationId]);

    const markSingleMessageAsRead = async (messageId: number) => {
        try {
            const token = await AsyncStorage.getItem("providerToken");
            if (!token) return;

            await markMessagesAsRead(conversationId, [messageId], token);
        } catch (error) {
            console.error("Mark single message as read error:", error);
        }
    };

    const handleSendMessage = async () => {
        if (!messageText.trim() && !replyingTo) return;

        setSending(true);
        try {
            const token = await AsyncStorage.getItem("providerToken");
            if (!token) {
                Alert.alert("Error", "Authentication required");
                return;
            }

            const response = await sendMessage(
                conversationId,
                messageText.trim(),
                token,
                "text",
                replyingTo?.message_id
            );

            // Add new message to list
            setMessages((prev) => [...prev, response.data]);
            setMessageText("");
            setReplyingTo(null);

            // Scroll to bottom
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to send message");
        } finally {
            setSending(false);
        }
    };

    const handleImagePicker = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== "granted") {
                Alert.alert(
                    "Permission Required",
                    "Please grant camera roll permissions to send images"
                );
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                await sendImageMessage(result.assets[0]);
            }
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to pick image");
        }
    };

    const sendImageMessage = async (image: any) => {
        setSending(true);
        try {
            const token = await AsyncStorage.getItem("providerToken");
            if (!token) {
                Alert.alert("Error", "Authentication required");
                return;
            }

            const attachment = {
                uri: image.uri,
                name: image.fileName || `image_${Date.now()}.jpg`,
                type: image.mimeType || "image/jpeg",
            };

            const response = await sendMessage(
                conversationId,
                "Sent an image",
                token,
                "image",
                undefined,
                attachment
            );

            setMessages((prev) => [...prev, response.data]);

            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to send image");
        } finally {
            setSending(false);
        }
    };

    const handleCall = () => {
        if (!customerPhone) {
            Alert.alert("No Phone Number", "Customer phone number is not available");
            return;
        }

        const phoneNumber = customerPhone.replace(/[^0-9]/g, "");
        const phoneUrl = Platform.OS === "ios" ? `telprompt:${phoneNumber}` : `tel:${phoneNumber}`;

        Linking.canOpenURL(phoneUrl)
            .then((supported) => {
                if (supported) {
                    return Linking.openURL(phoneUrl);
                } else {
                    Alert.alert("Error", "Unable to make phone call");
                }
            })
            .catch((err) => Alert.alert("Error", "Unable to make phone call"));
    };

    const formatMessageTime = (dateString: string) => {
        try {
            const date = parseISO(dateString);
            return format(date, "h:mm a");
        } catch {
            return "";
        }
    };

    const renderMessage = ({ item, index }: { item: Message; index: number }) => {
        const isProvider = item.sender_type === "provider";
        const showTimestamp =
            index === 0 ||
            new Date(item.created_at).getTime() -
                new Date(messages[index - 1].created_at).getTime() >
                300000; // 5 minutes

        return (
            <View style={styles.messageContainer}>
                {showTimestamp && (
                    <Text style={styles.timestampText}>
                        {format(parseISO(item.created_at), "MMM d, h:mm a")}
                    </Text>
                )}

                <View
                    style={[
                        styles.messageBubble,
                        isProvider ? styles.providerBubble : styles.customerBubble,
                    ]}
                >
                    {item.replied_to && (
                        <View style={styles.replyContainer}>
                            <View style={styles.replyLine} />
                            <View style={styles.replyContent}>
                                <Text style={styles.replyAuthor}>
                                    {item.replied_to.sender_type === "provider"
                                        ? "You"
                                        : customerName}
                                </Text>
                                <Text style={styles.replyText} numberOfLines={2}>
                                    {item.replied_to.content}
                                </Text>
                            </View>
                        </View>
                    )}

                    {item.message_type === "image" && item.attachment_url && (
                        <TouchableOpacity
                            onPress={() => {
                                // Open image in full screen (implement modal if needed)
                                Linking.openURL(item.attachment_url!);
                            }}
                        >
                            <Image
                                source={{ uri: item.attachment_url }}
                                style={styles.messageImage}
                                resizeMode="cover"
                            />
                        </TouchableOpacity>
                    )}

                    {item.message_type === "document" && item.attachment_url && (
                        <TouchableOpacity
                            style={styles.documentContainer}
                            onPress={() => Linking.openURL(item.attachment_url!)}
                        >
                            <Ionicons name="document-text" size={24} color="#1e6355" />
                            <Text style={styles.documentText} numberOfLines={1}>
                                {item.content.replace("Sent a document: ", "")}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {item.message_type === "text" && (
                        <Text
                            style={[
                                styles.messageText,
                                isProvider ? styles.providerText : styles.customerText,
                            ]}
                        >
                            {item.content}
                        </Text>
                    )}

                    <View style={styles.messageFooter}>
                        <Text
                            style={[
                                styles.messageTime,
                                isProvider ? styles.providerTime : styles.customerTime,
                            ]}
                        >
                            {formatMessageTime(item.created_at)}
                        </Text>
                        {isProvider && (
                            <Ionicons
                                name={item.is_read ? "checkmark-done" : "checkmark"}
                                size={14}
                                color={item.is_read ? "#4CAF50" : "#999"}
                                style={styles.readIcon}
                            />
                        )}
                    </View>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
                <StatusBar barStyle="dark-content" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#00796B" />
                    <Text style={styles.loadingText}>Loading messages...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" />
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#000" />
                    </TouchableOpacity>

                    <View style={styles.headerCenter}>
                        {customerPhoto ? (
                            <Image
                                source={{ uri: customerPhoto }}
                                style={styles.headerAvatar}
                            />
                        ) : (
                            <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
                                <Text style={styles.headerAvatarText}>
                                    {customerName.charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}
                        <View style={styles.headerInfo}>
                            <View style={styles.headerNameRow}>
                                <Text style={styles.headerName} numberOfLines={1}>
                                    {customerName}
                                </Text>
                                {isConnected && (
                                    <View style={styles.connectionIndicator}>
                                        <View style={styles.connectionDot} />
                                    </View>
                                )}
                            </View>
                            {customerPhone && (
                                <Text style={styles.headerPhone}>{customerPhone}</Text>
                            )}
                        </View>
                    </View>

                    <TouchableOpacity onPress={handleCall} style={styles.callButton}>
                        <Ionicons name="call" size={24} color="#1e6355" />
                    </TouchableOpacity>
                </View>

                {/* Messages List */}
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.message_id.toString()}
                    contentContainerStyle={styles.messagesContainer}
                    onContentSizeChange={() =>
                        flatListRef.current?.scrollToEnd({ animated: false })
                    }
                />

                {/* Reply Preview */}
                {replyingTo && (
                    <View style={styles.replyPreview}>
                        <View style={styles.replyPreviewContent}>
                            <Text style={styles.replyPreviewLabel}>
                                Replying to{" "}
                                {replyingTo.sender_type === "provider" ? "yourself" : customerName}
                            </Text>
                            <Text style={styles.replyPreviewText} numberOfLines={1}>
                                {replyingTo.content}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => setReplyingTo(null)}>
                            <Ionicons name="close" size={24} color="#666" />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Read-Only Banner */}
                {isReadOnly && (
                    <View style={styles.readOnlyBanner}>
                        <View style={styles.readOnlyContent}>
                            <Ionicons name="lock-closed" size={16} color="#856404" style={{ marginRight: 8 }} />
                            <Text style={styles.readOnlyText}>
                                This conversation is read-only (Appointment completed)
                            </Text>
                        </View>
                    </View>
                )}

                {/* Input Bar - Conditional based on read-only status */}
                {isReadOnly ? (
                    <View style={styles.readOnlyInputContainer}>
                        <Ionicons name="lock-closed-outline" size={18} color="#6c757d" style={{ marginRight: 8 }} />
                        <Text style={styles.readOnlyInputText}>
                            Messaging disabled for completed appointments
                        </Text>
                    </View>
                ) : warrantyExpired ? (
                    <View style={styles.readOnlyInputContainer}>
                        <Ionicons name="time-outline" size={18} color="#FF9800" style={{ marginRight: 8 }} />
                        <Text style={styles.readOnlyInputText}>
                            Warranty period has expired - messages are read-only
                        </Text>
                    </View>
                ) : (
                    <View style={styles.inputContainer}>
                        <TouchableOpacity
                            onPress={handleImagePicker}
                            style={styles.attachButton}
                            disabled={sending}
                        >
                            <Ionicons name="image" size={24} color="#1e6355" />
                        </TouchableOpacity>

                        <TextInput
                            style={styles.input}
                            placeholder="Type a message..."
                            placeholderTextColor="#999"
                            value={messageText}
                            onChangeText={setMessageText}
                            multiline
                            maxLength={1000}
                            editable={!sending}
                        />

                        <TouchableOpacity
                            onPress={handleSendMessage}
                            style={[
                                styles.sendButton,
                                (!messageText.trim() || sending) && styles.sendButtonDisabled,
                            ]}
                            disabled={!messageText.trim() || sending}
                        >
                            {sending ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Ionicons name="send" size={20} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </KeyboardAvoidingView>
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#e0e0e0",
    },
    backButton: {
        padding: 4,
        marginRight: 8,
    },
    headerCenter: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
    },
    headerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    headerAvatarPlaceholder: {
        backgroundColor: "#1e6355",
        justifyContent: "center",
        alignItems: "center",
    },
    headerAvatarText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "600",
    },
    headerInfo: {
        flex: 1,
    },
    headerNameRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    headerName: {
        fontSize: 16,
        fontWeight: "600",
        color: "#000",
    },
    connectionIndicator: {
        marginLeft: 6,
    },
    connectionDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#4CAF50",
    },
    headerPhone: {
        fontSize: 12,
        color: "#666",
        marginTop: 2,
    },
    callButton: {
        padding: 8,
        marginLeft: 8,
    },
    messagesContainer: {
        padding: 16,
        paddingBottom: 8,
    },
    messageContainer: {
        marginBottom: 16,
    },
    timestampText: {
        textAlign: "center",
        fontSize: 12,
        color: "#999",
        marginBottom: 12,
    },
    messageBubble: {
        maxWidth: "75%",
        borderRadius: 12,
        padding: 12,
        marginBottom: 4,
    },
    providerBubble: {
        alignSelf: "flex-end",
        backgroundColor: "#1e6355",
    },
    customerBubble: {
        alignSelf: "flex-start",
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#e0e0e0",
    },
    replyContainer: {
        flexDirection: "row",
        marginBottom: 8,
        paddingLeft: 8,
    },
    replyLine: {
        width: 3,
        backgroundColor: "rgba(255,255,255,0.5)",
        marginRight: 8,
        borderRadius: 2,
    },
    replyContent: {
        flex: 1,
    },
    replyAuthor: {
        fontSize: 12,
        fontWeight: "600",
        color: "rgba(255,255,255,0.9)",
        marginBottom: 2,
    },
    replyText: {
        fontSize: 12,
        color: "rgba(255,255,255,0.7)",
    },
    messageImage: {
        width: 200,
        height: 200,
        borderRadius: 8,
        marginBottom: 4,
    },
    documentContainer: {
        flexDirection: "row",
        alignItems: "center",
        padding: 8,
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: 8,
        marginBottom: 4,
    },
    documentText: {
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
        color: "#fff",
    },
    messageText: {
        fontSize: 15,
        lineHeight: 20,
    },
    providerText: {
        color: "#fff",
    },
    customerText: {
        color: "#000",
    },
    messageFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        marginTop: 4,
    },
    messageTime: {
        fontSize: 11,
    },
    providerTime: {
        color: "rgba(255,255,255,0.7)",
    },
    customerTime: {
        color: "#999",
    },
    readIcon: {
        marginLeft: 4,
    },
    replyPreview: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: "#e0e0e0",
    },
    replyPreviewContent: {
        flex: 1,
    },
    replyPreviewLabel: {
        fontSize: 12,
        fontWeight: "600",
        color: "#1e6355",
        marginBottom: 2,
    },
    replyPreviewText: {
        fontSize: 14,
        color: "#666",
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "flex-end",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#fff",
        borderTopWidth: 1,
        borderTopColor: "#e0e0e0",
    },
    attachButton: {
        padding: 8,
        marginRight: 4,
    },
    input: {
        flex: 1,
        backgroundColor: "#f5f5f5",
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
        maxHeight: 100,
        marginRight: 8,
        color: "#000",
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#1e6355",
        justifyContent: "center",
        alignItems: "center",
    },
    sendButtonDisabled: {
        backgroundColor: "#ccc",
    },
    readOnlyBanner: {
        backgroundColor: '#fff3cd',
        borderBottomWidth: 1,
        borderBottomColor: '#ffc107',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    readOnlyContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    readOnlyText: {
        color: '#856404',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
    readOnlyInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        backgroundColor: '#f8f9fa',
        borderTopWidth: 0.5,
        borderTopColor: '#dee2e6',
    },
    readOnlyInputText: {
        color: '#6c757d',
        fontSize: 14,
        fontStyle: 'italic',
    },
});
