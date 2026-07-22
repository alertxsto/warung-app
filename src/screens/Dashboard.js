import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Platform, StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getProducts, getDashboardStats, getTopProducts, getLast7DaysRevenue } from '../database/db';
import { formatRupiah } from '../utils/calculations';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { loadTodayChatHistory } from '../utils/chatStorage';

const DAY_NAMES = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatCard = ({ icon, label, value, valueColor, bg }) => (
  <View style={[styles.statCard, bg && { backgroundColor: bg }]}>
    <Ionicons name={icon} size={24} color={valueColor || colors.primary} style={{ marginBottom: 4 }} />
    <Text style={styles.statCardLabel}>{label}</Text>
    <Text style={[styles.statCardValue, valueColor && { color: valueColor }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
  </View>
);

const MenuButton = ({ icon, label, sublabel, color, onPress, fullWidth, compact }) => (
  <TouchableOpacity
    style={[
      styles.menuBtn,
      fullWidth && styles.menuBtnFull,
      compact && styles.menuBtnCompact,
    ]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <View style={[styles.menuBtnIcon, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon} size={compact ? 24 : 28} color={color} />
    </View>
    <View style={styles.menuBtnText}>
      <Text style={[styles.menuBtnLabel, compact && { fontSize: 15 }]}>{label}</Text>
      {sublabel ? <Text style={styles.menuBtnSublabel} numberOfLines={1}>{sublabel}</Text> : null}
    </View>
    <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
  </TouchableOpacity>
);

// ─── Mini Bar Chart (7 Hari Terakhir) ────────────────────────────────────────
const MiniBarChart = ({ data }) => {
  if (!data || data.length === 0) return null;
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
  const today = new Date().toISOString().split('T')[0];

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="bar-chart" size={18} color={colors.primary} />
          <Text style={styles.chartTitle}>Omset 7 Hari Terakhir</Text>
        </View>
      </View>
      <View style={styles.barsContainer}>
        {data.map((item, idx) => {
          const heightPct = item.revenue > 0 ? (item.revenue / maxRevenue) : 0;
          const isToday = item.date === today;
          return (
            <View key={idx} style={styles.barWrapper}>
              <Text style={styles.barValue} numberOfLines={1}>
                {item.revenue > 0 ? (item.revenue >= 1000000
                  ? `${(item.revenue / 1000000).toFixed(1)}jt`
                  : `${(item.revenue / 1000).toFixed(0)}rb`) : ''}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { height: `${Math.max(heightPct * 100, item.revenue > 0 ? 8 : 0)}%` },
                    isToday && styles.barFillToday,
                  ]}
                />
              </View>
              <Text style={[styles.barLabel, isToday && styles.barLabelToday]}>{item.dayLabel}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// ─── Top Products ─────────────────────────────────────────────────────────────
const TopProductsSection = ({ data }) => {
  if (!data || data.length === 0) return null;
  const maxQty = Math.max(...data.map(d => d.total_qty), 1);

  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Ionicons name="trophy" size={18} color="#F59E0B" />
        <Text style={styles.sectionCardTitle}>Produk Terlaris Bulan Ini</Text>
      </View>
      {data.map((item, idx) => {
        const pct = (item.total_qty / maxQty) * 100;
        const colors_medal = ['#FFD700', '#C0C0C0', '#CD7F32', colors.primaryLight, colors.primaryLight];
        return (
          <View key={idx} style={styles.topProductRow}>
            <View style={[styles.topProductRank, { backgroundColor: colors_medal[idx] + '22' }]}>
               <Text style={[styles.topProductRankText, { color: idx < 3 ? colors_medal[idx] : colors.textLight }]}>{idx + 1}</Text>
            </View>
            <View style={styles.topProductInfo}>
              <View style={styles.topProductNameRow}>
                <Text style={styles.topProductName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.topProductQty}>{item.total_qty} pcs</Text>
              </View>
              <View style={styles.topProductBarTrack}>
                <View style={[styles.topProductBarFill, { width: `${pct}%`, backgroundColor: idx < 3 ? colors_medal[idx] : colors.primaryLight }]} />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

// ─── Smart Tips ───────────────────────────────────────────────────────────────
const generateTips = ({ stats, lowStockCount, outOfStockCount, products, chartData }) => {
  const tips = [];
  const now = new Date();
  const hour = now.getHours();

  // Salam waktu
  const greetingHour = hour < 12 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam';

  // Tip 1: Performance hari ini
  if (stats.todayTxCount >= 10) {
    tips.push({ icon: 'star', text: `Luar biasa! Sudah ${stats.todayTxCount} transaksi hari ini. Performa sangat bagus!`, color: '#1B5E20', bg: '#E8F5E9' });
  } else if (stats.todayTxCount === 0 && hour >= 10) {
    tips.push({ icon: 'rocket', text: 'Belum ada transaksi hari ini. Semangat, masih ada waktu!', color: '#E65100', bg: '#FFF3E0' });
  }

  // Tip 2: Margin check
  if (stats.monthRevenue > 0) {
    const margin = (stats.monthProfit / stats.monthRevenue) * 100;
    if (margin < 10) {
      tips.push({ icon: 'bulb', text: `Margin bulan ini ${margin.toFixed(1)}%. Coba pertimbangkan naikan harga jual beberapa barang.`, color: '#7B1FA2', bg: '#F3E5F5' });
    } else if (margin >= 20) {
      tips.push({ icon: 'trending-up', text: `Keren! Margin bulan ini ${margin.toFixed(1)}%. Toko berjalan dengan sangat sehat!`, color: '#1B5E20', bg: '#E8F5E9' });
    }
  }

  // Tip 3: Stok habis
  if (outOfStockCount > 0) {
    tips.push({ icon: 'alert-circle', text: `${outOfStockCount} barang stok habis. Segera restok agar tidak kehilangan pelanggan!`, color: '#B71C1C', bg: '#FCE4EC' });
  } else if (lowStockCount > 0) {
    tips.push({ icon: 'warning', text: `${lowStockCount} barang hampir habis (stok ≤5). Persiapkan restok sebelum kehabisan.`, color: '#E65100', bg: '#FFF3E0' });
  }

  // Tip 4: Hari ramai/sepi
  if (chartData && chartData.length === 7) {
    const todayData = chartData[6];
    const avg = chartData.slice(0, 6).reduce((s, d) => s + d.revenue, 0) / 6;
    if (avg > 0 && todayData.revenue > avg * 1.3) {
      tips.push({ icon: 'flash', text: 'Penjualan hari ini di atas rata-rata 6 hari terakhir. Hari yang bagus!', color: '#1565C0', bg: '#E3F2FD' });
    }
  }

  // Tip 5: Waktu istirahat
  if (hour >= 13 && hour <= 14) {
    tips.push({ icon: 'cafe', text: `Sudah ${greetingHour}! Jangan lupa istirahat dan makan siang ya.`, color: '#4E342E', bg: '#EFEBE9' });
  }

  // Default jika tidak ada tip
  if (tips.length === 0) {
    tips.push({ icon: 'thumbs-up', text: 'Semua berjalan baik! Tetap semangat dan jaga kesehatan.', color: '#1565C0', bg: '#E3F2FD' });
  }

  return tips.slice(0, 3); // Maksimal 3 tips
};

const SmartTips = ({ tips }) => {
  if (!tips || tips.length === 0) return null;
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Ionicons name="bulb" size={18} color={colors.primary} />
        <Text style={styles.sectionCardTitle}>Saran Hari Ini</Text>
      </View>
      {tips.map((tip, idx) => (
        <View key={idx} style={[styles.tipRow, { backgroundColor: tip.bg }, idx < tips.length - 1 && { marginBottom: 8 }]}>
          <Ionicons name={tip.icon} size={20} color={tip.color} style={{ marginRight: 10, marginTop: 2 }} />
          <Text style={[styles.tipText, { color: tip.color }]}>{tip.text}</Text>
        </View>
      ))}
    </View>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const Dashboard = ({ navigation }) => {
  const [stats, setStats] = useState({ todayRevenue: 0, todayProfit: 0, monthRevenue: 0, monthProfit: 0, todayTxCount: 0 });
  const [productCount, setProductCount] = useState(0);
  const [estimatedProfit, setEstimatedProfit] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [outOfStockCount, setOutOfStockCount] = useState(0);
  const [topProducts, setTopProducts] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [tips, setTips] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const now = new Date();
    // Sequential agar tidak ada concurrent SQLite queries → cegah crash Android
    const products = await getProducts();
    const dashStats = await getDashboardStats();
    const topProds = await getTopProducts(now.getFullYear(), now.getMonth() + 1);
    const chart = await getLast7DaysRevenue();

    setProductCount(products.length);
    const est = products.reduce((total, p) => total + ((p.selling_price - p.modal_price) * p.stock), 0);
    setEstimatedProfit(est);
    const low = products.filter(p => p.stock > 0 && p.stock <= 5).length;
    const out = products.filter(p => p.stock <= 0).length;
    setLowStockCount(low);
    setOutOfStockCount(out);
    setStats(dashStats);
    setTopProducts(topProds);
    setChartData(chart);

    // Generate tips with loaded data
    setTips(generateTips({
      stats: dashStats,
      lowStockCount: low,
      outOfStockCount: out,
      products,
      chartData: chart,
    }));
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Selamat Pagi' : hour < 15 ? 'Selamat Siang' : hour < 18 ? 'Selamat Sore' : 'Selamat Malam';
  const todayLabel = `${DAY_NAMES[now.getDay()]}, ${now.getDate()} ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  const timeLabel = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} WIB`;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >
      {/* === HERO HEADER (no nav bar) === */}
      <View style={styles.hero}>
        {/* Status bar safe area */}
        <View style={{ height: Platform.OS === 'android' ? StatusBar.currentHeight ?? 28 : 44 }} />

        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroGreeting}>{greeting} <Ionicons name="hand-right" size={16} color="rgba(255,255,255,0.75)" /></Text>
            <Text style={styles.heroTitle}>Warung Mamah</Text>
            <Text style={styles.heroDate}>{todayLabel}</Text>
          </View>
          <View style={styles.heroTimeBadge}>
            <Ionicons name="time-outline" size={14} color={colors.white} style={{ marginRight: 4 }} />
            <Text style={styles.heroTime}>{timeLabel}</Text>
          </View>
        </View>

        {/* Today Stats */}
        <View style={styles.heroStats}>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>{formatRupiah(stats.todayRevenue)}</Text>
            <Text style={styles.heroStatLabel}>Omset Hari Ini</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStatItem}>
            <Text style={[styles.heroStatValue, { color: '#A5D6A7' }]}>{formatRupiah(stats.todayProfit)}</Text>
            <Text style={styles.heroStatLabel}>Untung Hari Ini</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>{stats.todayTxCount}x</Text>
            <Text style={styles.heroStatLabel}>Transaksi</Text>
          </View>
        </View>
      </View>

      {/* === ALERT STOK === */}
      {(outOfStockCount > 0 || lowStockCount > 0) && (
        <TouchableOpacity
          style={styles.alertBanner}
          onPress={() => navigation.navigate('ProductList')}
          activeOpacity={0.85}
        >
          <View style={[styles.alertBannerIconContainer, { backgroundColor: outOfStockCount > 0 ? colors.danger + '44' : colors.warning + '44' }]}>
            <Ionicons name={outOfStockCount > 0 ? "close-circle" : "warning"} size={28} color={outOfStockCount > 0 ? colors.dangerText : colors.warningText} />
          </View>
          <View style={styles.alertBannerText}>
            {outOfStockCount > 0 && <Text style={styles.alertBannerTitle}>{outOfStockCount} barang stok habis!</Text>}
            {lowStockCount > 0 && <Text style={styles.alertBannerSub}>{lowStockCount} barang stok menipis (≤5)</Text>}
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.textLight} />
        </TouchableOpacity>
      )}

      {/* === MINI BAR CHART === */}
      <MiniBarChart data={chartData} />

      {/* === MENU UTAMA (Moved here) === */}
      <View style={styles.sectionLabelRow}>
        <Ionicons name="flash" size={16} color={colors.textSecondary} />
        <Text style={styles.sectionLabel}>Menu Utama</Text>
      </View>

      <MenuButton
        icon="cart" label="Kasir (Ngakasir)" sublabel="Catat transaksi & hitung kembalian"
        color={colors.primary} onPress={() => navigation.navigate('Cashier')} fullWidth
      />

      {/* Tombol AI */}
      <TouchableOpacity
        style={styles.aiBtn}
        onPress={() => navigation.navigate('AiAssistant')}
        activeOpacity={0.82}
      >
        <View style={styles.aiBtnIcon}>
          <Ionicons name="sparkles" size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.aiBtnLabel}>Tanya AI Iki</Text>
          <Text style={styles.aiBtnSub}>Tambah stok, cek untung, pakai bahasa biasa</Text>
        </View>
        <View style={styles.aiBtnBadge}>
          <Text style={styles.aiBtnBadgeText}>BARU</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.menuGrid}>
        <MenuButton icon="bar-chart" label="Laporan" sublabel="Lihat riwayat" color="#7B1FA2" onPress={() => navigation.navigate('Report')} compact />
        <MenuButton icon="list" label="Stok" sublabel="Kelola barang" color="#00838F" onPress={() => navigation.navigate('ProductList')} compact />
      </View>

      <MenuButton
        icon="add-circle" label="Tambah Barang Baru" sublabel="Daftarkan barang ke rak toko"
        color={colors.successDark} onPress={() => navigation.navigate('AddEditProduct')} fullWidth
      />

      {/* === BULAN INI === */}
      <View style={styles.sectionLabelRow}>
        <Ionicons name="calendar" size={16} color={colors.textSecondary} />
        <Text style={styles.sectionLabel}>Bulan {MONTH_NAMES[now.getMonth()]} {now.getFullYear()}</Text>
      </View>
      <View style={styles.statsRow}>
        <StatCard icon="cash" label="Total Omset" value={formatRupiah(stats.monthRevenue)} valueColor={colors.primary} />
        <StatCard icon="trending-up" label="Total Untung" value={formatRupiah(stats.monthProfit)} valueColor={colors.successText} bg={colors.success} />
      </View>

      {/* === ESTIMASI STOK === */}
      <View style={styles.estimateRow}>
        <View style={styles.estimateLeft}>
          <View style={styles.estimateIconContainer}>
            <Ionicons name="cube" size={24} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.estimateTitle}>Estimasi Nilai Stok</Text>
            <Text style={styles.estimateSub}>{productCount} jenis barang tersimpan</Text>
          </View>
        </View>
        <Text style={[styles.estimateValue, { color: estimatedProfit >= 0 ? colors.successText : colors.dangerText }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>
          {formatRupiah(estimatedProfit)}
        </Text>
      </View>

      {/* === TOP PRODUCTS === */}
      <TopProductsSection data={topProducts} />

      {/* === SMART TIPS === */}
      <SmartTips tips={tips} />

      <View style={styles.footerInfo}>
         <Ionicons name="refresh-circle" size={16} color={colors.textLight} />
         <Text style={styles.footerNote}>Tarik ke bawah untuk refresh data</Text>
      </View>
    </ScrollView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },

  // Hero (header tanpa nav bar)
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 25,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 12,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 10,
    marginBottom: 20,
  },
  heroGreeting: { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginBottom: 2 },
  heroTitle: { fontSize: 28, fontWeight: '900', color: colors.white, letterSpacing: -0.5 },
  heroDate: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2, fontWeight: '500' },
  heroTimeBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 4,
  },
  heroTime: { fontSize: 14, color: colors.white, fontWeight: '700' },
  heroStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 18,
    padding: 16,
  },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 16, fontWeight: '800', color: colors.white, marginBottom: 3 },
  heroStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.65)', textAlign: 'center' },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 4 },

  // Alert Banner
  alertBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE0B2',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  alertBannerIconContainer: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  alertBannerText: { flex: 1 },
  alertBannerTitle: { fontSize: 15, fontWeight: '700', color: colors.dangerText },
  alertBannerSub: { fontSize: 13, color: colors.warningText, marginTop: 1 },

  // Section Label
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 6,
  },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Stat Cards
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: colors.cardBg, borderRadius: 16, padding: 14,
    alignItems: 'center', shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 5, elevation: 3,
  },
  statCardIcon: { fontSize: 22, marginBottom: 5 },
  statCardLabel: { fontSize: 12, color: colors.textLight, marginBottom: 3 },
  statCardValue: { fontSize: 15, fontWeight: 'bold', color: colors.primary, textAlign: 'center' },

  // Estimate Row
  estimateRow: {
    marginHorizontal: 16, marginBottom: 14, backgroundColor: colors.cardBg,
    borderRadius: 16, padding: 14, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 5, elevation: 3,
  },
  estimateLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  estimateIconContainer: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: colors.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  estimateTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  estimateSub: { fontSize: 12, color: colors.textLight, marginTop: 1 },
  estimateValue: { fontSize: 16, fontWeight: '800' },

  // Mini Bar Chart
  chartCard: {
    marginHorizontal: 16, marginBottom: 14, backgroundColor: colors.cardBg,
    borderRadius: 18, padding: 16, shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 4,
  },
  chartHeader: { marginBottom: 14 },
  chartTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  barsContainer: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 6 },
  barWrapper: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barValue: { fontSize: 9, color: colors.textLight, marginBottom: 3, textAlign: 'center' },
  barTrack: {
    width: '100%', backgroundColor: colors.surface, borderRadius: 6,
    height: 72, justifyContent: 'flex-end', overflow: 'hidden',
  },
  barFill: { width: '100%', backgroundColor: colors.primaryLight, borderRadius: 6 },
  barFillToday: { backgroundColor: colors.primary },
  barLabel: { fontSize: 10, color: colors.textLight, marginTop: 5, fontWeight: '600' },
  barLabelToday: { color: colors.primary, fontWeight: '800' },

  // Section Card (shared for top products & tips)
  sectionCard: {
    marginHorizontal: 16, marginBottom: 14, backgroundColor: colors.cardBg,
    borderRadius: 18, padding: 16, shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14,
  },
  sectionCardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },

  // Top Products
  topProductRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  topProductRank: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  topProductRankText: { fontSize: 14, fontWeight: '900' },
  topProductInfo: { flex: 1 },
  topProductNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  topProductName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  topProductQty: { fontSize: 12, color: colors.textLight, fontWeight: '700', marginLeft: 8 },
  topProductBarTrack: { height: 6, backgroundColor: colors.surface, borderRadius: 4, overflow: 'hidden' },
  topProductBarFill: { height: '100%', borderRadius: 4 },

  // Smart Tips
  tipRow: {
    flexDirection: 'row', alignItems: 'flex-start', padding: 12,
    borderRadius: 12, marginBottom: 0,
  },
  tipIcon: { fontSize: 20, marginRight: 10, marginTop: 1 },
  tipText: { flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 20 },

  // Menu Buttons
  menuGrid: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 10 },
  menuBtn: {
    backgroundColor: colors.cardBg, borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
    borderWidth: 1, borderColor: colors.border + '60',
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
  },
  menuBtnFull: { marginHorizontal: 16 },
  menuBtnCompact: { flex: 1, marginBottom: 0, paddingVertical: 12 },
  menuBtnIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuBtnText: { flex: 1 },
  menuBtnLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  menuBtnSublabel: { fontSize: 12, color: colors.textLight, marginTop: 1 },

  footerInfo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 12, paddingHorizontal: 16,
  },
  footerNote: {
    textAlign: 'center', fontSize: 12, color: colors.textLight,
  },

  // AI Button
  aiBtn: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#EDE7F6',
    borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#7B1FA2' + '40',
    shadowColor: '#7B1FA2', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  aiBtnIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#7B1FA2' + '20',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  aiBtnLabel: { fontSize: 16, fontWeight: '800', color: '#4A148C' },
  aiBtnSub: { fontSize: 12, color: '#7B1FA2', marginTop: 2 },
  aiBtnBadge: {
    backgroundColor: '#D32F2F', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  aiBtnBadgeText: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
});

export default Dashboard;
