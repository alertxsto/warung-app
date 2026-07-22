import AsyncStorage from '@react-native-async-storage/async-storage';

const STORE_KEY = '@warung_store_profile';

export const DEFAULT_STORE_PROFILE = {
  name: 'Warung Mamah',
  tagline: 'Terima kasih sudah berbelanja!',
  address: '',
  phone: '',
};

export const saveStoreProfile = async (profile) => {
  try {
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('saveStoreProfile error', e);
  }
};

export const loadStoreProfile = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (!raw) return { ...DEFAULT_STORE_PROFILE };
    return { ...DEFAULT_STORE_PROFILE, ...JSON.parse(raw) };
  } catch (e) {
    console.error('loadStoreProfile error', e);
    return { ...DEFAULT_STORE_PROFILE };
  }
};
