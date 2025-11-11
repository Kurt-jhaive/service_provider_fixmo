import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useRef } from "react";
import { Animated, StyleSheet, TouchableOpacity, View } from "react-native";

type TabKey = "home" | "task" | "myservices" | "messages" | "profile" | "calendar" | "chat";

type BottomTabsProps = {
    activeTab: TabKey;
    isApproved: boolean;
};

const tabIcons: Record<TabKey, string> = {
    home: "home",
    task: "calendar-outline",
    myservices: "briefcase",
    messages: "chatbubbles-outline",
    profile: "person",
    calendar: "calendar-outline",
    chat: "chatbubble-outline",
};

// Only show these tabs in the bottom navigation
const visibleTabs: TabKey[] = ["home", "task", "myservices", "messages", "profile"];

export default function BottomTabs({activeTab, isApproved}: BottomTabsProps) {
    const router = useRouter();

    const scales: Record<TabKey, Animated.Value> = {
        home: useRef(new Animated.Value(1)).current,
        task: useRef(new Animated.Value(1)).current,
        myservices: useRef(new Animated.Value(1)).current,
        messages: useRef(new Animated.Value(1)).current,
        profile: useRef(new Animated.Value(1)).current,
        calendar: useRef(new Animated.Value(1)).current,
        chat: useRef(new Animated.Value(1)).current,
    };

    const handleTabPress = (tab: TabKey) => {
        // Disable certain tabs if user not approved
        if (!isApproved && ["task", "myservices", "messages", "calendar", "chat"].includes(tab)) return;

        Animated.sequence([
            Animated.timing(scales[tab], {toValue: 1.2, duration: 120, useNativeDriver: true}),
            Animated.spring(scales[tab], {toValue: 1, friction: 4, useNativeDriver: true}),
        ]).start();

        switch (tab) {
            case "home":
                router.push("/provider/onboarding/pre_homepage");
                break;
            case "profile":
                router.push("/provider/onboarding/providerprofile");
                break;
            case "task":
                router.push("/provider/integration/fixmoto");
                break;
            case "myservices":
                router.push("/provider/integration/myservices");
                break;
            case "messages":
                router.push("/messaging");
                break;
        }
    };

    return (
        <View style={styles.container}>
            {visibleTabs.map((tab) => {
                const isDisabled = !isApproved && ["task", "myservices", "messages"].includes(tab);
                const isActive = activeTab === tab;

                const tabColor = isDisabled ? "#ccc" : isActive ? "#009688" : "#555";

                return (
                    <TouchableOpacity
                        key={tab}
                        style={styles.tab}
                        onPress={() => handleTabPress(tab)}
                        disabled={isDisabled}
                    >
                        <Animated.View style={{transform: [{scale: scales[tab]}]}}>
                            <Ionicons name={tabIcons[tab] as any} size={26} color={tabColor}/>
                        </Animated.View>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        paddingVertical: 10,
        backgroundColor: "#fff",
    },
    tab: {alignItems: "center", flex: 1, marginBottom: 18},
});
