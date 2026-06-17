import { serverTimestamp } from "firebase/firestore";

export const DB_PATHS = {
  USER_DOC: "users/admin_vault",
  INVENTORY: "users/admin_vault/inventory",
  CASH_LEDGER: "users/admin_vault/cash_ledger",
  MASTER_CATALOG: "master_catalog", // Or users/admin_vault/catalog
  SETTINGS: "users/admin_vault/settings/store",
  TRANSACTIONS: "users/admin_vault/transactions",
  PROCUREMENTS: "users/admin_vault/procurements",
  CAPITAL_INJECTIONS: "users/admin_vault/capital_injections",
};

export const sanitizeNumber = (val: any) => {
  const parsed = Number(val);
  return isNaN(parsed) ? 0 : parsed;
};

export const formatLedgerEntry = (data: any) => ({
  ...data,
  amount: sanitizeNumber(data.amount),
  flow: data.flow === "Cash In" || data.flow === "Cash Out" ? data.flow : "Cash Out",
  createdAt: serverTimestamp(),
});

export const formatInventoryItem = (data: any) => ({
  ...data,
  id: data.id || `INV-${Date.now()}`,
  quantity: sanitizeNumber(data.quantity),
  costBasis: sanitizeNumber(data.costBasis),
  currentPrice: sanitizeNumber(data.currentPrice),
  procurementCost: sanitizeNumber(data.cost || data.procurementCost), // As per instruction
  status: data.status === "In Stock" || data.status === "Sold" ? data.status : "In Stock",
  updatedAt: serverTimestamp(),
});

export const formatCashLedgerEntry = (data: any) => ({
    ...data,
    amount: sanitizeNumber(data.amount),
    createdAt: serverTimestamp()
});

export const formatCapitalInjection = (data: any) => ({
    ...data,
    amount: sanitizeNumber(data.amount),
    injectedAmount: sanitizeNumber(data.amount),
    createdAt: serverTimestamp()
});
