/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Dashboard } from './components/Dashboard';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Inventory } from './components/Inventory';
import { Procurement } from './components/Procurement';
import { ProcurementHistory } from './components/ProcurementHistory';
import { Transactions } from './components/Transactions';
import { AiInsights } from './components/AiInsights';
import { Settings } from './components/Settings';
import { BarcodeScanner } from './components/BarcodeScanner';

// Firebase imports
import { useFirebase } from './contexts/FirebaseContext';
import { LoginGate } from './components/LoginGate';
import { db } from './firebase';
import { collection, onSnapshot, doc, getDocs, deleteDoc, query, orderBy, addDoc, setDoc, where, writeBatch, serverTimestamp } from 'firebase/firestore';
import { firestoreService } from './utils/firestoreService';
import { handleFirestoreError, OperationType } from './utils/firebaseUtils';
import { Loader2 } from 'lucide-react';

export interface InventoryBatch {
  batchId: string;
  date: string;
  qty: number;
  costBasis: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  set: string;
  category: string;
  condition: string;
  foilType: string;
  gradingCompany: string | null;
  certNumber: string | null;
  quantity: number;
  costBasis: number;
  currentPrice: number;
  imageUrl: string | null;
  cardNumber?: string;
  rarity?: string;
  language?: string;
  batches?: InventoryBatch[];
  acquisitionDate?: string;
  status?: string;
  dateAdded?: any;
}

export interface ProcurementRecord {
  id: string;
  date: string;
  type: string;
  itemName: string;
  description: string;
  supplier: string;
  totalCost: number;
}

export interface CatalogItem {
  itemName: string;
  setName: string;
  cardNumber?: string;
  rarity?: string;
}

export default function App() {
  const { user, loading } = useFirebase();

  const [currentView, setCurrentView] = useState('insights');
  const [isGlobalScannerOpen, setIsGlobalScannerOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [scannedProcurementEvent, setScannedProcurementEvent] = useState<{code: string, timestamp: number} | null>(null);
  const [scannedSellEvent, setScannedSellEvent] = useState<{code: string, timestamp: number} | null>(null);
  const scanLockRef = useRef(false);
  
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  
  const [masterCatalog, setMasterCatalog] = useState<CatalogItem[]>(() => {
    try {
      const saved = localStorage.getItem('bandit_catalog');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [procurementRecords, setProcurementRecords] = useState<ProcurementRecord[]>(() => {
    try {
      const saved = localStorage.getItem('bandit_procurements');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [transactions, setTransactions] = useState<any[]>(() => {
    try {
       const saved = localStorage.getItem('bandit_transactions');
       return saved ? JSON.parse(saved) : [];
    } catch {
       return [];
    }
  });

  const [outOfPocketCapital, setOutOfPocketCapital] = useState(() => {
    try {
      const saved = localStorage.getItem('bandit_outOfPocket');
      return saved ? parseFloat(saved) : 0;
    } catch {
      return 0;
    }
  });

  const [cashReserve, setCashReserve] = useState(() => {
    try {
      const saved = localStorage.getItem('bandit_cashReserve');
      return saved ? parseFloat(saved) : 0;
    } catch {
      return 0;
    }
  });

  const [capitalInjections, setCapitalInjections] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('bandit_capital_injections');
      const parsed = saved ? JSON.parse(saved) : [];
      return parsed;
    } catch {
      return [];
    }
  });

  // Load and subscribe from Firestore when logged in
  useEffect(() => {
    if (!user) return;

    // Load/Sync settings and stats
    const settingsRef = doc(db, `users/${user.uid}/settings/store`);
    const unsubscribeSettings = onSnapshot(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.storeName) localStorage.setItem('bandit_store_name', data.storeName);
        if (data.currencySymbol) localStorage.setItem('bandit_currency', data.currencySymbol);
        if (data.defaultPlatformFee) localStorage.setItem('bandit_def_platform_fee', data.defaultPlatformFee);
        if (data.defaultShipping) localStorage.setItem('bandit_def_shipping', data.defaultShipping);
        if (typeof data.outOfPocketCapital === 'number') setOutOfPocketCapital(data.outOfPocketCapital);
        if (typeof data.cashReserve === 'number') setCashReserve(data.cashReserve);
      } else {
        // Initialize settings in firestore if empty
        firestoreService.saveSettings(user.uid, {
          storeName: localStorage.getItem('bandit_store_name') || 'REIN Collects',
          currencySymbol: localStorage.getItem('bandit_currency') || 'IDR',
          defaultPlatformFee: localStorage.getItem('bandit_def_platform_fee') || '10',
          defaultShipping: localStorage.getItem('bandit_def_shipping') || '0',
          outOfPocketCapital,
          cashReserve
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/settings/store`);
    });

    // 1. Inventory Items subscription
    const q = query(collection(db, "users", user.uid, "inventory"));
    const unsubscribeInventory = onSnapshot(q, (snapshot) => {
      const itemsData = snapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));
      setInventoryItems(itemsData); // Update state purely from the cloud
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/inventory`);
    });

    // 2. Transactions subscription
    const unsubscribeTransactions = onSnapshot(collection(db, `users/${user.uid}/transactions`), (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(d => {
        items.push(d.data());
      });
      setTransactions(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/transactions`);
    });

    // 3. Procurements subscription
    const unsubscribeProcurements = onSnapshot(collection(db, `users/${user.uid}/procurements`), (snapshot) => {
      const items: ProcurementRecord[] = [];
      snapshot.forEach(d => {
        items.push(d.data() as ProcurementRecord);
      });
      setProcurementRecords(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/procurements`);
    });

    // 4. Catalog Items subscription
    const unsubscribeCatalog = onSnapshot(collection(db, `users/${user.uid}/catalog`), (snapshot) => {
      const items: CatalogItem[] = [];
      snapshot.forEach(d => {
        items.push(d.data() as CatalogItem);
      });
      setMasterCatalog(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/catalog`);
    });

    // 5. Capital Injections subscription
    const unsubscribeInjections = onSnapshot(collection(db, `users/${user.uid}/capital_injections`), (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(d => {
        items.push(d.data());
      });
      setCapitalInjections(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/capital_injections`);
    });

    // One-time local data recovery & migration to cloud if first login
    const hasMigrated = localStorage.getItem(`bandit_cloud_migrated_${user.uid}`);
    if (!hasMigrated) {
      const performMigration = async () => {
        try {
          // Migration of catalog items
          const localCatalog = JSON.parse(localStorage.getItem('bandit_catalog') || '[]');
          for (let i = 0; i < localCatalog.length; i++) {
            await firestoreService.saveCatalogItem(user.uid, localCatalog[i], `cat_${i}_${Date.now()}`);
          }
          // Migration of procurements
          const localProcurements = JSON.parse(localStorage.getItem('bandit_procurements') || '[]');
          for (const item of localProcurements) {
            await firestoreService.saveProcurementRecord(user.uid, item);
          }
          // Migration of transactions
          const localTransactions = JSON.parse(localStorage.getItem('bandit_transactions') || '[]');
          for (const item of localTransactions) {
            await firestoreService.saveTransaction(user.uid, item);
          }
          // Migration of capital injections
          const localInjections = JSON.parse(localStorage.getItem('bandit_capital_injections') || '[]');
          for (const item of localInjections) {
            await firestoreService.saveCapitalInjection(user.uid, item);
          }
          // Settings sync
          await firestoreService.saveSettings(user.uid, {
            storeName: localStorage.getItem('bandit_store_name') || 'REIN Collects',
            currencySymbol: localStorage.getItem('bandit_currency') || 'IDR',
            defaultPlatformFee: localStorage.getItem('bandit_def_platform_fee') || '10',
            defaultShipping: localStorage.getItem('bandit_def_shipping') || '0',
            outOfPocketCapital,
            cashReserve
          });
          
          localStorage.setItem(`bandit_cloud_migrated_${user.uid}`, 'true');
        } catch (migErr) {
          console.error("Migration during onboard failed", migErr);
        }
      };
      performMigration();
    }

    return () => {
      unsubscribeSettings();
      unsubscribeInventory();
      unsubscribeTransactions();
      unsubscribeProcurements();
      unsubscribeCatalog();
      unsubscribeInjections();
    };
  }, [user]);

  useEffect(() => {
    if (outOfPocketCapital > 0 && capitalInjections.length === 0 && !user) {
      setCapitalInjections([
        {
          id: 'INJ-INITIAL',
          date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          amount: outOfPocketCapital
        }
      ]);
    }
  }, [outOfPocketCapital, capitalInjections.length, user]);

  useEffect(() => {
    localStorage.setItem('bandit_outOfPocket', outOfPocketCapital.toString());
  }, [outOfPocketCapital]);

  useEffect(() => {
    localStorage.setItem('bandit_cashReserve', cashReserve.toString());
  }, [cashReserve]);

  useEffect(() => {
    localStorage.setItem('bandit_capital_injections', JSON.stringify(capitalInjections));
  }, [capitalInjections]);

  useEffect(() => {
    localStorage.setItem('bandit_procurements', JSON.stringify(procurementRecords));
  }, [procurementRecords]);

  useEffect(() => {
    localStorage.setItem('bandit_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('bandit_catalog', JSON.stringify(masterCatalog));
  }, [masterCatalog]);

  const handleScanSuccess = (decodedText: string) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    
    setIsGlobalScannerOpen(false);
    const code = decodedText.trim().toUpperCase();
    
    let foundItemId: string | null = null;
    for (const item of inventoryItems) {
      const itemIdSanitized = item.id ? item.id.trim().toUpperCase() : '';
      const matchesBatch = item.batches?.some(b => b.batchId && b.batchId.trim().toUpperCase() === code);
      
      if (itemIdSanitized === code || matchesBatch) {
        foundItemId = item.id;
        break;
      }
    }

    if (foundItemId) {
      setScannedSellEvent({ code: foundItemId, timestamp: Date.now() });
      setCurrentView('transactions');
    } else {
      setScannedProcurementEvent({ code: code, timestamp: Date.now() });
      setCurrentView('procurement');
    }

    setTimeout(() => {
      scanLockRef.current = false;
    }, 1500);
  };

  const handleInjectCapital = (amount: number) => {
    const displayDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const newInjection = {
      id: `INJ-${Date.now()}`,
      date: displayDate,
      amount: amount
    };
    if (user) {
      firestoreService.saveCapitalInjection(user.uid, newInjection);
      firestoreService.saveSettings(user.uid, {
        storeName: localStorage.getItem('bandit_store_name') || 'REIN Collects',
        currencySymbol: localStorage.getItem('bandit_currency') || 'IDR',
        defaultPlatformFee: localStorage.getItem('bandit_def_platform_fee') || '10',
        defaultShipping: localStorage.getItem('bandit_def_shipping') || '0',
        outOfPocketCapital: outOfPocketCapital + amount,
        cashReserve: cashReserve + amount
      });
    } else {
      setCapitalInjections(prev => [newInjection, ...prev]);
      setOutOfPocketCapital(prev => prev + amount);
      setCashReserve(prev => prev + amount);
    }
  };

  const handleSaveItem = async (newItemData: InventoryItem) => {
    // 1. Save to inventory
    const docId = newItemData.id || `INV-${Date.now()}`;
    const userUid = user?.uid || "admin_test_user";
    await setDoc(doc(db, "users", userUid, "inventory", docId), { ...newItemData, id: docId, status: "active", dateAdded: new Date() });

    // 2. Write to master_catalog
    const { name, set, category, foilType, rarity, condition, cardNumber } = newItemData;
    if (name && set) {
      // Create a deterministic unique ID based on Name + Set + CardNumber (optional)
      const uniqueId = (name.replace(/\s+/g, '_') + '_' + set.replace(/\s+/g, '_') + (cardNumber ? '_' + cardNumber : '')).toLowerCase();
      
      const catalogEntry = {
        name,
        set,
        category: category || 'Single',
        foilType: foilType || 'Non-Foil',
        rarity: rarity || 'N/A',
        condition: condition || 'NM',
        cardNumber: cardNumber || '',
        updatedAt: new Date()
      };

      await setDoc(doc(db, "master_catalog", uniqueId), catalogEntry, { merge: true });
    }
  };

  const handleUpdateItem = (updatedItem: InventoryItem) => {
    if (user) {
      firestoreService.saveInventoryItem(user.uid, updatedItem);
    } else {
      setInventoryItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
    }
  };

  const handleDeleteItem = (id: string) => {
    if (user) {
      firestoreService.deleteInventoryItem(user.uid, id);
    } else {
      setInventoryItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleUpdateInventory = (itemsToUpdate: { id: string; quantityToDeduct: number }[]) => {
    if (user) {
      itemsToUpdate.forEach(update => {
        const item = inventoryItems.find(i => i.id === update.id);
        if (item) {
          let remainingToDeduct = update.quantityToDeduct;
          const oldBatches = item.batches && item.batches.length > 0 
            ? [...item.batches] 
            : [{ batchId: 'BCH-LEGACY-' + item.id, date: 'Legacy', qty: item.quantity, costBasis: item.costBasis }];
          
          const newBatches: InventoryBatch[] = [];
          for (const batch of oldBatches) {
            if (remainingToDeduct <= 0) {
              newBatches.push(batch);
              continue;
            }
            if (batch.qty <= remainingToDeduct) {
              remainingToDeduct -= batch.qty;
            } else {
              newBatches.push({ ...batch, qty: batch.qty - remainingToDeduct });
              remainingToDeduct = 0;
            }
          }

          const newQuantity = Math.max(0, item.quantity - update.quantityToDeduct);
          const newCostBasis = newBatches.length > 0 
            ? newBatches.reduce((sum, b) => sum + (b.costBasis * b.qty), 0) / newBatches.reduce((sum, b) => sum + b.qty, 0)
            : item.costBasis;

          firestoreService.saveInventoryItem(user.uid, {
            ...item,
            quantity: newQuantity,
            costBasis: newCostBasis,
            batches: newBatches
          });
        }
      });
    } else {
      setInventoryItems(prev => prev.map(item => {
        const update = itemsToUpdate.find(u => u.id === item.id);
        if (update) {
          let remainingToDeduct = update.quantityToDeduct;
          const oldBatches = item.batches && item.batches.length > 0 
            ? [...item.batches] 
            : [{ batchId: 'BCH-LEGACY-' + item.id, date: 'Legacy', qty: item.quantity, costBasis: item.costBasis }];
          
          const newBatches: InventoryBatch[] = [];
          for (const batch of oldBatches) {
            if (remainingToDeduct <= 0) {
              newBatches.push(batch);
              continue;
            }
            if (batch.qty <= remainingToDeduct) {
              remainingToDeduct -= batch.qty;
              // batch is depleted, don't push
            } else {
              newBatches.push({ ...batch, qty: batch.qty - remainingToDeduct });
              remainingToDeduct = 0;
            }
          }

          const newQuantity = Math.max(0, item.quantity - update.quantityToDeduct);
          const newCostBasis = newBatches.length > 0 
            ? newBatches.reduce((sum, b) => sum + (b.costBasis * b.qty), 0) / newBatches.reduce((sum, b) => sum + b.qty, 0)
            : item.costBasis;

          return { 
            ...item, 
            quantity: newQuantity,
            costBasis: newCostBasis,
            batches: newBatches
          };
        }
        return item;
      }));
    }
  };

  const handleAddProcurements = (records: ProcurementRecord[]) => {
    if (user) {
      records.forEach(record => {
        firestoreService.saveProcurementRecord(user.uid, record);
      });
      const totalCost = records.reduce((sum, record) => sum + record.totalCost, 0);
      firestoreService.saveSettings(user.uid, {
        storeName: localStorage.getItem('bandit_store_name') || 'REIN Collects',
        currencySymbol: localStorage.getItem('bandit_currency') || 'IDR',
        defaultPlatformFee: localStorage.getItem('bandit_def_platform_fee') || '10',
        defaultShipping: localStorage.getItem('bandit_def_shipping') || '0',
        outOfPocketCapital,
        cashReserve: cashReserve - totalCost
      });
    } else {
      setProcurementRecords(prev => [...records, ...prev]);
      const totalCost = records.reduce((sum, record) => sum + record.totalCost, 0);
      setCashReserve(prev => prev - totalCost);
    }
  };

  const handleAddTransaction = async (transaction: any) => {
    if (user) {
      try {
        const batch = writeBatch(db);
        
        // 1. Transaction save
        const trxId = transaction.id || `TRX-${Date.now()}`;
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
        const trxRef = doc(db, `users/${user.uid}/transactions/${trxId}`);
        batch.set(trxRef, { ...transactionToSave, createdAt: serverTimestamp() });
        
        // 2. Mark specific items as sold
        if (transaction.items && transaction.items.length > 0) {
          transaction.items.forEach((item: any) => {
            const itemRef = doc(db, "users", user.uid, "inventory", item.id);
            batch.update(itemRef, { 
              status: "sold", 
              soldAt: serverTimestamp() 
            });
          });
        }
        
        // 3. Update cash reserve settings
        const netCashAdded = transactionToSave.total - transactionToSave.platform_fee - transactionToSave.shipping_cost;
        const settingsToUpdate = {
          storeName: localStorage.getItem('bandit_store_name') || 'REIN Collects',
          currencySymbol: localStorage.getItem('bandit_currency') || 'IDR',
          defaultPlatformFee: localStorage.getItem('bandit_def_platform_fee') || '10',
          defaultShipping: localStorage.getItem('bandit_def_shipping') || '0',
          outOfPocketCapital,
          cashReserve: cashReserve + netCashAdded
        };
        const settingsRef = doc(db, `users/${user.uid}/settings/store`);
        batch.set(settingsRef, settingsToUpdate, { merge: true });
        
        // Commit the batch
        await batch.commit();

      } catch (err) {
        console.error("Failed to commit batch transaction:", err);
      }
    } else {
      setTransactions(prev => [transaction, ...prev]);
      const netCashAdded = transaction.total - (transaction.platform_fee || 0) - (transaction.shipping_cost || 0);
      setCashReserve(prev => prev + netCashAdded);
      // Local updates
      const soldIds = transaction.items?.map((i: any) => i.id) || [];
      setInventoryItems(prev => prev.filter(item => !soldIds.includes(item.id)));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f2f2f2] flex items-center justify-center p-4">
        <Loader2 className="animate-spin text-[#961b2b]" size={40} />
      </div>
    );
  }

  if (!user) {
    return <LoginGate />;
  }

  return (

    <div className="flex h-screen bg-[#f2f2f2] text-gray-900 font-sans overflow-hidden w-full">
      <Sidebar 
        currentView={currentView} 
        onViewChange={(view) => {
          setCurrentView(view);
          setIsMobileMenuOpen(false);
        }} 
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden w-full relative">
        <Header 
          onOpenScanner={() => setIsGlobalScannerOpen(true)} 
          onMenuClick={() => setIsMobileMenuOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 w-full">
          {currentView === 'dashboard' && (
            <Dashboard 
              inventory={inventoryItems} 
              transactions={transactions} 
              onAddTransaction={handleAddTransaction} 
              onUpdateInventory={handleUpdateInventory} 
              outOfPocketCapital={outOfPocketCapital} 
              cashReserve={cashReserve} 
              onInjectCapital={handleInjectCapital}
              capitalInjections={capitalInjections}
              procurementRecords={procurementRecords}
            />
          )}
          {currentView === 'inventory' && (
             <Inventory 
              items={inventoryItems} 
              onNavigateToProcurement={() => setCurrentView('procurement')} 
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
            />
          )}
          {currentView === 'procurement' && (
            <Procurement 
              key={scannedProcurementEvent?.timestamp || 'procurement'}
              masterCatalog={masterCatalog}
              onAddItem={handleSaveItem} 
              procurementRecords={procurementRecords}
              onAddProcurements={handleAddProcurements}
              onNavigateToHistory={() => setCurrentView('procurementHistory')}
              initialSerialNumber={scannedProcurementEvent ? scannedProcurementEvent.code : ''}
              onOpenScanner={() => setIsGlobalScannerOpen(true)}
            />
          )}
          {currentView === 'procurementHistory' && (
            <ProcurementHistory 
              records={procurementRecords} 
              onBack={() => setCurrentView('procurement')}
            />
          )}
          {currentView === 'transactions' && (
            <Transactions 
              key={scannedSellEvent?.timestamp || 'transactions'}
              inventory={inventoryItems}
              transactions={transactions}
              onAddTransaction={handleAddTransaction}
              onUpdateInventory={handleUpdateInventory}
              initialSellItemCode={scannedSellEvent ? scannedSellEvent.code : ''}
            />
          )}
          {currentView === 'insights' && <AiInsights />}
          {currentView === 'settings' && (
            <Settings 
              masterCatalog={masterCatalog}
              outOfPocketCapital={outOfPocketCapital}
              cashReserve={cashReserve}
              onUpdateCatalog={async (updated) => {
                if (user) {
                  try {
                    const catalogColl = collection(db, `users/${user.uid}/catalog`);
                    const snapshot = await getDocs(catalogColl);
                    // Delete existing docs safely in parallel
                    const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
                    await Promise.all(deletePromises);
                    
                    // Write new ones in parallel
                    const savePromises = updated.map((item, i) => 
                      firestoreService.saveCatalogItem(user.uid, item, `cat_${i}_${Date.now()}`)
                    );
                    await Promise.all(savePromises);
                  } catch (e) {
                    console.error("Failed to sync catalog update to store", e);
                  }
                } else {
                  setMasterCatalog(updated);
                }
              }}
            />
          )}
        </main>
      </div>

      <BarcodeScanner 
        isOpen={isGlobalScannerOpen} 
        onClose={() => setIsGlobalScannerOpen(false)} 
        onScan={handleScanSuccess} 
      />
    </div>
  );
}

