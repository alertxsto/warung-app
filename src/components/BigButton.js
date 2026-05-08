import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

const TYPE_MAP = {
  primary:  { bg: colors.primary,     shadow: colors.primaryDark },
  success:  { bg: colors.successDark, shadow: '#1B4D1C' },
  danger:   { bg: colors.dangerText,  shadow: '#7f0000' },
  outline:  { bg: 'transparent',      shadow: 'transparent' },
};

const BigButton = ({ title, onPress, type = 'primary', style, icon, disabled }) => {
  const t = TYPE_MAP[type] || TYPE_MAP.primary;
  const isOutline = type === 'outline';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: t.bg, shadowColor: t.shadow },
        isOutline && { borderWidth: 2, borderColor: colors.primary },
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      activeOpacity={disabled ? 1 : 0.82}
      disabled={disabled}
    >
      {icon ? (
        <View style={styles.iconRow}>
          <Text style={styles.icon}>{icon}</Text>
          <Text style={[styles.text, isOutline && { color: colors.primary }]}>{title}</Text>
        </View>
      ) : (
        <Text style={[styles.text, isOutline && { color: colors.primary }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: { fontSize: 18 },
  text: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  disabled: {
    opacity: 0.55,
    shadowOpacity: 0,
    elevation: 0,
  },
});

export default BigButton;
