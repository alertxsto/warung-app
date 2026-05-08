import { GROQ_API_KEY, GROQ_MODEL, GROQ_URL } from '../config';
import { getProducts, updateProduct, getDashboardStats } from '../database/db';
import { formatRupiah } from './calculations';

/**
 * Bangun system prompt dengan konteks produk saat ini
 */
const buildSystemPrompt = (products) => {
  const productList = products.map(p =>
    `- ID:${p.id} | ${p.name} | Stok: ${p.stock} ${p.unit || 'pcs'} | Jual: ${formatRupiah(p.selling_price)}/${p.unit || 'pcs'} | Modal: ${formatRupiah(p.modal_price)}`
  ).join('\n');

  return `Kamu adalah asisten warung bernama "AI Iki" — AI buatan Iki yang membantu Mamah mengelola warung.
Kamu membalas dalam bahasa Indonesia yang santai, singkat, dan ramah seperti berbicara dengan orang tua.
Kamu bisa sesekali menyebut nama "Mamah" untuk terasa lebih personal.

DAFTAR BARANG SAAT INI:
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
    "stock_delta": <angka positif=tambah, negatif=kurang>
  }
}

2. Tipe aksi yang tersedia:
   - "update_stock": tambah atau kurang stok (gunakan product_id dan stock_delta)
   - null: jika hanya menjawab pertanyaan tanpa mengubah data

3. Contoh input & output:
   Input: "tambah stok beras 2 karung" 
   → Cari produk beras, lihat items_per_bulk-nya, kalikan 2, lalu update_stock

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
 * Kirim pesan ke Groq dan parse hasilnya
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

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Response kosong dari AI');

  return JSON.parse(content);
};

/**
 * Eksekusi aksi dari AI ke database
 */
export const executeAiAction = async (action, products) => {
  if (!action || !action.type) return null;

  if (action.type === 'update_stock') {
    const product = products.find(p => p.id === action.product_id);
    if (!product) return '⚠️ Produk tidak ditemukan.';

    const newStock = Math.max(0, product.stock + action.stock_delta);
    await updateProduct(product.id, { ...product, stock: newStock });

    const verb = action.stock_delta > 0 ? 'ditambah' : 'dikurangi';
    return `✅ Stok ${product.name} berhasil ${verb} ${Math.abs(action.stock_delta)} ${product.unit || 'pcs'}. Sekarang: ${newStock} ${product.unit || 'pcs'}`;
  }

  return null;
};
