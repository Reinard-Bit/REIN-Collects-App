export const formatIDR = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
};

export const parseIDR = (value: string) => {
  return parseInt(value.replace(/\D/g, ''), 10) || 0;
};
