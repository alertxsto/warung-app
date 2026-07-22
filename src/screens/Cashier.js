import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, Alert, KeyboardAvoidingView, Platform, ScrollView, TextInput, StatusBar
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getProducts, addTransaction } from '../database/db';
import { formatRupiah } from '../utils/calculations';
import { colors } from '../theme/colors';

const SHORTCUTS = [500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];

const Cashier = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [receivedMoney, setReceivedMoney] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const loadProducts = async () => {
    const data = await getProducts();
    setProducts(data);
  };

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [])
  );

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addToCart = (product) => {
    if (product.stock <= 0) {
      Alert.alert('Stok Habis', 'Barang ini sedang kosong.');
      return;
    }
    // Unit berbasis berat/volume mulai dari 0.5, lainnya mulai 1
    const isDecimalUnit = ['liter','kg','ons','gram'].includes(product.unit);
    const startQty = isDecimalUnit ? 0.5 : 1;
    const step = isDecimalUnit ? 0.5 : 1;

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        const newQty = Math.round((existingItem.qty + step) * 100) / 100;
        if (newQty > product.stock) {
          Alert.alert('Stok Tidak Cukup', `Stok ${product.name} hanya tersisa ${product.stock} ${product.unit || 'pcs'}.`);
          return prevCart;
        }
        return prevCart.map(item =>
          item.id === product.id ? { ...item, qty: newQty } : item
        );
      } else {
        return [...prevCart, { ...product, qty: startQty, _step: step }];
      }
    });
    setModalVisible(false);
    setSearchQuery('');
  };

  const updateQty = (id, delta) => {
    setCart(prevCart =>
      prevCart.map(item => {
        if (item.id === id) {
          // Round ke 2 desimal untuk hindari floating point noise
          const newQty = Math.round((item.qty + delta) * 100) / 100;
          if (newQty > item.stock) {
            Alert.alert('Stok Tidak Cukup', `Stok tersisa hanya ${item.stock} ${item.unit || 'pcs'}.`);
            return item;
          }
          return { ...item, qty: newQty };
        }
        return item;
      }).filter(item => item.qty > 0)
    );
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.selling_price * item.qty), 0);
  const totalModal = cart.reduce((sum, item) => sum + (item.modal_price * item.qty), 0);
  const profit = totalAmount - totalModal;
  const receivedValue = parseInt(receivedMoney.replace(/\D/g, '')) || 0;
  const change = receivedValue - totalAmount;

  const handleShortcut = (val) => {
    const current = parseInt(receivedMoney.replace(/\D/g, '')) || 0;
    setReceivedMoney(String(current + val));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      Alert.alert('Keranjang Kosong', 'Tambahkan barang terlebih dahulu.');
      return;
    }
    if (receivedValue < totalAmount) {
      Alert.alert('Uang Kurang', `Kekurangan: ${formatRupiah(totalAmount - receivedValue)}`);
      return;
    }
    setLoading(true);
    try {
      await addTransaction(cart, totalAmount, totalModal, profit);
      Alert.alert('Transaksi Berhasil', `Kembalian: ${formatRupiah(change)}`, [
        { text: 'OK', onPress: () => { setCart([]); setReceivedMoney(''); } }
      ]);
      loadProducts();
    } catch (error) {
      Alert.alert('Error', 'Gagal menyimpan transaksi.');
    } finally {
      setLoading(false);
    }
  };

  const renderCartItem = ({ item }) => {
    const isDecimalUnit = ['liter','kg','ons','gram'].includes(item.unit);
    const step = item._step || (isDecimalUnit ? 0.5 : 1);
    const qtyDisplay = Number.isInteger(item.qty) ? item.qty : item.qty.toFixed(1);

    return (
      <View style={styles.cartItem}>
        <View style={styles.cartItemInfo}>
          <Text style={styles.cartItemName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cartItemPrice}>{formatRupiah(item.selling_price)} / {item.unit || 'pcs'}</Text>
        </View>
        <View style={styles.qtyContainer}>
          {/* Tombol -step (0.5 atau 1) */}
          <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, -step)}>
            <Text style={{ color: colors.white, fontSize: 16, fontWeight: '900' }}>{isDecimalUnit ? '−½' : '−'}</Text>
          </TouchableOpacity>
          <Text style={styles.qtyText}>{qtyDisplay}</Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, step)}>
            <Text style={{ color: colors.white, fontSize: 16, fontWeight: '900' }}>{isDecimalUnit ? '+½' : '+'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.subtotalContainer}>
          <Text style={styles.subtotalText}>{formatRupiah(item.selling_price * item.qty)}</Text>
          <TouchableOpacity onPress={() => removeFromCart(item.id)} style={styles.removeBtn}>
            <Ionicons name="trash-outline" size={18} color={colors.dangerText} />
          </TouchableOpacity>
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
            <Text style={styles.headerTitle}>Kasir (Ngakasir)</Text>
            <Text style={styles.headerSub}>{cart.length} Jenis Barang di Keranjang</Text>
          </View>
          <TouchableOpacity 
             onPress={() => cart.length > 0 && Alert.alert('Kosongkan Keranjang', 'Hapus semua isi keranjang?', [{text:'Batal'}, {text:'Ya, Hapus', onPress:()=>setCart([])}])}
             style={[styles.backBtn, { backgroundColor: colors.danger + '10', borderColor: colors.danger + '20' }]}
          >
             <Ionicons name="trash-outline" size={22} color={colors.dangerText} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <FlatList
          data={cart}
          keyExtractor={item => item.id.toString()}
          renderItem={renderCartItem}
          contentContainerStyle={styles.cartList}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="basket-outline" size={64} color={colors.textLight} />
              </View>
              <Text style={styles.emptyText}>Keranjang Kosong</Text>
              <Text style={styles.emptySubText}>Belum ada barang yang dipilih</Text>
            </View>
          }
        />

        {/* Bottom Panel - inside KAV agar naik bersama saat keyboard muncul */}
        <View style={styles.bottomPanel}>
          <TouchableOpacity style={styles.addItemBtn} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
            <Ionicons name="add-circle" size={24} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.addItemBtnText}>Pilih Barang (Tambah)</Text>
          </TouchableOpacity>

          <View style={styles.totalsCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Belanja</Text>
              <Text style={styles.totalValue}>{formatRupiah(totalAmount)}</Text>
            </View>
            
            <View style={styles.paymentSection}>
               <View style={styles.inputWrapper}>
                  <Text style={styles.currencyPrefix}>Rp</Text>
                  <TextInput
                    style={styles.paymentInput}
                    value={receivedMoney}
                    onChangeText={setReceivedMoney}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textLight}
                    returnKeyType="done"
                  />
                  {receivedMoney !== '' && (
                    <TouchableOpacity 
                      onPress={() => setReceivedMoney('')} 
                      style={styles.resetInputBtn}
                    >
                      <Ionicons name="close-circle" size={24} color={colors.dangerText} />
                    </TouchableOpacity>
                  )}
               </View>

               <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shortcutList} contentContainerStyle={styles.shortcutContent}>
                  <TouchableOpacity 
                    style={[styles.shortcutBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]} 
                    onPress={() => setReceivedMoney(String(totalAmount))}
                  >
                    <Text style={[styles.shortcutText, { color: colors.white }]}>Uang Pas</Text>
                  </TouchableOpacity>
                  {SHORTCUTS.map(val => (
                    <TouchableOpacity key={val} style={styles.shortcutBtn} onPress={() => handleShortcut(val)}>
                      <Text style={styles.shortcutText}>+{val >= 1000 ? `${val/1000}rb` : val}</Text>
                    </TouchableOpacity>
                  ))}
               </ScrollView>
            </View>

            {receivedMoney !== '' && (
              <View style={[
                styles.changeCard,
                { backgroundColor: change < 0 ? '#FCE4EC' : '#E8F5E9', borderColor: change < 0 ? '#EF9A9A' : '#A5D6A7' }
              ]}>
                <View style={styles.changeHeader}>
                   <Ionicons 
                    name={change < 0 ? "alert-circle" : "checkmark-circle"} 
                    size={20} 
                    color={change < 0 ? colors.dangerText : colors.successText} 
                  />
                  <Text style={[styles.changeLabel, { color: change < 0 ? colors.dangerText : colors.successText }]}>
                    {change < 0 ? 'Uang Kurang' : 'Kembalian'}
                  </Text>
                </View>
                <Text style={[styles.changeValue, { color: change < 0 ? colors.dangerText : colors.successText }]}>
                  {formatRupiah(Math.abs(change))}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.checkoutBtn, (loading || cart.length === 0) && { opacity: 0.6 }]}
            onPress={handleCheckout}
            disabled={loading || cart.length === 0}
          >
            <Ionicons name="checkmark-done" size={24} color={colors.white} style={{ marginRight: 8 }} />
            <Text style={styles.checkoutBtnText}>{loading ? 'Menyimpan...' : 'Selesaikan Transaksi'}</Text>
          </TouchableOpacity>

          <View style={{ height: insets.bottom > 0 ? insets.bottom : 12 }} />
        </View>
      </View>

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderElegan}>
               <View style={styles.modalHeaderTop}>
                  <TouchableOpacity onPress={() => { setModalVisible(false); setSearchQuery(''); }} style={styles.modalCloseBtn}>
                     <Ionicons name="close" size={26} color={colors.text} />
                  </TouchableOpacity>
                  <View style={styles.modalTitleContainer}>
                     <Text style={styles.modalTitleText}>Pilih Barang</Text>
                     <Text style={styles.modalSubTitleText}>Cari dan masukkan ke keranjang</Text>
                  </View>
               </View>
               
               <View style={styles.searchWrapperModal}>
                  <Ionicons name="search" size={18} color={colors.textLight} />
                  <TextInput
                    style={styles.searchInputModal}
                    placeholder="Cari nama barang..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus={true}
                  />
                  {searchQuery !== '' && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Ionicons name="close-circle" size={20} color={colors.textLight} />
                    </TouchableOpacity>
                  )}
               </View>
            </View>

            <FlatList
              data={filteredProducts}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={styles.modalList}
              renderItem={({ item }) => {
                const inCart = cart.find(c => c.id === item.id);
                const isOutOfStock = item.stock <= 0;
                return (
                  <TouchableOpacity
                    style={[styles.productItem, isOutOfStock && styles.productItemDisabled]}
                    onPress={() => !isOutOfStock && addToCart(item)}
                    activeOpacity={isOutOfStock ? 1 : 0.7}
                  >
                    <View style={styles.productItemLeft}>
                      <Text style={styles.productCategory}>{item.category || 'Umum'}</Text>
                      <Text style={[styles.productName, isOutOfStock && { color: colors.textLight }]}>{item.name}</Text>
                      <Text style={styles.productPrice}>{formatRupiah(item.selling_price)} / {item.unit || 'pcs'}</Text>
                    </View>
                    <View style={styles.productItemRight}>
                      <View style={[styles.modalStockBadge, isOutOfStock && { backgroundColor: '#FFEBEE' }]}>
                        <Text style={[styles.modalStockText, isOutOfStock && { color: colors.dangerText }]}>
                          {isOutOfStock ? 'Stok Habis' : `Stok: ${item.stock} ${item.unit || 'pcs'}`}
                        </Text>
                      </View>
                      {inCart && !isOutOfStock && (
                        <View style={styles.cartQtyBadge}>
                          <Text style={styles.cartQtyBadgeText}>{inCart.qty}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={48} color={colors.textLight} />
                  <Text style={styles.emptyText}>Barang tidak ditemukan</Text>
                </View>
              }
            />
          </View>
        </View>
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

  cartList: { padding: 16, paddingBottom: 24 },

  cartItem: {
    flexDirection: 'row', backgroundColor: colors.cardBg, padding: 12,
    borderRadius: 16, marginBottom: 10, alignItems: 'center',
    elevation: 2, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4,
  },
  cartItemInfo: { flex: 1, marginRight: 8 },
  cartItemName: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  cartItemPrice: { fontSize: 13, color: colors.textLight },
  
  qtyContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 8 },
  qtyBtn: { 
    backgroundColor: colors.primary, width: 30, height: 30, 
    borderRadius: 8, alignItems: 'center', justifyContent: 'center' 
  },
  qtyText: { fontSize: 16, fontWeight: '800', color: colors.text, minWidth: 22, textAlign: 'center' },
  
  subtotalContainer: { alignItems: 'flex-end', gap: 8, minWidth: 80 },
  subtotalText: { fontSize: 14, fontWeight: '800', color: colors.primary },
  removeBtn: { padding: 4 },

  emptyContainer: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyIconContainer: { 
    width: 100, height: 100, borderRadius: 50, 
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 12 
  },
  emptyText: { fontSize: 18, fontWeight: '700', color: colors.textSecondary },
  emptySubText: { fontSize: 14, color: colors.textLight },

  bottomPanel: {
    backgroundColor: colors.cardBg, paddingHorizontal: 16, paddingTop: 16,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    elevation: 20, shadowColor: colors.shadow, shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15, shadowRadius: 10,
  },
  addItemBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 12,
    marginBottom: 16, borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed',
  },
  addItemBtnText: { fontSize: 16, fontWeight: '800', color: colors.primary },

  totalsCard: {
    backgroundColor: colors.background, borderRadius: 20, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: colors.divider,
  },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  totalLabel: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  totalValue: { fontSize: 24, fontWeight: '900', color: colors.primary },

  paymentSection: { marginBottom: 12 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardBg,
    borderRadius: 14, paddingHorizontal: 16, borderWidth: 2, borderColor: colors.primary,
  },
  currencyPrefix: { fontSize: 18, fontWeight: '800', color: colors.primary, marginRight: 8 },
  paymentInput: { flex: 1, paddingVertical: 12, fontSize: 22, fontWeight: '900', color: colors.text },
  resetInputBtn: { padding: 4, marginLeft: 4 },

  shortcutList: { marginTop: 12 },
  shortcutContent: { gap: 8, paddingRight: 16 },
  shortcutBtn: {
    backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
  },
  shortcutText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },

  changeCard: {
    padding: 14, borderRadius: 14, borderWidth: 1.5, marginTop: 4,
  },
  changeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  changeLabel: { fontSize: 13, fontWeight: '700' },
  changeValue: { fontSize: 22, fontWeight: '900' },

  checkoutBtn: {
    backgroundColor: colors.successDark, borderRadius: 16, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: colors.successDark, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6,
  },
  checkoutBtnText: { fontSize: 18, fontWeight: '800', color: colors.white },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { 
    height: '92%', backgroundColor: colors.background, 
    borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' 
  },
  modalHeaderElegan: {
    backgroundColor: colors.cardBg,
    paddingTop: 20, paddingHorizontal: 20, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 4,
  },
  modalHeaderTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  modalCloseBtn: { 
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', 
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider 
  },
  modalTitleContainer: { marginLeft: 14 },
  modalTitleText: { fontSize: 20, fontWeight: '900', color: colors.text },
  modalSubTitleText: { fontSize: 13, color: colors.textLight, fontWeight: '600', marginTop: 2 },
  
  searchWrapperModal: {
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: colors.surface, borderRadius: 14, 
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.divider,
  },
  searchInputModal: { flex: 1, fontSize: 16, color: colors.text, marginLeft: 10 },

  modalList: { paddingBottom: 40 },
  productItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.cardBg, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  productItemDisabled: { opacity: 0.6, backgroundColor: colors.background },
  productItemLeft: { flex: 1, marginRight: 12 },
  productCategory: { fontSize: 9, fontWeight: '700', color: colors.textLight, textTransform: 'uppercase', marginBottom: 2 },
  productName: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  productPrice: { fontSize: 15, color: colors.primary, fontWeight: '700' },
  
  productItemRight: { alignItems: 'flex-end', gap: 6 },
  modalStockBadge: { backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  modalStockText: { fontSize: 12, fontWeight: '700', color: colors.textLight },
  cartQtyBadge: { 
    backgroundColor: colors.successText, width: 24, height: 24, 
    borderRadius: 12, alignItems: 'center', justifyContent: 'center' 
  },
  cartQtyBadgeText: { color: colors.white, fontSize: 12, fontWeight: '900' },
});

export default Cashier;
