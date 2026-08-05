# 🏪 Kasir Pintar (warung-app)

> Aplikasi kasir & manajemen warung berbasis **Expo / React Native** — offline-first, data tersimpan lokal di perangkat.

**Kasir Pintar** adalah aplikasi point-of-sale (POS) ringan yang dibangun khusus untuk pemilik warung / toko kecil. Semua data (produk, transaksi, utang) disimpan **lokal di HP** via SQLite — tanpa perlu koneksi internet untuk operasional sehari-hari.

![Platform](https://img.shields.io/badge/platform-Android%20%7C%20iOS%20%7C%20Web-blue)
![React Native](https://img.shields.io/badge/React%20Native-0.81.5-61dafb)
![Expo](https://img.shields.io/badge/Expo-SDK%2054-black)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Fitur

- 🧾 **Kasir (Checkout)** — keranjang belanja, konfirmasi modal, stok berkurang otomatis
- 📦 **Manajemen Produk** — tambah/edit/hapus produk, harga modal & jual, stok, kategori, satuan (pcs/renteng/lusin), harga grosir
- 📊 **Dashboard** — omset & profit hari ini/bulan ini, grafik 7 hari terakhir, perbandingan bulan ini vs bulan lalu
- 📈 **Laporan** — laporan harian & bulanan, produk terlaris (top 5), detail item per transaksi
- 💸 **Manajemen Utang (Debt Manager)** — catat utang pelanggan, pembayaran parsial, status lunas/belum
- 🤖 **AI Assistant** — asisten kasir berbasis AI (OpenRouter, default `deepseek-chat-v4-flash:free`), riwayat chat tersimpan lokal
- 🗄️ **Backup & Restore** — export/import seluruh data ke file JSON (bisa dibagikan via WhatsApp)
- 📤 **Export CSV** — export laporan/data ke format CSV
- 🔁 **CI/CD Otomatis** — tag `v*` → GitHub Actions build APK (EAS local) → rilis otomatis ke GitHub Releases

## 🛠️ Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | [Expo SDK 54](https://expo.dev) |
| UI | React Native 0.81.5, React 19, React Navigation 7 (native-stack) |
| Database | expo-sqlite (SQLite + WAL), AsyncStorage |
| AI | OpenRouter API (chat completions) |
| CI/CD | GitHub Actions + EAS Build (local runner) |

## 🚀 Cara Menjalankan

### Prasyarat
- Node.js ≥ 20
- Expo CLI / akun Expo (untuk build EAS)

### Install & Run

```bash
# 1. Clone repo
git clone https://github.com/alertxsto/warung-app.git
cd warung-app

# 2. Install dependencies
npm install

# 3. Siapkan environment variables (opsional, untuk fitur AI)
cp .env.example .env
# Isi EXPO_PUBLIC_OPENROUTER_API_KEY dengan key dari https://openrouter.ai/keys

# 4. Jalankan
npm start          # Expo dev server
npm run android    # Buka di Android
npm run ios        # Buka di iOS (Mac)
npm run web        # Buka di browser
```

> Fitur AI Assistant butuh API key OpenRouter. Tanpa key, semua fitur kasir tetap berfungsi normal.

## 🔑 Environment Variables

| Variable | Deskripsi | Default |
|---|---|---|
| `EXPO_PUBLIC_OPENROUTER_API_KEY` | API key OpenRouter untuk AI Assistant | — |
| `EXPO_PUBLIC_AI_MODEL` | Model AI yang dipakai | `deepseek/deepseek-chat-v4-flash:free` |

## 📦 Build & Release

### Build APK manual (EAS local)

```bash
npx eas-cli build --platform android --profile preview --local --non-interactive --output=warung-app.apk
```

### Release otomatis via GitHub Actions

1. Push tag versi baru:
   ```bash
   git tag v1.0.4
   git push origin v1.0.4
   ```
2. Workflow `.github/workflows/build-apk.yml` otomatis build APK dan upload ke GitHub Releases.

Secrets yang dibutuhkan di repository:
- `EXPO_TOKEN` — token akun Expo (EAS)
- `EXPO_PUBLIC_OPENROUTER_API_KEY` — API key OpenRouter
- `EXPO_PUBLIC_AI_MODEL` — model AI (opsional)

## 🗂️ Struktur Proyek

```
warung-app/
├── App.js                    # Entry point & navigasi
├── app.json                  # Konfigurasi Expo
├── eas.json                  # Profil build EAS
├── src/
│   ├── components/           # Komponen UI reusable (ProductCard, CustomInput, BigButton)
│   ├── screens/              # 8 layar (Dashboard, Cashier, ProductList, Report, dll)
│   ├── database/db.js        # Inisialisasi SQLite, query, backup/restore
│   ├── theme/colors.js       # Tema warna
│   ├── utils/                # Helper (kalkulasi, CSV export, AI helper, chat storage)
│   └── config.js             # Konfigurasi AI (OpenRouter)
└── .github/workflows/        # CI/CD build APK otomatis
```

## 📝 Catatan

- Data tersimpan **100% lokal** di perangkat — tidak ada server. Gunakan fitur **Backup** di menu Settings secara rutin agar data aman.
- Versi aplikasi: `1.0.3-1` — paket Android: `com.mamah.warungapp`

## 🤝 Kontribusi

Pull request & issue sangat diterima! Untuk perubahan besar, buka issue dulu untuk diskusi.

## 📄 Lisensi

[MIT](LICENSE) © 2026 [Dwiky Candra](https://github.com/alertxsto)
