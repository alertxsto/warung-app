import React, { useState, useEffect } from 'react';
import {
  View, ScrollView, StyleSheet, Text, Alert,
  KeyboardAvoidingView, Platform, TouchableOpacity, TextInput, StatusBar
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { calculateModalPrice, calculateMargin, formatRupiah } from '../utils/calculations';
import { addProduct, updateProduct, deleteProduct } from '../database/db';
import { Ionicons } from '@expo/vector-icons';

const CATEGORIES = ['Sembako', 'Snack', 'Minuman', 'Sabun/Deterjen', 'Rokok', 'Obat', 'Lainnya'];
const UNITS = ['pcs', 'liter', 'kg', 'ons', 'gram', 'batang', 'renceng', 'pak', 'botol', 'butir'];

// Label satuan beli (kebalikan dari unit jual)
const getBuyingUnit = (unit) => {
  const map = {
    liter: 'karung/jerigen',
    batang: 'bungkus/slop',
    kg: 'karung/sak',
    ons: 'pak',
    gram: 'pak',
    pcs: 'pak/dus',
    botol: 'dus',
    butir: 'pak',
    renceng: 'pak',
    pak: 'dus',
  };
  return map[unit] || 'bungkus';
};

// ─── Labelled Input ────────────────────────────────────────────────────────────
const Field = ({ label, hint, value, onChangeText, keyboardType = 'default', placeholder, autoFocus, error }) => (
  <View style={fieldStyles.wrapper}>
    <View style={fieldStyles.labelRow}>
      <Text style={fieldStyles.label}>{label}</Text>
      {hint ? <Text style={fieldStyles.hint}>{hint}</Text> : null}
    </View>
    <TextInput
      style={[fieldStyles.input, error && { borderColor: colors.dangerText, borderWidth: 2 }]}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      placeholder={placeholder}
      placeholderTextColor={colors.textLight}
      autoFocus={autoFocus}
      returnKeyType="next"
    />
  </View>
);

const fieldStyles = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  label: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  hint: { fontSize: 12, color: colors.textLight },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
const AddEditProduct = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const isEditing = !!route.params?.product;
  const product = route.params?.product || {};

  const [name, setName] = useState(product.name || '');
  const [category, setCategory] = useState(product.category || '');
  const [unit, setUnit] = useState(product.unit || 'pcs');
  const [bulkPrice, setBulkPrice] = useState(product.bulk_price ? product.bulk_price.toString() : '');
  const [itemsPerBulk, setItemsPerBulk] = useState(product.items_per_bulk ? product.items_per_bulk.toString() : '1');
  const [sellingPrice, setSellingPrice] = useState(product.selling_price ? product.selling_price.toString() : '');
  const [stock, setStock] = useState(product.stock ? product.stock.toString() : '');
  const [saving, setSaving] = useState(false);

  const [modalPrice, setModalPrice] = useState(product.modal_price || 0);
  const [margin, setMargin] = useState({ profitRp: 0, marginPercentage: 0, isProfitable: true });

  const [kgPerBulk, setKgPerBulk] = useState('');           // untuk konversi kg→liter
  // Standar: 1 liter beras = 0.753 kg → 1 kg = 1/0.753 ≈ 1.328 liter
  const KG_TO_LITER = 1 / 0.753;  // ≈ 1.328

  useEffect(() => {
    const bulk = parseFloat(bulkPrice) || 0;
    const items = parseFloat(itemsPerBulk) || 1;  // parseFloat untuk support desimal
    const sell = parseFloat(sellingPrice) || 0;
    const modal = calculateModalPrice(bulk, items);
    setModalPrice(modal);
    setMargin(calculateMargin(modal, sell));
  }, [bulkPrice, itemsPerBulk, sellingPrice]);

  // Auto-konversi kg → liter saat kgPerBulk berubah
  useEffect(() => {
    if (unit === 'liter' && kgPerBulk) {
      const kg = parseFloat(kgPerBulk) || 0;
      if (kg > 0) {
        setItemsPerBulk((kg * KG_TO_LITER).toFixed(1));
      }
    }
  }, [kgPerBulk, unit]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Perhatian', 'Nama barang tidak boleh kosong'); return; }
    if (!sellingPrice) { Alert.alert('Perhatian', 'Harga jual harus diisi'); return; }
    if (!stock) { Alert.alert('Perhatian', 'Jumlah stok harus diisi'); return; }

    const sell = parseFloat(sellingPrice) || 0;
    const saveProcess = async () => {
      setSaving(true);
      const formatTitle = str => str.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      const productData = {
        name: formatTitle(name),
        category: category.trim() || 'Umum',
        unit: unit.trim().toLowerCase() || 'pcs',
        bulk_price: parseFloat(bulkPrice) || 0,
        items_per_bulk: parseFloat(itemsPerBulk) || 1,  // parseFloat: support desimal (misal 29.5 liter/karung)
        modal_price: modalPrice,
        selling_price: sell,
        stock: parseFloat(stock) || 0,                   // parseFloat: support 0.5, 1.5 kg/liter
      };
      try {
        if (isEditing) {
          await updateProduct(product.id, productData);
          Alert.alert('Berhasil', 'Data barang berhasil diperbarui');
        } else {
          await addProduct(productData);
          Alert.alert('Berhasil', 'Barang berhasil ditambahkan!');
        }
        navigation.goBack();
      } catch {
        Alert.alert('Error', 'Gagal menyimpan data. Coba lagi.');
      } finally {
        setSaving(false);
      }
    };

    // Peringatan jika jual rugi (harga jual < modal)
    if (modalPrice > 0 && sell < modalPrice) {
      Alert.alert(
        'Peringatan Harga Rugi',
        `Harga jual (${formatRupiah(sell)}) lebih murah dibanding harga modal (${formatRupiah(modalPrice)}).\n\nApakah Anda yakin tetap ingin menyimpan data barang ini?`,
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Ya, Simpan', onPress: saveProcess }
        ]
      );
    } else {
      saveProcess();
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Hapus Barang',
      `Yakin ingin menghapus "${product.name}"?\n\nTindakan ini tidak dapat dibatalkan.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Hapus', style: 'destructive',
          onPress: async () => {
            try {
              await deleteProduct(product.id);
              navigation.goBack();
            } catch {
              Alert.alert('Error', 'Gagal menghapus data');
            }
          }
        }
      ]
    );
  };

  const profitColor = margin.isProfitable ? colors.successText : colors.dangerText;
  const profitBg = margin.isProfitable ? '#E8F5E9' : '#FCE4EC';
  const profitBorder = margin.isProfitable ? '#A5D6A7' : '#EF9A9A';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Premium Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{isEditing ? 'Edit Barang' : 'Barang Baru'}</Text>
            <Text style={styles.headerSub}>{isEditing ? 'Perbarui informasi produk' : 'Daftarkan produk ke toko'}</Text>
          </View>
          <View style={[styles.backBtn, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '20' }]}>
             <Ionicons name={isEditing ? "create" : "add-circle"} size={22} color={colors.primary} />
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 80}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingBottom: 72 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Identitas */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="pricetag" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Identitas Barang</Text>
            </View>
            <Field
              label="Nama Barang"
              value={name}
              onChangeText={setName}
              placeholder="Cth: Beras Pandan Wangi, Indomie..."
              autoFocus={!isEditing}
            />
            <View style={{ marginTop: 8 }}>
              <Text style={fieldStyles.label}>Pilih Kategori</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipList} contentContainerStyle={styles.chipContent}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity 
                    key={cat} 
                    style={[styles.chipBtn, category === cat && styles.chipBtnActive]} 
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={{ marginTop: 14 }}>
              <Text style={fieldStyles.label}>Pilih Satuan (Unit)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipList} contentContainerStyle={styles.chipContent}>
                {UNITS.map(u => (
                  <TouchableOpacity 
                    key={u} 
                    style={[styles.chipBtn, unit === u && styles.chipBtnActive]} 
                    onPress={() => setUnit(u)}
                  >
                    <Text style={[styles.chipText, unit === u && styles.chipTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Modal */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calculator" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Harga Modal / Harga Beli</Text>
            </View>
            {/* Info helper */}
            <View style={{ backgroundColor: colors.primary + '10', borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <Ionicons name="information-circle" size={18} color={colors.primary} />
              <Text style={{ flex: 1, fontSize: 12, color: colors.primary, fontWeight: '600', lineHeight: 18 }}>
                Isi harga beli 1 {getBuyingUnit(unit)} dan berapa {unit} isinya. Contoh: 1 {getBuyingUnit(unit)} beras berisi 25 {unit}.
              </Text>
            </View>

            {/* Konversi kg → liter (muncul hanya jika unit = liter) */}
            {unit === 'liter' && (
              <View style={{ backgroundColor: '#FFF8E1', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1.5, borderColor: '#FFE082' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Ionicons name="swap-horizontal" size={16} color={colors.warningText} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.warningText }}>Konversi Otomatis kg → liter</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10, lineHeight: 17 }}>
                  Isi berapa kg per karung, liter akan dihitung otomatis.
                  Standar: 1 liter beras ≈ 0.753 kg, jadi 1 kg ≈ 1.33 liter.
                  Atau isi langsung field "Isi (liter)" di bawah jika sudah tahu.
                </Text>
                <Field
                  label="Berat per karung (kg)"
                  hint="kg"
                  value={kgPerBulk}
                  onChangeText={setKgPerBulk}
                  keyboardType="decimal-pad"
                  placeholder="25"
                />
                {kgPerBulk ? (
                  <Text style={{ fontSize: 12, color: colors.warningText, fontWeight: '700', marginTop: -8 }}>
                  {parseFloat(kgPerBulk) || 0} kg ≈ {((parseFloat(kgPerBulk) || 0) / 0.753).toFixed(1)} liter per karung
                  </Text>
                ) : null}
              </View>
            )}

            <View style={styles.rowFields}>
              <View style={{ flex: 2, marginRight: 8 }}>
                <Field
                  label={`Harga 1 ${getBuyingUnit(unit)}`}
                  hint="Rp"
                  value={bulkPrice}
                  onChangeText={setBulkPrice}
                  keyboardType="numeric"
                  placeholder="100000"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label={`Isi (${unit})`}
                  value={itemsPerBulk}
                  onChangeText={setItemsPerBulk}
                  keyboardType="decimal-pad"
                  placeholder="25"
                />
              </View>
            </View>
            <View style={styles.resultBox}>
              <View style={styles.resultBoxLeft}>
                <Text style={styles.resultLabel}>Modal per {unit}</Text>
                <Text style={styles.resultSub}>
                  {bulkPrice && itemsPerBulk
                    ? `${formatRupiah(parseFloat(bulkPrice))} ÷ ${parseFloat(itemsPerBulk) || 1} ${unit}`
                    : `Isi harga beli & jumlah ${unit}`}
                </Text>
              </View>
              <Text style={styles.resultValue}>{formatRupiah(modalPrice)}</Text>
            </View>
          </View>

          {/* Jual */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="cash" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Harga Jual & Analisis</Text>
            </View>
            <Field
              label={`Harga Jual per ${unit}`}
              hint="Rp"
              value={sellingPrice}
              onChangeText={setSellingPrice}
              keyboardType="numeric"
              placeholder="3000"
              error={!margin.isProfitable && parseFloat(sellingPrice) > 0}
            />
            {(!margin.isProfitable && parseFloat(sellingPrice) > 0) && (
              <Text style={{ color: colors.dangerText, fontSize: 12, fontWeight: '600', marginTop: -6, marginBottom: 12 }}>
                ⚠️ Harga jual di bawah modal!
              </Text>
            )}
            {parseFloat(sellingPrice) > 0 && (
              <View style={[styles.marginCard, { backgroundColor: profitBg, borderColor: profitBorder }]}>
                <View style={styles.marginCardRow}>
                  <View style={styles.marginItem}>
                    <Text style={styles.marginItemLabel}>Modal</Text>
                    <Text style={[styles.marginItemValue, { color: colors.textSecondary }]}>{formatRupiah(modalPrice)}</Text>
                  </View>
                  <Text style={styles.marginArrow}>→</Text>
                  <View style={styles.marginItem}>
                    <Text style={styles.marginItemLabel}>Jual</Text>
                    <Text style={[styles.marginItemValue, { color: colors.primary }]}>{formatRupiah(parseFloat(sellingPrice) || 0)}</Text>
                  </View>
                  <View style={[styles.marginItem, { alignItems: 'flex-end' }]}>
                    <Text style={styles.marginItemLabel}>{margin.isProfitable ? 'Untung' : 'Rugi'}</Text>
                    <Text style={[styles.marginItemValue, { color: profitColor }]}>{formatRupiah(margin.profitRp)}</Text>
                  </View>
                </View>
                <View style={styles.marginPercentRow}>
                  <Ionicons
                    name={margin.isProfitable ? "trending-up" : "trending-down"}
                    size={15}
                    color={profitColor}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.marginPercent, { color: profitColor }]}>
                    Margin: {margin.marginPercentage}%
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Stok */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="cube" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Jumlah Stok</Text>
            </View>
            <Field
              label={`Stok Saat Ini (${unit})`}
              value={stock}
              onChangeText={setStock}
              keyboardType="decimal-pad"
              placeholder={unit === 'liter' || unit === 'kg' || unit === 'ons' || unit === 'gram' ? '0.5' : '40'}
            />
          </View>

          {isEditing && (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={18} color={colors.dangerText} style={{ marginRight: 6 }} />
              <Text style={styles.deleteBtnText}>Hapus Barang Ini</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={[styles.footerBar, { paddingBottom: 12 + insets.bottom }]}>
          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.65 }]} onPress={handleSave} disabled={saving}>
            <Ionicons
              name={saving ? "hourglass-outline" : isEditing ? "save-outline" : "add-circle-outline"}
              size={20}
              color={colors.white}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.saveBtnText}>
              {saving ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Tambah Barang'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  content: { padding: 16 },
  section: {
    backgroundColor: colors.cardBg, borderRadius: 18, padding: 16, marginBottom: 14,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14,
    paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  chipList: { marginTop: 4, marginHorizontal: -4 },
  chipContent: { paddingHorizontal: 4, gap: 8, paddingBottom: 4 },
  chipBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
  },
  chipBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  rowFields: { flexDirection: 'row' },
  resultBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginTop: 4,
  },
  resultBoxLeft: {},
  resultLabel: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  resultSub: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  resultValue: { fontSize: 22, fontWeight: '900', color: colors.primary },
  marginCard: { borderRadius: 14, padding: 14, borderWidth: 1.5, marginTop: 4 },
  marginCardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  marginItem: { flex: 1 },
  marginItemLabel: { fontSize: 11, color: colors.textLight, marginBottom: 3 },
  marginItemValue: { fontSize: 14, fontWeight: '800' },
  marginArrow: { fontSize: 18, color: colors.textLight, marginHorizontal: 6 },
  marginPercentRow: { paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.07)' },
  marginPercent: { fontSize: 14, fontWeight: '700' },
  deleteBtn: {
    borderWidth: 2, borderColor: colors.dangerText, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 4, marginBottom: 8,
  },
  deleteBtnText: { fontSize: 16, fontWeight: '700', color: colors.dangerText },
  footerBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16,
    paddingTop: 12, backgroundColor: colors.cardBg, borderTopWidth: 1, borderTopColor: colors.divider,
    elevation: 12, shadowColor: colors.shadow, shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 8,
  },
  saveBtn: {
    backgroundColor: colors.successDark, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', shadowColor: colors.successDark, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 5,
  },
  saveBtnText: { fontSize: 17, fontWeight: '800', color: colors.white },
});

export default AddEditProduct;
