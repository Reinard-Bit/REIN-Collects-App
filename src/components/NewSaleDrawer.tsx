import React, { useState, useRef } from 'react';
import { Search, Plus, X, ShoppingCart, Trash2, ArrowRight, Camera, Info } from 'lucide-react';
import { formatIDR } from '../utils/currency';
import { CurrencyInput } from './CurrencyInput';
import { BarcodeScanner } from './BarcodeScanner';

interface NewSaleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: any[];
  onAddTransaction: (t: any) => void;
  onUpdateInventory: (items: {id: string, quantityToDeduct: number}[]) => void;
  initialSellItemCode?: string;
}

export function NewSaleDrawer({
  isOpen,
  onClose,
  inventory,
  onAddTransaction,
  onUpdateInventory,
  initialSellItemCode
}: NewSaleDrawerProps) {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [scanSuccessItem, setScanSuccessItem] = useState<any>(null);
  const scanLockRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<{ id: string; name: string; price: number; cost: number; quantity: number, maxQuantity: number, category: string }[]>(() => {
    if (initialSellItemCode) {
      const item = inventory.find(i => i.id === initialSellItemCode);
      if (item && item.quantity > 0) {
        return [{ id: item.id, name: item.name, price: item.currentPrice || 0, cost: item.costBasis, quantity: 1, maxQuantity: item.quantity, category: item.category }];
      }
    }
    return [];
  });
  const [salesChannel, setSalesChannel] = useState('In-Store POS');
  const [platformFee, setPlatformFee] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleScan = (decodedText: string) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    setIsProcessingScan(true);

    const sanitizedScan = decodedText.trim().toUpperCase();

    // Direct, strict lookup against the sanitized scanned string
    const foundItem = inventory.find(i => {
      const itemIdSanitized = i.id ? i.id.trim().toUpperCase() : '';
      const itemCardNumberSanitized = i.cardNumber ? i.cardNumber.trim().toUpperCase() : '';
      const itemNameSanitized = i.name ? i.name.trim().toUpperCase() : '';
      
      const matchesBatch = i.batches?.some((b: any) => b.batchId && b.batchId.trim().toUpperCase() === sanitizedScan);

      return itemIdSanitized === sanitizedScan || 
             itemCardNumberSanitized === sanitizedScan ||
             itemNameSanitized === sanitizedScan ||
             matchesBatch;
    });
    
    if (foundItem) {
      if (foundItem.quantity > 0) {
        addToCart(foundItem);
        setScanSuccessItem(foundItem);
        setTimeout(() => {
          setScanSuccessItem(null);
        }, 1500);
      } else {
        setErrorMsg(`Item ${foundItem.name} is out of stock.`);
      }
    } else {
      setSearchQuery(decodedText);
      setIsScannerOpen(false); // Close on unknown scan to let user search manually
    }

    // Cooldown lock for 600ms
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

    const cartTotalLocal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cartCostLocal = cart.reduce((sum, item) => sum + (item.cost * item.quantity), 0);

    const transaction = {
      id: `TRX-${Date.now()}`,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      channel: salesChannel,
      total: cartTotalLocal,
      cost: cartCostLocal,
      platform_fee: platformFee,
      shipping_cost: shippingCost,
      status: 'Completed',
      items: cart
    };

    onAddTransaction(transaction);
    onUpdateInventory(cart.map(c => ({ id: c.id, quantityToDeduct: c.quantity })));
    
    setCart([]);
    setPlatformFee(0);
    setShippingCost(0);
    setSearchQuery('');
    onClose();
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCost = cart.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
  const trueNetProfit = cartTotal - cartCost - platformFee - shippingCost;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-gray-200/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-[#f2f2f2] border-l border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.1)] z-50 flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#961b2b]/10 text-[#961b2b] rounded-lg">
              <ShoppingCart size={20} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">New Sale</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Sales Channel Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Sales Channel</label>
            <select 
              value={salesChannel}
              onChange={(e) => setSalesChannel(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#961b2b]/50 focus:ring-1 focus:ring-[#961b2b]/50 transition-all appearance-none"
            >
              <option value="In-Store POS">In-Store POS</option>
              <option value="REIN Collects Website">REIN Collects Website</option>
              <option value="eBay">eBay</option>
              <option value="Shopee">Shopee</option>
              <option value="Tokopedia">Tokopedia</option>
              <option value="TikTok Shop">TikTok Shop</option>
            </select>
          </div>

          {/* Quick Search */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Add Items</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search inventory..."
                  className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-800 placeholder-gray-600 focus:outline-none focus:border-[#961b2b]/50 focus:ring-1 focus:ring-[#961b2b]/50 transition-all"
                />
              </div>
              <button 
                onClick={() => setIsScannerOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[#961b2b] text-white rounded-lg hover:bg-[#961b2b]/90 transition-colors font-medium text-sm flex-shrink-0 shadow-sm"
                title="Scan Barcode"
              >
                <Camera size={18} />
                Scan Item
              </button>
            </div>
            
            {/* Search Results (Click to add) */}
            <div className="mt-2 space-y-1">
              {filteredInventory.slice(0, 5).map(item => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 text-left transition-colors group"
                >
                  <div>
                    <div className="text-sm text-gray-800 font-medium">{item.name}</div>
                    <div className="text-xs text-gray-500 font-mono">{item.id} • Stock: {item.quantity}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-emerald-400">{formatIDR(item.currentPrice || 0)}</span>
                    <Plus size={16} className="text-gray-500 group-hover:text-[#961b2b]" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Cart Items */}
          <div className="space-y-3 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700">Current Order</h4>
            {errorMsg && (
              <div className="p-3 bg-[#961b2b]/10 border border-[#961b2b]/20 text-[#961b2b] text-sm rounded-lg flex items-start gap-2">
                <Info size={16} className="mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {cart.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm border border-dashed border-gray-200 rounded-xl">
                Cart is empty. Add items above.
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="flex flex-col gap-2 p-3 bg-white border border-gray-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="text-sm font-medium text-gray-800 truncate">{item.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{item.category} • Stock: {item.maxQuantity}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center bg-[#f2f2f2] border border-gray-200 rounded-lg">
                          <button onClick={() => updateQuantity(item.id, -1)} className="px-2 py-1 text-gray-500 hover:text-gray-900">-</button>
                          <span className="w-6 text-center text-sm font-mono text-gray-800">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} disabled={item.quantity >= item.maxQuantity} className="px-2 py-1 text-gray-500 hover:text-gray-900 disabled:opacity-50">+</button>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="p-1.5 text-gray-500 hover:text-[#961b2b] hover:bg-[#961b2b]/10 rounded-md transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <span className="text-xs font-medium text-gray-500">Sale Price (IDR):</span>
                      <div className="w-32">
                        <CurrencyInput 
                          value={item.price} 
                          onChange={(val) => setCart(cart.map(c => c.id === item.id ? { ...c, price: val } : c))} 
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Operational Expenses */}
          <div className="space-y-3 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700">Operational Expenses</h4>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500">Platform Fee (IDR)</label>
                <CurrencyInput 
                  value={platformFee} 
                  onChange={setPlatformFee} 
                  placeholder="0" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500">Shipping/Packaging Cost (IDR)</label>
                <CurrencyInput 
                  value={shippingCost} 
                  onChange={setShippingCost} 
                  placeholder="0" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Checkout Footer */}
        <div className="p-6 bg-white border-t border-gray-200 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Gross Revenue</span>
              <span className="font-mono">{formatIDR(cartTotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Cost Basis</span>
              <span className="font-mono text-[#961b2b]/70">-{formatIDR(cartCost)}</span>
            </div>
            {(platformFee > 0 || shippingCost > 0) && (
              <>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Platform Fee</span>
                  <span className="font-mono text-[#961b2b]/70">-{formatIDR(platformFee)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Shipping Cost</span>
                  <span className="font-mono text-[#961b2b]/70">-{formatIDR(shippingCost)}</span>
                </div>
              </>
            )}
            <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
              <span className="text-base font-medium text-gray-800">True Net Profit</span>
              <span className={`text-2xl font-bold font-mono ${trueNetProfit > 0 ? 'text-emerald-400' : trueNetProfit < 0 ? 'text-[#961b2b]' : 'text-gray-900'}`}>
                {formatIDR(trueNetProfit)}
              </span>
            </div>
          </div>
          
          <button 
            onClick={handleCompleteTransaction}
            disabled={cart.length === 0}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-medium bg-[#961b2b] text-gray-100 rounded-xl hover:bg-[#961b2b]/90 shadow-[0_4px_12px_rgba(150,27,43,0.3)] disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all"
          >
            Complete Transaction
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <BarcodeScanner 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        onScan={handleScan} 
        continuous={true}
        scanSuccessItem={scanSuccessItem}
      />
    </>
  );
}
