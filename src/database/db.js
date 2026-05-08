import * as SQLite from 'expo-sqlite';

let db = null;

export const initDB = async () => {
  try {
    db = await SQLite.openDatabaseAsync('warung.db');
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        bulk_price REAL,
        items_per_bulk INTEGER,
        modal_price REAL NOT NULL,
        selling_price REAL NOT NULL,
        stock INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        total_amount REAL NOT NULL,
        total_modal REAL NOT NULL,
        profit REAL NOT NULL
      );
      CREATE TABLE IF NOT EXISTS transaction_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        modal REAL NOT NULL,
        subtotal REAL NOT NULL,
        FOREIGN KEY (transaction_id) REFERENCES transactions (id),
        FOREIGN KEY (product_id) REFERENCES products (id)
      );
    `);

    // Cek kolom baru di products (migration sederhana)
    const productsInfo = await db.getAllAsync("PRAGMA table_info(products)");
    const hasCategory = productsInfo.some(col => col.name === 'category');
    const hasUnit = productsInfo.some(col => col.name === 'unit');

    if (!hasCategory) {
      await db.execAsync("ALTER TABLE products ADD COLUMN category TEXT DEFAULT 'Umum';");
    }
    if (!hasUnit) {
      await db.execAsync("ALTER TABLE products ADD COLUMN unit TEXT DEFAULT 'pcs';");
    }

    console.log('Database initialized and migrated');
  } catch (error) {
    console.error('Error initializing database', error);
  }
};

export const getProducts = async () => {
  if (!db) return [];
  try {
    const result = await db.getAllAsync('SELECT * FROM products ORDER BY name ASC;');
    return result;
  } catch (error) {
    console.error('Error getting products', error);
    return [];
  }
};

export const addProduct = async (product) => {
  if (!db) return;
  try {
    const result = await db.runAsync(
      'INSERT INTO products (name, bulk_price, items_per_bulk, modal_price, selling_price, stock, category, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        product.name,
        product.bulk_price || null,
        product.items_per_bulk || 1,
        product.modal_price,
        product.selling_price,
        product.stock,
        product.category || 'Umum',
        product.unit || 'pcs'
      ]
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Error adding product', error);
    throw error;
  }
};

export const updateProduct = async (id, product) => {
  if (!db) return;
  try {
    await db.runAsync(
      'UPDATE products SET name = ?, bulk_price = ?, items_per_bulk = ?, modal_price = ?, selling_price = ?, stock = ?, category = ?, unit = ? WHERE id = ?',
      [
        product.name,
        product.bulk_price || null,
        product.items_per_bulk || 1,
        product.modal_price,
        product.selling_price,
        product.stock,
        product.category || 'Umum',
        product.unit || 'pcs',
        id
      ]
    );
  } catch (error) {
    console.error('Error updating product', error);
    throw error;
  }
};

export const deleteProduct = async (id) => {
  if (!db) return;
  try {
    await db.runAsync('DELETE FROM products WHERE id = ?', [id]);
  } catch (error) {
    console.error('Error deleting product', error);
    throw error;
  }
};

export const addTransaction = async (cart, totalAmount, totalModal, profit) => {
  if (!db) return;
  try {
    // Gunakan local datetime bukan UTC (toISOString() pakai UTC → tengah malam WIB jadi kemarin)
    const now = new Date();
    const pad2 = n => String(n).padStart(2, '0');
    const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}T${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;

    // Insert transaction
    const txResult = await db.runAsync(
      'INSERT INTO transactions (date, total_amount, total_modal, profit) VALUES (?, ?, ?, ?)',
      [date, totalAmount, totalModal, profit]
    );
    const transactionId = txResult.lastInsertRowId;

    // Insert transaction items and update stock
    for (const item of cart) {
      await db.runAsync(
        'INSERT INTO transaction_items (transaction_id, product_id, quantity, price, modal, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
        [transactionId, item.id, item.qty, item.selling_price, item.modal_price, item.selling_price * item.qty]
      );

      // Update stock
      await db.runAsync(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.qty, item.id]
      );
    }
    return transactionId;
  } catch (error) {
    console.error('Error adding transaction', error);
    throw error;
  }
};

export const getMonthlyReport = async (year, month) => {
  if (!db) return { totalRevenue: 0, totalProfit: 0, transactions: [] };
  try {
    const prefix = `${year}-${month}`;
    const transactions = await db.getAllAsync(
      "SELECT * FROM transactions WHERE date LIKE ? ORDER BY date DESC",
      [`${prefix}%`]
    );
    let totalRevenue = 0;
    let totalProfit = 0;
    transactions.forEach(t => {
      totalRevenue += t.total_amount;
      totalProfit += t.profit;
    });
    return { totalRevenue, totalProfit, transactions };
  } catch (error) {
    console.error('Error getting monthly report', error);
    return { totalRevenue: 0, totalProfit: 0, transactions: [] };
  }
};

export const getDailyReport = async (dateString) => {
  // dateString format: 'YYYY-MM-DD'
  if (!db) return { totalRevenue: 0, totalProfit: 0, transactions: [], totalItems: 0 };
  try {
    const transactions = await db.getAllAsync(
      "SELECT * FROM transactions WHERE date LIKE ? ORDER BY date DESC",
      [`${dateString}%`]
    );

    let totalRevenue = 0;
    let totalProfit = 0;
    const enriched = [];

    // Sequential (bukan Promise.all) agar tidak crash SQLite di Android
    for (const t of transactions) {
      const items = await db.getAllAsync(
        "SELECT ti.*, p.name FROM transaction_items ti LEFT JOIN products p ON ti.product_id = p.id WHERE ti.transaction_id = ?",
        [t.id]
      );
      totalRevenue += t.total_amount;
      totalProfit += t.profit;
      enriched.push({ ...t, items });
    }

    const totalItems = enriched.reduce((sum, t) => sum + t.items.reduce((s, i) => s + i.quantity, 0), 0);

    return { totalRevenue, totalProfit, transactions: enriched, totalItems };
  } catch (error) {
    console.error('Error getting daily report', error);
    return { totalRevenue: 0, totalProfit: 0, transactions: [], totalItems: 0 };
  }
};

// Ambil 5 produk terlaris berdasarkan qty terjual di bulan tertentu
export const getTopProducts = async (year, month) => {
  if (!db) return [];
  try {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const rows = await db.getAllAsync(
      `SELECT p.name, SUM(ti.quantity) as total_qty, SUM(ti.subtotal) as total_revenue
       FROM transaction_items ti
       JOIN transactions t ON ti.transaction_id = t.id
       JOIN products p ON ti.product_id = p.id
       WHERE t.date LIKE ?
       GROUP BY ti.product_id
       ORDER BY total_qty DESC
       LIMIT 5`,
      [`${prefix}%`]
    );
    return rows;
  } catch (error) {
    console.error('Error getting top products', error);
    return [];
  }
};

// Ambil omset 7 hari terakhir untuk mini bar chart
export const getLast7DaysRevenue = async () => {
  if (!db) return [];
  try {
    const results = [];
    const pad2 = n => String(n).padStart(2, '0');
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      // Pakai waktu LOKAL — sama dengan cara addTransaction menyimpan tanggal
      const dateStr = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      const rows = await db.getAllAsync(
        "SELECT SUM(total_amount) as revenue, COUNT(*) as count FROM transactions WHERE date LIKE ?",
        [`${dateStr}%`]
      );
      results.push({
        date: dateStr,
        revenue: rows[0]?.revenue || 0,
        count: rows[0]?.count || 0,
        dayLabel: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][d.getDay()],
      });
    }
    return results;
  } catch (error) {
    console.error('Error getting 7-day revenue', error);
    return [];
  }
};

// Perbandingan bulan ini vs bulan lalu
export const getMonthComparison = async (year, month) => {
  if (!db) return { current: { revenue: 0, profit: 0 }, previous: { revenue: 0, profit: 0 } };
  try {
    const curPrefix = `${year}-${String(month).padStart(2, '0')}`;
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth < 1) { prevMonth = 12; prevYear--; }
    const prevPrefix = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

    const curRows = await db.getAllAsync(
      "SELECT SUM(total_amount) as revenue, SUM(profit) as profit FROM transactions WHERE date LIKE ?",
      [`${curPrefix}%`]
    );
    const prevRows = await db.getAllAsync(
      "SELECT SUM(total_amount) as revenue, SUM(profit) as profit FROM transactions WHERE date LIKE ?",
      [`${prevPrefix}%`]
    );

    return {
      current: { revenue: curRows[0]?.revenue || 0, profit: curRows[0]?.profit || 0 },
      previous: { revenue: prevRows[0]?.revenue || 0, profit: prevRows[0]?.profit || 0 },
    };
  } catch (error) {
    console.error('Error getting month comparison', error);
    return { current: { revenue: 0, profit: 0 }, previous: { revenue: 0, profit: 0 } };
  }
};

export const getDashboardStats = async () => {
  if (!db) return { todayRevenue: 0, todayProfit: 0, monthRevenue: 0, monthProfit: 0, todayTxCount: 0 };
  try {
    const now = new Date();
    // Pakai waktu LOKAL (bukan toISOString yang UTC) — sama persis dengan cara addTransaction menyimpan tanggal
    const pad2 = n => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const year = now.getFullYear();
    const month = pad2(now.getMonth() + 1);
    const monthPrefix = `${year}-${month}`;

    const todayTx = await db.getAllAsync(
      "SELECT * FROM transactions WHERE date LIKE ?",
      [`${todayStr}%`]
    );
    const monthTx = await db.getAllAsync(
      "SELECT * FROM transactions WHERE date LIKE ?",
      [`${monthPrefix}%`]
    );

    let todayRevenue = 0, todayProfit = 0, monthRevenue = 0, monthProfit = 0;
    todayTx.forEach(t => { todayRevenue += t.total_amount; todayProfit += t.profit; });
    monthTx.forEach(t => { monthRevenue += t.total_amount; monthProfit += t.profit; });

    return {
      todayRevenue,
      todayProfit,
      monthRevenue,
      monthProfit,
      todayTxCount: todayTx.length,
    };
  } catch (error) {
    console.error('Error getting dashboard stats', error);
    return { todayRevenue: 0, todayProfit: 0, monthRevenue: 0, monthProfit: 0, todayTxCount: 0 };
  }
};

// ─── BACKUP & RESTORE ─────────────────────────────────────────────────────────

/**
 * Export semua data ke string JSON
 * Bisa disimpan ke file atau dikirim via WhatsApp
 */
export const exportBackup = async () => {
  if (!db) throw new Error('Database belum siap');
  try {
    const products = await db.getAllAsync('SELECT * FROM products ORDER BY id ASC');
    const transactions = await db.getAllAsync('SELECT * FROM transactions ORDER BY id ASC');
    const transactionItems = await db.getAllAsync('SELECT * FROM transaction_items ORDER BY id ASC');

    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;

    const backup = {
      version: 1,
      app: 'WarungApp',
      exported_at: now.toISOString(),
      timestamp,
      data: { products, transactions, transactionItems },
    };

    return JSON.stringify(backup, null, 2);
  } catch (error) {
    console.error('Error exporting backup', error);
    throw error;
  }
};

/**
 * Import & pulihkan data dari string JSON backup
 * HATI-HATI: ini akan menghapus semua data yang ada!
 */
export const importBackup = async (jsonString) => {
  if (!db) throw new Error('Database belum siap');
  try {
    const backup = JSON.parse(jsonString);
    if (!backup.version || !backup.data) {
      throw new Error('Format backup tidak valid');
    }

    const { products, transactions, transactionItems } = backup.data;

    // Hapus semua data lama
    await db.execAsync(`
      DELETE FROM transaction_items;
      DELETE FROM transactions;
      DELETE FROM products;
    `);

    // Pulihkan products
    for (const p of products) {
      await db.runAsync(
        'INSERT INTO products (id, name, bulk_price, items_per_bulk, modal_price, selling_price, stock, category, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [p.id, p.name, p.bulk_price, p.items_per_bulk || 1, p.modal_price, p.selling_price, p.stock, p.category || 'Umum', p.unit || 'pcs']
      );
    }

    // Pulihkan transactions
    for (const t of transactions) {
      await db.runAsync(
        'INSERT INTO transactions (id, date, total_amount, total_modal, profit) VALUES (?, ?, ?, ?, ?)',
        [t.id, t.date, t.total_amount, t.total_modal, t.profit]
      );
    }

    // Pulihkan transaction_items
    for (const ti of transactionItems) {
      await db.runAsync(
        'INSERT INTO transaction_items (id, transaction_id, product_id, quantity, price, modal, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [ti.id, ti.transaction_id, ti.product_id, ti.quantity, ti.price, ti.modal, ti.subtotal]
      );
    }

    return {
      products: products.length,
      transactions: transactions.length,
      transactionItems: transactionItems.length,
    };
  } catch (error) {
    console.error('Error importing backup', error);
    throw error;
  }
};

// ─── CANCEL / HAPUS TRANSACTION ──────────────────────────────────────────────

/**
 * Hapus transaksi dari database (hard delete).
 * Jika restoreStock=true, stok barang dikembalikan dulu sebelum dihapus.
 * Tidak butuh kolom 'status' — langsung delete dari DB.
 */
export const cancelTransaction = async (transactionId, restoreStock) => {
  if (!db) throw new Error('Database belum siap');
  try {
    if (restoreStock) {
      // Ambil item dulu sebelum dihapus
      const items = await db.getAllAsync(
        'SELECT * FROM transaction_items WHERE transaction_id = ?',
        [transactionId]
      );
      // Kembalikan stok
      for (const item of items) {
        await db.runAsync(
          'UPDATE products SET stock = stock + ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
    }
    // Hard delete — hapus items dulu (foreign key), lalu transaksinya
    await db.runAsync('DELETE FROM transaction_items WHERE transaction_id = ?', [transactionId]);
    await db.runAsync('DELETE FROM transactions WHERE id = ?', [transactionId]);
  } catch (error) {
    console.error('Error deleting transaction', error);
    throw error;
  }
};
