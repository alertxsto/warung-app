import { AI_API_KEY, AI_MODEL, AI_URL } from '../config';
import { getProducts, updateProduct, getDashboardStats } from '../database/db';
import { formatRupiah } from './calculations';

/**
 * Bangun system prompt dengan konteks produk saat ini
 */
const buildSystemPrompt = (products) => {
  // Urutkan & prioritaskan produk (misal stok menipis dulu), serta batasi max 60 item untuk efisiensi token
  const sortedProducts = [...products].sort((a, b) => a.stock - b.stock);
  const displayProducts = sortedProducts.slice(0, 60);

  const productList = displayProducts.map(p => {
    const bulkInfo = p.items_per_bulk > 1 ? ` [1 grosir=${p.items_per_bulk} ${p.unit || 'pcs'}]` : '';
    return `- ID:${p.id} | ${p.name}${bulkInfo} | Stok: ${p.stock} ${p.unit || 'pcs'} | Jual: ${formatRupiah(p.selling_price)} | Modal: ${formatRupiah(p.modal_price)}`;
  }).join('\n');

  const truncatedNotice = products.length > 60 ? `\n(Menampilkan 60 dari total ${products.length} produk untuk efisiensi)` : '';

  return `Kamu adalah asisten warung bernama "AI Iki" — AI buatan Iki yang membantu Mamah mengelola warung.
Kamu membalas dalam bahasa Indonesia yang santai, singkat, dan ramah seperti berbicara dengan orang tua.
Kamu bisa sesekali menyebut nama "Mamah" untuk terasa lebih personal.

DAFTAR BARANG SAAT INI:${truncatedNotice}
${productList}

ATURAN PENTING:
1. Selalu balas dalam JSON VALID dengan format ini persis:
{
  "message": "Pesan untuk Mamah (bahasa Indonesia, singkat & ramah)",
  "action": null
}
ATAU jika ada aksi:
{
  "message": "Pesan untuk Mamah",
  "action": {
    "type": "update_stock",
    "product_id": <nomor ID produk>,
    "product_name": "<nama produk>",
    "stock_delta": <angka positif=tambah, negatif=kurang>
  }
}

2. Tipe aksi yang tersedia:
   - "update_stock": tambah atau kurang stok (gunakan product_id dan stock_delta)
   - null: jika hanya menjawab pertanyaan tanpa mengubah data

3. Contoh input & output:
   Input: "tambah stok beras 2 karung" 
   → Cari produk beras, lihat items_per_bulk-nya (cth: 25), kalikan 2 (=50), lalu update_stock dengan stock_delta: 50

   Input: "berapa untung hari ini?"
   → Jawab dari data statistik yang kamu tahu, action: null

   Input: "stok minyak berapa?"
   → Jawab dari daftar produk, action: null

4. JANGAN pernah membuat action jika tidak yakin produk mana yang dimaksud.
   Tanyakan klarifikasi jika ambigu.
5. Jika ada beberapa produk mirip namanya, sebutkan pilihannya ke Mamah.
6. Gunakan bahasa yang SANGAT SIMPEL — Mamah bukan orang IT.`;
};

/**
 * Kirim pesan ke OpenRouter API dan parse hasilnya
 */
export const sendToGroq = async (userMessage, conversationHistory = []) => {
  // Load produk terbaru setiap panggilan agar konteks selalu update
  const products = await getProducts();
  const stats = await getDashboardStats();

  // Inject stats ke pesan user sebagai konteks tambahan
  const contextualMessage = `${userMessage}

[KONTEKS OTOMATIS — jangan tampilkan ke user]
Omset hari ini: ${formatRupiah(stats.todayRevenue)}
Untung hari ini: ${formatRupiah(stats.todayProfit)}
Jumlah transaksi hari ini: ${stats.todayTxCount}x
Omset bulan ini: ${formatRupiah(stats.monthRevenue)}`;

  const messages = [
    { role: 'system', content: buildSystemPrompt(products) },
    ...conversationHistory.slice(-6), // Simpan 6 pesan terakhir sebagai konteks
    { role: 'user', content: contextualMessage },
  ];

  const response = await fetch(AI_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AI_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://warung-app.local',
      'X-Title': 'Warung App',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Response kosong dari AI');

  // Bersihkan pemformatan markdown block jika ada (misal ```json ... ```)
  content = content.trim();
  if (content.startsWith('```')) {
    content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }

  // Jika ada teks tambahan di luar JSON, ambil blok JSON { ... }
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    content = jsonMatch[0];
  }

  return JSON.parse(content);
};

export const sendToAi = sendToGroq;

export const executeAiAction = async (action, products) => {
  if (!action || !action.type) return null;

  if (action.type === 'update_stock') {
    let productList = products;
    if (!productList || productList.length === 0) {
      productList = await getProducts();
    }
    let product = null;

    // 1. Cari berdasarkan product_id (support number, string "1", atau "ID:1")
    if (action.product_id !== undefined && action.product_id !== null) {
      const rawIdStr = String(action.product_id).trim();
      const numericId = parseInt(rawIdStr.replace(/\D/g, ''), 10);

      product = productList.find(p =>
        p.id === action.product_id ||
        p.id === numericId ||
        String(p.id) === rawIdStr
      );
    }

    // 2. Fallback: Cari berdasarkan nama produk (fuzzy search) jika product_id tidak ketemu
    if (!product && (action.product_name || action.product_id)) {
      const query = String(action.product_name || action.product_id).toLowerCase().trim();
      product = productList.find(p => {
        const nameLower = p.name.toLowerCase();
        return nameLower.includes(query) || query.includes(nameLower);
      });
    }

    if (!product) {
      return `Gagal update stok: Produk tidak ditemukan di database.`;
    }

    const delta = Number(action.stock_delta || 0);
    const newStock = Math.max(0, product.stock + delta);
    await updateProduct(product.id, { ...product, stock: newStock });

    const verb = delta > 0 ? 'ditambah' : 'dikurangi';
    return `Stok ${product.name} berhasil ${verb} ${Math.abs(delta)} ${product.unit || 'pcs'}. Sekarang: ${newStock} ${product.unit || 'pcs'}`;
  }

  return null;
};
