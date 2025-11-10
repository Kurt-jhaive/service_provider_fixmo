import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    BackHandler,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function MessageScreen() {
    const router = useRouter();
    const {name, messages} = useLocalSearchParams();
    const parsedMessages = messages ? JSON.parse(messages as string) : [];

    const [chatMessages, setChatMessages] = useState(parsedMessages);
    const [newMessage, setNewMessage] = useState("");
    const flatListRef = useRef<FlatList>(null);

    // Prevent back to OTP screen - navigate to home instead
    useFocusEffect(
        React.useCallback(() => {
            const onBackPress = () => {
                router.replace('/provider/integration/fixmoto');
                return true;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

            return () => subscription.remove();
        }, [])
    );

    // Auto scroll to bottom
    useEffect(() => {
        if (chatMessages.length > 0) {
            flatListRef.current?.scrollToEnd({animated: true});
        }
    }, [chatMessages]);

    const sendMessage = () => {
        if (newMessage.trim() === "") return;
        const msg = {
            id: Date.now().toString(),
            text: newMessage,
            sender: "me",
            date: "Today",
        };
        setChatMessages([...chatMessages, msg]);
        setNewMessage("");
    };

    return (
        <KeyboardAvoidingView
            style={{flex: 1}}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <View style={styles.container}>
                {/* Header */}
                <Text style={styles.header}>{name}</Text>

                {/* Chat list */}
                <FlatList
                    ref={flatListRef}
                    contentContainerStyle={{paddingTop: 10}}
                    data={chatMessages}
                    keyExtractor={(item) => item.id}
                    renderItem={({item}) => (
                        <View
                            style={[
                                styles.messageBubble,
                                item.sender === "me" ? styles.myBubble : styles.theirBubble,
                            ]}
                        >
                            <Text style={styles.messageText}>{item.text}</Text>
                            <Text style={styles.date}>{item.date}</Text>
                        </View>
                    )}
                />

                {/* Input */}
                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type a message..."
                        placeholderTextColor="#999"
                        value={newMessage}
                        onChangeText={setNewMessage}
                    />
                    <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
                        <Ionicons name="send" size={22} color="#fff"/>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {flex: 1, backgroundColor: "#fff", padding: 12},

    header: {
        fontSize: 18,
        fontWeight: "700",
        marginTop: 30,
        marginBottom: 15,
        textAlign: "center",
        color: "#111", // ✅ green header
        fontFamily: "PoppinsSemiBold",
    },

    messageBubble: {
        maxWidth: "75%",
        padding: 10,
        marginVertical: 5,
        borderRadius: 12,
    },

    myBubble: {
        backgroundColor: "#008080", // ✅ green bubble
        alignSelf: "flex-end",
    },

    theirBubble: {
        backgroundColor: "#f1f5f9",
        alignSelf: "flex-start",
    },

    messageText: {
        color: "#111",
        fontSize: 14,
        fontFamily: "PoppinsRegular",
    },

    date: {
        fontSize: 10,
        color: "#555",
        marginTop: 4,
        fontFamily: "PoppinsRegular",
    },

    inputRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 6,
     
    },

    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: "#008080", // ✅ green border
        borderRadius: 20,
        paddingHorizontal: 12,
        height: 40,
        fontFamily: "PoppinsRegular",
        color: "#111",
    },

    sendBtn: {
        marginLeft: 8,
        backgroundColor: "#008080", // ✅ green send button
        padding: 10,
        borderRadius: 20,
    },
});
