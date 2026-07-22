import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, 
  Platform, StatusBar, Alert, ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getMonthlyReport, getDailyReport, getTopProducts, getMonthComparison, exportBackup, importBackup, cancelTransaction } from '../database/db';
import { formatRupiah } from '../utils/calculations';
import { colors } from '../theme/colors';

const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const pad = n => String(n).padStart(2, '0');

// ─── Helper components ───────────────────────────────────────────────────────
const SummaryCard = ({ icon, label, value, color, bg }) => (
  <View style={[styles.summaryCard, bg && { backgroundColor: bg }]}>
    <View style={[styles.summaryIconContainer, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <View style={styles.summaryTextContainer}>
      <Text style={styles.summaryCardLabel} numberOfLines={1}>{label}</Text>
      <Text style={[styles.summaryCardValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  </View>
);

// ─── Daily Tab ────────────────────────────────────────────────────────────────
const DailyTab = () => {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [minAmount, setMinAmount] = useState('');
  const [data, setData] = useState({ totalRevenue: 0, totalProfit: 0, transactions: [], totalItems: 0 });
  const [confirmCancelId, setConfirmCancelId] = useState(null); // id transaksi yg lagi dikonfirmasi
  const [cancelLoading, setCancelLoading] = useState(false);

  const load = useCallback(async () => {
    const ds = `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth()+1)}-${pad(selectedDate.getDate())}`;
    const result = await getDailyReport(ds);
    setData(result);
  }, [selectedDate]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const goDay = (delta) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    if (d <= today) setSelectedDate(d);
  };

  const isToday = selectedDate.toDateString() === today.toDateString();
  const dateLabel = isToday
    ? 'Hari Ini'
    : `${selectedDate.getDate()} ${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  const dayName = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][selectedDate.getDay()];

  const filteredTransactions = data.transactions.filter(t => {
    if (!minAmount) return true;
    return t.total_amount >= parseFloat(minAmount);
  });

  const doCancel = async (txId, restoreStock) => {
    setCancelLoading(true);
    try {
      await cancelTransaction(txId, restoreStock);
      setConfirmCancelId(null);
      load();
    } catch {
      setConfirmCancelId(null);
    } finally {
      setCancelLoading(false);
    }
  };

  const renderTx = ({ item, index }) => {
    const d = new Date(item.date);
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const isConfirming = confirmCancelId === item.id;

    return (
      <View style={styles.txCard}>
        <View style={styles.txCardBody}>
          <View style={styles.txCardTop}>
            <View style={styles.txBadge}>
              <Text style={styles.txBadgeText}>#{data.transactions.length - index}</Text>
            </View>
            <View style={styles.txTimeContainer}>
              <Ionicons name="time-outline" size={14} color={colors.textLight} />
              <Text style={styles.txTime}>{time}</Text>
            </View>
            <Text style={styles.txProfit}>{formatRupiah(item.profit)}</Text>
            {/* Tombol Cancel — toggle inline confirmation */}
            <TouchableOpacity
              style={styles.txCancelBtn}
              onPress={() => setConfirmCancelId(isConfirming ? null : item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isConfirming ? 'close-circle' : 'trash-outline'}
                size={20}
                color={isConfirming ? colors.primary : colors.dangerText}
              />
            </TouchableOpacity>
          </View>

          {/* ── Inline Confirmation Panel ────────────────── */}
          {isConfirming && (
            <View style={styles.cancelPanel}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Ionicons name="warning" size={16} color={colors.warningText} />
                <Text style={styles.cancelPanelTitle}>Batalkan transaksi ini?</Text>
              </View>
              <Text style={styles.cancelPanelSub}>Pilih apakah stok barang dikembalikan:</Text>
              <View style={styles.cancelPanelBtns}>
                <TouchableOpacity
                  style={[styles.cancelPanelBtn, styles.cancelPanelBtnGreen]}
                  onPress={() => doCancel(item.id, true)}
                  disabled={cancelLoading}
                >
                  <Ionicons name="cube-outline" size={15} color="#fff" />
                  <Text style={styles.cancelPanelBtnText}>Kembalikan Stok</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelPanelBtn, styles.cancelPanelBtnRed]}
                  onPress={() => doCancel(item.id, false)}
                  disabled={cancelLoading}
                >
                  <Ionicons name="trash-outline" size={15} color="#fff" />
                  <Text style={styles.cancelPanelBtnText}>Hapus Saja</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setConfirmCancelId(null)} style={styles.cancelPanelDismiss}>
                <Text style={styles.cancelPanelDismissText}>← Batal, jangan hapus</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Items list */}
          {item.items && item.items.length > 0 && (
            <View style={styles.txItemsList}>
              {item.items.map((it, i) => (
                <View key={i} style={styles.txItemRow}>
                  <Text style={styles.txItemName} numberOfLines={1}>• {it.name}</Text>
                  <Text style={styles.txItemQty}>{it.quantity} {it.unit || 'pcs'}</Text>
                  <Text style={styles.txItemSubtotal}>{formatRupiah(it.subtotal)}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.txCardBottom}>
            <Text style={styles.txTotalLabel}>Total Bayar</Text>
            <Text style={styles.txTotalValue}>{formatRupiah(item.total_amount)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <FlatList
      data={filteredTransactions}
      keyExtractor={item => item.id.toString()}
      renderItem={renderTx}
      contentContainerStyle={styles.tabContent}
      ListHeaderComponent={
        <>
          {/* Date Navigator */}
          <View style={styles.navigator}>
            <TouchableOpacity style={styles.navArrow} onPress={() => goDay(-1)}>
              <Ionicons name="chevron-back" size={24} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.navCenter} 
              onPress={() => setSelectedDate(today)}
              activeOpacity={0.7}
            >
              <Text style={styles.navMainLabel}>{dateLabel}</Text>
              <Text style={styles.navSubLabel}>{isToday ? 'Tap untuk refresh' : 'Kembali ke hari ini'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navArrow, isToday && styles.navArrowDisabled]}
              onPress={() => goDay(1)}
              disabled={isToday}
            >
              <Ionicons name="chevron-forward" size={24} color={isToday ? 'rgba(255,255,255,0.3)' : colors.white} />
            </TouchableOpacity>
          </View>

          {/* Filter Bar */}
          <View style={styles.filterBar}>
            <Ionicons name="funnel-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.filterLabel}>Min. Belanja: </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              <TouchableOpacity 
                style={[styles.filterChip, minAmount === '' && styles.filterChipActive]} 
                onPress={() => setMinAmount('')}
              >
                <Text style={[styles.filterChipText, minAmount === '' && styles.filterChipTextActive]}>Semua</Text>
              </TouchableOpacity>
              {['20000', '50000', '100000'].map(amt => (
                <TouchableOpacity 
                  key={amt}
                  style={[styles.filterChip, minAmount === amt && styles.filterChipActive]} 
                  onPress={() => setMinAmount(amt)}
                >
                  <Text style={[styles.filterChipText, minAmount === amt && styles.filterChipTextActive]}>≥ {parseInt(amt)/1000}rb</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Summary Cards */}
          <View style={styles.summaryGrid}>
            <SummaryCard icon="cash" label="Omset" value={formatRupiah(data.totalRevenue)} color={colors.primary} />
            <SummaryCard icon="trending-up" label="Untung" value={formatRupiah(data.totalProfit)} color={colors.successText} bg={colors.success} />
            <SummaryCard icon="cart" label="Transaksi" value={`${data.transactions.length}x`} color="#7B1FA2" />
            <SummaryCard icon="cube" label="Terjual" value={`${data.totalItems} item`} color={colors.warningText} bg={colors.warning} />
          </View>

          {data.transactions.length > 0 && (
            <View style={styles.sectionHeader}>
               <Ionicons name="list" size={16} color={colors.textSecondary} />
               <Text style={styles.sectionTitle}>Rincian Transaksi</Text>
            </View>
          )}
        </>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="receipt-outline" size={48} color={colors.textLight} />
          </View>
          <Text style={styles.emptyText}>Tidak ada transaksi</Text>
          <Text style={styles.emptySub}>{dayName}, {dateLabel}</Text>
        </View>
      }
    />
  );
};

// ─── Comparison Block ─────────────────────────────────────────────────────────
const ComparisonBlock = ({ comparison }) => {
  const revDiff = comparison.previous.revenue > 0
    ? ((comparison.current.revenue - comparison.previous.revenue) / comparison.previous.revenue) * 100
    : null;
  const profDiff = comparison.previous.profit > 0
    ? ((comparison.current.profit - comparison.previous.profit) / comparison.previous.profit) * 100
    : null;

  return (
    <View style={styles.comparisonCard}>
      <View style={styles.sectionHeader}>
        <Ionicons name="stats-chart" size={16} color={colors.textSecondary} />
        <Text style={styles.comparisonTitle}>Perbandingan Bulan Lalu</Text>
      </View>
      <View style={styles.comparisonRow}>
        <View style={styles.comparisonItem}>
          <Text style={styles.comparisonLabel}>Omset</Text>
          {revDiff !== null ? (
            <View style={[styles.comparisonBadge, { backgroundColor: revDiff >= 0 ? '#E8F5E9' : '#FCE4EC' }]}>
              <Ionicons name={revDiff >= 0 ? "trending-up" : "trending-down"} size={14} color={revDiff >= 0 ? '#1B5E20' : '#B71C1C'} style={{ marginRight: 4 }} />
              <Text style={[styles.comparisonBadgeText, { color: revDiff >= 0 ? '#1B5E20' : '#B71C1C' }]}>
                {Math.abs(revDiff).toFixed(1)}%
              </Text>
            </View>
          ) : <Text style={styles.comparisonNa}>Data Baru</Text>}
        </View>
        <View style={styles.comparisonItem}>
          <Text style={styles.comparisonLabel}>Untung</Text>
          {profDiff !== null ? (
            <View style={[styles.comparisonBadge, { backgroundColor: profDiff >= 0 ? '#E8F5E9' : '#FCE4EC' }]}>
              <Ionicons name={profDiff >= 0 ? "trending-up" : "trending-down"} size={14} color={profDiff >= 0 ? '#1B5E20' : '#B71C1C'} style={{ marginRight: 4 }} />
              <Text style={[styles.comparisonBadgeText, { color: profDiff >= 0 ? '#1B5E20' : '#B71C1C' }]}>
                {Math.abs(profDiff).toFixed(1)}%
              </Text>
            </View>
          ) : <Text style={styles.comparisonNa}>Data Baru</Text>}
        </View>
      </View>
    </View>
  );
};

// ─── Monthly Tab ──────────────────────────────────────────────────────────────
const MonthlyTab = () => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [data, setData] = useState({ totalRevenue: 0, totalProfit: 0, transactions: [] });
  const [comparison, setComparison] = useState(null);
  const [topProds, setTopProds] = useState([]);

  const load = useCallback(async () => {
    const m = pad(selectedMonth + 1);
    const result = await getMonthlyReport(selectedYear, m);
    const comp = await getMonthComparison(selectedYear, selectedMonth + 1);
    const top = await getTopProducts(selectedYear, selectedMonth + 1);
    setData(result);
    setComparison(comp);
    setTopProds(top);
  }, [selectedYear, selectedMonth]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const goMonth = (delta) => {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    const target = new Date(y, m, 1);
    if (target <= new Date(now.getFullYear(), now.getMonth(), 1)) {
      setSelectedMonth(m);
      setSelectedYear(y);
    }
  };

  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  const renderTx = ({ item, index }) => {
    const d = new Date(item.date);
    const dateStr = `${pad(d.getDate())}/${pad(d.getMonth()+1)}`;
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return (
      <View style={styles.txCard}>
        <View style={styles.txCardBody}>
          <View style={styles.txCardTop}>
            <View style={[styles.txBadge, { backgroundColor: '#EDE7F6' }]}>
              <Text style={[styles.txBadgeText, { color: '#7B1FA2' }]}>#{data.transactions.length - index}</Text>
            </View>
            <View style={styles.txTimeContainer}>
              <Ionicons name="calendar-outline" size={14} color={colors.textLight} />
              <Text style={styles.txTime}>{dateStr} • {time}</Text>
            </View>
            <Text style={styles.txProfit}>{formatRupiah(item.profit)}</Text>
          </View>
          <View style={styles.txCardBottom}>
            <Text style={styles.txTotalLabel}>Total Bayar</Text>
            <Text style={styles.txTotalValue}>{formatRupiah(item.total_amount)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <FlatList
      data={data.transactions}
      keyExtractor={item => item.id.toString()}
      renderItem={renderTx}
      contentContainerStyle={styles.tabContent}
      ListHeaderComponent={
        <>
          {/* Month Navigator */}
          <View style={[styles.navigator, { backgroundColor: '#7B1FA2' }]}>
            <TouchableOpacity style={styles.navArrow} onPress={() => goMonth(-1)}>
              <Ionicons name="chevron-back" size={24} color={colors.white} />
            </TouchableOpacity>
            <View style={styles.navCenter}>
              <Text style={styles.navMainLabel}>{MONTH_NAMES[selectedMonth]}</Text>
              <Text style={styles.navSubLabel}>{selectedYear}</Text>
            </View>
            <TouchableOpacity
              style={[styles.navArrow, isCurrentMonth && styles.navArrowDisabled]}
              onPress={() => goMonth(1)} disabled={isCurrentMonth}
            >
              <Ionicons name="chevron-forward" size={24} color={isCurrentMonth ? 'rgba(255,255,255,0.3)' : colors.white} />
            </TouchableOpacity>
          </View>

          {/* Summary Cards */}
          <View style={styles.summaryGrid}>
            <SummaryCard icon="cash" label="Total Omset" value={formatRupiah(data.totalRevenue)} color={colors.primary} />
            <SummaryCard icon="trending-up" label="Total Untung" value={formatRupiah(data.totalProfit)} color={colors.successText} bg={colors.success} />
            <SummaryCard icon="pie-chart" label="Margin" value={`${data.totalRevenue > 0 ? ((data.totalProfit / data.totalRevenue) * 100).toFixed(1) : 0}%`} color="#7B1FA2" />
            <SummaryCard icon="cart" label="Transaksi" value={`${data.transactions.length}x`} color={colors.primary} />
          </View>

          {/* Komparasi bulan lalu */}
          {comparison && (comparison.previous.revenue > 0 || comparison.current.revenue > 0) && (
            <ComparisonBlock comparison={comparison} />
          )}

          {/* Top Produk */}
          {topProds.length > 0 && (
            <View style={styles.topProdCard}>
               <View style={styles.sectionHeader}>
                  <Ionicons name="trophy" size={16} color="#F59E0B" />
                  <Text style={styles.comparisonTitle}>Produk Terlaris Bulan Ini</Text>
                </View>
              {topProds.map((item, idx) => {
                const maxQty = topProds[0].total_qty;
                const pct = (item.total_qty / maxQty) * 100;
                const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32', colors.primaryLight];
                return (
                  <View key={idx} style={styles.topProductRow}>
                    <View style={[styles.rankBadge, { backgroundColor: (rankColors[idx] || colors.primaryLight) + '22' }]}>
                       <Text style={[styles.rankText, { color: rankColors[idx] || colors.textLight }]}>{idx + 1}</Text>
                    </View>
                    <View style={styles.topProductInfo}>
                      <View style={styles.topProductNameRow}>
                        <Text style={styles.topProductName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.topProductQty}>{item.total_qty} pcs</Text>
                      </View>
                      <View style={styles.topProductBarTrack}>
                        <View style={[styles.topProductBarFill, { width: `${pct}%`, backgroundColor: rankColors[idx] || colors.primaryLight }]} />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {data.transactions.length > 0 && (
            <View style={styles.sectionHeader}>
               <Ionicons name="list" size={16} color={colors.textSecondary} />
               <Text style={styles.sectionTitle}>Riwayat Transaksi</Text>
            </View>
          )}
        </>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="receipt-outline" size={48} color={colors.textLight} />
          </View>
          <Text style={styles.emptyText}>Tidak ada transaksi</Text>
          <Text style={styles.emptySub}>{MONTH_NAMES[selectedMonth]} {selectedYear}</Text>
        </View>
      }
    />
  );
};

const Report = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('daily');
  const [backupLoading, setBackupLoading] = useState(false);

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const json = await exportBackup();
      const now = new Date();
      const filename = `warung_backup_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}.json`;

      try {
        const fileUri = FileSystem.documentDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, json, { encoding: 'utf8' });

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'Simpan atau Kirim Backup Data',
          });
        } else {
          Alert.alert('File Tersimpan', `Backup disimpan sebagai:\n${filename}\n\nDi folder Documents aplikasi.`);
        }
      } catch (fileErr) {
        // Fallback: tampilkan statistik backup tanpa file
        const parsed = JSON.parse(json);
        Alert.alert(
          'Data Siap Dibackup',
          `${parsed.data.products.length} barang\n${parsed.data.transactions.length} transaksi\n\nCatatan: Berbagi file tidak tersedia di mode ini. Gunakan APK untuk backup penuh.`,
          [{ text: 'OK' }]
        );
      }
    } catch (e) {
      Alert.alert('Gagal Backup', e.message);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestore = () => {
    Alert.alert(
      'Pulihkan Data',
      'Ini akan MENGHAPUS semua data saat ini dan menggantinya dengan data dari file backup.\n\nPastikan Anda sudah yakin!',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Ya, Lanjutkan', style: 'destructive', onPress: async () => {
          try {
            const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
            if (result.canceled || !result.assets?.[0]?.uri) return;

            const content = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: 'utf8' });
            const stats = await importBackup(content);
            Alert.alert(
              'Berhasil Dipulihkan!',
              `${stats.products} produk\n${stats.transactions} transaksi\ntelah berhasil dipulihkan.`
            );
          } catch (e) {
            Alert.alert('Gagal Restore', e.message);
          }
        }}
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Laporan Keuangan</Text>
            <Text style={styles.headerSub}>Analisis & Riwayat Toko</Text>
          </View>
          <TouchableOpacity 
            style={[styles.backBtn, { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' }]}
            onPress={handleBackup}
            disabled={backupLoading}
          >
            {backupLoading 
              ? <ActivityIndicator size="small" color={colors.successText} />
              : <Ionicons name="cloud-upload" size={22} color={colors.successText} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Backup & Restore Bar */}
      <View style={styles.backupBar}>
        <TouchableOpacity style={styles.backupBtn} onPress={handleBackup} disabled={backupLoading}>
          <Ionicons name="download-outline" size={18} color={colors.successText} />
          <Text style={[styles.backupBtnText, { color: colors.successText }]}>
            {backupLoading ? 'Mengekspor...' : 'Ekspor Backup'}
          </Text>
        </TouchableOpacity>
        <View style={{ width: 1, height: 24, backgroundColor: colors.divider }} />
        <TouchableOpacity style={styles.backupBtn} onPress={handleRestore}>
          <Ionicons name="cloud-download-outline" size={18} color={colors.warningText} />
          <Text style={[styles.backupBtnText, { color: colors.warningText }]}>Pulihkan Data</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'daily' && styles.tabBtnActive]}
            onPress={() => setActiveTab('daily')}
          >
            <Ionicons name="today" size={18} color={activeTab === 'daily' ? colors.primary : colors.textLight} />
            <Text style={[styles.tabBtnText, activeTab === 'daily' && styles.tabBtnTextActive]}>Harian</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'monthly' && styles.tabBtnActive]}
            onPress={() => setActiveTab('monthly')}
          >
            <Ionicons name="calendar" size={18} color={activeTab === 'monthly' ? '#7B1FA2' : colors.textLight} />
            <Text style={[styles.tabBtnText, activeTab === 'monthly' && styles.tabBtnTextActive]}>Bulanan</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'daily' ? <DailyTab /> : <MonthlyTab />}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    backgroundColor: colors.cardBg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 60,
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
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: colors.textLight, fontWeight: '600', marginTop: 2 },
  backBtn: { 
    width: 44, height: 44, borderRadius: 14, 
    alignItems: 'center', justifyContent: 'center', 
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.divider,
  },

  // Backup Bar
  backupBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.cardBg, marginHorizontal: 16, marginBottom: 8,
    borderRadius: 16, paddingVertical: 10, paddingHorizontal: 16,
    borderWidth: 1, borderColor: colors.divider,
    elevation: 2, shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  backupBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 2,
  },
  backupBtnText: { fontSize: 13, fontWeight: '700' },

  // Tab Bar Redesign
  tabContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  tabBar: {
    flexDirection: 'row', 
    backgroundColor: colors.surface, 
    borderRadius: 16,
    padding: 4,
    gap: 4
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 10, borderRadius: 12,
  },
  tabBtnActive: {
    backgroundColor: colors.white,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  tabBtnText: { fontSize: 14, fontWeight: '700', color: colors.textLight },
  tabBtnTextActive: { color: colors.text },

  tabContent: { padding: 16, paddingBottom: 40 },

  // Navigator
  navigator: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary,
    borderRadius: 20, padding: 10, marginBottom: 16,
    elevation: 4, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8,
  },
  navArrow: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14,
  },
  navArrowDisabled: { opacity: 0.3 },
  navCenter: { flex: 1, alignItems: 'center' },
  navMainLabel: { fontSize: 18, fontWeight: '900', color: colors.white },
  navSubLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  // Filter Bar
  filterBar: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 16,
    backgroundColor: colors.cardBg, padding: 12, borderRadius: 16, gap: 10,
    borderWidth: 1, borderColor: colors.divider,
  },
  filterLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  filterChipTextActive: { color: colors.white },

  // Summary Grid
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  summaryCard: {
    flex: 1, minWidth: '45%', backgroundColor: colors.cardBg, borderRadius: 18, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    elevation: 2, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4,
  },
  summaryIconContainer: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  summaryTextContainer: { flex: 1 },
  summaryCardLabel: { fontSize: 11, color: colors.textLight, marginBottom: 2 },
  summaryCardValue: { fontSize: 14, fontWeight: '800' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Transaction Card
  txCard: {
    backgroundColor: colors.cardBg, borderRadius: 16, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border + '60',
    elevation: 2, shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  txCardBody: { flex: 1, padding: 12 },
  txCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  txBadge: { backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  txBadgeText: { fontSize: 12, fontWeight: '800', color: colors.textSecondary },
  txTimeContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  txTime: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  txProfit: { fontSize: 14, fontWeight: '800', color: colors.successText },
  txCancelBtn: { marginLeft: 4, padding: 2 },

  // ── Inline Cancel Panel ──────────────────────────────
  cancelPanel: {
    backgroundColor: '#FFF8E1',
    borderRadius: 14, padding: 14, marginTop: 2, marginBottom: 6,
    borderWidth: 1.5, borderColor: '#FFE082',
  },
  cancelPanelTitle: { fontSize: 14, fontWeight: '800', color: colors.warningText },
  cancelPanelSub: { fontSize: 12, color: colors.textSecondary, marginBottom: 10 },
  cancelPanelBtns: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  cancelPanelBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 12,
  },
  cancelPanelBtnGreen: { backgroundColor: '#2E7D32' },
  cancelPanelBtnRed: { backgroundColor: '#C62828' },
  cancelPanelBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  cancelPanelDismiss: { alignItems: 'center', paddingVertical: 4 },
  cancelPanelDismissText: { fontSize: 13, color: colors.primary, fontWeight: '600' },

  txItemsList: { backgroundColor: colors.background, borderRadius: 12, padding: 10, marginBottom: 10, gap: 6 },
  txItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  txItemName: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  txItemQty: { fontSize: 12, color: colors.textLight, marginHorizontal: 8 },
  txItemSubtotal: { fontSize: 13, fontWeight: '700', color: colors.primary },

  txCardBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.divider,
  },
  txTotalLabel: { fontSize: 12, color: colors.textLight, fontWeight: '600' },
  txTotalValue: { fontSize: 16, fontWeight: '900', color: colors.text },

  comparisonCard: { backgroundColor: colors.cardBg, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.divider },
  comparisonTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  comparisonRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  comparisonItem: { flex: 1, alignItems: 'center', backgroundColor: colors.background, padding: 12, borderRadius: 14 },
  comparisonLabel: { fontSize: 12, color: colors.textLight, marginBottom: 8, fontWeight: '600' },
  comparisonBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  comparisonBadgeText: { fontSize: 14, fontWeight: '800' },
  comparisonNa: { fontSize: 12, color: colors.textLight, fontStyle: 'italic' },

  topProdCard: { backgroundColor: colors.cardBg, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.divider },
  topProductRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  rankBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  rankText: { fontSize: 14, fontWeight: '900' },
  topProductInfo: { flex: 1 },
  topProductNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  topProductName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  topProductQty: { fontSize: 12, color: colors.textLight, fontWeight: '700', marginLeft: 8 },
  topProductBarTrack: { height: 6, backgroundColor: colors.surface, borderRadius: 3, overflow: 'hidden' },
  topProductBarFill: { height: '100%', borderRadius: 3 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyIconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 18, fontWeight: '700', color: colors.textSecondary },
  emptySub: { fontSize: 14, color: colors.textLight },
});

export default Report;
