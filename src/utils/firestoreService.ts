import { doc, setDoc, deleteDoc, updateDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from './firebaseUtils';
import { InventoryItem, CatalogItem, ProcurementRecord } from '../App';
import { DB_PATHS, formatInventoryItem, formatCapitalInjection } from './dbConfig';

export const firestoreService = {
  // Settings
  async saveSettings(userId: string, settings: any) {
    const path = `${DB_PATHS.SETTINGS}`;
    try {
      await setDoc(doc(db, path), settings);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  // Inventory
  async saveInventoryItem(userId: string, item: InventoryItem) {
    // Generate valid id if not exists
    const itemId = item.id || `INV-${Date.now()}`;
    const path = `${DB_PATHS.INVENTORY}/${itemId}`;
    try {
      // Clean up item for firestore
      const itemToSave = formatInventoryItem({
        id: itemId,
        name: item.name || '',
        set: item.set || '',
        category: item.category || 'Singles',
        condition: item.condition || 'NM',
        foilType: item.foilType || 'Non-Foil',
        gradingCompany: item.gradingCompany || null,
        certNumber: item.certNumber || null,
        quantity: item.quantity,
        costBasis: item.costBasis,
        currentPrice: item.currentPrice,
        imageUrl: item.imageUrl || null,
        cardNumber: item.cardNumber || '',
        rarity: item.rarity || '',
        language: item.language || '',
        batches: item.batches || [],
        acquisitionDate: item.acquisitionDate || ''
      });
      await setDoc(doc(db, path), itemToSave);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async deleteInventoryItem(userId: string, itemId: string) {
    const path = `${DB_PATHS.INVENTORY}/${itemId}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  },

  // Transactions
  async saveTransaction(userId: string, transaction: any) {
    const trxId = transaction.id || `TRX-${Date.now()}`;
    const path = `${DB_PATHS.TRANSACTIONS}/${trxId}`;
    try {
      const transactionToSave = {
        id: trxId,
        date: transaction.date || '',
        channel: transaction.channel || 'In-Store POS',
        total: typeof transaction.total === 'number' ? transaction.total : 0,
        cost: typeof transaction.cost === 'number' ? transaction.cost : 0,
        platform_fee: typeof transaction.platform_fee === 'number' ? transaction.platform_fee : 0,
        shipping_cost: typeof transaction.shipping_cost === 'number' ? transaction.shipping_cost : 0,
        status: transaction.status || 'Completed',
        items: transaction.items || []
      };
      await setDoc(doc(db, path), transactionToSave);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async deleteTransaction(userId: string, transactionId: string) {
    const path = `${DB_PATHS.TRANSACTIONS}/${transactionId}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  },

  async updateTransactionDate(userId: string, transactionId: string, newDateString: string) {
    const path = `${DB_PATHS.TRANSACTIONS}/${transactionId}`;
    try {
      await updateDoc(doc(db, path), { date: newDateString });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  // Procurements
  async saveProcurementRecord(userId: string, record: ProcurementRecord) {
    const path = `${DB_PATHS.PROCUREMENTS}/${record.id}`;
    try {
      const recordToSave = {
        id: record.id,
        date: record.date || '',
        type: record.type || '',
        itemName: record.itemName || '',
        description: record.description || '',
        supplier: record.supplier || '',
        totalCost: typeof record.totalCost === 'number' ? record.totalCost : 0
      };
      await setDoc(doc(db, path), recordToSave);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async deleteProcurementRecord(userId: string, recordId: string) {
    const path = `${DB_PATHS.PROCUREMENTS}/${recordId}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  },

  // Catalog
  async saveCatalogItem(userId: string, item: CatalogItem, indexId: string) {
    const path = `${DB_PATHS.MASTER_CATALOG}/${indexId}`;
    try {
      const itemToSave = {
        itemName: item.itemName || '',
        setName: item.setName || '',
        cardNumber: item.cardNumber || '',
        rarity: item.rarity || ''
      };
      await setDoc(doc(db, path), itemToSave);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async deleteCatalogItem(userId: string, indexId: string) {
    const path = `${DB_PATHS.MASTER_CATALOG}/${indexId}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  },

  // Capital Injections
  async saveCapitalInjection(userId: string, injection: any) {
    const path = `${DB_PATHS.CAPITAL_INJECTIONS}/${injection.id}`;
    try {
      const injectionToSave = formatCapitalInjection({
        id: injection.id,
        date: injection.date || '',
        amount: typeof injection.amount === 'number' ? injection.amount : 0
      });
      await setDoc(doc(db, path), injectionToSave);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  }
};
