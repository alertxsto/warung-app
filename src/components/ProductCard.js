import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { formatRupiah } from '../utils/calculations';

const LOW_STOCK_THRESHOLD = 5;

const ProductCard = ({ product, onPress }) => {
  const isProfitable = product.selling_price >= product.modal_price;
  const profitRp = product.selling_price - product.modal_price;
  const marginPct = product.modal_price > 0
    ? ((profitRp / product.modal_price) * 100).toFixed(0)
    : 0;
  const isLowStock = product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD;
  const isOutOfStock = product.stock <= 0;

  const stockColor = isOutOfStock ? colors.dangerText : isLowStock ? colors.warningText : colors.successText;
  const stockBg = isOutOfStock ? colors.danger : isLowStock ? colors.warning : colors.success;
  const accentColor = isProfitable ? colors.primary : colors.dangerText;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.78}>
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      <View style={styles.body}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
          <View style={[styles.stockBadge, { backgroundColor: stockBg }]}>
            {(isLowStock || isOutOfStock) && (
              <Ionicons
                name={isOutOfStock ? "alert-circle" : "warning"}
                size={14}
                color={stockColor}
                style={{ marginRight: 2 }}
              />
            )}
            <Text style={[styles.stockText, { color: stockColor }]}>
              {isOutOfStock ? 'Habis' : `Stok: ${product.stock}`}
            </Text>
          </View>
        </View>

        {/* Price Row */}
        <View style={styles.priceRow}>
          <View style={styles.priceCol}>
            <Text style={styles.priceLabel}>Modal</Text>
            <Text style={styles.priceValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{formatRupiah(product.modal_price)}</Text>
          </View>
          <View style={styles.priceDivider} />
          <View style={styles.priceCol}>
            <Text style={styles.priceLabel}>Harga Jual</Text>
            <Text style={[styles.priceValue, { color: isProfitable ? colors.primary : colors.dangerText }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {formatRupiah(product.selling_price)}
            </Text>
          </View>
          <View style={styles.priceDivider} />
          <View style={styles.priceCol}>
            <Text style={styles.priceLabel}>Untung/pcs</Text>
            <Text style={[styles.priceValue, { color: isProfitable ? colors.successText : colors.dangerText }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {formatRupiah(profitRp)}
            </Text>
            <Text style={[styles.marginPct, { color: isProfitable ? colors.successText : colors.dangerText }]}>{isProfitable ? '+' : ''}{marginPct}%</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    marginBottom: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  accentBar: {
    width: 5,
  },
  body: {
    flex: 1,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 3,
  },
  stockIcon: { fontSize: 11 },
  stockText: {
    fontSize: 13,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  priceCol: { flex: 1 },
  priceDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.divider,
    marginHorizontal: 6,
  },
  priceLabel: {
    fontSize: 11,
    color: colors.textLight,
    marginBottom: 3,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  marginPct: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default ProductCard;
