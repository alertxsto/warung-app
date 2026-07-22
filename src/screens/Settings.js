import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, StatusBar, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { loadStoreProfile, saveStoreProfile } from '../utils/storeSettings';

// ─── Field component ─────────────────────────────────────────────────────────
const FieldInput = ({ icon, label, value, onChangeText, placeholder, hint, multiline, keyboardType, maxLength }) => (
  <View style={styles.field}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {maxLength && (
        <Text style={{ fontSize: 11, color: colors.textLight, marginBottom: 4 }}>
          {value?.length || 0}/{maxLength}
        </Text>
      )}
    </View>
    {hint && <Text style={styles.fieldHint}>{hint}</Text>}
    <View style={[styles.fieldInputRow, multiline && { alignItems: 'flex-start', minHeight: 72 }]}>
      <Ionicons name={icon} size={18} color={colors.textLight} style={styles.fieldIcon} />
      <TextInput
        style={[styles.fieldInput, multiline && { flex: 1, minHeight: 72, textAlignVertical: 'top', paddingTop: 4 }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboardType || 'default'}
        maxLength={maxLength}
      />
    </View>
  </View>
);

const Settings = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState({
    name: '',
    tagline: '',
    address: '',
    phone: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadStoreProfile().then(setProfile);
    }, [])
  );

  const handleChange = (key, val) => {
    if (key === 'phone') {
      // Auto-format phone number: 0812-3456-7890
      let cleaned = val.replace(/\D/g, ''); // Hapus non-angka
      let formatted = cleaned;
      if (cleaned.length > 4) {
        formatted = cleaned.slice(0, 4) + '-' + cleaned.slice(4);
      }
      if (cleaned.length > 8) {
        formatted = formatted.slice(0, 9) + '-' + cleaned.slice(8);
      }
      setProfile(prev => ({ ...prev, [key]: formatted }));
    } else {
      setProfile(prev => ({ ...prev, [key]: val }));
    }
    setSaved(false);
  };

  const handleSave = async () => {
    if (!profile.name.trim()) {
      Alert.alert('Perhatian', 'Nama warung tidak boleh kosong.');
      return;
    }
    setSaving(true);
    await saveStoreProfile({ ...profile, name: profile.name.trim(), tagline: profile.tagline.trim() });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <StatusBar barStyle="dark-content" />

        {/* Header */}
        <View style={[styles.header, { paddingTop: (StatusBar.currentHeight || 24) + 10 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>Pengaturan Warung</Text>
            <Text style={styles.headerSub}>Sesuaikan profil toko Anda</Text>
          </View>
          <TouchableOpacity
            style={[styles.saveBtn, (saving || saved) && { backgroundColor: saved ? colors.successDark : colors.primary + '80' }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Ionicons
              name={saved ? 'checkmark' : 'save-outline'}
              size={18}
              color={colors.white}
            />
            <Text style={styles.saveBtnText}>{saved ? 'Tersimpan' : saving ? 'Menyimpan...' : 'Simpan'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Identitas Warung */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="storefront-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Identitas Toko</Text>
            </View>

            <View style={styles.previewCard}>
              <View style={styles.previewIconBox}>
                <Ionicons name="storefront" size={28} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.previewName} numberOfLines={1}>
                  {profile.name || 'Nama Warung'}
                </Text>
                <Text style={styles.previewTagline} numberOfLines={1}>
                  {profile.tagline || 'Tagline warung Anda'}
                </Text>
                {profile.address ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <Ionicons name="location-outline" size={12} color={colors.textLight} />
                    <Text style={styles.previewAddress} numberOfLines={1}>{profile.address}</Text>
                  </View>
                ) : null}
                {profile.phone ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Ionicons name="call-outline" size={12} color={colors.textLight} />
                    <Text style={styles.previewAddress} numberOfLines={1}>{profile.phone}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <FieldInput
              icon="storefront-outline"
              label="Nama Warung / Toko *"
              value={profile.name}
              onChangeText={v => handleChange('name', v)}
              placeholder="contoh: Warung Bu Sari"
              hint="Tampil pada struk belanja & header aplikasi"
              maxLength={30}
            />
            <FieldInput
              icon="chatbubble-ellipses-outline"
              label="Tagline / Pesan Penutup Struk"
              value={profile.tagline}
              onChangeText={v => handleChange('tagline', v)}
              placeholder="contoh: Terima kasih sudah berbelanja!"
              hint="Muncul di bawah struk WhatsApp"
              maxLength={60}
            />
          </View>

          {/* Kontak */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Informasi Kontak (Opsional)</Text>
            </View>
            <FieldInput
              icon="location-outline"
              label="Alamat Toko"
              value={profile.address}
              onChangeText={v => handleChange('address', v)}
              placeholder="contoh: Jl. Mawar No. 5, Bandung"
              multiline
            />
            <FieldInput
              icon="call-outline"
              label="Nomor Telepon / WhatsApp"
              value={profile.phone}
              onChangeText={v => handleChange('phone', v)}
              placeholder="contoh: 0812-3456-7890"
              keyboardType="phone-pad"
              maxLength={15}
            />
          </View>

          {/* Info Struk */}
          <View style={styles.infoBox}>
            <Ionicons name="receipt-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Pratinjau Struk WA</Text>
              <Text style={styles.infoText}>
                {`*${profile.name || 'Nama Warung'}*\nWaktu: 22/07/2026 09:00\n-----------------------------------\n• Contoh Barang\n  2 pcs x Rp 5.000 = Rp 10.000\n-----------------------------------\n*TOTAL:* Rp 10.000\nBayar: Rp 20.000\nKembalian: Rp 10.000\n\n${profile.tagline || 'Terima kasih sudah berbelanja!'}`}
              </Text>
            </View>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    backgroundColor: colors.cardBg,
    paddingBottom: 18, paddingHorizontal: 16,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    borderWidth: 1, borderColor: colors.border + '50',
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
    marginBottom: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  headerTitleBox: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
  headerSub: { fontSize: 12, color: colors.textLight, fontWeight: '600', marginTop: 1 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  saveBtnText: { color: colors.white, fontSize: 13, fontWeight: '800' },

  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  section: {
    backgroundColor: colors.cardBg, borderRadius: 20, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border + '50',
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text },

  previewCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.primary + '08', borderRadius: 14,
    padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.primary + '20',
  },
  previewIconBox: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center',
  },
  previewName: { fontSize: 16, fontWeight: '900', color: colors.text },
  previewTagline: { fontSize: 12, color: colors.textSecondary, fontWeight: '500', marginTop: 2 },
  previewAddress: { fontSize: 11, color: colors.textLight, fontWeight: '500' },

  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, marginBottom: 2 },
  fieldHint: { fontSize: 11, color: colors.textLight, marginBottom: 6 },
  fieldInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1.5,
    borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10,
  },
  fieldIcon: { marginRight: 10 },
  fieldInput: {
    flex: 1, fontSize: 14, color: colors.text, fontWeight: '600', padding: 0,
  },

  infoBox: {
    flexDirection: 'row', gap: 12,
    backgroundColor: colors.primary + '08', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.primary + '20', marginBottom: 8,
  },
  infoTitle: { fontSize: 13, fontWeight: '800', color: colors.primary, marginBottom: 8 },
  infoText: {
    fontSize: 12, color: colors.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 18,
  },
});

export default Settings;
