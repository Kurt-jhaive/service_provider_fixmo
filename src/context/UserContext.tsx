import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from "react";

type ScheduledWork = {
    status: "scheduled" | "ongoing" | "finished";
    client: string;
    service: string;
    datetime: string;
};

export type User = {
    name: string;
    phone: string;
    status: "active" | "pending" | "approved" | "denied";
    scheduledWork?: ScheduledWork;
    email?: string;
    profileImage?: string;
};

export type Notification = {
    id: number;
    title: string;
    body: string;
    read: boolean;
    type?: "welcome" | "booking" | "approval" | "system" | "denied";
    createdAt: string;
};

const defaultUser: User = {
    name: "",
    phone: "",
    status: "approved",
    email: "juan.delacruz@example.com",
    profileImage: "",
    scheduledWork: {
        client: "Maria de la Cruz",
        service: "Plumbing",
        datetime: new Date().toISOString(),
        status: "scheduled",
    },
};

const UserContext = createContext<{
    user: User;
    setUser: (user: User) => void;
    setScheduledWork: (work: ScheduledWork | undefined) => void;
    notifications: Notification[];
    archivedNotifications: Notification[];
    notificationCount: number;
    addNotification: (notif: Omit<Notification, "id" | "read" | "createdAt">) => void;
    markAllAsRead: () => void;
    cleanUpNotifications: () => void;
    logout: () => Promise<void>; // ✅ changed to async
}>({
    user: defaultUser,
    setUser: () => {
    },
    setScheduledWork: () => {
    },
    notifications: [],
    archivedNotifications: [],
    notificationCount: 0,
    addNotification: () => {
    },
    markAllAsRead: () => {
    },
    cleanUpNotifications: () => {
    },
    logout: async () => {
    },
});

export const UserProvider = ({children}: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User>(defaultUser);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [archivedNotifications, setArchivedNotifications] = useState<Notification[]>([]);

    useEffect(() => {
        if (user.name && notifications.length === 0 && user.status === "pending") {
            setNotifications([
                {
                    id: 1,
                    title: "Welcome to FixMo!",
                    body: `Hi ${user.name}, thanks for joining 🎉`,
                    type: "welcome",
                    read: false,
                    createdAt: new Date().toISOString(),
                },
            ]);
        }
    }, [user]);

    useEffect(() => {
        if (user.status === "denied") {
            addNotification({
                title: "Application Denied",
                body: `Hi ${user.name || "Provider"}, your documents were denied. You can submit a new application after 7 days.`,
                type: "denied",
            });
        }
    }, [user.status]);

    const addNotification = (notif: Omit<Notification, "id" | "read" | "createdAt">) => {
        setNotifications((prev) => [
            ...prev,
            {
                id: prev.length + archivedNotifications.length + 1,
                ...notif,
                read: false,
                createdAt: new Date().toISOString(),
            },
        ]);
    };

    const markAllAsRead = () => {
        setNotifications((prev) => prev.map((n) => ({...n, read: true})));
    };

    const cleanUpNotifications = () => {
        const now = new Date();
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(now.getMonth() - 3);

        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(now.getFullYear() - 1);

        setNotifications((prev) => {
            const stillActive: Notification[] = [];
            const toArchive: Notification[] = [];

            prev.forEach((n) => {
                const created = new Date(n.createdAt);
                if (created < oneYearAgo) {
                    return;
                } else if (created < threeMonthsAgo) {
                    toArchive.push(n);
                } else {
                    stillActive.push(n);
                }
            });

            if (toArchive.length > 0) {
                setArchivedNotifications((prevArchived) => [...toArchive, ...prevArchived]);
            }

            return stillActive;
        });
    };

    useEffect(() => {
        cleanUpNotifications();
    }, []);

    const logout = async () => {
        console.log('🚪 Logging out - clearing all session data');
        
        // Reset user state
        setUser({
            name: "",
            phone: "",
            status: "pending",
            email: "",
            profileImage: "",
            scheduledWork: undefined,
        });

        setNotifications([]);
        setArchivedNotifications([]);
        
        // Reset MessageService to clear cached conversations and disconnect socket
        try {
            const { MessageService } = require('../utils/messageAPI');
            MessageService.reset();
            console.log('🧹 MessageService reset on logout');
        } catch (error) {
            console.error('Failed to reset MessageService:', error);
        }

        // Clear all AsyncStorage data related to authentication and sessions
        try {
            // First get all keys to see what we're dealing with
            const allKeys = await AsyncStorage.getAllKeys();
            console.log('📋 All AsyncStorage keys before logout:', allKeys);
            
            const keysToRemove = [
                'providerToken',
                'providerId',
                'provider_id',
                'userToken',
                'userId',
                'user_id',
                'fcmToken',
                'expoPushToken',
            ];
            
            // Filter to only remove keys that exist
            const existingKeysToRemove = keysToRemove.filter(key => allKeys.includes(key));
            
            if (existingKeysToRemove.length > 0) {
                await AsyncStorage.multiRemove(existingKeysToRemove);
                console.log('🗑️ Cleared AsyncStorage session data:', existingKeysToRemove);
            }
            
            // Verify clearance
            const remainingKeys = await AsyncStorage.getAllKeys();
            console.log('📋 Remaining AsyncStorage keys after logout:', remainingKeys);
        } catch (error) {
            console.error('Failed to clear AsyncStorage on logout:', error);
        }
    };

    const notificationCount = notifications.filter((n) => !n.read).length;

    const setScheduledWork = (work: ScheduledWork | undefined) => {
        setUser((prev) => ({...prev, scheduledWork: work}));
    };

    return (
        <UserContext.Provider
            value={{
                user,
                setUser,
                setScheduledWork,
                notifications,
                archivedNotifications,
                notificationCount,
                addNotification,
                markAllAsRead,
                cleanUpNotifications,
                logout,
            }}
        >
            {children}
        </UserContext.Provider>
    );
};

export const useUserContext = () => useContext(UserContext);
