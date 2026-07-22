import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, Platform, StatusBar, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getDebts, addDebt, payDebt, deleteDebt, getTotalDebt } from '../database/db';
import { formatRupiah } from '../utils/calculations';
import { colors } from '../theme/colors';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const STATUS_CONFIG = {
  unpaid: { label: 'Belum Bayar', icon: 'alert-circle', color: '#D32F2F', bg: '#FCE4EC' },
  partial: { label: 'Cicilan', icon: 'time', color: '#F57C00', bg: '#FFF3E0' },
  paid: { label: 'Lunas', icon: 'checkmark-circle', color: '#2E7D32', bg: '#E8F5E9' },
};

const DebtCard = ({ item, onPay, onDelete }) => {
  const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.unpaid;
  const remaining = item.total_amount - item.paid_amount;

  return (
    <View style={styles.debtCard}>
      <View style={styles.debtCardTop}>
        <View style={styles.debtCustomer}>
          <View style={[styles.debtAvatar, { backgroundColor: status.bg }]}>
            <Ionicons name="person" size={20} color={status.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.debtCustomerName} numberOfLines={1}>{item.customer_name}</Text>
            {item.note ? <Text style={styles.debtNote} numberOfLines={1}>{item.note}</Text> : null}
          </View>
        </View>
        <View style={[styles.debtStatusBadge, { backgroundColor: status.bg, borderColor: status.color }]}>
          <Ionicons name={status.icon} size={12} color={status.color} />
          <Text style={[styles.debtStatusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.debtAmounts}>
        <View style={styles.debtAmountCol}>
          <Text style={styles.debtAmountLabel}>Total Hutang</Text>
          <Text style={styles.debtAmountValue}>{formatRupiah(item.total_amount)}</Text>
        </View>
        <View style={styles.debtAmountCol}>
          <Text style={styles.debtAmountLabel}>Sudah Dibayar</Text>
          <Text style={[styles.debtAmountValue, { color: '#2E7D32' }]}>{formatRupiah(item.paid_amount)}</Text>
        </View>
        <View style={styles.debtAmountCol}>
          <Text style={styles.debtAmountLabel}>Sisa</Text>
          <Text style={[styles.debtAmountValue, { color: remaining > 0 ? '#D32F2F' : '#2E7D32' }]}>
            {formatRupiah(remaining)}
          </Text>
        </View>
      </View>

      <View style={styles.debtDivider} />

      <Text style={styles.debtDate}>{formatDate(item.date)}</Text>

      {item.status !== 'paid' && (
        <View style={styles.debtActions}>
          <TouchableOpacity
            style={styles.debtPayBtn}
            onPress={() => onPay(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="cash-outline" size={16} color={colors.white} />
            <Text style={styles.debtPayBtnText}>Bayar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.debtDelBtn}
            onPress={() => onDelete(item)}
          >
            <Ionicons name="trash-outline" size={18} color={colors.dangerText} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const DebtManager = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [debts, setDebts] = useState([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [filter, setFilter] = useState('unpaid');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [loading, setLoading] = useState(true);

  const [newCustomer, setNewCustomer] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newNote, setNewNote] = useState('');
  const [payAmount, setPayAmount] = useState('');

  const loadDebts = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getDebts('all');
      setDebts(all);
      const total = all
        .filter(d => d.status !== 'paid')
        .reduce((sum, d) => sum + (d.total_amount - d.paid_amount), 0);
      setTotalOutstanding(total);
    } catch (e) {
      console.error('Error loading debts:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadDebts(); }, [loadDebts]));

  const filteredDebts = debts.filter(d => {
    if (filter === 'all') return true;
    return d.status === filter;
  });

  const handleAddDebt = async () => {
    if (!newCustomer.trim()) { Alert.alert('Perhatian', 'Nama pelanggan harus diisi.'); return; }
    const amount = parseInt(newAmount.replace(/\D/g, '')) || 0;
    if (amount <= 0) { Alert.alert('Perhatian', 'Jumlah hutang harus lebih dari Rp 0.'); return; }
    try {
      await addDebt({
        customer_name: newCustomer.trim(),
        total_amount: amount,
        note: newNote.trim() || null,
      });
      setNewCustomer('');
      setNewAmount('');
      setNewNote('');
      setShowAddModal(false);
      loadDebts();
    } catch {
      Alert.alert('Error', 'Gagal mencatat hutang.');
    }
  };

  const handlePayDebt = async () => {
    if (!selectedDebt) return;
    const amount = parseInt(payAmount.replace(/\D/g, '')) || 0;
    if (amount <= 0) { Alert.alert('Perhatian', 'Jumlah bayar harus lebih dari Rp 0.'); return; }
    const remaining = selectedDebt.total_amount - selectedDebt.paid_amount;
    if (amount > remaining) { Alert.alert('Perhatian', `Pembayaran melebihi sisa hutang (${formatRupiah(remaining)}).`); return; }
    try {
      await payDebt(selectedDebt.id, amount);
      setPayAmount('');
      setShowPayModal(false);
      setSelectedDebt(null);
      loadDebts();
    } catch {
      Alert.alert('Error', 'Gagal mencatat pembayaran.');
    }
  };

  const handleDeleteDebt = (item) => {
    Alert.alert(
      'Hapus Hutang',
      `Hapus hutang ${item.customer_name} sebesar ${formatRupiah(item.total_amount)}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Hapus', style: 'destructive',
          onPress: async () => {
            try {
              await deleteDebt(item.id);
              loadDebts();
            } catch {
              Alert.alert('Error', 'Gagal menghapus hutang.');
            }
          }
        }
      ]
    );
  };

  const openPayModal = (item) => {
    setSelectedDebt(item);
    setPayAmount('');
    setShowPayModal(true);
  };

  const remainingForSelected = selectedDebt
    ? selectedDebt.total_amount - selectedDebt.paid_amount
    : 0;

  const filterTabs = [
    { key: 'unpaid', label: 'Belum Bayar', count: debts.filter(d => d.status === 'unpaid').length },
    { key: 'partial', label: 'Cicilan', count: debts.filter(d => d.status === 'partial').length },
    { key: 'paid', label: 'Lunas', count: debts.filter(d => d.status === 'paid').length },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 60 }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Hutang Pelanggan</Text>
            <Text style={styles.headerSub}>Kelola catatan hutang warung</Text>
          </View>
          <TouchableOpacity
            style={styles.addDebtHeaderBtn}
            onPress={() => { setNewCustomer(''); setNewAmount(''); setNewNote(''); setShowAddModal(true); }}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroCardLeft}>
            <Ionicons name="wallet-outline" size={20} color={colors.white} />
            <Text style={styles.heroCardLabel}>Total Hutang Outstanding</Text>
          </View>
          <Text style={styles.heroCardValue}>{formatRupiah(totalOutstanding)}</Text>
          {totalOutstanding > 100000 && (
            <View style={styles.heroWarning}>
              <Ionicons name="warning" size={14} color={colors.warningText} />
              <Text style={styles.heroWarningText}>Total hutang di atas Rp 100.000</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.filterBar}>
        {filterTabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
            onPress={() => setFilter(tab.key)}
          >
            <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={[styles.filterTabBadge, filter === tab.key && { backgroundColor: colors.white }]}>
                <Text style={[styles.filterTabBadgeText, filter === tab.key && { color: colors.primary }]}>
                  {tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredDebts}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <DebtCard item={item} onPay={openPayModal} onDelete={handleDeleteDebt} />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="wallet-outline" size={48} color={colors.textLight} />
            </View>
            <Text style={styles.emptyText}>
              {filter === 'paid' ? 'Belum ada hutang lunas' : 'Tidak ada hutang'}
            </Text>
            <Text style={styles.emptySub}>
              {filter === 'paid' ? 'Hutang yang sudah dibayar muncul di sini' : 'Warung sedang bersih dari hutang! 🎉'}
            </Text>
          </View>
        }
      />

      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAddModal(false)}>
            <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { paddingBottom: 12 + insets.bottom }]}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Catat Hutang Baru</Text>

              <Text style={styles.fieldLabel}>Nama Pelanggan</Text>
              <TextInput
                style={styles.fieldInput}
                value={newCustomer}
                onChangeText={setNewCustomer}
                placeholder="Nama pelanggan yang berhutang"
                placeholderTextColor={colors.textLight}
                autoFocus
              />

              <Text style={styles.fieldLabel}>Jumlah Hutang (Rp)</Text>
              <TextInput
                style={styles.fieldInput}
                value={newAmount}
                onChangeText={setNewAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textLight}
              />

              <Text style={styles.fieldLabel}>Catatan (opsional)</Text>
              <TextInput
                style={[styles.fieldInput, { minHeight: 72, textAlignVertical: 'top' }]}
                value={newNote}
                onChangeText={setNewNote}
                placeholder="Misal: beli beras 2 karung"
                placeholderTextColor={colors.textLight}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity style={styles.saveModalBtn} onPress={handleAddDebt} activeOpacity={0.8}>
                <Ionicons name="save-outline" size={20} color={colors.white} />
                <Text style={styles.saveModalBtnText}>Simpan Hutang</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showPayModal} animationType="slide" transparent onRequestClose={() => setShowPayModal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPayModal(false)}>
            <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { paddingBottom: 12 + insets.bottom }]}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Bayar Hutang</Text>

              <View style={styles.payInfoCard}>
                <Text style={styles.payInfoLabel}>Pelanggan</Text>
                <Text style={styles.payInfoValue}>{selectedDebt?.customer_name}</Text>

                <View style={{ flexDirection: 'row', marginTop: 12, gap: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.payInfoLabel}>Total Hutang</Text>
                    <Text style={styles.payInfoValue}>{formatRupiah(selectedDebt?.total_amount || 0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.payInfoLabel}>Sudah Bayar</Text>
                    <Text style={[styles.payInfoValue, { color: '#2E7D32' }]}>
                      {formatRupiah(selectedDebt?.paid_amount || 0)}
                    </Text>
                  </View>
                </View>

                <View style={styles.payRemaining}>
                  <Text style={styles.payInfoLabel}>Sisa Hutang</Text>
                  <Text style={[styles.payInfoValue, { color: '#D32F2F' }]}>
                    {formatRupiah(remainingForSelected)}
                  </Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Jumlah Bayar (Rp)</Text>
              <TextInput
                style={styles.fieldInput}
                value={payAmount}
                onChangeText={setPayAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textLight}
                autoFocus
              />

              <View style={styles.payPresetRow}>
                {[remainingForSelected, remainingForSelected * 0.5].map((amt, i) => (
                  amt > 0 ? (
                    <TouchableOpacity
                      key={i}
                      style={styles.payPresetChip}
                      onPress={() => setPayAmount(String(Math.round(amt)))}
                    >
                      <Text style={styles.payPresetChipText}>
                        {i === 0 ? 'Lunas' : 'Setengah'}: {formatRupiah(Math.round(amt))}
                      </Text>
                    </TouchableOpacity>
                  ) : null
                ))}
              </View>

              <TouchableOpacity style={styles.saveModalBtn} onPress={handlePayDebt} activeOpacity={0.8}>
                <Ionicons name="cash-outline" size={20} color={colors.white} />
                <Text style={styles.saveModalBtnText}>Catat Pembayaran</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    backgroundColor: colors.cardBg,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 4,
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitleContainer: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: colors.textLight, fontWeight: '600', marginTop: 2 },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider,
  },
  addDebtHeaderBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  heroCard: {
    backgroundColor: '#D32F2F',
    borderRadius: 18,
    padding: 16,
    marginTop: 16,
  },
  heroCardLeft: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
  },
  heroCardLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  heroCardValue: { fontSize: 28, fontWeight: '900', color: colors.white },
  heroWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start',
  },
  heroWarningText: { fontSize: 12, fontWeight: '700', color: colors.warning },

  filterBar: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  filterTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterTabText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  filterTabTextActive: { color: colors.white },
  filterTabBadge: {
    backgroundColor: colors.primary + '20', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  filterTabBadgeText: { fontSize: 11, fontWeight: '800', color: colors.primary },

  listContent: { padding: 16, paddingBottom: 40 },

  debtCard: {
    backgroundColor: colors.cardBg, borderRadius: 18, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: colors.border + '60',
    elevation: 2, shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  debtCardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  debtCustomer: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  debtAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  debtCustomerName: { fontSize: 16, fontWeight: '800', color: colors.text },
  debtNote: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  debtStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    borderWidth: 1,
  },
  debtStatusText: { fontSize: 11, fontWeight: '700' },

  debtAmounts: {
    flexDirection: 'row', gap: 8,
  },
  debtAmountCol: { flex: 1 },
  debtAmountLabel: { fontSize: 11, color: colors.textLight, marginBottom: 2 },
  debtAmountValue: { fontSize: 14, fontWeight: '800', color: colors.text },
  debtDivider: { height: 1, backgroundColor: colors.divider, marginVertical: 10 },
  debtDate: { fontSize: 12, color: colors.textLight, fontWeight: '500' },

  debtActions: {
    flexDirection: 'row', gap: 8, marginTop: 10,
  },
  debtPayBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#2E7D32', borderRadius: 12, paddingVertical: 10,
  },
  debtPayBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
  debtDelBtn: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center',
  },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyIconContainer: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { fontSize: 18, fontWeight: '700', color: colors.textSecondary },
  emptySub: { fontSize: 14, color: colors.textLight, textAlign: 'center', paddingHorizontal: 32 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12,
  },
  modalHandle: {
    width: 40, height: 5, borderRadius: 2.5,
    backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: 20 },

  fieldLabel: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, marginBottom: 6 },
  fieldInput: {
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: colors.text, fontWeight: '600',
    marginBottom: 14,
  },

  saveModalBtn: {
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 8,
    elevation: 4, shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6,
  },
  saveModalBtnText: { fontSize: 16, fontWeight: '800', color: colors.white },

  payInfoCard: {
    backgroundColor: colors.background, borderRadius: 14,
    padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.border + '60',
  },
  payInfoLabel: { fontSize: 11, color: colors.textLight, marginBottom: 2 },
  payInfoValue: { fontSize: 16, fontWeight: '800', color: colors.text },
  payRemaining: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider },
  payPresetRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  payPresetChip: {
    flex: 1, backgroundColor: colors.surface,
    borderRadius: 12, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  payPresetChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
});

export default DebtManager;