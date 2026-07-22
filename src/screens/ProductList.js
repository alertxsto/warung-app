import React, { useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, Text, ActivityIndicator,
  TouchableOpacity, Alert, TextInput, Modal, StatusBar, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getProducts, updateProduct } from '../database/db';
import ProductCard from '../components/ProductCard';
import { colors } from '../theme/colors';
import { formatRupiah } from '../utils/calculations';

const LOW_STOCK = 5;

const ProductList = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('name');
  const [filterRestock, setFilterRestock] = useState(false);

  // Quick Stock Modal State
  const [quickStockModal, setQuickStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const loadProducts = async () => {
    setLoading(true);
    const data = await getProducts();
    setProducts(data);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { loadProducts(); }, []));

  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= LOW_STOCK).length;
  const outOfStockCount = products.filter(p => p.stock <= 0).length;
  const totalStockValue = products.reduce((s, p) => s + p.selling_price * p.stock, 0);

  const sorted = [...products].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'stock') return a.stock - b.stock;
    if (sortBy === 'profit') return (b.selling_price - b.modal_price) - (a.selling_price - a.modal_price);
    return 0;
  });

  const filtered = sorted.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRestock = filterRestock ? (p.stock <= LOW_STOCK) : true;
    return matchesSearch && matchesRestock;
  });

  const handleQuickStock = (product) => {
    setSelectedProduct(product);
    setQuickStockModal(true);
  };

  const changeStock = async (delta) => {
    if (!selectedProduct) return;
    const newStock = Math.max(0, selectedProduct.stock + delta);
    try {
      await updateProduct(selectedProduct.id, { ...selectedProduct, stock: newStock });
      // Update local state for immediate feedback
      setSelectedProduct(prev => ({ ...prev, stock: newStock }));
      loadProducts();
    } catch {
      Alert.alert('Error', 'Gagal mengubah stok');
    }
  };

  const SORT_OPTIONS = [
    { label: 'A–Z', value: 'name' },
    { label: 'Stok', value: 'stock' },
    { label: 'Untung', value: 'profit' },
  ];

  const renderHeader = () => (
    <>
      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{products.length}</Text>
          <Text style={styles.statLabel}>Total Barang</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, outOfStockCount > 0 && { color: '#FFCDD2' }]}>
            {outOfStockCount}
          </Text>
          <Text style={styles.statLabel}>Stok Habis</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, lowStockCount > 0 && { color: '#FFE082' }]}>
            {lowStockCount}
          </Text>
          <Text style={styles.statLabel}>Menipis</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { fontSize: 12 }]} numberOfLines={1}>
            {totalStockValue >= 1000000
              ? `${(totalStockValue / 1000000).toFixed(1)}jt`
              : `${(totalStockValue / 1000).toFixed(0)}rb`}
          </Text>
          <Text style={styles.statLabel}>Nilai Stok</Text>
        </View>
      </View>

      {/* Alert banner */}
      {(outOfStockCount > 0 || lowStockCount > 0) && !searchQuery && (
        <View style={[styles.alertBar, outOfStockCount > 0 && styles.alertBarDanger]}>
          <Ionicons name={outOfStockCount > 0 ? "close-circle" : "warning"} size={18} color={outOfStockCount > 0 ? colors.dangerText : colors.warningText} />
          <Text style={[styles.alertBarText, { color: outOfStockCount > 0 ? colors.dangerText : colors.warningText }]}>
            {outOfStockCount > 0 ? `${outOfStockCount} barang habis` : ''}{outOfStockCount > 0 && lowStockCount > 0 ? '  •  ' : ''}{lowStockCount > 0 ? `${lowStockCount} menipis` : ''}
          </Text>
          <TouchableOpacity onPress={() => setFilterRestock(true)}>
            <Text style={[styles.alertBarAction, { color: outOfStockCount > 0 ? colors.dangerText : colors.warningText }]}>Lihat →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Sort & filter bar */}
      <View style={styles.controlBar}>
        <View style={styles.sortGroup}>
          {SORT_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, sortBy === opt.value && styles.chipActive]}
              onPress={() => setSortBy(opt.value)}
            >
              <Text style={[styles.chipText, sortBy === opt.value && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.chip, styles.chipWarning, filterRestock && styles.chipWarningActive]}
            onPress={() => setFilterRestock(v => !v)}
          >
            <Ionicons name="warning-outline" size={13} color={filterRestock ? colors.white : colors.warningText} style={{ marginRight: 4 }} />
            <Text style={[styles.chipText, filterRestock && styles.chipTextActive]}>Restok</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.countLabel}>{filtered.length} barang</Text>
      </View>
    </>
  );

  const renderItem = ({ item }) => {
    const profit = item.selling_price - item.modal_price;
    const isOut = item.stock <= 0;
    const isLow = item.stock > 0 && item.stock <= LOW_STOCK;

    return (
      <View style={[styles.card, isOut && styles.cardOut, isLow && styles.cardLow]}>
        <View style={styles.cardBody}>
          {/* Top row */}
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardCategory}>{item.category || 'Umum'}</Text>
              <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
            </View>
            <View style={[
              styles.stockBadge,
              isOut && styles.stockBadgeOut,
              isLow && styles.stockBadgeLow,
            ]}>
              <Ionicons
                name={isOut ? "alert-circle" : isLow ? "warning" : "cube-outline"}
                size={13}
                color={isOut ? colors.dangerText : isLow ? colors.warningText : colors.primary}
                style={{ marginRight: 3 }}
              />
              <Text style={[
                styles.stockBadgeText,
                isOut && { color: colors.dangerText },
                isLow && { color: colors.warningText },
              ]}>
                {isOut ? 'Habis' : `Stok: ${item.stock} ${item.unit || 'pcs'}`}
              </Text>
            </View>
          </View>

          {/* Price row */}
          <View style={styles.cardPriceRow}>
            <View>
              <Text style={styles.cardPriceLabel}>Modal/{item.unit || 'pcs'}</Text>
              <Text style={styles.cardModalPrice}>{formatRupiah(item.modal_price)}</Text>
            </View>
            <View style={styles.cardArrow}>
              <Text style={styles.cardArrowText}>→</Text>
            </View>
            <View>
              <Text style={styles.cardPriceLabel}>Jual/{item.unit || 'pcs'}</Text>
              <Text style={styles.cardSellPrice}>{formatRupiah(item.selling_price)}</Text>
            </View>
            <View style={styles.cardProfitBadge}>
              <Text style={styles.cardProfitLabel}>Untung</Text>
              <Text style={[styles.cardProfitValue, { color: profit >= 0 ? colors.successText : colors.dangerText }]}>
                {formatRupiah(profit)}
              </Text>
            </View>
          </View>

          {/* Bottom row */}
          <View style={styles.cardBottom}>
            <TouchableOpacity style={styles.quickBtn} onPress={() => handleQuickStock(item)}>
              <Ionicons name="cube-outline" size={16} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.quickBtnText}>Ubah Stok</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => navigation.navigate('AddEditProduct', { product: item })}
            >
              <Ionicons name="pencil-outline" size={16} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
            <Text style={styles.headerTitle}>Stok Barang</Text>
            <Text style={styles.headerSub}>{products.length} Jenis Barang Tersedia</Text>
          </View>
          <View style={[styles.backBtn, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '20' }]}>
             <Ionicons name="cube" size={22} color={colors.primary} />
          </View>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrapper}>
        <Ionicons name="search" size={20} color={colors.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama barang..."
          placeholderTextColor={colors.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={[styles.list, { paddingBottom: 90 + insets.bottom }]}
        ListHeaderComponent={renderHeader}
        renderItem={renderItem}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 48 }} />
            : (
              <View style={styles.empty}>
                <Ionicons name="cube-outline" size={64} color={colors.textLight} />
                <Text style={styles.emptyText}>{searchQuery ? 'Barang tidak ditemukan' : 'Belum ada barang'}</Text>
                {!searchQuery && <Text style={styles.emptySub}>Tap "Tambah Barang" untuk memulai</Text>}
              </View>
            )
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddEditProduct')}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle" size={24} color={colors.white} style={{ marginRight: 8 }} />
          <Text style={styles.addBtnText}>Tambah Barang Baru</Text>
        </TouchableOpacity>
      </View>

      {/* QUICK STOCK MODAL */}
      <Modal 
        visible={quickStockModal} 
        transparent 
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setQuickStockModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setQuickStockModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.quickStockBox}>
            <View style={styles.quickStockHeader}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="cube" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.qsTitle}>Ubah Stok Cepat</Text>
                  <Text style={styles.qsProductName} numberOfLines={1}>{selectedProduct?.name}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setQuickStockModal(false)} style={styles.qsClose} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                 <Ionicons name="close-circle" size={32} color={colors.textLight} />
              </TouchableOpacity>
            </View>

            <View style={styles.qsBody}>
               <View style={styles.qsCurrentRow}>
                  <Text style={styles.qsCurrentLabel}>Stok Saat Ini:</Text>
                  <View style={[
                    styles.qsCurrentValueBox, 
                    (selectedProduct?.stock ?? 0) <= 0 && { backgroundColor: colors.danger },
                    (selectedProduct?.stock ?? 0) > 0 && (selectedProduct?.stock ?? 0) <= LOW_STOCK && { backgroundColor: colors.warning }
                  ]}>
                    <Text style={[
                      styles.qsCurrentValue,
                      (selectedProduct?.stock ?? 0) <= 0 && { color: colors.dangerText },
                      (selectedProduct?.stock ?? 0) > 0 && (selectedProduct?.stock ?? 0) <= LOW_STOCK && { color: colors.warningText }
                    ]}>
                      {selectedProduct?.stock ?? 0} <Text style={{ fontSize: 14 }}>{selectedProduct?.unit || 'pcs'}</Text>
                    </Text>
                  </View>
               </View>

               {/* Tambah per karung/bungkus (pakai items_per_bulk) */}
               {(selectedProduct?.items_per_bulk ?? 1) > 1 && (
                 <View style={{ marginBottom: 16 }}>
                   <Text style={[styles.qsActionLabel, { marginBottom: 8 }]}>
                     Tambah per {selectedProduct?.items_per_bulk} {selectedProduct?.unit} (1 karung/bungkus):
                   </Text>
                   <View style={{ flexDirection: 'row', gap: 10 }}>
                     <TouchableOpacity 
                       style={[styles.qsBtn, { backgroundColor: '#E3F2FD', flex: 1 }]} 
                       onPress={() => changeStock(-(selectedProduct?.items_per_bulk ?? 1))}
                     >
                       <Text style={[styles.qsBtnText, { color: '#1565C0', fontSize: 15 }]}>
                         −1 karung
                       </Text>
                     </TouchableOpacity>
                     <TouchableOpacity 
                       style={[styles.qsBtn, { backgroundColor: '#E8F5E9', flex: 1 }]} 
                       onPress={() => changeStock(selectedProduct?.items_per_bulk ?? 1)}
                     >
                       <Text style={[styles.qsBtnText, { color: colors.successText, fontSize: 15 }]}>
                         +1 karung
                       </Text>
                     </TouchableOpacity>
                   </View>
                 </View>
               )}

               <Text style={styles.qsActionLabel}>Tambah atau Kurangi Satuan:</Text>
               <View style={styles.qsGrid}>
                  <TouchableOpacity style={[styles.qsBtn, styles.qsBtnMinus]} onPress={() => changeStock(-5)}>
                    <Text style={styles.qsBtnText}>−5</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.qsBtn, styles.qsBtnMinus]} onPress={() => changeStock(-1)}>
                    <Text style={styles.qsBtnText}>−1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.qsBtn, styles.qsBtnPlus]} onPress={() => changeStock(1)}>
                    <Text style={styles.qsBtnText}>+1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.qsBtn, styles.qsBtnPlus]} onPress={() => changeStock(5)}>
                    <Text style={styles.qsBtnText}>+5</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.qsBtn, styles.qsBtnPlus]} onPress={() => changeStock(10)}>
                    <Text style={styles.qsBtnText}>+10</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.qsBtn, styles.qsBtnPlus]} onPress={() => changeStock(40)}>
                    <Text style={styles.qsBtnText}>+40</Text>
                  </TouchableOpacity>
               </View>
            </View>

            <TouchableOpacity style={styles.qsDoneBtn} onPress={() => setQuickStockModal(false)}>
              <Text style={styles.qsDoneText}>Selesai & Simpan</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    backgroundColor: colors.cardBg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 60,
    paddingBottom: 20, paddingHorizontal: 20,
    borderBottomLeftRadius: 30, borderBottomRightRadius: 30,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 8,
    marginBottom: 4,
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitleContainer: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: colors.textLight, fontWeight: '600', marginTop: 2 },
  backBtn: { 
    width: 44, height: 44, borderRadius: 14, 
    alignItems: 'center', justifyContent: 'center', 
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider 
  },

  // Search - rounded pill style
  searchWrapper: {
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: colors.cardBg,
    marginHorizontal: 14, marginVertical: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20,
    gap: 10,
    elevation: 4, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6,
    borderWidth: 1, borderColor: colors.divider,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 2 },

  // Stats bar - rounded card
  statsBar: {
    flexDirection: 'row', backgroundColor: colors.primary,
    marginHorizontal: 14, marginBottom: 10,
    paddingVertical: 14, paddingHorizontal: 16,
    alignItems: 'center', borderRadius: 20,
    elevation: 4, shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.white },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },

  // Alert bar - rounded card
  alertBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8E1',
    marginHorizontal: 14, marginBottom: 10, paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 16, gap: 10,
    borderWidth: 1.5, borderColor: '#FFE082',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4,
  },
  alertBarDanger: { backgroundColor: '#FCE4EC', borderColor: '#EF9A9A' },
  alertBarText: { flex: 1, fontSize: 13, fontWeight: '600' },
  alertBarAction: { fontSize: 13, fontWeight: '700' },

  // Control bar - floating card
  controlBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: colors.cardBg, marginHorizontal: 14, marginBottom: 12,
    borderRadius: 18, gap: 8,
    elevation: 2, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 5,
    borderWidth: 1, borderColor: colors.divider,
  },
  sortGroup: { flex: 1, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipWarning: { borderColor: colors.warningText },
  chipWarningActive: { backgroundColor: colors.warningText, borderColor: colors.warningText },
  chipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  countLabel: { fontSize: 12, color: colors.textLight, fontWeight: '600' },

  list: { paddingHorizontal: 12, paddingTop: 4 },

  // Product Card
  card: {
    backgroundColor: colors.cardBg, borderRadius: 20, marginBottom: 12,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: colors.border + '60'
  },
  cardOut: { opacity: 0.75, backgroundColor: '#FAFAFA' },
  cardLow: { borderWidth: 1.5, borderColor: '#FFE082' },
  cardBody: { flex: 1, padding: 16 },

  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardCategory: { fontSize: 10, fontWeight: '700', color: colors.textLight, textTransform: 'uppercase', marginBottom: 2 },
  cardName: { fontSize: 16, fontWeight: '700', color: colors.text, marginRight: 8 },

  stockBadge: { backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  stockBadgeOut: { backgroundColor: colors.danger },
  stockBadgeLow: { backgroundColor: colors.warning },
  stockBadgeText: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },

  cardPriceRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background,
    borderRadius: 14, padding: 12, marginBottom: 12, gap: 8,
  },
  cardPriceLabel: { fontSize: 10, color: colors.textLight, marginBottom: 2, fontWeight: '700' },
  cardModalPrice: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  cardSellPrice: { fontSize: 14, fontWeight: '800', color: colors.primary },
  cardArrow: { flex: 0 },
  cardArrowText: { fontSize: 18, color: colors.textLight },
  cardProfitBadge: {
    flex: 1, alignItems: 'flex-end', borderLeftWidth: 1, borderLeftColor: colors.divider, paddingLeft: 12,
  },
  cardProfitLabel: { fontSize: 10, color: colors.textLight, marginBottom: 2, fontWeight: '700' },
  cardProfitValue: { fontSize: 15, fontWeight: '900' },

  cardBottom: { flexDirection: 'row', gap: 8 },
  quickBtn: {
    flex: 1.2, backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 11,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.border,
  },
  quickBtnText: { fontSize: 13, color: colors.primary, fontWeight: '800' },
  editBtn: {
    flex: 1, backgroundColor: colors.primary + '15', borderRadius: 16, paddingVertical: 11,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.primary + '40',
  },
  editBtnText: { fontSize: 13, color: colors.primary, fontWeight: '800' },

  // Empty
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 18, fontWeight: '600', color: colors.textSecondary },
  emptySub: { fontSize: 13, color: colors.textLight },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16,
    paddingTop: 12, backgroundColor: colors.cardBg,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    elevation: 16, shadowColor: colors.shadow, shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 10,
  },
  addBtn: {
    backgroundColor: colors.primary, borderRadius: 18, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
  },
  addBtnText: { fontSize: 17, fontWeight: '800', color: colors.white },

  // QUICK STOCK MODAL
  modalOverlay: { 
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', 
    justifyContent: 'center', padding: 24 
  },
  quickStockBox: {
    backgroundColor: colors.cardBg, borderRadius: 28, padding: 20,
    elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 20,
  },
  quickStockHeader: { 
    flexDirection: 'row', justifyContent: 'space-between', 
    alignItems: 'center', marginBottom: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.divider
  },
  qsTitle: { fontSize: 13, fontWeight: '800', color: colors.primary, textTransform: 'uppercase' },
  qsProductName: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 4 },
  qsClose: { padding: 4, marginLeft: 8 },
  
  qsBody: { marginBottom: 20 },
  qsCurrentRow: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.background, padding: 14, borderRadius: 16, marginBottom: 18
  },
  qsCurrentLabel: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  qsCurrentValueBox: { backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  qsCurrentValue: { fontSize: 24, fontWeight: '900', color: colors.primary },
  
  qsActionLabel: { fontSize: 14, fontWeight: '700', color: colors.textLight, marginBottom: 12 },
  qsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  qsBtn: { 
    flex: 1, minWidth: '28%', height: 54, borderRadius: 14, 
    alignItems: 'center', justifyContent: 'center', elevation: 2
  },
  qsBtnMinus: { backgroundColor: '#FCE4EC' },
  qsBtnPlus: { backgroundColor: '#E8F5E9' },
  qsBtnText: { fontSize: 18, fontWeight: '800', color: colors.text },
  
  qsDoneBtn: {
    backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 14,
    alignItems: 'center', marginTop: 8
  },
  qsDoneText: { fontSize: 16, fontWeight: '800', color: colors.white },
});

export default ProductList;
