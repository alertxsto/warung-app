import React, { useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, Text, ActivityIndicator,
  TouchableOpacity, Alert, TextInput, Modal, StatusBar, Platform, ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getProducts, updateProduct } from '../database/db';
import { colors } from '../theme/colors';
import { formatRupiah } from '../utils/calculations';

const LOW_STOCK = 5;
const CATEGORIES = ['Semua', '⚠️ Restok', 'Sembako', 'Snack', 'Minuman', 'Sabun/Deterjen', 'Rokok', 'Obat', 'Lainnya'];

const ProductList = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('name');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [isGridMode, setIsGridMode] = useState(false); // Mode tampilan (Compact List vs Grid)

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
    let matchesCategory = true;
    if (selectedCategory === '⚠️ Restok') {
      matchesCategory = p.stock <= LOW_STOCK;
    } else if (selectedCategory !== 'Semua') {
      matchesCategory = p.category === selectedCategory;
    }
    return matchesSearch && matchesCategory;
  });

  const handleInlineStockChange = async (product, delta) => {
    const newStock = Math.max(0, product.stock + delta);
    try {
      await updateProduct(product.id, { ...product, stock: newStock });
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock: newStock } : p));
    } catch {
      Alert.alert('Error', 'Gagal mengubah stok');
    }
  };

  const handleQuickStock = (product) => {
    setSelectedProduct(product);
    setQuickStockModal(true);
  };

  const changeStock = async (delta) => {
    if (!selectedProduct) return;
    const newStock = Math.max(0, selectedProduct.stock + delta);
    try {
      await updateProduct(selectedProduct.id, { ...selectedProduct, stock: newStock });
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
      {/* Summary Cards */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{products.length}</Text>
          <Text style={styles.statLabel}>Total Barang</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, outOfStockCount > 0 && { color: colors.dangerText }]}>
            {outOfStockCount}
          </Text>
          <Text style={styles.statLabel}>Stok Habis</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, lowStockCount > 0 && { color: colors.warningText }]}>
            {lowStockCount}
          </Text>
          <Text style={styles.statLabel}>Menipis</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { fontSize: 13 }]} numberOfLines={1}>
            {totalStockValue >= 1000000
              ? `${(totalStockValue / 1000000).toFixed(1)}jt`
              : `${(totalStockValue / 1000).toFixed(0)}rb`}
          </Text>
          <Text style={styles.statLabel}>Nilai Stok</Text>
        </View>
      </View>

      {/* Category Pills Filter Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryContent}>
        {CATEGORIES.map(cat => {
          const isSelected = selectedCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryTab, isSelected && styles.categoryTabActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.categoryTabText, isSelected && styles.categoryTabTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Sort & Layout View Switcher */}
      <View style={styles.controlBar}>
        <View style={styles.sortGroup}>
          <Text style={styles.sortGroupLabel}>Urut:</Text>
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
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.countLabel}>{filtered.length} barang</Text>
          {/* Mode Switcher */}
          <TouchableOpacity
            style={styles.viewModeBtn}
            onPress={() => setIsGridMode(prev => !prev)}
          >
            <Ionicons name={isGridMode ? "list" : "grid-outline"} size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  // Compact Row Item (Super Dense & Fast)
  const renderCompactItem = ({ item }) => {
    const profit = item.selling_price - item.modal_price;
    const isOut = item.stock <= 0;
    const isLow = item.stock > 0 && item.stock <= LOW_STOCK;
    const isDecimalUnit = ['liter','kg','ons','gram'].includes(item.unit);
    const step = isDecimalUnit ? 0.5 : 1;

    return (
      <View style={[styles.compactRow, isOut && styles.compactRowOut, isLow && styles.compactRowLow]}>
        {/* Left Info Column */}
        <View style={styles.compactLeft}>
          <View style={styles.compactTitleRow}>
            <Text style={styles.compactName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.compactCategoryBadge}>{item.category || 'Umum'}</Text>
          </View>
          <View style={styles.compactMetaRow}>
            <Text style={styles.compactPrice}>{formatRupiah(item.selling_price)}/{item.unit || 'pcs'}</Text>
            <Text style={styles.compactDot}>•</Text>
            <Text style={styles.compactModal}>Modal {formatRupiah(item.modal_price)}</Text>
            <Text style={styles.compactDot}>•</Text>
            <Text style={[styles.compactProfit, { color: profit >= 0 ? colors.successDark : colors.dangerText }]}>
              +{formatRupiah(profit)}
            </Text>
          </View>
        </View>

        {/* Right Stepper & Edit Actions */}
        <View style={styles.compactRight}>
          <View style={[styles.inlineStepper, isOut && styles.inlineStepperOut, isLow && styles.inlineStepperLow]}>
            <TouchableOpacity style={styles.inlineStepBtn} onPress={() => handleInlineStockChange(item, -step)}>
              <Text style={styles.inlineStepBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={[
              styles.inlineStepValue,
              isOut && { color: colors.dangerText },
              isLow && { color: colors.warningText },
            ]}>
              {item.stock} {item.unit || 'pcs'}
            </Text>
            <TouchableOpacity style={styles.inlineStepBtn} onPress={() => handleInlineStockChange(item, step)}>
              <Text style={styles.inlineStepBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.iconEditBtn}
            onPress={() => navigation.navigate('AddEditProduct', { product: item })}
          >
            <Ionicons name="pencil" size={16} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconMoreBtn}
            onPress={() => handleQuickStock(item)}
          >
            <Ionicons name="ellipsis-vertical" size={16} color={colors.textLight} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Grid Card Item
  const renderGridItem = ({ item }) => {
    const profit = item.selling_price - item.modal_price;
    const isOut = item.stock <= 0;
    const isLow = item.stock > 0 && item.stock <= LOW_STOCK;
    const isDecimalUnit = ['liter','kg','ons','gram'].includes(item.unit);
    const step = isDecimalUnit ? 0.5 : 1;

    return (
      <View style={[styles.gridCard, isOut && styles.compactRowOut, isLow && styles.compactRowLow]}>
        <View style={styles.gridTop}>
          <Text style={styles.compactCategoryBadge}>{item.category || 'Umum'}</Text>
          <Text style={styles.compactName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.compactPrice}>{formatRupiah(item.selling_price)}/{item.unit || 'pcs'}</Text>
        </View>

        <View style={styles.gridBottom}>
          <View style={styles.inlineStepper}>
            <TouchableOpacity style={styles.inlineStepBtn} onPress={() => handleInlineStockChange(item, -step)}>
              <Text style={styles.inlineStepBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.inlineStepValue}>{item.stock} {item.unit || 'pcs'}</Text>
            <TouchableOpacity style={styles.inlineStepBtn} onPress={() => handleInlineStockChange(item, step)}>
              <Text style={styles.inlineStepBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.iconEditBtn}
            onPress={() => navigation.navigate('AddEditProduct', { product: item })}
          >
            <Ionicons name="pencil" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Stok Barang</Text>
            <Text style={styles.headerSub}>{products.length} Jenis Barang Tersedia</Text>
          </View>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={() => navigation.navigate('AddEditProduct')}
          >
             <Ionicons name="add" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrapper}>
        <Ionicons name="search" size={18} color={colors.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama barang..."
          placeholderTextColor={colors.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          key={isGridMode ? 'GRID' : 'LIST'}
          data={filtered}
          numColumns={isGridMode ? 2 : 1}
          keyExtractor={item => item.id.toString()}
          renderItem={isGridMode ? renderGridItem : renderCompactItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={[styles.list, { paddingBottom: 80 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={56} color={colors.textLight} />
              <Text style={styles.emptyText}>Barang Tidak Ditemukan</Text>
              <Text style={styles.emptySubText}>Coba ganti kata kunci pencarian atau filter</Text>
            </View>
          }
        />
      )}

      {/* Quick Stock Options Modal */}
      <Modal visible={quickStockModal} transparent={true} animationType="fade">
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
                  <Text style={styles.qsTitle}>Opsi Stok & Grosir</Text>
                  <Text style={styles.qsProductName} numberOfLines={1}>{selectedProduct?.name}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setQuickStockModal(false)} style={styles.qsClose} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                 <Ionicons name="close-circle" size={30} color={colors.textLight} />
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
                      {selectedProduct?.stock} {selectedProduct?.unit || 'pcs'}
                    </Text>
                  </View>
               </View>

               {(selectedProduct?.items_per_bulk ?? 1) > 1 && (
                 <View style={styles.qsBulkBox}>
                   <Text style={styles.qsBulkLabel}>Format Grosir ({selectedProduct?.items_per_bulk} {selectedProduct?.unit || 'pcs'} / karung):</Text>
                   <View style={{ flexDirection: 'row', gap: 10 }}>
                     <TouchableOpacity 
                       style={[styles.qsBtn, { backgroundColor: '#E3F2FD', flex: 1 }]} 
                       onPress={() => changeStock(-(selectedProduct?.items_per_bulk ?? 1))}
                     >
                       <Text style={[styles.qsBtnText, { color: '#1565C0', fontSize: 14 }]}>
                         −1 grosir
                       </Text>
                     </TouchableOpacity>
                     <TouchableOpacity 
                       style={[styles.qsBtn, { backgroundColor: '#E8F5E9', flex: 1 }]} 
                       onPress={() => changeStock(selectedProduct?.items_per_bulk ?? 1)}
                     >
                       <Text style={[styles.qsBtnText, { color: colors.successText, fontSize: 14 }]}>
                         +1 grosir
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
                    <Text style={[styles.qsBtnText, styles.qsBtnTextPlus]}>+1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.qsBtn, styles.qsBtnPlus]} onPress={() => changeStock(5)}>
                    <Text style={[styles.qsBtnText, styles.qsBtnTextPlus]}>+5</Text>
                  </TouchableOpacity>
               </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    backgroundColor: colors.cardBg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 60,
    paddingBottom: 16, paddingHorizontal: 20,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    borderWidth: 1, borderColor: colors.border + '50',
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 4,
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitleContainer: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: colors.textLight, fontWeight: '600', marginTop: 2 },
  backBtn: { 
    width: 44, height: 44, borderRadius: 14, 
    alignItems: 'center', justifyContent: 'center', 
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border + '60'
  },

  searchWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardBg,
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border + '60',
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, shadowRadius: 4, elevation: 2,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: colors.text },

  statsBar: {
    flexDirection: 'row', backgroundColor: colors.cardBg,
    marginHorizontal: 16, marginTop: 6, marginBottom: 10, borderRadius: 16,
    paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border + '60',
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, shadowRadius: 4, elevation: 2,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 15, fontWeight: '900', color: colors.primary, marginBottom: 1 },
  statLabel: { fontSize: 10, color: colors.textLight, fontWeight: '600', textAlign: 'center' },
  statDivider: { width: 1, height: 24, backgroundColor: colors.divider },

  categoryScroll: { marginHorizontal: 16, marginBottom: 8 },
  categoryContent: { gap: 6, paddingRight: 16 },
  categoryTab: {
    backgroundColor: colors.cardBg, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border + '60',
  },
  categoryTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryTabText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  categoryTabTextActive: { color: colors.white },

  controlBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 8,
  },
  sortGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sortGroupLabel: { fontSize: 11, color: colors.textLight, fontWeight: '700', marginRight: 2 },
  chip: {
    backgroundColor: colors.cardBg, paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 9, borderWidth: 1, borderColor: colors.border + '60',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  countLabel: { fontSize: 11, color: colors.textLight, fontWeight: '700' },
  viewModeBtn: {
    backgroundColor: colors.cardBg, padding: 6, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border + '60',
  },

  list: { paddingHorizontal: 16, paddingTop: 2 },

  // Compact Row Styling (Ultra Dense & Efficient)
  compactRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.cardBg, borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border + '60',
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  compactRowOut: { opacity: 0.7, backgroundColor: '#FAFAFA' },
  compactRowLow: { borderWidth: 1.5, borderColor: '#FFE082' },

  compactLeft: { flex: 1, marginRight: 10 },
  compactTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  compactName: { fontSize: 15, fontWeight: '800', color: colors.text, flexShrink: 1 },
  compactCategoryBadge: {
    fontSize: 9, fontWeight: '700', color: colors.textLight,
    backgroundColor: colors.surface, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    textTransform: 'uppercase',
  },

  compactMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  compactPrice: { fontSize: 13, fontWeight: '800', color: colors.primary },
  compactDot: { fontSize: 10, color: colors.textLight },
  compactModal: { fontSize: 11, color: colors.textLight, fontWeight: '600' },
  compactProfit: { fontSize: 11, fontWeight: '800' },

  compactRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inlineStepper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: 10, paddingHorizontal: 4, paddingVertical: 2, gap: 4,
    borderWidth: 1, borderColor: colors.border + '50',
  },
  inlineStepperOut: { backgroundColor: '#FFEBEE', borderColor: '#FFCDD2' },
  inlineStepperLow: { backgroundColor: '#FFF8E1', borderColor: '#FFE082' },
  inlineStepBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: colors.cardBg, alignItems: 'center', justifyContent: 'center' },
  inlineStepBtnText: { fontSize: 14, fontWeight: '900', color: colors.primary },
  inlineStepValue: { fontSize: 12, fontWeight: '800', color: colors.text, paddingHorizontal: 2 },

  iconEditBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center',
  },
  iconMoreBtn: {
    width: 28, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },

  // Grid Card
  gridCard: {
    flex: 1, backgroundColor: colors.cardBg, borderRadius: 16, padding: 12, margin: 4,
    borderWidth: 1, borderColor: colors.border + '60', justifyContent: 'space-between',
  },
  gridTop: { marginBottom: 10 },
  gridBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  loadingContainer: { paddingVertical: 60, alignItems: 'center' },
  emptyContainer: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: colors.textSecondary },
  emptySubText: { fontSize: 13, color: colors.textLight },

  // Quick Stock Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  quickStockBox: { width: '100%', backgroundColor: colors.cardBg, borderRadius: 24, padding: 20, maxWidth: 360 },
  quickStockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  qsTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  qsProductName: { fontSize: 13, color: colors.textLight, fontWeight: '600', marginTop: 1 },
  qsClose: { padding: 2 },

  qsBody: { gap: 14 },
  qsCurrentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qsCurrentLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: '700' },
  qsCurrentValueBox: { backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  qsCurrentValue: { fontSize: 14, fontWeight: '800', color: colors.primary },

  qsBulkBox: { backgroundColor: colors.background, padding: 12, borderRadius: 14, gap: 8 },
  qsBulkLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  qsActionLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },
  qsGrid: { flexDirection: 'row', gap: 8 },
  qsBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  qsBtnMinus: { backgroundColor: '#FFEBEE', borderColor: '#FFCDD2' },
  qsBtnPlus: { backgroundColor: colors.primary, borderColor: colors.primary },
  qsBtnText: { fontSize: 15, fontWeight: '800', color: colors.dangerText },
  qsBtnTextPlus: { color: colors.white },
});

export default ProductList;
