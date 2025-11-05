import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY_PREFIX = 'penalty_cache_';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CacheData {
  data: any;
  timestamp: number;
}

/**
 * Save data to cache with timestamp
 * @param key - Cache key (without prefix)
 * @param data - Data to cache
 */
export const saveToCache = async (key: string, data: any): Promise<void> => {
  try {
    const cacheData: CacheData = {
      data: data,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(
      `${CACHE_KEY_PREFIX}${key}`,
      JSON.stringify(cacheData)
    );
    console.log(`💾 Cached data for key: ${key}`);
  } catch (error) {
    console.error('❌ Cache save error:', error);
  }
};

/**
 * Get data from cache if still valid
 * @param key - Cache key (without prefix)
 * @returns Cached data if valid, null otherwise
 */
export const getFromCache = async (key: string): Promise<any | null> => {
  try {
    const cached = await AsyncStorage.getItem(`${CACHE_KEY_PREFIX}${key}`);

    if (!cached) {
      console.log(`📭 No cache found for key: ${key}`);
      return null;
    }

    const cacheData: CacheData = JSON.parse(cached);
    const age = Date.now() - cacheData.timestamp;

    // Check if cache is still valid
    if (age < CACHE_DURATION) {
      const ageSeconds = Math.floor(age / 1000);
      console.log(`✅ Using cached data for ${key} (age: ${ageSeconds}s)`);
      return cacheData.data;
    } else {
      console.log(`❌ Cache expired for key: ${key}`);
      // Clean up expired cache
      await clearCache(key);
      return null;
    }
  } catch (error) {
    console.error('❌ Cache read error:', error);
    return null;
  }
};

/**
 * Clear specific cache entry
 * @param key - Cache key (without prefix)
 */
export const clearCache = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(`${CACHE_KEY_PREFIX}${key}`);
    console.log(`🗑️ Cleared cache for key: ${key}`);
  } catch (error) {
    console.error('❌ Cache clear error:', error);
  }
};

/**
 * Clear all penalty-related caches
 */
export const clearAllPenaltyCache = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const penaltyCacheKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));
    
    if (penaltyCacheKeys.length > 0) {
      await AsyncStorage.multiRemove(penaltyCacheKeys);
      console.log(`🗑️ Cleared ${penaltyCacheKeys.length} penalty cache entries`);
    }
  } catch (error) {
    console.error('❌ Clear all cache error:', error);
  }
};

/**
 * Get cache age in seconds
 * @param key - Cache key (without prefix)
 * @returns Age in seconds, or null if not cached
 */
export const getCacheAge = async (key: string): Promise<number | null> => {
  try {
    const cached = await AsyncStorage.getItem(`${CACHE_KEY_PREFIX}${key}`);
    
    if (!cached) return null;
    
    const cacheData: CacheData = JSON.parse(cached);
    const age = Date.now() - cacheData.timestamp;
    
    return Math.floor(age / 1000); // Return age in seconds
  } catch (error) {
    console.error('❌ Get cache age error:', error);
    return null;
  }
};
