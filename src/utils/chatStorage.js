import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'ai_chat_';
const MAX_DAYS_KEPT = 7; // simpan maksimal 7 hari terakhir

/**
 * Dapatkan key storage berdasarkan tanggal
 * Format: ai_chat_2026-04-22
 */
const getKeyForDate = (date = new Date()) => {
  const d = date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${STORAGE_PREFIX}${y}-${m}-${day}`;
};

/**
 * Dapatkan tanggal hari ini dalam format YYYY-MM-DD
 */
export const getTodayString = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Simpan daftar pesan ke storage untuk hari ini
 * @param {Array} messages - array of { role, content, timestamp? }
 */
export const saveChatHistory = async (messages) => {
  try {
    const key = getKeyForDate();
    const payload = JSON.stringify({
      date: getTodayString(),
      messages,
      savedAt: new Date().toISOString(),
    });
    await AsyncStorage.setItem(key, payload);
  } catch (e) {
    console.warn('Gagal simpan chat history:', e);
  }
};

/**
 * Load chat history untuk hari ini
 * @returns {Array} messages array, atau [] jika kosong
 */
export const loadTodayChatHistory = async () => {
  try {
    const key = getKeyForDate();
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.messages || [];
  } catch (e) {
    console.warn('Gagal load chat history:', e);
    return [];
  }
};

/**
 * Hapus chat history hari ini
 */
export const clearTodayChatHistory = async () => {
  try {
    const key = getKeyForDate();
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.warn('Gagal hapus chat history:', e);
  }
};

/**
 * Bersihkan chat history yang lebih dari MAX_DAYS_KEPT hari
 * (dipanggil sekali saat app buka)
 */
export const cleanOldChatHistory = async () => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const chatKeys = allKeys.filter(k => k.startsWith(STORAGE_PREFIX));

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - MAX_DAYS_KEPT);

    const keysToDelete = chatKeys.filter(key => {
      const dateStr = key.replace(STORAGE_PREFIX, ''); // '2026-04-15'
      const keyDate = new Date(dateStr);
      return keyDate < cutoff;
    });

    if (keysToDelete.length > 0) {
      await AsyncStorage.multiRemove(keysToDelete);
    }
  } catch (e) {
    console.warn('Gagal bersihkan chat lama:', e);
  }
};

/**
 * Dapatkan daftar hari yang punya chat history (untuk fitur riwayat)
 * @returns {Array} ['2026-04-22', '2026-04-21', ...]
 */
export const getChatHistoryDates = async () => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const chatKeys = allKeys
      .filter(k => k.startsWith(STORAGE_PREFIX))
      .map(k => k.replace(STORAGE_PREFIX, ''))
      .sort((a, b) => b.localeCompare(a)); // terbaru dulu
    return chatKeys;
  } catch (e) {
    return [];
  }
};

/**
 * Dapatkan daftar hari beserta jumlah pesannya (untuk HistoryModal)
 * @returns {Array} [{ date: '2026-04-22', messageCount: 12 }, ...]
 */
export const getChatHistoryWithCount = async () => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const chatKeys = allKeys
      .filter(k => k.startsWith(STORAGE_PREFIX))
      .sort((a, b) => b.localeCompare(a)); // terbaru dulu

    const results = await Promise.all(
      chatKeys.map(async (key) => {
        const dateStr = key.replace(STORAGE_PREFIX, '');
        try {
          const raw = await AsyncStorage.getItem(key);
          if (!raw) return { date: dateStr, messageCount: 0 };
          const parsed = JSON.parse(raw);
          const msgs = parsed.messages || [];
          // Hitung hanya pesan user dan assistant (bukan system/divider)
          const count = msgs.filter(m => m.role === 'user' || m.role === 'assistant').length;
          return { date: dateStr, messageCount: count };
        } catch {
          return { date: dateStr, messageCount: 0 };
        }
      })
    );

    return results;
  } catch (e) {
    return [];
  }
};

/**
 * Load chat history untuk tanggal tertentu
 * @param {string} dateStr - format 'YYYY-MM-DD'
 * @returns {Array} messages array
 */
export const loadChatHistoryForDate = async (dateStr) => {
  try {
    const key = `${STORAGE_PREFIX}${dateStr}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.messages || [];
  } catch (e) {
    return [];
  }
};
