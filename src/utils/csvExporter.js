/**
 * Utility untuk mengonversi data transaksi warung ke format CSV
 */

export const generateTransactionsCSV = (transactions) => {
  if (!transactions || transactions.length === 0) {
    return 'ID Transaksi,Tanggal,Waktu,Total Belanja,Total Modal,Profit Bersih\n';
  }

  const pad = n => String(n).padStart(2, '0');
  
  const headers = ['ID Transaksi', 'Tanggal', 'Waktu', 'Total Belanja (Rp)', 'Total Modal (Rp)', 'Profit Bersih (Rp)'];
  const rows = transactions.map((tx, idx) => {
    const d = new Date(tx.date);
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const txId = tx.id ? `#${tx.id}` : `#${idx + 1}`;

    return [
      `"${txId}"`,
      `"${dateStr}"`,
      `"${timeStr}"`,
      tx.total_amount || 0,
      tx.total_modal || 0,
      tx.profit || 0,
    ].join(',');
  });

  // Tambahkan baris total di bagian bawah
  const totalRevenue = transactions.reduce((s, t) => s + (t.total_amount || 0), 0);
  const totalModal = transactions.reduce((s, t) => s + (t.total_modal || 0), 0);
  const totalProfit = transactions.reduce((s, t) => s + (t.profit || 0), 0);

  const totalRow = [
    '"TOTAL"',
    '""',
    '""',
    totalRevenue,
    totalModal,
    totalProfit
  ].join(',');

  return [headers.join(','), ...rows, '', totalRow].join('\n');
};
