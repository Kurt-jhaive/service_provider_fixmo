import {
    getProviderRatings,
    Rating,
    RatingsPagination,
    RatingStatistics
} from "@/api/ratings.api";
import { useUserContext } from "@/context/UserContext";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    BackHandler,
    Image,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function RatingScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useUserContext();
    const [providerId, setProviderId] = useState<number | null>(null);
    const [ratings, setRatings] = useState<Rating[]>([]);
    const [allRatings, setAllRatings] = useState<Rating[]>([]); // Store all ratings for filtering
    const [statistics, setStatistics] = useState<RatingStatistics | null>(null);
    const [pagination, setPagination] = useState<RatingsPagination | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [filterValue, setFilterValue] = useState<number | null>(null); // null = All ratings

    // Prevent going back to OTP screen - navigate to profile instead
    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                router.replace('/provider/onboarding/providerprofile');
                return true; // Prevent default back action
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [])
    );

    // Get provider ID from AsyncStorage
    useEffect(() => {
        const getProviderId = async () => {
            try {
                console.log('🔍 Fetching providerId from AsyncStorage...');
                const id = await AsyncStorage.getItem('providerId');
                console.log('📱 Provider ID found:', id);
                
                if (id) {
                    setProviderId(parseInt(id));
                } else {
                    console.warn('⚠️ No providerId found in AsyncStorage');
                    setLoading(false); // Stop loading if no ID
                }
            } catch (error) {
                console.error('❌ Error fetching providerId:', error);
                setLoading(false);
            }
        };
        getProviderId();
    }, []);

    // Fetch ratings data
    useEffect(() => {
        if (providerId) {
            console.log('🎯 Provider ID set, loading ratings for provider:', providerId);
            loadRatings();
        }
    }, [providerId, currentPage]);

    const loadRatings = async (isRefresh: boolean = false) => {
        if (!providerId) {
            console.warn('⚠️ No providerId found - cannot load ratings');
            setLoading(false);
            return;
        }

        try {
            console.log(`📊 Loading ratings for provider ${providerId}, page ${currentPage}...`);
            
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const response = await getProviderRatings(
                providerId,
                currentPage,
                10 // 10 ratings per page
            );

            console.log('📦 API Response:', {
                success: response.success,
                ratingsCount: response.data?.ratings?.length || 0,
                totalRatings: response.data?.pagination?.total_ratings || 0,
                avgRating: response.data?.statistics?.average_rating || 0,
            });

            if (response.success) {
                setAllRatings(response.data.ratings); // Store all ratings
                setRatings(response.data.ratings);
                setStatistics(response.data.statistics);
                setPagination(response.data.pagination);
                console.log('✅ Ratings loaded successfully');
                
                // Apply filter if one is set
                if (filterValue !== null) {
                    applyFilter(filterValue, response.data.ratings);
                }
            } else {
                console.error('❌ Failed to load ratings:', response.message);
                // Set empty data so UI shows empty state instead of loading forever
                setRatings([]);
                setAllRatings([]);
                setStatistics(null);
                setPagination(null);
            }
        } catch (error) {
            console.error('💥 Error loading ratings:', error);
            // Set empty data on error
            setRatings([]);
            setAllRatings([]);
            setStatistics(null);
            setPagination(null);
        } finally {
            console.log('🏁 Loading complete, hiding spinner');
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setCurrentPage(1);
        setFilterValue(null); // Reset filter on refresh
        loadRatings(true);
    };

    const handleLoadMore = () => {
        if (pagination && pagination.has_next) {
            setCurrentPage(currentPage + 1);
        }
    };

    const applyFilter = (starRating: number | null, ratingsData: Rating[] = allRatings) => {
        console.log('🔍 Applying filter:', starRating);
        
        if (starRating === null) {
            // Show all ratings
            setRatings(ratingsData);
        } else {
            // Filter by star rating
            const filtered = ratingsData.filter(rating => 
                Math.floor(rating.rating_value) === starRating
            );
            setRatings(filtered);
        }
    };

    const handleFilterChange = (starRating: number | null) => {
        setFilterValue(starRating);
        applyFilter(starRating);
    };

    const renderStars = (rating: number) => {
        try {
            // Ensure rating is a valid number
            const safeRating = isNaN(rating) || rating < 0 ? 0 : Math.min(rating, 5);
            
            const fullStars = Math.floor(safeRating);
            const hasHalfStar = safeRating - fullStars >= 0.5;
            const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

            const stars = [];

            for (let i = 0; i < fullStars; i++) {
                stars.push(
                    <Ionicons key={`full-${i}`} name="star" size={22} color="#FFD700"/>
                );
            }

            if (hasHalfStar) {
                stars.push(
                    <Ionicons key="half" name="star-half" size={22} color="#FFD700"/>
                );
            }

            for (let i = 0; i < emptyStars; i++) {
                stars.push(
                    <Ionicons key={`empty-${i}`} name="star-outline" size={22} color="#FFD700"/>
                );
            }

            return <View style={styles.starRow}>{stars}</View>;
        } catch (error) {
            console.error('Error rendering stars:', error);
            // Return empty stars as fallback
            return (
                <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <Ionicons key={`empty-${i}`} name="star-outline" size={22} color="#FFD700"/>
                    ))}
                </View>
            );
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    };

    if (loading && !refreshing) {
        return (
            <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
                <TouchableOpacity 
                    style={styles.backButton} 
                    onPress={() => router.replace('/provider/onboarding/providerprofile')}
                >
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#008080" />
                    <Text style={styles.loadingText}>Loading ratings...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Show error if no provider ID found
    if (!providerId && !loading) {
        return (
            <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
                <TouchableOpacity 
                    style={styles.backButton} 
                    onPress={() => router.replace('/provider/onboarding/providerprofile')}
                >
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <View style={styles.emptyContainer}>
                    <Ionicons name="alert-circle-outline" size={64} color="#F44336" />
                    <Text style={styles.emptyText}>Provider ID Not Found</Text>
                    <Text style={styles.emptySubtext}>
                        Please log in again to view ratings
                    </Text>
                    <TouchableOpacity 
                        style={styles.retryButton}
                        onPress={() => router.replace('/provider/onboarding/providerprofile')}
                    >
                        <Text style={styles.retryButtonText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
            {/* Back Button */}
            <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => router.replace('/provider/onboarding/providerprofile')}
            >
                <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>

            {/* Fixed Header */}
            <View style={styles.headerContainer}>
                <Text style={styles.header}>Ratings & Reviews</Text>
                
                {statistics && statistics.average_rating !== undefined && (
                    <>
                        <Text style={styles.overallLabel}>Overall Rating</Text>
                        <Text style={styles.overallScore}>
                            {(statistics.average_rating || 0).toFixed(1)}
                        </Text>
                        <View style={styles.starsCenter}>
                            {renderStars(statistics.average_rating || 0)}
                        </View>
                        <Text style={styles.totalReviews}>
                            {statistics.total_ratings || 0} total review{(statistics.total_ratings || 0) !== 1 ? 's' : ''}
                        </Text>

                        {/* Rating Distribution */}
                        {statistics.rating_distribution && statistics.rating_distribution.length > 0 && (
                            <View style={styles.distributionContainer}>
                                {statistics.rating_distribution
                                    .sort((a, b) => b.star - a.star)
                                    .map((dist) => {
                                        const totalRatings = statistics.total_ratings || 1; // Prevent division by zero
                                        const percentage = (dist.count / totalRatings) * 100;
                                        
                                        return (
                                            <View key={dist.star} style={styles.distributionRow}>
                                                <Text style={styles.distributionStar}>
                                                    {dist.star} ⭐
                                                </Text>
                                                <View style={styles.distributionBar}>
                                                    <View 
                                                        style={[
                                                            styles.distributionFill,
                                                            { 
                                                                width: `${Math.min(percentage, 100)}%` 
                                                            }
                                                        ]} 
                                                    />
                                                </View>
                                                <Text style={styles.distributionCount}>
                                                    {dist.count}
                                                </Text>
                                            </View>
                                        );
                                    })}
                            </View>
                        )}
                    </>
                )}

                {/* Filter Section */}
                <View style={styles.filterContainer}>
                    <Text style={styles.filterLabel}>Filter by Rating:</Text>
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterScrollContent}
                    >
                        <TouchableOpacity 
                            style={[
                                styles.filterButton, 
                                filterValue === null && styles.filterButtonActive
                            ]}
                            onPress={() => handleFilterChange(null)}
                        >
                            <Text style={[
                                styles.filterButtonText,
                                filterValue === null && styles.filterButtonTextActive
                            ]}>
                                All
                            </Text>
                        </TouchableOpacity>

                        {[5, 4, 3, 2, 1].map((star) => (
                            <TouchableOpacity 
                                key={star}
                                style={[
                                    styles.filterButton, 
                                    filterValue === star && styles.filterButtonActive
                                ]}
                                onPress={() => handleFilterChange(star)}
                            >
                                <Ionicons 
                                    name="star" 
                                    size={14} 
                                    color={filterValue === star ? '#FFF' : '#FFD700'} 
                                />
                                <Text style={[
                                    styles.filterButtonText,
                                    filterValue === star && styles.filterButtonTextActive
                                ]}>
                                    {star}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <Text style={styles.sectionTitle}>Customer Reviews</Text>
            </View>

            {/* Scrollable Content */}
            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={['#008080']}
                        tintColor="#008080"
                    />
                }
            >
                {ratings.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="star-outline" size={64} color="#CCC" />
                        <Text style={styles.emptyText}>No ratings yet</Text>
                        <Text style={styles.emptySubtext}>
                            Complete jobs to receive customer ratings
                        </Text>
                    </View>
                ) : (
                    <>
                        {ratings.map((rating) => {
                            // Safety check to prevent crashes
                            if (!rating || !rating.id) {
                                console.warn('⚠️ Invalid rating object:', rating);
                                return null;
                            }

                            return (
                                <View key={rating.id} style={styles.ratingCard}>
                                    {/* Customer Info */}
                                    <View style={styles.customerRow}>
                                        {rating.user?.profile_photo ? (
                                            <Image 
                                                source={{ uri: rating.user.profile_photo }} 
                                                style={styles.customerPhoto}
                                                onError={(error) => {
                                                    console.warn('Failed to load profile photo:', error);
                                                }}
                                            />
                                        ) : (
                                            <View style={[styles.customerPhoto, styles.customerPhotoPlaceholder]}>
                                                <Ionicons name="person" size={24} color="#666" />
                                            </View>
                                        )}
                                        <View style={styles.customerInfo}>
                                            <Text style={styles.customerName}>
                                                {rating.user?.first_name && rating.user?.last_name
                                                    ? `${rating.user.first_name} ${rating.user.last_name}` 
                                                    : 'Anonymous'
                                                }
                                            </Text>
                                            <Text style={styles.ratingDate}>
                                                {rating.created_at ? formatDate(rating.created_at) : 'N/A'}
                                            </Text>
                                        </View>
                                        <View style={styles.ratingValueContainer}>
                                            {renderStars(rating.rating_value || 0)}
                                        </View>
                                    </View>

                                {/* Service Info */}
                                {rating.appointment?.service && (
                                    <View style={styles.serviceInfoRow}>
                                        <Ionicons name="construct" size={16} color="#008080" />
                                        <Text style={styles.serviceName}>
                                            {rating.appointment.service.service_title}
                                        </Text>
                                    </View>
                                )}

                                {/* Comment */}
                                {rating.rating_comment && (
                                    <Text style={styles.commentText}>
                                        {rating.rating_comment}
                                    </Text>
                                )}

                                    {/* Photo */}
                                    {rating.rating_photo && (
                                        <Image 
                                            source={{ uri: rating.rating_photo }} 
                                            style={styles.ratingPhoto}
                                            resizeMode="cover"
                                            onError={(error) => {
                                                console.warn('Failed to load rating photo:', error);
                                            }}
                                        />
                                    )}
                                </View>
                            );
                        })}

                        {/* Load More Button */}
                        {pagination && pagination.has_next && (
                            <TouchableOpacity 
                                style={styles.loadMoreButton}
                                onPress={handleLoadMore}
                            >
                                <Text style={styles.loadMoreText}>Load More</Text>
                                <Ionicons name="chevron-down" size={20} color="#008080" />
                            </TouchableOpacity>
                        )}

                        {/* Pagination Info */}
                        {pagination && (
                            <Text style={styles.paginationInfo}>
                                Page {pagination.current_page} of {pagination.total_pages}
                            </Text>
                        )}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    backButton: {
        position: 'absolute',
        top: 10,
        left: 20,
        zIndex: 10,
        padding: 8,
        backgroundColor: '#fff',
        borderRadius: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
        fontFamily: 'PoppinsRegular',
    },
    headerContainer: {
        paddingHorizontal: 20,
        paddingTop: 40,
        paddingBottom: 10,
        backgroundColor: "#fff",
        zIndex: 1,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    header: {
        fontSize: 22,
        fontFamily: "PoppinsSemiBold",
        color: "#008080",
        textAlign: "center",
        marginBottom: 10,
    },
    overallLabel: {
        fontSize: 14,
        color: "#666",
        fontFamily: "PoppinsRegular",
        marginBottom: 4,
        textAlign: "center",
    },
    overallScore: {
        fontSize: 48,
        color: "#FFA500",
        fontFamily: "PoppinsBold",
        textAlign: "center",
    },
    totalReviews: {
        marginTop: 5,
        color: "#666",
        fontSize: 14,
        fontFamily: "PoppinsRegular",
        textAlign: "center",
    },
    distributionContainer: {
        marginTop: 16,
        paddingVertical: 8,
    },
    distributionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    distributionStar: {
        fontSize: 14,
        fontFamily: 'PoppinsMedium',
        color: '#333',
        width: 50,
    },
    distributionBar: {
        flex: 1,
        height: 8,
        backgroundColor: '#E0E0E0',
        borderRadius: 4,
        overflow: 'hidden',
    },
    distributionFill: {
        height: '100%',
        backgroundColor: '#FFD700',
    },
    distributionCount: {
        fontSize: 12,
        fontFamily: 'PoppinsRegular',
        color: '#666',
        width: 30,
        textAlign: 'right',
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: "PoppinsSemiBold",
        marginTop: 20,
        color: "#333",
    },
    starRow: {
        flexDirection: "row",
        marginBottom: 6,
    },
    starsCenter: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 6,
    },
    filterContainer: {
        marginTop: 20,
        marginBottom: 10,
    },
    filterLabel: {
        fontSize: 14,
        fontFamily: "PoppinsSemiBold",
        color: "#333",
        marginBottom: 12,
    },
    filterScrollContent: {
        flexDirection: "row",
        gap: 8,
        paddingVertical: 4,
    },
    filterButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: "#F5F5F5",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#E0E0E0",
    },
    filterButtonActive: {
        backgroundColor: "#008080",
        borderColor: "#008080",
    },
    filterButtonText: {
        fontSize: 14,
        fontFamily: "PoppinsMedium",
        color: "#666",
    },
    filterButtonTextActive: {
        color: "#FFF",
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 18,
        fontFamily: 'PoppinsMedium',
        color: '#999',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        fontFamily: 'PoppinsRegular',
        color: '#BBB',
        marginTop: 8,
        textAlign: 'center',
    },
    ratingCard: {
        backgroundColor: '#F4F8F7',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    customerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    customerPhoto: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 12,
    },
    customerPhotoPlaceholder: {
        backgroundColor: '#E0E0E0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    customerInfo: {
        flex: 1,
    },
    customerName: {
        fontSize: 16,
        fontFamily: 'PoppinsSemiBold',
        color: '#333',
        marginBottom: 2,
    },
    ratingDate: {
        fontSize: 12,
        fontFamily: 'PoppinsRegular',
        color: '#999',
    },
    ratingValueContainer: {
        marginLeft: 'auto',
    },
    serviceInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: '#E0F2F1',
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    serviceName: {
        fontSize: 14,
        fontFamily: 'PoppinsMedium',
        color: '#008080',
        marginLeft: 6,
    },
    commentText: {
        fontSize: 14,
        fontFamily: 'PoppinsRegular',
        color: '#444',
        lineHeight: 20,
        marginTop: 8,
    },
    ratingPhoto: {
        width: '100%',
        height: 200,
        borderRadius: 8,
        marginTop: 12,
    },
    loadMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        backgroundColor: '#E0F2F1',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#008080',
        marginTop: 8,
        gap: 8,
    },
    loadMoreText: {
        fontSize: 16,
        fontFamily: 'PoppinsMedium',
        color: '#008080',
    },
    paginationInfo: {
        textAlign: 'center',
        fontSize: 12,
        fontFamily: 'PoppinsRegular',
        color: '#999',
        marginTop: 16,
    },
    retryButton: {
        marginTop: 20,
        paddingVertical: 12,
        paddingHorizontal: 32,
        backgroundColor: '#008080',
        borderRadius: 8,
    },
    retryButtonText: {
        fontSize: 16,
        fontFamily: 'PoppinsMedium',
        color: '#FFF',
    },
});
