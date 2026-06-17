import React, { useState, useEffect } from 'react';
import { formatIDR } from '../utils/currency';
import { collection, onSnapshot, query, where, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, ACTIVE_USER_ID } from '../firebase';
import { useFirebase } from '../contexts/FirebaseContext';
import { DB_PATHS } from '../utils/dbConfig';
import { NewSaleDrawer } from './NewSaleDrawer';
import {
  DollarSign,
  TrendingUp,
  PackageOpen,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  BrainCircuit,
  CheckCircle2,
  X,
  Edit2,
  Trash2,
  Calendar,
  History,
} from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

interface DashboardProps {
  inventory: any[];
  transactions: any[];
  onAddTransaction: (t: any) => void;
  onUpdateInventory: (items: {id: string, quantityToDeduct: number}[]) => void;
  outOfPocketCapital: number;
  cashReserve: number;
  onInjectCapital: (amount: number) => void;
  capitalInjections?: any[];
  procurementRecords?: any[];
}

const formatDate = (dateVal: any) => {
  if (!dateVal) return 'N/A';
  let d: Date;
  if (dateVal && typeof dateVal.toDate === 'function') {
    d = dateVal.toDate();
  } else if (dateVal instanceof Date) {
    d = dateVal;
  } else {
    d = new Date(dateVal);
  }
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export function Dashboard({ 
  inventory, 
  transactions, 
  onAddTransaction, 
  onUpdateInventory, 
  outOfPocketCapital, 
  cashReserve, 
  onInjectCapital,
  capitalInjections = [],
  procurementRecords = []
}: DashboardProps) {
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [isInjectModalOpen, setIsInjectModalOpen] = useState(false);
  const [injectAmount, setInjectAmount] = useState('');
  const [activeLedgerModal, setActiveLedgerModal] = useState<'total' | 'cash' | 'active' | 'procurement' | null>(null);
  const { user } = useFirebase();
  const [totalCapital, setTotalCapital] = useState(0);
  const [activeCapitalAtRisk, setActiveCapitalAtRisk] = useState(0);
  const [exposureEvents, setExposureEvents] = useState<any[]>([]);
  const [capitalSurplus, setCapitalSurplus] = useState(0);
  const [cashLedgerItems, setCashLedgerItems] = useState<any[]>([]);
  const [liquidWalletBalance, setLiquidWalletBalance] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    // Force reset state to prevent stale data lingering
    setCashLedgerItems([]);
    setLiquidWalletBalance(0);
    const q = query(collection(db, DB_PATHS.CASH_LEDGER));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setCashLedgerItems([]);
        setLiquidWalletBalance(0);
        return;
      }
      const items: any[] = [];
      let balance = 0;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const amount = typeof data.amount === 'number' ? data.amount : parseFloat(data.amount) || 0;
        
        let displayDate = 'N/A';
        if (data.date) {
          displayDate = formatDate(data.date);
        }

        const itemFlow = data.flow || (data.impact === 'inflow' ? 'Cash In' : 'Cash Out');
        const flowImpact = itemFlow === 'Cash In' ? 'inflow' : 'outflow';

        items.push({
          ...data,
          id: docSnap.id,
          trueDbId: docSnap.id,
          displayId: data.id || docSnap.id,
          date: displayDate,
          rawDate: data.date,
          flow: itemFlow,
          description: data.sourceDescription || data.description || 'Unknown Flow',
          amount: amount,
          impact: flowImpact,
          type: 'cash_ledger'
        });

        if (itemFlow === 'Cash In') {
          balance += amount;
        } else {
          balance -= amount;
        }
      });

      // Sort items chronologically descending
      items.sort((a, b) => {
        const timeA = a.rawDate && typeof a.rawDate.toDate === 'function' ? a.rawDate.toDate().getTime() : (a.rawDate ? new Date(a.rawDate).getTime() : 0);
        const timeB = b.rawDate && typeof b.rawDate.toDate === 'function' ? b.rawDate.toDate().getTime() : (b.rawDate ? new Date(b.rawDate).getTime() : 0);
        if (timeB !== timeA) return timeB - timeA;
        return b.id.localeCompare(a.id);
      });

      setCashLedgerItems(items);
      setLiquidWalletBalance(balance);
    }, (error) => {
      console.error("Error reading cash ledger:", error);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const safeCash = Number(liquidWalletBalance || 0);
    const safeRisk = Number(activeCapitalAtRisk || 0);
    const safeBase = Number(totalCapital || 0);
    const calculatedSurplus = (safeCash + safeRisk) - safeBase;
    setCapitalSurplus(calculatedSurplus);
  }, [liquidWalletBalance, activeCapitalAtRisk, totalCapital]);

  useEffect(() => {
    // Force reset state to prevent stale data lingering
    setTotalCapital(0);
    const q = query(collection(db, DB_PATHS.CAPITAL_INJECTIONS));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setTotalCapital(0);
        return;
      }
      let sum = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        const amount = typeof data.amount === 'number' ? data.amount : parseFloat(data.amount) || 0;
        sum += amount;
      });
      setTotalCapital(sum);
    }, (error) => {
      console.error("Error aggregating capital injections:", error);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    // Force reset state to prevent stale data lingering
    setActiveCapitalAtRisk(0);
    setExposureEvents([]);
    const q = query(collection(db, DB_PATHS.INVENTORY));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setActiveCapitalAtRisk(0);
        setExposureEvents([]);
        return;
      }
      let totalInventoryCost = 0;
      const events: any[] = [];

      snapshot.forEach((docSnap) => {
        const item = docSnap.data();
        const costBasisVal = typeof item.costBasis === 'number' ? item.costBasis : parseFloat(item.costBasis) || 0;

        // Keep the total stock cost basis exposure calculation based ONLY on items where status === "In Stock"
        if (item.status === "In Stock") {
          const quantity = typeof item.quantity === 'number' 
            ? item.quantity 
            : (item.quantity !== undefined ? parseFloat(item.quantity) || 1 : 1);
          totalInventoryCost += costBasisVal * quantity;
        }

        const namePart = item.name || '';
        const setPart = item.set || '';
        const itemDNA = `${namePart} ${setPart}`.trim();

        // Rule A: For EVERY item in the snapshot, push a "Procurement" event object into the array.
        events.push({
          id: docSnap.id + '-procurement',
          date: item.dateAdded || item.acquisitionDate,
          type: "Risk Added (Procurement)",
          itemDNA,
          impact: costBasisVal
        });

        // Rule B: If an item has status === "Sold", push a SECOND event object into the array.
        if (item.status === "Sold") {
          events.push({
            id: docSnap.id + '-sale',
            date: item.soldAt,
            type: "Risk Cleared (Sale)",
            itemDNA,
            impact: -Math.abs(costBasisVal)
          });
        }
      });

      setActiveCapitalAtRisk(totalInventoryCost);

      const parseDateVal = (dateVal: any) => {
        if (!dateVal) return 0;
        if (typeof dateVal.toDate === 'function') {
          return dateVal.toDate().getTime();
        }
        if (dateVal instanceof Date) {
          return dateVal.getTime();
        }
        try {
          const str = String(dateVal);
          const parts = str.split(' ');
          if (parts.length === 3) {
            const months: { [key: string]: number } = {
              jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
              jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
            };
            const day = parseInt(parts[0], 10);
            const month = months[parts[1].toLowerCase().substring(0, 3)] || 0;
            const year = parseInt(parts[2], 10);
            return new Date(year, month, day).getTime();
          }
          return Date.parse(str) || 0;
        } catch {
          return 0;
        }
      };

      // Sort combined array by date descending (newest events at the top)
      events.sort((a, b) => {
        const timeA = parseDateVal(a.date);
        const timeB = parseDateVal(b.date);
        if (timeB !== timeA) return timeB - timeA;
        return b.id.localeCompare(a.id);
      });

      setExposureEvents(events);
    }, (error) => {
      console.error("Error aggregating inventory capital exposure:", error);
    });
    return () => unsubscribe();
  }, [user]);

  const handleAddAndShowSuccess = (t: any) => {
    onAddTransaction(t);
    setSuccessMsg(true);
    setTimeout(() => setSuccessMsg(false), 3000);
  };

  const handleInject = () => {
    const amount = parseFloat(injectAmount) || 0;
    if (amount > 0) {
      onInjectCapital(amount);
      setInjectAmount('');
      setIsInjectModalOpen(false);
    }
  };

  const handleDelete = async (collectionName: string, trueDbId: string) => {
    console.log("Delete button clicked for ID:", trueDbId);
    try {
      const collectionPath = collectionName === 'cash_ledger' ? DB_PATHS.CASH_LEDGER : DB_PATHS.CAPITAL_INJECTIONS;
      const targetRef = doc(db, collectionPath, trueDbId);
      console.log("🚨 Target DB Path:", targetRef.path);
      await deleteDoc(targetRef);
      console.log("🚀 Delete success for path:", targetRef.path);
    } catch (error) {
      console.error("❌ Delete failed for path:", collectionName, trueDbId, error);
    }
  };

  const handleDeleteInjection = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this capital injection? This will permanently lower your Total Base Investment.")) {
      try {
        const deletedInj = capitalInjections.find((i: any) => i.trueDbId === id || i.id === id);
        if (deletedInj) {
          const deletedAmount = deletedInj.amount || deletedInj.injectedAmount || 0;
          
          const settingsRef = doc(db, DB_PATHS.SETTINGS);
          await updateDoc(settingsRef, {
            outOfPocketCapital: outOfPocketCapital - deletedAmount,
            cashReserve: cashReserve - deletedAmount
          });
        }

        const targetRef = doc(db, DB_PATHS.CAPITAL_INJECTIONS, id);
        await deleteDoc(targetRef);
      } catch (error) {
        console.error("Error deleting injection:", error);
      }
    }
  };

  const handleEditInjection = (item: any) => {
    setEditingId(item.id);
    setEditValue(String(item.amount || item.injectedAmount || ""));
  };

  const handleEdit = (collectionName: string, item: any) => {
    console.log("Edit button clicked for item:", item);
    setEditingId(item.id);
    setEditValue(String(item.amount || item.injectedAmount || ""));
  };

  const submitEdit = async (collectionName: string, trueDbId: string) => {
    try {
      const collectionPath = collectionName === 'cash_ledger' ? DB_PATHS.CASH_LEDGER : DB_PATHS.CAPITAL_INJECTIONS;
      const targetRef = doc(db, collectionPath, trueDbId);
      console.log("🚨 Target DB Path:", targetRef.path);
      
      const updateData: any = { amount: Number(editValue) };
      if (collectionName === 'capital_injections') {
        updateData.injectedAmount = Number(editValue);
        
        const inj = capitalInjections.find((i: any) => i.trueDbId === trueDbId || i.id === trueDbId);
        if (inj) {
          const oldAmount = inj.amount || inj.injectedAmount || 0;
          const newAmount = Number(editValue);
          const difference = newAmount - oldAmount;
          
          if (difference !== 0) {
            const settingsRef = doc(db, DB_PATHS.SETTINGS);
            await updateDoc(settingsRef, {
              outOfPocketCapital: outOfPocketCapital + difference,
              cashReserve: cashReserve + difference
            });
            console.log("🚀 Automatically recalculated Out of Pocket Capital for edit. Difference:", difference);
          }
        }
      }
      
      await updateDoc(targetRef, updateData);
      console.log("🚀 Edit success for path:", targetRef.path);
      setEditingId(null);
      setEditValue("");
    } catch (error) {
      console.error("❌ Edit failed for path:", collectionName, trueDbId, error);
    }
  };

  const totalRealizedProfits = transactions.reduce((sum, trx) => sum + (trx.total - trx.cost - trx.platform_fee - trx.shipping_cost), 0);
  const activeInventoryValue = inventory.filter(i => i.status === 'In Stock').reduce((sum, item) => sum + ((item.currentPrice || 0) * item.quantity), 0);

  // Chronological cash reserve movements helper
  const sortedCashMovements = (() => {
    const movements: any[] = [];

    // 1. Capital Injections
    capitalInjections.forEach(inj => {
      movements.push({
        id: inj.id,
        date: inj.date,
        type: 'injection',
        description: inj.id === 'INJ-INITIAL' ? 'Initial Capital Investment' : 'Capital Injection',
        amount: inj.amount,
        impact: 'inflow'
      });
    });

    // 2. Sales Transactions
    transactions.forEach(trx => {
      const netRevenue = trx.total - (trx.platform_fee || 0) - (trx.shipping_cost || 0);
      const firstItem = trx.items && trx.items[0];
      const itemName = firstItem ? firstItem.name : 'Custom POS/Manual Sale';
      const count = trx.items ? trx.items.length : 0;
      const addition = count > 1 ? ` + ${count - 1} items` : '';
      
      movements.push({
        id: trx.id,
        date: trx.date,
        type: 'sale',
        description: `POS Sale: ${itemName}${addition}`,
        amount: netRevenue,
        impact: 'inflow'
      });
    });

    // 3. Procurement Records
    procurementRecords.forEach(proc => {
      movements.push({
        id: proc.id,
        date: proc.date,
        type: 'procurement',
        description: `Procurement: ${proc.itemName}`,
        amount: proc.totalCost,
        impact: 'outflow'
      });
    });

    const parseDateStr = (dateStr: string) => {
      try {
        const parts = dateStr.split(' ');
        if (parts.length === 3) {
          const months: { [key: string]: number } = {
            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
            jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
          };
          const day = parseInt(parts[0], 10);
          const month = months[parts[1].toLowerCase().substring(0, 3)] || 0;
          const year = parseInt(parts[2], 10);
          return new Date(year, month, day).getTime();
        }
        return Date.parse(dateStr) || 0;
      } catch {
        return 0;
      }
    };

    return movements.sort((a, b) => {
      const timeA = parseDateStr(a.date);
      const timeB = parseDateStr(b.date);
      if (timeB !== timeA) return timeB - timeA;
      return b.id.localeCompare(a.id);
    });
  })();

  // Group transactions for the chart
  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);
  
  const chartPoints: any[] = Object.entries(
    transactions.reduce((acc, trx) => {
      // In a real app we'd parse the actual date, this is simplified
      const idStr = trx.id.split('-')[1];
      const date = new Date(parseInt(idStr) || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      if (!acc[date]) acc[date] = { name: date, revenue: 0, cost: 0 };
      acc[date].revenue += trx.total;
      acc[date].cost += trx.cost;
      return acc;
    }, {} as Record<string, any>)
  ).map(([, val]) => val);
  
  // Intercept and pad single data point to resolve Recharts dual-point requirement for line rendering
  let chartData = [...chartPoints];
  if (chartData.length === 1) {
    const singlePoint = chartData[0];
    let prevDateStr = 'Prev';
    try {
      const dNow = new Date();
      dNow.setDate(dNow.getDate() - 1);
      prevDateStr = dNow.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      if (prevDateStr === singlePoint.name) {
        dNow.setDate(dNow.getDate() - 1);
        prevDateStr = dNow.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      }
    } catch {
      prevDateStr = 'Prev';
    }
    chartData.unshift({ name: prevDateStr, revenue: 0, cost: 0 });
  } else if (chartData.length === 0) {
    const dNow = new Date();
    const dPrev = new Date();
    dPrev.setDate(dPrev.getDate() - 1);
    chartData = [
      { name: dPrev.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), revenue: 0, cost: 0 },
      { name: dNow.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), revenue: 0, cost: 0 }
    ];
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto relative">
      {successMsg && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 z-50">
          <CheckCircle2 size={16} />
          Transaction completed successfully!
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
          Financial Overview
        </h2>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button 
            onClick={() => setActiveLedgerModal('procurement')}
            className="px-4 py-2 text-sm font-medium bg-white border border-[#961b2b]/20 text-[#961b2b] hover:text-[#961b2b] rounded-lg hover:bg-[#961b2b]/5 transition-all shadow-sm flex items-center gap-1.5 min-h-[44px]"
          >
            <History size={14} /> View Procurement History
          </button>
          <button 
            onClick={() => setIsInjectModalOpen(true)}
            className="px-4 py-2 text-sm font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors shadow-sm min-h-[44px]"
          >
            Inject Capital
          </button>
          <button 
            onClick={() => setIsNewSaleOpen(true)}
            className="px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-bold bg-[#961b2b] text-gray-100 rounded-xl hover:bg-[#961b2b]/95 shadow-[0_4px_12px_rgba(150,27,43,0.3)] hover:shadow-[0_6px_16px_rgba(150,27,43,0.4)] transition-all flex items-center justify-center gap-2 min-h-[44px]"
          >
            New Transaction
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Total Out-of-Pocket Capital"
          value={formatIDR(totalCapital)}
          trend="Base Investment"
          isPositive={null}
          icon={<DollarSign className="text-gray-500" size={20} />}
          onClick={() => setActiveLedgerModal('total')}
        />
        <MetricCard
          title="Cash Reserve (Wallet)"
          value={formatIDR(liquidWalletBalance)}
          trend={liquidWalletBalance >= totalCapital ? 'Profitable' : 'Deficit'}
          isPositive={liquidWalletBalance >= totalCapital}
          icon={<TrendingUp className="text-[#961b2b]" size={20} />}
          onClick={() => setActiveLedgerModal('cash')}
        />
        <MetricCard
          title="Active Capital at Risk"
          value={formatIDR(activeCapitalAtRisk)}
          trend="Exposure"
          isPositive={false}
          icon={<PackageOpen className="text-[#961b2b]" size={20} />}
          highlight={false}
          valueColor="text-gray-900"
          onClick={() => setActiveLedgerModal('active')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.04)] p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Revenue vs Cost of Goods Sold
              </h3>
              <select className="bg-[#f2f2f2] border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-[#961b2b]/50">
                <option>Last 30 Days</option>
                <option>This Quarter</option>
                <option>Year to Date</option>
              </select>
            </div>
            <div className="h-72 min-h-[300px] w-full" style={{ minHeight: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#961b2b" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#961b2b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="name"
                    stroke="#52525b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => formatIDR(value)}
                    contentStyle={{
                      backgroundColor: '#f2f2f2',
                      borderColor: '#e5e7eb',
                      color: '#111827',
                      borderRadius: '8px'
                    }}
                    itemStyle={{ color: '#111827' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    dot={{ r: 3, strokeWidth: 1.5, fill: '#10b981' }}
                    activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    stroke="#961b2b"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorCost)"
                    dot={{ r: 3, strokeWidth: 1.5, fill: '#961b2b' }}
                    activeDot={{ r: 6, strokeWidth: 0, fill: '#961b2b' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.04)] p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Recent High-Value Transactions
              </h3>
              <button className="text-sm text-[#961b2b] hover:text-[#961b2b] transition-colors">
                View All
              </button>
            </div>
            <InventoryTable transactions={transactions} inventory={inventory} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.04)] p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-6">
              <BrainCircuit className="text-[#961b2b]" size={20} />
              <h3 className="text-lg font-semibold text-gray-900">
                AI Insights
              </h3>
            </div>
            <div className="space-y-4">
              <div className="p-4 text-center border border-dashed border-gray-200 rounded-xl">
                <p className="text-sm text-gray-500">No active insights available.</p>
                <p className="text-xs text-gray-600 mt-1">Add items to trigger AI analysis.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <NewSaleDrawer 
        isOpen={isNewSaleOpen} 
        onClose={() => setIsNewSaleOpen(false)} 
        inventory={inventory} 
        onAddTransaction={handleAddAndShowSuccess} 
        onUpdateInventory={onUpdateInventory} 
      />

      {isInjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsInjectModalOpen(false)}
          />
          <div className="relative bg-[#f2f2f2] border border-gray-200 rounded-[12px] shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 bg-white border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Inject Capital</h3>
              <p className="text-sm text-gray-500 mt-1">Add funds to your Out-of-Pocket capital and Cash Reserve.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (IDR)</label>
                <input
                  type="number"
                  value={injectAmount}
                  onChange={(e) => setInjectAmount(e.target.value)}
                  placeholder="e.g. 1000000"
                  className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#961b2b]/50 focus:ring-1 focus:ring-[#961b2b]/50 transition-all font-mono"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsInjectModalOpen(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInject}
                  disabled={!injectAmount || parseFloat(injectAmount) <= 0}
                  className="flex-1 px-4 py-2 text-sm font-medium bg-[#961b2b] text-gray-100 rounded-lg hover:bg-[#961b2b]/95 disabled:opacity-50 transition-all shadow-sm"
                >
                  Add Funds
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Ledger Modals --- */}
      {/* 1. Total Capital Ledger Modal */}
      {activeLedgerModal === 'total' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setActiveLedgerModal(null)}
          />
          <div className="relative bg-white border border-gray-200 rounded-[16px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Total Out-of-Pocket Capital Ledger</h3>
                <p className="text-xs text-gray-500 mt-1">History of manual capital seed injections that establish your base investment.</p>
              </div>
              <button 
                onClick={() => setActiveLedgerModal(null)}
                className="p-1.5 hover:bg-gray-250 rounded-lg text-gray-500 hover:text-gray-800 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Summary stats */}
              <div className="bg-[#961b2b]/5 border border-[#961b2b]/15 rounded-xl p-4 flex justify-between items-center font-mono">
                <div>
                  <span className="text-[11px] text-gray-500 uppercase tracking-wider block font-semibold">Total Base Investment</span>
                  <span className="text-2xl font-extrabold text-[#961b2b]">{formatIDR(totalCapital)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-gray-500 uppercase tracking-wider block font-semibold">Injections Logs</span>
                  <span className="text-base font-bold text-gray-700">{capitalInjections.length} Entries</span>
                </div>
              </div>

              {/* Ledger list */}
              <div className="space-y-0">
                {capitalInjections.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 text-sm">
                    No manual capital injections recorded yet. Use "Inject Capital" to fund operations.
                  </div>
                ) : (
                  capitalInjections.map((inj) => (
                    <div key={inj.id} className="group flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-gray-100 transition-colors hover:bg-gray-50/30 px-2 -mx-2 rounded-lg">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{inj.date}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-600">
                            Capital In
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 font-mono">ID: {inj.id}</span>
                      </div>
                      
                      <div className="mt-3 sm:mt-0 flex items-center justify-between sm:justify-end gap-6">
                        <div className="text-right">
                          {editingId === inj.id ? (
                            <input 
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="border border-gray-200 rounded px-2 py-1 text-right w-32 font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-gray-800"
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                          ) : (
                            <span className="text-base font-bold text-gray-900">{formatIDR(inj.amount)}</span>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-end gap-1 min-w-[70px]">
                          {editingId === inj.id ? (
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button 
                                type="button"
                                onClick={() => submitEdit('capital_injections', inj.trueDbId)}
                                className="px-2 py-1 text-[10px] font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                              >
                                Save
                              </button>
                              <button 
                                type="button"
                                onClick={() => { setEditingId(null); setEditValue(""); }}
                                className="px-2 py-1 text-[10px] font-medium bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 text-gray-400">
                              <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleEditInjection(inj); }}
                                className="hover:text-blue-600 transition-colors"
                                title="Edit"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleDeleteInjection(inj.trueDbId || inj.id); }}
                                className="hover:text-red-600 transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setActiveLedgerModal(null)}
                className="px-6 py-2 text-xs font-bold bg-[#961b2b] text-gray-100 rounded-lg hover:bg-[#961b2b]/95 shadow transition-all duration-150 min-h-[40px]"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Cash Reserve Ledger Modal */}
      {activeLedgerModal === 'cash' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setActiveLedgerModal(null)}
          />
          <div className="relative bg-white border border-gray-200 rounded-[16px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Cash Reserve (Wallet) Ledger</h3>
                <p className="text-xs text-gray-500 mt-1">Real-time breakdown of fluid cash reserve (Injections + Sales Revenue - Procurements).</p>
              </div>
              <button 
                onClick={() => setActiveLedgerModal(null)}
                className="p-1.5 hover:bg-gray-250 rounded-lg text-gray-500 hover:text-gray-800 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>
            
             {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Summary stats */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex justify-between items-center font-mono">
                <div>
                  <span className="text-[11px] text-gray-500 uppercase tracking-wider block font-semibold">Active Liquid Wallet Balance</span>
                  <span className={`text-2xl font-extrabold ${liquidWalletBalance >= 0 ? 'text-[#961b2b]' : 'text-red-600'}`}>
                    {formatIDR(liquidWalletBalance)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-gray-500 uppercase tracking-wider block font-semibold">Journal Entries</span>
                  <span className="text-base font-bold text-gray-700">{cashLedgerItems.length} Records</span>
                </div>
              </div>

              {/* Ledger list */}
              <div className="border border-gray-200 rounded-xl overflow-hidden animate-in fade-in duration-300">
                <div className="overflow-x-auto max-h-[45vh]">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-500 border-b border-gray-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-5 py-3 font-semibold text-[10px] uppercase tracking-wider">Date</th>
                        <th className="px-5 py-3 font-semibold text-[10px] uppercase tracking-wider">Flow</th>
                        <th className="px-5 py-3 font-semibold text-[10px] uppercase tracking-wider">Source description</th>
                        <th className="px-5 py-3 font-semibold text-[10px] uppercase tracking-wider text-right">Cash Impact</th>
                        <th className="px-5 py-3 font-semibold text-[10px] uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono text-gray-705">
                      {cashLedgerItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-8 text-center text-gray-500 font-sans">
                            No cash reserve movements registered in the wallet ledger yet.
                          </td>
                        </tr>
                      ) : (
                        cashLedgerItems.map((move, hIdx) => (
                          <tr key={`${move.id}-${hIdx}`} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-5 py-3 text-gray-500 text-[11px] font-sans whitespace-nowrap">{move.date}</td>
                            <td className="px-5 py-3 font-sans whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                move.impact === 'inflow' 
                                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600'
                                  : 'bg-red-500/10 border border-red-500/20 text-red-600'
                              }`}>
                                {move.impact === 'inflow' ? 'Cash In' : 'Cash Out'}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-gray-800 break-words font-sans font-medium min-w-[200px]">
                              <div className="line-clamp-1 leading-snug whitespace-normal">{move.description}</div>
                              <div className="text-[10px] text-gray-400 mt-0.5 font-mono">{move.id}</div>
                            </td>
                            <td className={`px-5 py-3 text-right font-bold whitespace-nowrap ${
                              move.impact === 'inflow' ? 'text-emerald-500' : 'text-red-500'
                            }`}>
                              {editingId === move.id ? (
                                <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <span>{move.impact === 'inflow' ? '+' : '-'}</span>
                                  <input 
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="border border-gray-300 rounded px-2 py-1 text-right w-36 font-mono text-xs focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none text-gray-800"
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                  />
                                </div>
                              ) : (
                                <>
                                  {move.impact === 'inflow' ? '+' : '-'}{formatIDR(move.amount).replace('Rp', '').trim()}
                                </>
                              )}
                            </td>
                             <td className="px-5 py-3 text-right">
                              {editingId === move.id ? (
                                <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <button 
                                    type="button"
                                    onClick={() => submitEdit('cash_ledger', move.trueDbId)}
                                    className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors cursor-pointer"
                                    title="Save changes"
                                  >
                                    Save
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => { setEditingId(null); setEditValue(""); }}
                                    className="px-2.5 py-1 text-[11px] font-bold bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors cursor-pointer"
                                    title="Cancel editing"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-2">
                                  <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleEdit('cash_ledger', move); }}
                                    className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-blue-600 transition-colors cursor-pointer"
                                    title="Edit"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleDelete('cash_ledger', move.trueDbId); }}
                                    className="p-1 hover:bg-red-50 rounded text-gray-500 hover:text-red-600 transition-colors cursor-pointer"
                                    title="Delete"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setActiveLedgerModal(null)}
                className="px-6 py-2 text-xs font-bold bg-[#961b2b] text-gray-100 rounded-lg hover:bg-[#961b2b]/95 shadow transition-all duration-150 min-h-[40px]"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Active Capital Ledger Modal */}
      {activeLedgerModal === 'active' && (() => {
        const unsoldItems = inventory.filter(item => item.quantity > 0 && item.status === 'In Stock');
        const totalActiveCost = activeCapitalAtRisk;
        
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
              onClick={() => setActiveLedgerModal(null)}
            />
            <div className="relative bg-white border border-gray-200 rounded-[16px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-5 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Active Capital ("Risk Flow") Ledger</h3>
                  <p className="text-xs text-gray-500 mt-1">Chronological exposure timeline of physical inventory life cycle (Procurements and Sales).</p>
                </div>
                <button 
                  onClick={() => setActiveLedgerModal(null)}
                  className="p-1.5 hover:bg-gray-250 rounded-lg text-gray-500 hover:text-gray-800 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>
              
              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Summary stats */}
                <div className="bg-[#961b2b]/5 border border-[#961b2b]/15 rounded-xl p-4 flex justify-between items-center font-mono">
                  <div>
                    <span className="text-[11px] text-gray-500 uppercase tracking-wider block font-semibold">Total Stock Cost Basis Exposure</span>
                    <span className="text-2xl font-extrabold text-[#961b2b]">{formatIDR(totalActiveCost)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-gray-500 uppercase tracking-wider block font-semibold">In-Stock Products</span>
                    <span className="text-base font-bold text-gray-700">{unsoldItems.length} Unique Cards</span>
                  </div>
                </div>

                {/* Ledger list */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto max-h-[45vh]">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-gray-50 text-gray-500 border-b border-gray-200 sticky top-0 z-10 font-sans">
                        <tr>
                          <th className="px-5 py-3 font-semibold text-[10px] uppercase tracking-wider">Date</th>
                          <th className="px-5 py-3 font-semibold text-[10px] uppercase tracking-wider">Event Type</th>
                          <th className="px-5 py-3 font-semibold text-[10px] uppercase tracking-wider">Item Description</th>
                          <th className="px-5 py-3 font-semibold text-[10px] uppercase tracking-wider text-right">Exposure Impact</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-mono text-gray-705 text-[11px]">
                        {exposureEvents.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-5 py-8 text-center text-gray-500 font-sans">
                              No exposure events are recorded in your risk flow timeline.
                            </td>
                          </tr>
                        ) : (
                          exposureEvents.map((evt, idx) => {
                            const isAdded = evt.impact > 0;
                            return (
                              <tr key={`${evt.id}-${idx}`} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-5 py-3 text-gray-650 font-sans">
                                  {formatDate(evt.date)}
                                </td>
                                <td className="px-5 py-3 font-sans whitespace-nowrap">
                                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                                    isAdded 
                                      ? 'bg-rose-500/10 border border-rose-500/20 text-red-600'
                                      : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600'
                                  }`}>
                                    {evt.type}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-gray-800 font-sans font-medium break-words max-w-sm whitespace-normal leading-relaxed">
                                  {evt.itemDNA}
                                </td>
                                <td className={`px-5 py-3 text-right font-extrabold text-sm whitespace-nowrap ${
                                  isAdded ? 'text-red-600' : 'text-emerald-600'
                                }`}>
                                  {isAdded ? `+ ${formatIDR(evt.impact)}` : `- ${formatIDR(Math.abs(evt.impact))}`}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setActiveLedgerModal(null)}
                  className="px-6 py-2 text-xs font-bold bg-[#961b2b] text-gray-100 rounded-lg hover:bg-[#961b2b]/95 shadow transition-all duration-150 min-h-[40px]"
                >
                  Close Ledger
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 4. Procurement History Ledger Modal */}
      {activeLedgerModal === 'procurement' && (() => {
        const allProcurements = [...inventory].sort((a, b) => {
          const d1 = a.dateAdded ? (typeof a.dateAdded.toDate === 'function' ? a.dateAdded.toDate() : new Date(a.dateAdded)) : new Date(0);
          const d2 = b.dateAdded ? (typeof b.dateAdded.toDate === 'function' ? b.dateAdded.toDate() : new Date(b.dateAdded)) : new Date(0);
          return d2.getTime() - d1.getTime();
        });

        const totalAllTimeDepl = inventory.reduce((sum, item) => {
          const qty = item.quantity > 0 ? item.quantity : 1;
          return sum + ((item.costBasis || 0) * qty);
        }, 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
              onClick={() => setActiveLedgerModal(null)}
            />
            <div className="relative bg-white border border-gray-200 rounded-[16px] shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-5 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <History className="text-[#961b2b]" size={20} />
                    All-Time Procurement History Ledger
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Complete chronological breakdown of all-time deployed capital across catalog lots (both Active and Sold).</p>
                </div>
                <button 
                  onClick={() => setActiveLedgerModal(null)}
                  className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 hover:text-gray-800 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>
              
              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Summary Stats Header */}
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4 flex justify-between items-center font-mono">
                  <div>
                    <span className="text-[11px] text-gray-500 uppercase tracking-wider block font-semibold">Total All-Time Deployed Capital</span>
                    <span className="text-2xl font-extrabold text-[#961b2b]">{formatIDR(totalAllTimeDepl)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-gray-500 uppercase tracking-wider block font-semibold">Total Acquired Lots</span>
                    <span className="text-base font-bold text-gray-700">{allProcurements.length} Card Batches</span>
                  </div>
                </div>

                {/* Ledger list */}
                <div className="border border-gray-200 rounded-xl overflow-hidden font-sans">
                  <div className="overflow-x-auto max-h-[45vh]">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-gray-50 text-gray-500 border-b border-gray-200 sticky top-0 z-10">
                        <tr>
                          <th className="px-5 py-3 font-semibold text-[10px] uppercase tracking-wider">Date Procured</th>
                          <th className="px-5 py-3 font-semibold text-[10px] uppercase tracking-wider">Item DNA (Name/Set)</th>
                          <th className="px-5 py-3 font-semibold text-[10px] uppercase tracking-wider text-right">Cost Basis</th>
                          <th className="px-5 py-3 font-semibold text-[10px] uppercase tracking-wider text-center font-sans">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-mono text-gray-705 text-[11px]">
                        {allProcurements.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-5 py-8 text-center text-gray-500 font-sans">
                              No procurements recorded yet. Add inventory items to begin!
                            </td>
                          </tr>
                        ) : (
                          allProcurements.map((item, idx) => {
                            const isSold = item.status === 'Sold' || item.quantity === 0;
                            return (
                              <tr key={`${item.id}-${idx}`} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-5 py-3 text-gray-600">
                                  {formatDate(item.dateAdded || item.acquisitionDate)}
                                </td>
                                <td className="px-5 py-3 text-gray-850 font-sans min-w-[150px]">
                                  <div className="font-bold leading-tight text-sm text-gray-900 break-words line-clamp-1 whitespace-normal">
                                    {item.name}
                                  </div>
                                  <div className="text-[10px] text-gray-400 mt-0.5 font-medium leading-none">
                                    {item.set} {item.cardNumber ? `#${item.cardNumber}` : ''} • {item.condition} ({item.foilType || 'Non-Foil'})
                                  </div>
                                </td>
                                <td className="px-5 py-3 text-right font-bold text-gray-850 text-sm">
                                  {formatIDR((item.costBasis || 0) * (item.quantity || 1))}
                                  <span className="block text-[10px] text-gray-400 font-medium font-sans">
                                    {formatIDR(item.costBasis)} × {item.quantity || 1}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-center">
                                  {isSold ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide bg-gray-100 text-gray-400 uppercase border border-gray-200 font-sans">
                                      Sold
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide bg-emerald-50 text-emerald-600 uppercase border border-emerald-500/20 font-sans">
                                      Active
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setActiveLedgerModal(null)}
                  className="px-6 py-2 text-xs font-bold bg-[#961b2b] text-gray-100 rounded-lg hover:bg-[#961b2b]/95 shadow transition-all duration-150 min-h-[40px]"
                >
                  Close History
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function MetricCard({
  title,
  value,
  trend,
  isPositive,
  icon,
  highlight = false,
  valueColor = 'text-gray-900',
  onClick,
}: {
  title: string;
  value: string;
  trend: string;
  isPositive: boolean | null;
  icon: React.ReactNode;
  highlight?: boolean;
  valueColor?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`p-6 rounded-[12px] border transition-all duration-200 ${
        onClick 
          ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] hover:border-[#961b2b]/40' 
          : ''
      } ${
        highlight
          ? 'bg-gradient-to-br from-white to-gray-50 border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.04)]'
          : 'bg-white border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.04)]'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <div className="p-2 bg-[#f2f2f2] rounded-lg">{icon}</div>
      </div>
      <div className="flex items-baseline gap-2 overflow-hidden">
        <span
          className={`text-2xl lg:text-3xl font-bold tracking-tight truncate ${valueColor}`}
        >
          {value}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-sm">
        {isPositive !== null && (
          <span
            className={`flex items-center ${
              isPositive ? 'text-emerald-500' : 'text-[#961b2b]'
            }`}
          >
            {isPositive ? (
              <ArrowUpRight size={16} />
            ) : (
              <ArrowDownRight size={16} />
            )}
            {trend}
          </span>
        )}
        {isPositive === null && (
          <span className="text-gray-500 font-medium">{trend}</span>
        )}
      </div>
    </div>
  );
}

function AiRecommendationCard({
  type,
  title,
  description,
  action,
}: {
  type: 'pricing' | 'slow-moving' | 'restock';
  title: string;
  description: string;
  action: string;
}) {
  const getIcon = () => {
    switch (type) {
      case 'pricing':
        return <TrendingUp size={16} className="text-blue-400" />;
      case 'slow-moving':
        return <PackageOpen size={16} className="text-yellow-400" />;
      case 'restock':
        return <AlertTriangle size={16} className="text-[#961b2b]" />;
    }
  };

  return (
    <div className="p-4 rounded-xl bg-[#f2f2f2] border border-gray-200 hover:border-gray-200 transition-colors group">
      <div className="flex items-start gap-3">
        <div className="mt-1 p-1.5 bg-white rounded-md border border-gray-200">
          {getIcon()}
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-800">{title}</h4>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            {description}
          </p>
          <button className="mt-3 text-xs font-medium text-[#961b2b] hover:text-[#961b2b] flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            {action} <ArrowUpRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function InventoryTable({ transactions, inventory }: { transactions: any[], inventory: any[] }) {
  const recentTransactions = [...transactions].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 5);

  const getChannelBadge = (channel: string) => {
    switch (channel) {
      case 'In-Store POS':
        return 'bg-[#961b2b]/10 text-[#961b2b] border-[#961b2b]/20';
      case 'Tokopedia':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'TikTok Shop':
        return 'bg-gray-800/10 text-gray-900 border-gray-800/20';
      case 'Shopee':
        return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'eBay':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default:
        return 'bg-[#961b2b]/10 text-[#961b2b] border-[#961b2b]/20';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="hidden md:table-row text-gray-500 border-b border-gray-200">
            <th className="pb-3 font-medium">Item</th>
            <th className="pb-3 font-medium">Channel</th>
            <th className="pb-3 font-medium">Type</th>
            <th className="pb-3 font-medium text-right">Amount</th>
            <th className="pb-3 font-medium text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 md:table-row-group block w-full">
          {recentTransactions.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-8 text-center text-gray-500">
                No recent transactions
              </td>
            </tr>
          ) : (
            recentTransactions.map((trx) => {
              const firstItem = trx.items[0];
              const invItem = inventory.find(i => i.id === firstItem.id);
              const itemName = firstItem ? firstItem.name : 'Unknown Item';
              const addition = trx.items.length > 1 ? ` + ${trx.items.length - 1} more` : '';
              
              const isProfit = (trx.total - trx.cost - trx.platform_fee - trx.shipping_cost) > 0;

              return (
                <React.Fragment key={trx.id}>
                  {/* Desktop view */}
                  <tr className="hidden md:table-row group hover:bg-gray-50 transition-colors">
                    <td className="py-4">
                      <div className="font-medium text-gray-800">{itemName}{addition}</div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">{trx.id}</div>
                    </td>
                    <td className="py-4">
                      <span className={`px-2.5 py-1 rounded-full border text-xs font-semibold ${getChannelBadge(trx.channel)}`}>
                        {trx.channel}
                      </span>
                    </td>
                    <td className="py-4 text-gray-500">{firstItem ? firstItem.category : 'N/A'}</td>
                    <td className={`py-4 text-right font-mono ${isProfit ? 'text-emerald-500' : 'text-[#961b2b]'}`}>
                      {formatIDR(trx.total)}
                    </td>
                    <td className="py-4 text-right">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          trx.status === 'Completed' ? 'text-emerald-500' : 'text-gray-500'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            trx.status === 'Completed' ? 'bg-emerald-500' : 'bg-gray-400'
                          }`}
                        />
                        {trx.status}
                      </span>
                    </td>
                  </tr>

                  {/* Mobile view (Card Stack) */}
                  <tr className="md:hidden block w-full border-b border-gray-100 last:border-0">
                    <td className="block p-0 border-none bg-transparent w-full">
                      <div className="flex flex-col gap-2.5 py-3.5 bg-white rounded-lg">
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-0.5">
                            <div className="font-semibold text-gray-800 text-sm leading-tight break-words whitespace-normal">{itemName}{addition}</div>
                            <div className="text-[11px] text-gray-400 mt-0.5 flex flex-wrap items-center gap-1.5 font-medium">
                              <span className="font-mono">{trx.id}</span>
                              <span className="text-gray-300 font-sans">•</span>
                              <span className="text-gray-500 font-sans">{trx.date}</span>
                            </div>
                          </div>
                          <div className={`text-sm font-bold font-mono whitespace-nowrap mt-0.5 ${isProfit ? 'text-emerald-500' : 'text-[#961b2b]'}`}>
                            {formatIDR(trx.total)}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-50">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${getChannelBadge(trx.channel)}`}>
                              {trx.channel}
                            </span>
                            <span className="text-[11px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                              {firstItem ? firstItem.category : 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                                trx.status === 'Completed' ? 'text-emerald-500' : 'text-gray-500'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  trx.status === 'Completed' ? 'bg-emerald-500' : 'bg-gray-400'
                                }`}
                              />
                              {trx.status}
                            </span>
                          </div>
                        </div>

                        {/* Financial Breakdown */}
                        <div className="mt-2 text-[11px] p-2 bg-[#f2f2f2]/60 rounded-lg border border-gray-100 flex items-center justify-between text-xs gap-3">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500 font-medium">Base Cost:</span>
                            <span className="font-mono text-gray-700 font-medium">{formatIDR(trx.cost || 0)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500 font-medium">Profit margin:</span>
                            <span className={`font-mono font-bold ${(trx.total - (trx.cost || 0)) >= 0 ? 'text-[#2e7d32]' : 'text-[#961b2b]'}`}>
                              {formatIDR(trx.total - (trx.cost || 0))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

const chartData: any[] = [];
