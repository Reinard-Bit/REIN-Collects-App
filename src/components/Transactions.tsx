import React, { useState, useRef } from 'react';
import { Search, Plus, X, ShoppingCart, Trash2, ArrowRight, Clock, Store, Globe, ShoppingBag, Package, Info, Camera, CheckCircle2 } from 'lucide-react';
import { formatIDR } from '../utils/currency';
import { CurrencyInput } from './CurrencyInput';
import { BarcodeScanner } from './BarcodeScanner';
import { NewSaleDrawer } from './NewSaleDrawer';

interface TransactionsProps {
  key?: string | number;
  inventory: any[];
  transactions: any[];
  onAddTransaction: (t: any) => void;
  onUpdateInventory: (items: {id: string, quantityToDeduct: number}[]) => void;
  initialSellItemCode?: string;
}

export function Transactions({ inventory, transactions, onAddTransaction, onUpdateInventory, initialSellItemCode }: TransactionsProps) {
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(!!initialSellItemCode);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const scanLockRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<{ id: string; name: string; price: number; cost: number; quantity: number, maxQuantity: number, category: string }[]>([]);
  const [salesChannel, setSalesChannel] = useState('In-Store POS');
  const [platformFee, setPlatformFee] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState(false);

  const handleScan = (decodedText: string) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    setIsProcessingScan(true);

    const sanitizedScan = decodedText.trim().toUpperCase();
    setSearchQuery(sanitizedScan);
    setIsScannerOpen(false);
    console.log("Scanned:", sanitizedScan);

    setTimeout(() => {
      scanLockRef.current = false;
      setIsProcessingScan(false);
    }, 600);
  };

  const filteredInventory = searchQuery 
    ? inventory.filter(item => 
        item.quantity > 0 &&
        (item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.cardNumber && item.cardNumber.toLowerCase().includes(searchQuery.toLowerCase())))
      )
    : inventory.filter(item => item.quantity > 0);

  const addToCart = (item: any) => {
    setErrorMsg('');
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      if (existing.quantity < item.quantity) {
        setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
    } else {
      setCart([...cart, { id: item.id, name: item.name, price: item.currentPrice || 0, cost: item.costBasis, quantity: 1, maxQuantity: item.quantity, category: item.category }]);
    }
    setSearchQuery('');
  };

  const updateQuantity = (id: string, delta: number) => {
    setErrorMsg('');
    setCart(cart.map(c => {
      if (c.id === id) {
        const newQ = c.quantity + delta;
        return newQ > 0 ? { ...c, quantity: newQ } : c;
      }
      return c;
    }));
  };

  const removeFromCart = (id: string) => {
    setErrorMsg('');
    setCart(cart.filter(c => c.id !== id));
  };

  const handleCompleteTransaction = () => {
    const outOfStock = cart.find(c => {
      const invItem = inventory.find(i => i.id === c.id);
      return !invItem || invItem.quantity < c.quantity;
    });

    if (outOfStock) {
      setErrorMsg(`Insufficient stock for ${outOfStock.name}. Please adjust quantity.`);
      return;
    }

    const transaction = {
      id: `TRX-${Date.now()}`,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      channel: salesChannel,
      total: cartTotal,
      cost: cartCost,
      platform_fee: platformFee,
      shipping_cost: shippingCost,
      status: 'Completed',
      items: cart
    };

    onAddTransaction(transaction);
    
    setIsNewSaleOpen(false);
    setCart([]);
    setPlatformFee(0);
    setShippingCost(0);
    setSearchQuery('');
    setSuccessMsg(true);
    setTimeout(() => setSuccessMsg(false), 3000);
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCost = cart.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
  const trueNetProfit = cartTotal - cartCost - platformFee - shippingCost;

  const handleAddAndShowSuccess = (t: any) => {
    onAddTransaction(t);
    setSuccessMsg(true);
    setTimeout(() => setSuccessMsg(false), 3000);
  };

  const getChannelBadge = (channel: string) => {
    switch (channel) {
      case 'In-Store POS':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium"><Store size={12} /> {channel}</span>;
      case 'REIN Collects Website':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium"><Globe size={12} /> {channel}</span>;
      case 'eBay':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-medium"><ShoppingBag size={12} /> {channel}</span>;
      case 'Shopee':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium"><Package size={12} /> {channel}</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full bg-gray-500/10 border border-gray-500/20 text-gray-500 text-xs font-medium">{channel}</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed':
        return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {status}</span>;
      case 'Pending Shipment':
        return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-yellow-500"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500" /> {status}</span>;
      case 'Cancelled':
        return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#961b2b]"><span className="w-1.5 h-1.5 rounded-full bg-[#961b2b]" /> {status}</span>;
      default:
        return <span className="text-gray-500 text-xs">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto relative">
      {successMsg && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 z-50">
          <CheckCircle2 size={16} />
          Transaction completed successfully!
        </div>
      )}

      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
            Transactions & POS
          </h2>
          <p className="text-gray-500 mt-1 text-sm">
            Manage sales ledger and process new point-of-sale orders.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial sm:w-80 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Search Order ID..."
              className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:border-[#961b2b]/50 focus:ring-1 focus:ring-[#961b2b]/50 transition-all min-h-[44px]"
            />
          </div>
          <button 
            onClick={() => setIsNewSaleOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-[#961b2b] text-gray-900 rounded-lg hover:bg-[#961b2b]/90 shadow-[0_0_15px_rgba(150,27,43,0.3)] transition-all whitespace-nowrap min-h-[44px] w-full sm:w-auto"
          >
            <Plus size={16} />
            New Sale
          </button>
        </div>
      </div>

      {/* Sales Ledger Data Grid */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm block md:table">
            <thead>
              <tr className="hidden md:table-row text-gray-500 border-b border-gray-200 bg-[#f2f2f2]/50">
                <th className="px-6 py-4 font-medium">Order ID & Date</th>
                <th className="px-6 py-4 font-medium">Sales Channel</th>
                <th className="px-6 py-4 font-medium text-right">Total Sale</th>
                <th className="px-6 py-4 font-medium text-right">Net Profit</th>
                <th className="px-6 py-4 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 md:table-row-group block w-full">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.map((trx) => {
                  const profit = trx.total - trx.cost - (trx.platform_fee || 0) - (trx.shipping_cost || 0);
                  const firstItem = trx.items && trx.items[0];
                  const itemName = firstItem ? firstItem.name : 'Manual / Custom Sale';
                  const count = trx.items ? trx.items.length : 0;
                  const addition = count > 1 ? ` + ${count - 1} more` : '';
                  const profitMargin = trx.total - trx.cost;

                  return (
                    <React.Fragment key={trx.id}>
                      {/* Desktop Row view */}
                      <tr className="hidden md:table-row group hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-mono font-medium text-gray-800">{trx.id}</div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                            <Clock size={12} /> {trx.date}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getChannelBadge(trx.channel)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-gray-800">
                          {formatIDR(trx.total)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono relative">
                          <div className="group/tooltip inline-block relative">
                            <span className={`cursor-help border-b border-dashed border-gray-300 ${profit > 0 ? 'text-emerald-500' : profit < 0 ? 'text-[#961b2b]' : 'text-gray-500'}`}>
                              {profit > 0 ? '+' : ''}{formatIDR(Math.abs(profit))}
                            </span>
                            
                            {/* Tooltip */}
                            <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-[#1a1a1c] border border-gray-200 rounded-lg shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-10 text-xs text-gray-700 pointer-events-none">
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span>Gross Revenue:</span>
                                  <span className="text-gray-800">{formatIDR(trx.total)}</span>
                                </div>
                                <div className="flex justify-between text-[#961b2b]">
                                  <span>Cost Basis:</span>
                                  <span>-{formatIDR(trx.cost)}</span>
                                </div>
                                <div className="flex justify-between text-[#961b2b]">
                                  <span>Platform Fees:</span>
                                  <span>-{formatIDR(trx.platform_fee || 0)}</span>
                                </div>
                                <div className="flex justify-between text-[#961b2b]">
                                  <span>Shipping:</span>
                                  <span>-{formatIDR(trx.shipping_cost || 0)}</span>
                                </div>
                                <div className="pt-2 mt-1 border-t border-gray-200 flex justify-between font-medium">
                                  <span>True Net Profit:</span>
                                  <span className={profit > 0 ? 'text-emerald-400' : profit < 0 ? 'text-[#961b2b]' : 'text-gray-500'}>
                                    {formatIDR(profit)}
                                  </span>
                                </div>
                              </div>
                              {/* Arrow */}
                              <div className="absolute top-full right-4 -mt-1 border-4 border-transparent border-t-[#1a1a1c]" />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {getStatusBadge(trx.status)}
                        </td>
                      </tr>

                      {/* Mobile Card Stack view */}
                      <tr className="md:hidden block w-full border-b border-gray-100 last:border-0 hover:bg-gray-50/30 transition-colors">
                        <td className="block p-4 border-none bg-transparent w-full">
                          <div className="flex flex-col gap-3">
                            {/* Header: Item Name and Status */}
                            <div className="flex justify-between items-start gap-2">
                              <div className="space-y-1">
                                <div className="font-bold text-gray-900 text-sm leading-tight break-words whitespace-normal">
                                  {itemName}{addition}
                                </div>
                                <span className="inline-block font-mono text-[10px] font-semibold text-gray-500 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded">
                                  {trx.id}
                                </span>
                              </div>
                              {getStatusBadge(trx.status)}
                            </div>

                            {/* Total Sale row */}
                            <div className="flex justify-between items-center text-xs text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                              <span className="font-medium text-gray-600">Total Sale</span>
                              <span className="font-mono font-bold text-gray-900 text-sm">{formatIDR(trx.total)}</span>
                            </div>

                            {/* Financial Breakdown Row: Cost basis and Profit margin */}
                            <div className="flex items-center justify-between text-[12px] text-gray-500 py-1.5 px-2 bg-[#961b2b]/5 rounded-lg border border-[#961b2b]/10 font-mono">
                              <div>
                                Cost: <span className="font-bold text-gray-700">{formatIDR(trx.cost)}</span>
                              </div>
                              <div className="text-gray-300">|</div>
                              <div>
                                Profit:{' '}
                                <span className={`font-bold ${profitMargin >= 0 ? 'text-emerald-500' : 'text-[#961b2b]'}`}>
                                  {profitMargin >= 0 ? '+' : ''}{formatIDR(profitMargin)}
                                </span>
                              </div>
                            </div>

                            {/* Expandable/detailed exact fees subrow when applicable */}
                            {((trx.platform_fee || 0) > 0 || (trx.shipping_cost || 0) > 0) && (
                              <div className="flex flex-wrap gap-x-2 text-[10px] text-gray-400 font-mono px-1">
                                {(trx.platform_fee || 0) > 0 && <span>Fee: {formatIDR(trx.platform_fee)}</span>}
                                {(trx.shipping_cost || 0) > 0 && <span>Ship: {formatIDR(trx.shipping_cost)}</span>}
                                <span>• True Net Profit: <span className={profit >= 0 ? 'text-emerald-500' : 'text-[#961b2b]'}>{formatIDR(profit)}</span></span>
                              </div>
                            )}

                            {/* Footer: Date of Sale prominently displayed right next to Channel Badge */}
                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-50">
                              <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                                <Clock size={12} className="text-gray-400" />
                                <span>{trx.date}</span>
                              </div>
                              {getChannelBadge(trx.channel)}
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
      </div>

      <NewSaleDrawer 
        isOpen={isNewSaleOpen} 
        onClose={() => setIsNewSaleOpen(false)} 
        inventory={inventory} 
        onAddTransaction={handleAddAndShowSuccess} 
        onUpdateInventory={onUpdateInventory} 
        initialSellItemCode={initialSellItemCode}
      />
      <BarcodeScanner 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        onScan={handleScan} 
      />
    </div>
  );
}
