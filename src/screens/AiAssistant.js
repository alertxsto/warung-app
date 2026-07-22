import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, StatusBar, ActivityIndicator, Alert,
  Modal, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getProducts } from '../database/db';
import { sendToGroq, executeAiAction } from '../utils/aiHelper';
import {
  saveChatHistory,
  loadTodayChatHistory,
  clearTodayChatHistory,
  cleanOldChatHistory,
  getChatHistoryWithCount,
  loadChatHistoryForDate,
  getTodayString,
} from '../utils/chatStorage';
import { colors } from '../theme/colors';

// ─── Constants ─────────────────────────────────────────────────────────────
// type: 'send' = langsung kirim | 'template' = isi input saja
const SHORTCUT_CATEGORIES = [
  {
    label: 'Keuangan', icon: 'cash-outline',
    color: '#F0FDF4', borderColor: '#22C55E', textColor: '#14532D',
    items: [
      { label: 'Untung hari ini', text: 'Berapa untung hari ini?', type: 'send' },
      { label: 'Omset hari ini', text: 'Berapa omset hari ini?', type: 'send' },
      { label: 'Omset bulan ini', text: 'Omset bulan ini berapa?', type: 'send' },
      { label: 'Untung bulan ini', text: 'Total untung bulan ini berapa?', type: 'send' },
      { label: 'Jumlah transaksi', text: 'Ada berapa transaksi hari ini?', type: 'send' },
    ],
  },
  {
    label: 'Cek Stok', icon: 'cube-outline',
    color: '#EFF6FF', borderColor: '#3B82F6', textColor: '#1E3A8A',
    items: [
      { label: 'Stok mau habis', text: 'Stok apa yang mau habis?', type: 'send' },
      { label: 'Barang kosong', text: 'Ada barang yang stoknya sudah habis?', type: 'send' },
      { label: 'Semua stok', text: 'Tampilkan semua stok barang', type: 'send' },
      { label: 'Stok beras', text: 'Stok beras sekarang berapa?', type: 'send' },
      { label: 'Stok minyak', text: 'Stok minyak sekarang berapa?', type: 'send' },
      { label: 'Cek stok...', text: 'Stok ', type: 'template' },
    ],
  },
  {
    label: 'Update Stok', icon: 'repeat-outline',
    color: '#FFF7ED', borderColor: '#F97316', textColor: '#7C2D12',
    items: [
      { label: 'Tambah stok...', text: 'Tambah stok ', type: 'template' },
      { label: 'Kurangi stok...', text: 'Kurangi stok ', type: 'template' },
      { label: 'Tambah beras 1 karung', text: 'Tambah stok beras 1 karung', type: 'send' },
      { label: 'Tambah minyak 1 dos', text: 'Tambah stok minyak 1 dos', type: 'send' },
      { label: 'Tambah gula 1 karung', text: 'Tambah stok gula 1 karung', type: 'send' },
      { label: 'Tambah telur 1 tray', text: 'Tambah stok telur 1 tray', type: 'send' },
    ],
  },
  {
    label: 'Laporan', icon: 'bar-chart-outline',
    color: '#FDF4FF', borderColor: '#A855F7', textColor: '#581C87',
    items: [
      { label: 'Barang paling laris', text: 'Barang apa yang paling laris?', type: 'send' },
      { label: 'Barang paling untung', text: 'Barang apa yang paling banyak untungnya?', type: 'send' },
      { label: 'Rekap penjualan', text: 'Rekap penjualan hari ini dong', type: 'send' },
      { label: 'Saran warung', text: 'Kasih saran untuk warung saya dong', type: 'send' },
      { label: 'Perlu diisi ulang', text: 'Produk apa yang perlu diisi ulang segera?', type: 'send' },
    ],
  },
];

const SUGGESTION_CHIPS = [
  { label: 'Untung hari ini', text: 'Berapa untung hari ini?', type: 'send', icon: 'cash-outline' },
  { label: 'Stok mau habis', text: 'Stok apa yang mau habis?', type: 'send', icon: 'alert-circle-outline' },
  { label: 'Tambah stok...', text: 'Tambah stok ', type: 'template', icon: 'add-circle-outline' },
  { label: 'Barang paling laris', text: 'Barang apa yang paling laris?', type: 'send', icon: 'trending-up-outline' },
  { label: 'Omset bulan ini', text: 'Omset bulan ini berapa?', type: 'send', icon: 'calendar-outline' },
  { label: 'Barang kosong', text: 'Ada barang yang stoknya sudah habis?', type: 'send', icon: 'cube-outline' },
];

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

const formatDateLabel = (dateStr) => {
  const today = getTodayString();
  if (dateStr === today) return 'Hari Ini';

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
  if (dateStr === yStr) return 'Kemarin';

  const [y, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${MONTH_NAMES[parseInt(m)-1]} ${y}`;
};

const formatTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

// ─── Sub-components ─────────────────────────────────────────────────────────
const MessageBubble = ({ msg }) => {
  const isUser = msg.role === 'user';
  const isSystem = msg.role === 'system';
  const isDivider = msg.role === 'divider';

  if (isDivider) return (
    <View style={styles.dateDivider}>
      <View style={styles.dateDividerLine} />
      <View style={styles.dateDividerPill}>
        <Ionicons name="calendar-outline" size={11} color={colors.textLight} />
        <Text style={styles.dateDividerText}>{msg.content}</Text>
      </View>
      <View style={styles.dateDividerLine} />
    </View>
  );

  if (isSystem) return (
    <View style={styles.systemMsg}>
      <Ionicons name="information-circle-outline" size={14} color={colors.textLight} />
      <Text style={styles.systemMsgText}>{msg.content}</Text>
    </View>
  );

  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Ionicons name="hardware-chip" size={16} color={colors.white} />
        </View>
      )}
      <View style={[{ maxWidth: isUser ? '85%' : '88%' }, !isUser && { flex: 1 }]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{msg.content}</Text>
        </View>
        {msg.timestamp && (
          <Text style={[styles.bubbleTime, isUser && { textAlign: 'right' }]}>{formatTime(msg.timestamp)}</Text>
        )}
      </View>
    </View>
  );
};

// ─── Header Menu Modal ───────────────────────────────────────────────────────
const HeaderMenuModal = ({ visible, onClose, onNewChat, onShowHistory, onClearChat, isViewingHistory }) => (
  <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
    <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={onClose}>
      <View style={styles.menuDropdown}>
        {!isViewingHistory && (
          <>
            <TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); onNewChat(); }}>
              <Ionicons name="add-circle-outline" size={20} color={colors.text} />
              <Text style={styles.menuItemText}>Chat Baru</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
          </>
        )}
        <TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); onShowHistory(); }}>
          <Ionicons name="time-outline" size={20} color={colors.text} />
          <Text style={styles.menuItemText}>Riwayat Chat</Text>
        </TouchableOpacity>
        {!isViewingHistory && (
          <>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); onClearChat(); }}>
              <Ionicons name="trash-outline" size={20} color={colors.dangerText} />
              <Text style={[styles.menuItemText, { color: colors.dangerText }]}>Hapus Chat Hari Ini</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </TouchableOpacity>
  </Modal>
);


// ─── Shortcut Panel ──────────────────────────────────────────────────────────
const ShortcutPanel = ({ visible, onClose, onSend, onTemplate }) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <TouchableOpacity style={styles.shortcutOverlay} activeOpacity={1} onPress={onClose}>
      <TouchableOpacity activeOpacity={1} style={styles.shortcutSheet}>
        <View style={styles.shortcutHandle} />
        <View style={styles.shortcutHeader}>
          <View style={styles.shortcutIconWrap}>
            <Ionicons name="flash" size={18} color="#F97316" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.shortcutTitle}>Perintah Cepat</Text>
            <Text style={styles.shortcutSubtitle}>Ketuk untuk kirim · Ikon pensil = edit dulu</Text>
          </View>
          <TouchableOpacity style={styles.shortcutClose} onPress={onClose}>
            <Ionicons name="close" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          {SHORTCUT_CATEGORIES.map((cat) => (
            <View key={cat.label} style={styles.shortcutCategory}>
              <View style={styles.shortcutCatHeader}>
                <Ionicons name={cat.icon} size={13} color={cat.textColor} />
                <Text style={[styles.shortcutCategoryLabel, { color: cat.textColor }]}>{cat.label}</Text>
              </View>
              <View style={styles.shortcutChipsWrap}>
                {cat.items.map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.shortcutChip, { backgroundColor: cat.color, borderColor: cat.borderColor }]}
                    onPress={() => { onClose(); item.type === 'template' ? onTemplate(item.text) : onSend(item.text); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.shortcutChipText, { color: cat.textColor }]}>{item.label}</Text>
                    {item.type === 'template' && (
                      <Ionicons name="create-outline" size={11} color={cat.textColor} style={{ marginLeft: 3 }} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </TouchableOpacity>
    </TouchableOpacity>
  </Modal>
);

// ─── History Modal ──────────────────────────────────────────────────────────
const HistoryModal = ({ visible, onClose, onLoadDate }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      getChatHistoryWithCount().then(d => { setEntries(d); setLoading(false); });
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.historyModal}>
        <View style={styles.historyModalHeader}>
          <View style={styles.historyModalIconWrap}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
          </View>
          <Text style={styles.historyModalTitle}>Riwayat Chat</Text>
          <TouchableOpacity style={styles.historyModalClose} onPress={onClose}>
            <Ionicons name="close" size={20} color="#64748B" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
        ) : entries.length === 0 ? (
          <View style={styles.historyEmpty}>
            <View style={styles.historyEmptyIconWrap}>
              <Ionicons name="chatbubbles-outline" size={36} color="#CBD5E1" />
            </View>
            <Text style={styles.historyEmptyText}>Belum ada riwayat</Text>
            <Text style={styles.historyEmptySubtext}>Chat tersimpan otomatis setiap hari</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {entries.map(({ date: dateStr, messageCount }) => (
              <TouchableOpacity
                key={dateStr}
                style={styles.historyItem}
                onPress={() => { onLoadDate(dateStr); onClose(); }}
                activeOpacity={0.7}
              >
                <View style={styles.historyItemIcon}>
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyItemDate}>{formatDateLabel(dateStr)}</Text>
                  <Text style={styles.historyItemSub}>{dateStr}</Text>
                </View>
                <View style={styles.historyItemCount}>
                  <Text style={styles.historyItemCountText}>{messageCount}</Text>
                  <Text style={styles.historyItemCountLabel}>pesan</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────
const AiAssistant = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const WELCOME_MSG = {
    role: 'system',
    content: 'AI Iki siap membantu Mamah mengelola warung. Ketik pertanyaan atau pilih perintah cepat di bawah.',
  };

  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [history, setHistory] = useState([]); // untuk Groq context
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [viewingDate, setViewingDate] = useState(null); // null = hari ini
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // ── Load today's history on mount ──
  useEffect(() => {
    const init = async () => {
      await cleanOldChatHistory(); // bersihkan data > 7 hari
      const saved = await loadTodayChatHistory();
      if (saved.length > 0) {
        // Prepend welcome msg, then saved messages
        setMessages([WELCOME_MSG, ...saved]);
        // Rebuild Groq context from last 12 messages
        const groqCtx = saved
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role, content: m.content }))
          .slice(-12);
        setHistory(groqCtx);
      }
      setLoadingHistory(false);
    };
    init();
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // ── Auto-save whenever messages change ──
  useEffect(() => {
    if (loadingHistory) return; // jangan simpan sebelum selesai load
    // Simpan semua kecuali welcome msg dan divider
    const toSave = messages.filter(m => m.role !== 'system' && m.role !== 'divider');
    if (toSave.length > 0) {
      saveChatHistory(toSave);
    }
  }, [messages, loadingHistory]);

  // ── Kirim pesan ──
  const sendMessage = useCallback(async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    setViewingDate(null); // kembali ke hari ini saat kirim pesan

    const userMsg = { role: 'user', content: msg, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    scrollToBottom();

    try {
      const products = await getProducts();
      const result = await sendToGroq(msg, history);

      // Update Groq context
      const newHistory = [
        ...history,
        { role: 'user', content: msg },
        { role: 'assistant', content: result.message },
      ];
      setHistory(newHistory.slice(-12));

      let aiReply = result.message;

      if (result.action) {
        const actionResult = await executeAiAction(result.action, products);
        if (actionResult) {
          aiReply = `${result.message}\n\n${actionResult}`;
        }
      }

      const aiMsg = { role: 'assistant', content: aiReply, timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      const errMsg = e.message?.includes('GANTI_DENGAN')
        ? 'API Key belum diisi. Buka file src/config.js dan isi dengan API key Groq kamu.'
        : `Error: ${e.message}`;
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg, timestamp: new Date().toISOString() }]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [input, loading, history]);

  // ── Hapus chat hari ini ──
  const handleClearChat = () => {
    Alert.alert(
      'Hapus Chat Hari Ini?',
      'Semua percakapan hari ini akan terhapus. Chat hari sebelumnya tetap tersimpan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            await clearTodayChatHistory();
            setMessages([WELCOME_MSG]);
            setHistory([]);
          },
        },
      ]
    );
  };

  // ── New Chat (reset tampilan, history tetap tersimpan) ──
  const handleNewChat = () => {
    Alert.alert(
      'Mulai Chat Baru?',
      'Percakapan sekarang akan tersimpan di riwayat. Mau mulai obrolan baru?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Mulai Baru',
          onPress: () => {
            setMessages([WELCOME_MSG]);
            setHistory([]);
            setViewingDate(null);
          },
        },
      ]
    );
  };

  // ── Load riwayat hari tertentu (read-only) ──
  const handleLoadDate = async (dateStr) => {
    const today = getTodayString();
    if (dateStr === today) {
      // Kembali ke chat hari ini
      const saved = await loadTodayChatHistory();
      setMessages([WELCOME_MSG, ...saved]);
      setViewingDate(null);
      return;
    }
    const saved = await loadChatHistoryForDate(dateStr);
    const divider = { role: 'divider', content: formatDateLabel(dateStr) };
    setMessages([WELCOME_MSG, divider, ...saved]);
    setViewingDate(dateStr);
    scrollToBottom();
  };

  const isViewingHistory = viewingDate !== null;
  const showSuggestions = messages.length <= 1 && !loadingHistory;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      {/* ── Header (Clean ChatGPT Style) ── */}
      <View style={[styles.header, { paddingTop: (StatusBar.currentHeight || 24) + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerBrand}>
          <Text style={styles.headerTitle}>AI Iki</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {isViewingHistory ? `Riwayat · ${formatDateLabel(viewingDate)}` : 'Asisten Pintar'}
          </Text>
        </View>

        <TouchableOpacity style={styles.headerBtn} onPress={() => setShowMenu(true)}>
          <Ionicons name="ellipsis-vertical" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* ── Viewing History Banner ── */}
      {isViewingHistory && (
        <TouchableOpacity style={styles.viewingBanner} onPress={() => handleLoadDate(getTodayString())}>
          <Ionicons name="eye-outline" size={14} color={colors.primary} />
          <Text style={styles.viewingBannerText}>Mode baca · Ketuk untuk kembali ke chat hari ini</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      )}

      {/* ── Loading state ── */}
      {loadingHistory ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Memuat chat hari ini...</Text>
        </View>
      ) : (
        <>
          {/* ── Chat List ── */}
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item, index }) => (
              <MessageBubble
                msg={item}
                showTime={true}
              />
            )}
            contentContainerStyle={styles.chatList}
            onLayout={scrollToBottom}
            showsVerticalScrollIndicator={false}
          />

          {/* ── Suggestion Chips (Centered Empty State) ── */}
          {showSuggestions && (
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyStateLogo}>
                <Ionicons name="hardware-chip-outline" size={40} color={colors.primary} />
              </View>
              <Text style={styles.emptyStateTitle}>Halo Mamah!</Text>
              <Text style={styles.emptyStateSub}>Ada yang bisa Iki bantu hari ini?</Text>
              
              <View style={styles.chipsRow}>
                {SUGGESTION_CHIPS.map((chip, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.chip, chip.type === 'template' && styles.chipTemplate]}
                    onPress={() => {
                      if (chip.type === 'template') { setInput(chip.text); inputRef.current?.focus(); }
                      else sendMessage(chip.text);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={chip.icon}
                      size={16}
                      color={chip.type === 'template' ? colors.accent : colors.primary}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.chipText, chip.type === 'template' && styles.chipTextTemplate]}>
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ── Typing Indicator ── */}
          {loading && (
            <View style={styles.typingRow}>
              <View style={styles.aiAvatar}>
                <Ionicons name="hardware-chip-outline" size={16} color={colors.primary} />
              </View>
              <View style={styles.typingBubble}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.typingText}>AI Iki sedang berpikir...</Text>
              </View>
            </View>
          )}

          {/* ── Input Bar (Pill Shape) ── */}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.inputBarContainer, isViewingHistory && styles.inputBarContainerDisabled]}>
              {isViewingHistory ? (
                <TouchableOpacity
                  style={styles.returnToTodayBtn}
                  onPress={() => handleLoadDate(getTodayString())}
                >
                  <Ionicons name="arrow-undo-outline" size={20} color={colors.white} />
                  <Text style={styles.returnToTodayText}>Kembali ke Chat Hari Ini</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.inputPill}>
                  <TouchableOpacity style={styles.shortcutInputBtn} onPress={() => setShowShortcuts(true)}>
                    <Ionicons name="add" size={26} color={colors.textLight} />
                  </TouchableOpacity>
                  <TextInput
                    ref={inputRef}
                    style={styles.textInput}
                    placeholder="Ketik pesan..."
                    placeholderTextColor={colors.textLight}
                    value={input}
                    onChangeText={setInput}
                    multiline
                    maxLength={500}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
                    onPress={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={input.trim() ? "arrow-up" : "mic"} size={20} color={colors.white} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        </>
      )}

      {/* ── Header Menu Modal ── */}
      <HeaderMenuModal
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        onNewChat={handleNewChat}
        onShowHistory={() => setShowHistoryModal(true)}
        onClearChat={handleClearChat}
        isViewingHistory={isViewingHistory}
      />

      {/* ── History Modal ── */}
      <HistoryModal
        visible={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        onLoadDate={handleLoadDate}
      />

      {/* ── Shortcut Panel ── */}
      <ShortcutPanel
        visible={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        onSend={(text) => sendMessage(text)}
        onTemplate={(text) => {
          setInput(text);
          setShowShortcuts(false);
          setTimeout(() => inputRef.current?.focus(), 300);
        }}
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    backgroundColor: colors.cardBg,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrand: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: 0.3 },
  headerSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2, fontWeight: '500' },

  // Header Menu Modal
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'flex-end' },
  menuDropdown: {
    backgroundColor: colors.cardBg,
    marginTop: 60,
    marginRight: 16,
    borderRadius: 12,
    width: 200,
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  menuItemText: { fontSize: 15, fontWeight: '600', color: colors.text },
  menuDivider: { height: 1, backgroundColor: colors.divider },

  // History Banner
  viewingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  viewingBannerText: { flex: 1, fontSize: 13, color: colors.textSecondary, fontWeight: '600' },

  // Empty State (Center)
  emptyStateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, marginTop: 40 },
  emptyStateLogo: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  emptyStateTitle: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 8 },
  emptyStateSub: { fontSize: 15, color: colors.textSecondary, marginBottom: 32 },

  // Loading
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: 15, color: colors.textLight, fontWeight: '500' },

  // Chat list
  chatList: { padding: 16, paddingBottom: 24 },

  // Date divider
  dateDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
  dateDividerLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  dateDividerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.background,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: colors.divider,
  },
  dateDividerText: { fontSize: 11, color: colors.textLight, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },

  // System message
  systemMsg: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 10,
    marginBottom: 20, maxWidth: '90%',
  },
  systemMsgText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', fontWeight: '500', flex: 1, lineHeight: 18 },

  // Bubbles
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 20, gap: 12 },
  bubbleRowUser: { flexDirection: 'row-reverse' },
  aiAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  bubble: {
    paddingHorizontal: 16, paddingVertical: 12,
  },
  bubbleAi: { 
    backgroundColor: 'transparent', 
    paddingHorizontal: 0, paddingVertical: 4,
  },
  bubbleUser: { 
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderBottomRightRadius: 4,
  },
  bubbleText: { fontSize: 15, color: colors.text, lineHeight: 24, fontWeight: '400' },
  bubbleTextUser: { color: colors.text, fontWeight: '400' },
  bubbleTime: { fontSize: 10, color: colors.textLight, marginTop: 4, marginHorizontal: 4, fontWeight: '500' },

  // Suggestion chips
  chipsLabel: { fontSize: 12, color: colors.textLight, fontWeight: '800', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, letterSpacing: 0.3 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.cardBg, borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  chipTemplate: { borderColor: colors.accent, backgroundColor: colors.cardBg },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  chipTextTemplate: { color: colors.accent },

  // Typing indicator
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'transparent',
    paddingVertical: 12,
  },
  typingText: { fontSize: 13, color: colors.textLight, fontStyle: 'italic', fontWeight: '500' },

  // Input Bar
  inputBarContainer: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 16 : 24,
    paddingTop: 8,
    backgroundColor: colors.background,
  },
  inputBarContainerDisabled: {
    backgroundColor: colors.background,
    paddingHorizontal: 0, paddingBottom: 0, paddingTop: 0,
  },
  inputPill: {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: colors.cardBg,
    borderRadius: 28,
    paddingHorizontal: 8, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.cardBg, padding: 8,
    borderRadius: 30,
  },
  inputBarDisabled: { backgroundColor: colors.surface, borderRadius: 0, elevation: 0, padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
  shortcutInputBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
    marginBottom: 2, marginLeft: 2,
  },
  textInput: {
    flex: 1, minHeight: 44, maxHeight: 120,
    paddingHorizontal: 12, paddingVertical: 12,
    fontSize: 16, color: colors.text, fontWeight: '400',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center',
    marginBottom: 2, marginRight: 2,
  },
  sendBtnDisabled: { backgroundColor: colors.border, elevation: 0 },
  returnToTodayBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: colors.text, borderRadius: 24, paddingVertical: 14,
  },
  returnToTodayText: { fontSize: 15, fontWeight: '600', color: colors.cardBg },

  // Shortcut Panel
  shortcutOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  shortcutSheet: { backgroundColor: colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingTop: 12 },
  shortcutHandle: { width: 40, height: 5, borderRadius: 2.5, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 8 },
  shortcutHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 24, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  shortcutIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  shortcutTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  shortcutSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2, fontWeight: '400' },
  shortcutClose: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  shortcutCategory: { paddingHorizontal: 20, paddingTop: 24 },
  shortcutCatHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  shortcutCategoryLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  shortcutChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  shortcutChip: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1,
  },
  shortcutChipText: { fontSize: 14, fontWeight: '600' },

  // History Modal
  historyModal: { flex: 1, backgroundColor: colors.background },
  historyModalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.cardBg, padding: 20, paddingTop: 24,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  historyModalIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  historyModalTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
  historyModalClose: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  historyEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  historyEmptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  historyEmptyText: { fontSize: 18, fontWeight: '700', color: colors.textSecondary },
  historyEmptySubtext: { fontSize: 14, color: colors.textLight, textAlign: 'center', fontWeight: '400', lineHeight: 20 },
  historyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.cardBg, borderRadius: 16,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  historyItemIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  historyItemDate: { fontSize: 16, fontWeight: '700', color: colors.text },
  historyItemSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4, fontWeight: '400' },
  historyItemCount: {
    alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
  },
  historyItemCountText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  historyItemCountLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase' },
});

export default AiAssistant;

