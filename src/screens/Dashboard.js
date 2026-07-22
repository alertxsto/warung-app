import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Platform, StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getProducts, getDashboardStats, getTopProducts, getLast7DaysRevenue, getTotalDebt } from '../database/db';
import { formatRupiah, calculateTotalEstimatedProfit } from '../utils/calculations';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { loadTodayChatHistory } from '../utils/chatStorage';
import { loadStoreProfile } from '../utils/storeSettings';

const DAY_NAMES = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

// ─── Sub-components ───────────────────────────────────────────────────────────

// Quick Action Pill
const QuickActionButton = ({ icon, label, sublabel, color, onPress, badge }) => (
  <TouchableOpacity
    style={styles.quickActionBtn}
    onPress={onPress}
    activeOpacity={0.78}
  >
    <View style={[styles.quickActionIconBg, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon} size={24} color={color} />
      {badge ? (
        <View style={styles.quickActionBadge}>
          <Text style={styles.quickActionBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
    <Text style={styles.quickActionLabel} numberOfLines={1}>{label}</Text>
    {sublabel ? <Text style={styles.quickActionSub} numberOfLines={1}>{sublabel}</Text> : null}
  </TouchableOpacity>
);

// Bento Card Item
const BentoCard = ({ icon, iconColor, label, value, subtext, bg, onPress, borderAccent }) => (
  <TouchableOpacity
    style={[
      styles.bentoCard,
      bg && { backgroundColor: bg },
      borderAccent && { borderWidth: 1.5, borderColor: borderAccent }
    ]}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={0.78}
  >
    <View style={styles.bentoHeader}>
      <View style={[styles.bentoIconBg, { backgroundColor: (iconColor || colors.primary) + '15' }]}>
        <Ionicons name={icon} size={20} color={iconColor || colors.primary} />
      </View>
      {onPress && <Ionicons name="arrow-forward" size={16} color={colors.textLight} />}
    </View>
    <Text style={styles.bentoLabel}>{label}</Text>
    <Text style={[styles.bentoValue, iconColor && { color: iconColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
      {value}
    </Text>
    {subtext ? <Text style={styles.bentoSub} numberOfLines={1}>{subtext}</Text> : null}
  </TouchableOpacity>
);

// ─── Mini Bar Chart (7 Hari Terakhir) ────────────────────────────────────────
const MiniBarChart = ({ data }) => {
  const [selectedItem, setSelectedItem] = useState(null);

  if (!data || data.length === 0) return null;
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
  const today = new Date().toISOString().split('T')[0];

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="bar-chart" size={18} color={colors.primary} />
            <Text style={styles.chartTitle}>Omset 7 Hari Terakhir</Text>
          </View>
          {selectedItem && (
            <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary }}>
              {selectedItem.dayLabel}: {formatRupiah(selectedItem.revenue)}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.barsContainer}>
        {data.map((item, idx) => {
          const heightPct = item.revenue > 0 ? (item.revenue / maxRevenue) : 0;
          const isToday = item.date === today;
          const isSelected = selectedItem?.date === item.date;

          return (
            <TouchableOpacity
              key={idx}
              style={styles.barWrapper}
              onPress={() => setSelectedItem(isSelected ? null : item)}
              activeOpacity={0.7}
            >
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
                    isSelected && { backgroundColor: '#7B1FA2' }
                  ]}
                />
              </View>
              <Text style={[styles.barLabel, isToday && styles.barLabelToday, isSelected && { color: '#7B1FA2', fontWeight: '900' }]}>
                {item.dayLabel}
              </Text>
            </TouchableOpacity>
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
const SmartTips = ({ tips }) => {
  if (!tips || tips.length === 0) return null;
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Ionicons name="bulb" size={18} color="#F59E0B" />
        <Text style={styles.sectionCardTitle}>Catatan & Tips AI</Text>
      </View>
      {tips.map((t, idx) => (
        <View key={idx} style={[styles.tipRow, { backgroundColor: t.bg || colors.background }]}>
          <Ionicons name={t.icon || "information-circle"} size={20} color={t.color || colors.primary} style={{ marginRight: 10, marginTop: 1 }} />
          <Text style={[styles.tipText, { color: t.textColor || colors.text }]}>{t.text}</Text>
        </View>
      ))}
    </View>
  );
};

// ─── MAIN DASHBOARD SCREEN ────────────────────────────────────────────────────
const Dashboard = ({ navigation }) => {
  const [stats, setStats] = useState({ todayRevenue: 0, todayProfit: 0, monthRevenue: 0, monthProfit: 0, todayTxCount: 0 });
  const [productCount, setProductCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [outOfStockCount, setOutOfStockCount] = useState(0);
  const [estimatedProfit, setEstimatedProfit] = useState(0);
  const [topProducts, setTopProducts] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [tips, setTips] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [storeName, setStoreName] = useState('Warung Mamah');
  const [totalDebt, setTotalDebt] = useState(0);

  const loadAll = async () => {
    try {
      const [s, products, top, chart, chatMsgs, profile, debt] = await Promise.all([
        getDashboardStats(),
        getProducts(),
        getTopProducts(new Date().getFullYear(), new Date().getMonth() + 1),
        getLast7DaysRevenue(),
        loadTodayChatHistory(),
        loadStoreProfile(),
        getTotalDebt(),
      ]);
      setStoreName(profile.name || 'Warung Mamah');
      setTotalDebt(debt);

      setStats(s);
      setProductCount(products.length);
      setLowStockCount(products.filter(p => p.stock > 0 && p.stock <= 5).length);
      setOutOfStockCount(products.filter(p => p.stock <= 0).length);
      setEstimatedProfit(calculateTotalEstimatedProfit(products));
      setTopProducts(top);
      setChartData(chart);

      // Rekomendasi / Tips Otomatis
      const dynamicTips = [];
      const outOfStock = products.filter(p => p.stock <= 0);
      const lowStock = products.filter(p => p.stock > 0 && p.stock <= 5);

      if (outOfStock.length > 0) {
        dynamicTips.push({
          icon: 'alert-circle',
          color: colors.dangerText,
          bg: '#FFEBEE',
          textColor: colors.dangerText,
          text: `${outOfStock.length} barang habis (${outOfStock.slice(0,2).map(p=>p.name).join(', ')}${outOfStock.length>2?'...':''}). Segera kulakan!`,
        });
      } else if (lowStock.length > 0) {
        dynamicTips.push({
          icon: 'warning',
          color: colors.warningText,
          bg: '#FFF8E1',
          textColor: colors.warningText,
          text: `Stok ${lowStock.length} barang menipis (misal ${lowStock[0].name}: ${lowStock[0].stock} ${lowStock[0].unit||'pcs'}).`,
        });
      }

      if (s.todayTxCount === 0) {
        dynamicTips.push({
          icon: 'cart-outline',
          color: colors.primary,
          bg: '#E3F2FD',
          textColor: colors.primary,
          text: 'Belum ada transaksi hari ini. Buka layar Kasir saat ada yang beli!',
        });
      } else {
        dynamicTips.push({
          icon: 'trending-up',
          color: colors.successDark,
          bg: '#E8F5E9',
          textColor: colors.successDark,
          text: `Hari ini sudah ${s.todayTxCount}x transaksi. Untung: ${formatRupiah(s.todayProfit)}. Semangat Mamah!`,
        });
      }

      if (chatMsgs && chatMsgs.length > 0) {
        const lastAiMsg = [...chatMsgs].reverse().find(m => m.role === 'assistant');
        if (lastAiMsg && lastAiMsg.content) {
          const cleanTxt = lastAiMsg.content.split('\n\n')[0].trim();
          dynamicTips.unshift({
            icon: 'sparkles',
            color: '#7B1FA2',
            bg: '#F3E5F5',
            textColor: '#4A148C',
            text: `Pesan AI Iki: "${cleanTxt.slice(0, 80)}${cleanTxt.length > 80 ? '...' : ''}"`,
          });
        }
      }

      setTips(dynamicTips.slice(0, 3));
    } catch (e) {
      console.error('Error loading dashboard:', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 11 ? 'Selamat Pagi' : hour < 15 ? 'Selamat Siang' : hour < 18 ? 'Selamat Sore' : 'Selamat Malam';
  const todayLabel = `${DAY_NAMES[now.getDay()]}, ${now.getDate()} ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  const maskText = (val) => showBalance ? formatRupiah(val) : 'Rp •••••••';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >
      {/* === HERO HEADER === */}
      <View style={styles.hero}>
        <View style={{ height: Platform.OS === 'android' ? StatusBar.currentHeight ?? 28 : 44 }} />

        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroGreeting}>{greeting} <Ionicons name="hand-right" size={15} color="rgba(255,255,255,0.75)" /></Text>
            <Text style={styles.heroTitle}>{storeName}</Text>
            <Text style={styles.heroDate}>{todayLabel}</Text>
          </View>
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowBalance(prev => !prev)}
            activeOpacity={0.7}
          >
            <Ionicons name={showBalance ? "eye" : "eye-off"} size={18} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.eyeBtn, { marginLeft: 8 }]}
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>

        {/* Hero Card Balance */}
        <View style={styles.heroCard}>
          <View style={styles.heroCardTop}>
            <View>
              <Text style={styles.heroCardLabel}>Omset Hari Ini</Text>
              <Text style={styles.heroCardMainValue}>{maskText(stats.todayRevenue)}</Text>
            </View>
            <View style={styles.heroTxBadge}>
              <Text style={styles.heroTxBadgeText}>{stats.todayTxCount}x Transaksi</Text>
            </View>
          </View>

          <View style={styles.heroCardDivider} />

          <View style={styles.heroCardBottom}>
            <View style={styles.heroSubStat}>
              <Text style={styles.heroSubLabel}>Profit Hari Ini</Text>
              <Text style={styles.heroSubValueGreen}>{maskText(stats.todayProfit)}</Text>
            </View>
            <View style={styles.heroSubStat}>
              <Text style={styles.heroSubLabel}>Omset Bulan Ini</Text>
              <Text style={styles.heroSubValue}>{maskText(stats.monthRevenue)}</Text>
            </View>
          </View>
          {totalDebt > 100000 && (
            <View style={styles.debtWarningBanner}>
              <Ionicons name="warning" size={16} color={colors.warningText} />
              <Text style={styles.debtWarningText}>
                Total hutang pelanggan: {formatRupiah(totalDebt)}. Cek tab Hutang untuk detail.
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* === QUICK ACTIONS BAR (4 Pills Grid) === */}
      <View style={styles.quickActionsContainer}>
        <QuickActionButton
          icon="cart" label="Kasir" sublabel="Ngakasir"
          color={colors.primary} onPress={() => navigation.navigate('Cashier')}
        />
        <QuickActionButton
          icon="sparkles" label="Tanya AI" sublabel="AI Iki"
          color="#7B1FA2" onPress={() => navigation.navigate('AiAssistant')} badge="BARU"
        />
        <QuickActionButton
          icon="bar-chart" label="Laporan" sublabel="Riwayat"
          color="#00838F" onPress={() => navigation.navigate('Report')}
        />
        <QuickActionButton
          icon="cube" label="Stok Barang" sublabel="Kelola Rak"
          color="#E65100" onPress={() => navigation.navigate('ProductList')}
        />
        <QuickActionButton
          icon="wallet-outline" label="Hutang" sublabel="Pelanggan"
          color="#D32F2F" onPress={() => navigation.navigate('DebtManager')}
          badge={totalDebt > 0 ? `Rp${totalDebt >= 1000000 ? (totalDebt/1000000).toFixed(0)+'jt' : (totalDebt/1000).toFixed(0)+'rb'}` : null}
        />
      </View>

      {/* === BENTO GRID STATS (2x2 Grid) === */}
      <View style={styles.bentoSection}>
        <View style={styles.bentoRow}>
          <BentoCard
            icon="calendar-outline" iconColor={colors.primary}
            label="Omset Bulan Ini" value={maskText(stats.monthRevenue)}
            subtext={`Bulan ${MONTH_NAMES[now.getMonth()]}`}
          />
          <BentoCard
            icon="trending-up-outline" iconColor={colors.successDark}
            label="Untung Bulan Ini" value={maskText(stats.monthProfit)}
            subtext="Profit Bersih" bg="#E8F5E9"
          />
        </View>
        <View style={styles.bentoRow}>
          <BentoCard
            icon="wallet-outline" iconColor="#7B1FA2"
            label="Estimasi Untung Stok" value={maskText(estimatedProfit)}
            subtext={`${productCount} Jenis Produk`}
          />
          <BentoCard
            icon={outOfStockCount > 0 ? "alert-circle" : lowStockCount > 0 ? "warning" : "checkmark-circle"}
            iconColor={outOfStockCount > 0 ? colors.dangerText : lowStockCount > 0 ? colors.warningText : colors.successDark}
            label="Ketersediaan Stok"
            value={outOfStockCount > 0 ? `${outOfStockCount} Habis` : lowStockCount > 0 ? `${lowStockCount} Menipis` : 'Semua Aman'}
            subtext={outOfStockCount > 0 ? 'Segera kulakan' : lowStockCount > 0 ? 'Perlu restok' : 'Stok terisi'}
            bg={outOfStockCount > 0 ? colors.danger : lowStockCount > 0 ? colors.warning : '#F0FDF4'}
            borderAccent={outOfStockCount > 0 ? colors.dangerText : lowStockCount > 0 ? colors.warningText : undefined}
            onPress={() => navigation.navigate('ProductList', { initialFilter: 'Restok' })}
          />
        </View>
      </View>

      {/* === TOMBOL TAMBAH BARANG BARU === */}
      <TouchableOpacity
        style={styles.addBarBtn}
        onPress={() => navigation.navigate('AddEditProduct')}
        activeOpacity={0.8}
      >
        <View style={styles.addBarIconBg}>
          <Ionicons name="add-circle" size={24} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.addBarTitle}>Tambah Barang Baru</Text>
          <Text style={styles.addBarSub}>Daftarkan produk ke rak warung</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.white} />
      </TouchableOpacity>

      {/* === MINI BAR CHART (7 HARI TERAKHIR) === */}
      <MiniBarChart data={chartData} />

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

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },

  // Hero Header
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 8,
    marginBottom: 16,
  },
  heroGreeting: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginBottom: 2 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: colors.white, letterSpacing: -0.5 },
  heroDate: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2, fontWeight: '500' },
  eyeBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 4,
  },

  // Hero Financial Card
  heroCard: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroCardLabel: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  heroCardMainValue: { fontSize: 26, fontWeight: '900', color: colors.white, marginTop: 2 },
  heroTxBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  heroTxBadgeText: { fontSize: 12, fontWeight: '800', color: colors.white },
  heroCardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 12 },
  heroCardBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  heroSubStat: { flex: 1 },
  heroSubLabel: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 2 },
  heroSubValueGreen: { fontSize: 15, fontWeight: '800', color: '#A5D6A7' },
  heroSubValue: { fontSize: 15, fontWeight: '800', color: colors.white },

  // Quick Actions Bar (4 Pills)
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 16,
    gap: 8,
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border + '50',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  quickActionIconBg: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  quickActionLabel: { fontSize: 13, fontWeight: '700', color: colors.text, textAlign: 'center' },
  quickActionSub: { fontSize: 10, color: colors.textLight, marginTop: 1, textAlign: 'center' },
  quickActionBadge: {
    position: 'absolute', top: -3, right: -4,
    backgroundColor: '#D32F2F', borderRadius: 6,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  quickActionBadgeText: { fontSize: 8, fontWeight: '900', color: colors.white },

  // Bento Grid Stats
  bentoSection: { paddingHorizontal: 16, marginBottom: 14, gap: 10 },
  bentoRow: { flexDirection: 'row', gap: 10 },
  bentoCard: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border + '60',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  bentoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bentoIconBg: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bentoLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginBottom: 4 },
  bentoValue: { fontSize: 16, fontWeight: '800', color: colors.text },
  bentoSub: { fontSize: 11, color: colors.textLight, marginTop: 3 },

  // Add Item Bar
  addBarBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: colors.primary,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  addBarIconBg: { marginRight: 12 },
  addBarTitle: { fontSize: 15, fontWeight: '800', color: colors.white },
  addBarSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },

  // Mini Bar Chart
  chartCard: {
    marginHorizontal: 16, marginBottom: 14, backgroundColor: colors.cardBg,
    borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border + '60',
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 5, elevation: 2,
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

  // Section Card
  sectionCard: {
    marginHorizontal: 16, marginBottom: 14, backgroundColor: colors.cardBg,
    borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border + '60',
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 5, elevation: 2,
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
    borderRadius: 12, marginBottom: 6,
  },
  tipText: { flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 20 },

  footerInfo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 12, paddingHorizontal: 16,
  },
  footerNote: {
    textAlign: 'center', fontSize: 12, color: colors.textLight,
  },
  debtWarningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF8E1', borderRadius: 12,
    marginTop: 12, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#FFE082',
  },
  debtWarningText: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.warningText },
});

export default Dashboard;
