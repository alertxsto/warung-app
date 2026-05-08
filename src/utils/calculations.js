export const calculateModalPrice = (bulkPrice, itemsPerBulk) => {
  if (!bulkPrice || !itemsPerBulk || itemsPerBulk <= 0) return 0;
  return bulkPrice / itemsPerBulk;
};

export const calculateMargin = (modalPrice, sellingPrice) => {
  const profitRp = sellingPrice - modalPrice;
  const marginPercentage = modalPrice > 0 ? (profitRp / modalPrice) * 100 : 0;
  
  return {
    profitRp: profitRp,
    marginPercentage: marginPercentage.toFixed(2),
    isProfitable: profitRp >= 0
  };
};

export const calculateTotalEstimatedProfit = (products) => {
  return products.reduce((total, product) => {
    const profitPerItem = product.selling_price - product.modal_price;
    return total + (profitPerItem * product.stock);
  }, 0);
};

export const formatRupiah = (number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(number);
};
