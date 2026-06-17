import React, { useState, useRef } from 'react';
import { Search, Plus, MoreHorizontal, Filter, ChevronLeft, ChevronRight, Copy, Check, X, Image as ImageIcon, Camera, QrCode as QrCodeIcon, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatIDR } from '../utils/currency';
import { BarcodeScanner } from './BarcodeScanner';
import { CurrencyInput } from './CurrencyInput';
import { InventoryItem, InventoryBatch } from '../App';

interface InventoryProps {
  items: InventoryItem[];
  onNavigateToProcurement: () => void;
  onUpdateItem: (item: InventoryItem) => void;
  onDeleteItem: (id: string) => void;
}

export function Inventory({ items, onNavigateToProcurement, onUpdateItem, onDeleteItem }: InventoryProps) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const scanLockRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemToPrint, setItemToPrint] = useState<InventoryItem | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [stockModalItem, setStockModalItem] = useState<InventoryItem | null>(null);
  const [editModalItem, setEditModalItem] = useState<InventoryItem | null>(null);
  const [expandedRowIds, setExpandedRowIds] = useState<string[]>([]);
  const [hideSoldOut, setHideSoldOut] = useState(false);
  
  const toggleRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRowIds(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };
  
  React.useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleDelete = (id: string, name: string) => {
    onDeleteItem(id);
  };
  
  const categories = ['All', 'Singles', 'Sealed', 'Accessory', 'Slab'];
  const conditions = ['NM', 'LP', 'MP', 'HP', 'DMG'];
  const foilTypes = ['Non-Foil', 'Reverse Holo', 'Holo', 'Textured'];

  const handleScan = (decodedText: string) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    setIsProcessingScan(true);

    const sanitizedScan = decodedText.trim().toUpperCase();

    // Direct, strict lookup against the sanitized scanned string
    const foundItem = items.find(i => {
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
      setStockModalItem(foundItem);
      setIsScannerOpen(false); 
    } else {
      setSearchQuery(decodedText);
      setIsScannerOpen(false);
    }

    // Cooldown lock for 600ms
    setTimeout(() => {
      scanLockRef.current = false;
      setIsProcessingScan(false);
    }, 600);
  };

  const filteredItems = items.filter(item => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    const matchesSearch = (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.set || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.id || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const groupedItems = Object.values(filteredItems.reduce((acc, item) => {
    // Group by Card DNA
    const nameKey = item.name ? item.name.trim().toLowerCase() : '';
    const setKey = item.set ? item.set.trim().toLowerCase() : '';
    const key = `${nameKey}_${setKey}_${item.condition}_${item.foilType}_${item.category}`;
    if (!acc[key]) {
      acc[key] = {
        ...item,
        quantity: 0, // We will rebuild the total stock
        underlyingIds: [],
        soldIds: [],
        totalCostBasis: 0
      };
    }
    
    if (item.status === 'In Stock') {
      const qty = item.quantity || 1;
      acc[key].totalCostBasis += (item.costBasis || 0) * qty;
      acc[key].quantity += qty;
      acc[key].underlyingIds.push(item.id);
    } else if (item.status === 'Sold') {
      acc[key].soldIds.push(item.id);
    }
    
    return acc;
  }, {} as Record<string, any>)).map(group => ({
    ...group,
    costBasis: group.quantity > 0 ? group.totalCostBasis / group.quantity : 0
  }));

  const displayItems = hideSoldOut ? groupedItems.filter(item => item.quantity > 0) : groupedItems;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header, Search & Filters flattened */}
      <div className="flex flex-col gap-5 border-b border-gray-100 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
            Inventory Control
          </h2>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial sm:w-80 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, set, or SKU..."
                className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-10 py-2.5 text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:border-[#961b2b]/50 focus:ring-1 focus:ring-[#961b2b]/50 transition-all min-h-[44px]"
              />
              <button 
                onClick={() => setIsScannerOpen(true)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#961b2b] transition-colors p-1"
                title="Scan Barcode"
              >
                <Camera size={18} />
              </button>
            </div>
            <button 
              onClick={onNavigateToProcurement}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-[#961b2b] text-white rounded-lg hover:bg-[#961b2b]/90 shadow-sm transition-all whitespace-nowrap min-h-[44px] w-full sm:w-auto"
            >
              <Plus size={16} />
              Procure New Item
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col xl:flex-row xl:items-center gap-4">
          <div className="flex overflow-x-auto whitespace-nowrap gap-2 pb-2 lg:pb-0 hide-scrollbar w-full xl:w-auto flex-shrink-0">
            <div className="flex items-center gap-2 border-r border-gray-200 pr-4 mr-2 hidden sm:flex">
              <Filter size={16} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filters</span>
            </div>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors flex-shrink-0 ${
                  activeCategory === cat
                    ? 'bg-[#961b2b]/20 text-[#961b2b] border border-[#961b2b]/30'
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-gray-300 hover:text-gray-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full justify-between xl:justify-start">
            <label className="flex items-center cursor-pointer gap-2 h-[38px]">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={hideSoldOut} 
                  onChange={(e) => setHideSoldOut(e.target.checked)} 
                />
                <div className={`block w-10 h-6 rounded-full transition-colors duration-200 ease-in-out ${hideSoldOut ? 'bg-[#961b2b]' : 'bg-gray-300'}`}></div>
                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out ${hideSoldOut ? 'translate-x-4' : 'translate-x-0'}`}></div>
              </div>
              <span className="text-sm font-medium text-gray-700 select-none">Hide Sold Out</span>
            </label>

            <div className="h-4 w-px bg-gray-200 mx-1 hidden sm:block xl:block"></div>

            <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-2 w-full sm:w-auto flex-1">
              <select defaultValue="" className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#961b2b]/50 w-full sm:w-auto h-[38px]">
                <option value="">Condition (All)</option>
                {conditions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <select defaultValue="" className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#961b2b]/50 w-full sm:w-auto h-[38px]">
                <option value="">Foil Type (All)</option>
                {foilTypes.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm block md:table">
            <thead>
              <tr className="hidden md:table-row text-gray-500 border-b border-gray-200 bg-[#f2f2f2]/50">
                <th className="px-6 py-4 font-medium">Item Name & Set</th>
                <th className="px-6 py-4 font-medium">Category & Condition</th>
                <th className="px-6 py-4 font-medium">Cert #</th>
                <th className="px-6 py-4 font-medium text-right">Stock</th>
                <th className="px-6 py-4 font-medium text-right">Cost Basis</th>
                <th className="px-6 py-4 font-medium text-right">Market Price</th>
                <th className="px-6 py-4 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 md:table-row-group block w-full">
              {displayItems.map((item) => (
                <React.Fragment key={item.id}>
                  {/* Desktop view */}
                  <tr className={`hidden md:table-row group ${item.quantity === 0 ? 'opacity-50 grayscale bg-gray-50/50' : 'hover:bg-white/[0.02]'} transition-colors border-b border-gray-100`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="relative w-10 h-14 rounded overflow-hidden bg-[#1a1a1c] border border-gray-200 flex-shrink-0 group/img">
                          {item.imageUrl ? (
                            <img 
                              src={item.imageUrl} 
                              alt={item.name} 
                              className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-110"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-600">
                              <ImageIcon size={16} />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-gray-800">{item.name}</div>
                            {item.batches && item.batches.length > 0 && (
                              <button 
                                onClick={(e) => toggleRow(item.id, e)}
                                className="text-gray-400 hover:text-[#961b2b] p-0.5 rounded transition-colors"
                                title="View Cost Batches"
                              >
                                {expandedRowIds.includes(item.id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{item.set} • <span className="font-mono" title={item.underlyingIds.join(", ")}>{item.underlyingIds.length > 1 ? `Multiple Serials (${item.underlyingIds.length})` : item.id}</span></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded-md bg-[#f2f2f2] border border-gray-200 text-xs text-gray-700">
                          {item.category}
                        </span>
                        {item.condition !== 'N/A' && (
                          <span className="text-xs text-gray-500">• {item.condition}</span>
                        )}
                        {item.foilType !== 'N/A' && (
                          <span className="text-xs text-gray-500">• {item.foilType}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {item.category === 'Slab' && item.certNumber ? (
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-gray-200 text-gray-900">
                            {item.gradingCompany}
                          </span>
                          <span className="font-mono text-gray-700">{item.certNumber}</span>
                          <CopyButton text={item.certNumber} />
                        </div>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {item.quantity === 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-gray-200 text-gray-500 uppercase">
                          Sold Out
                        </span>
                      ) : (
                        <span className={`font-mono font-medium ${item.quantity < 3 ? 'text-[#961b2b]' : 'text-gray-700'}`}>
                          {item.quantity}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-gray-500">{formatIDR(item.costBasis)}</span>
                        {item.quantity > 1 && <span className="text-[10px] text-gray-400 font-sans tracking-wide">(Avg)</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-emerald-400">
                      {formatIDR(item.currentPrice)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => setStockModalItem(item)}
                          disabled={item.quantity === 0}
                          className={`p-2 rounded-lg transition-colors ${item.quantity === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-[#961b2b] hover:bg-[#961b2b]/10'}`}
                          title={item.quantity === 0 ? "Cannot adjust sold out stock here" : "Quick Adjust Stock"}
                        >
                          <QrCodeIcon size={16} />
                        </button>
                        <div className="relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === item.id ? null : item.id);
                            }}
                            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors" 
                            title="More options"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {activeMenuId === item.id && (
                            <div 
                              className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] py-1 flex flex-col z-[100]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button 
                                onClick={() => { setActiveMenuId(null); setEditModalItem(item); }}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-[#f2f2f2] transition-colors whitespace-nowrap"
                              >
                                Edit Details
                              </button>
                              <button 
                                onClick={() => { setActiveMenuId(null); setItemToPrint(item); }}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-[#f2f2f2] transition-colors whitespace-nowrap"
                              >
                                Print SKU Barcode
                              </button>
                              <button 
                                onClick={() => { setActiveMenuId(null); setStockModalItem(item); }}
                                disabled={item.quantity === 0}
                                className={`w-full text-left px-4 py-2.5 text-sm whitespace-nowrap transition-colors ${item.quantity === 0 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-[#f2f2f2]'}`}
                              >
                                {item.quantity === 0 ? 'Stock Locked (Sold)' : 'Adjust Stock Level'}
                              </button>
                              <div className="my-1 border-t border-gray-100" />
                              <button 
                                onClick={() => { setActiveMenuId(null); handleDelete(item.id, item.name); }}
                                className="w-full text-left px-4 py-2.5 text-sm font-medium text-[#961b2b] hover:bg-[#961b2b]/10 transition-colors whitespace-nowrap"
                              >
                                Delete Item
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Desktop sub-table expanded batches */}
                  {expandedRowIds.includes(item.id) && item.batches && item.batches.length > 0 && (
                    <tr className="hidden md:table-row">
                      <td colSpan={7} className="p-0 border-b border-gray-100">
                        <div className="bg-[#f2f2f2]/80 px-10 py-4 border-l-2 border-[#961b2b]">
                          <table className="w-full text-sm">
                            <thead>
                              <tr>
                                <th className="text-left font-semibold text-gray-500 pb-2 text-[10px] tracking-wider uppercase">Batch ID</th>
                                <th className="text-left font-semibold text-gray-500 pb-2 text-[10px] tracking-wider uppercase">Date Secured</th>
                                <th className="text-right font-semibold text-gray-500 pb-2 text-[10px] tracking-wider uppercase">Quantity</th>
                                <th className="text-right font-semibold text-gray-500 pb-2 text-[10px] tracking-wider uppercase">Exact Cost Basis</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200/50">
                              {item.batches.map(batch => (
                                <tr key={batch.batchId}>
                                  <td className="py-2 text-gray-600 font-mono text-xs">{batch.batchId}</td>
                                  <td className="py-2 text-gray-600">{batch.date}</td>
                                  <td className="py-2 text-right text-gray-800 font-mono">{batch.qty}</td>
                                  <td className="py-2 text-right text-gray-800 font-mono">{formatIDR(batch.costBasis)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Mobile Card Stack Item */}
                  <tr className={`md:hidden block w-full border-b border-gray-100 last:border-0 ${item.quantity === 0 ? 'opacity-60 grayscale bg-gray-50/30' : 'hover:bg-gray-50/20'} transition-colors`}>
                    <td className="block p-4 border-none bg-transparent w-full">
                      <div className="flex flex-col gap-3">
                        {/* Header: Img, Title, Options */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex gap-3">
                            <div className="relative w-12 h-16 rounded overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0 shadow-sm">
                              {item.imageUrl ? (
                                <img 
                                  src={item.imageUrl} 
                                  alt={item.name} 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                  <ImageIcon size={18} />
                                </div>
                              )}
                            </div>
                            <div className="space-y-0.5">
                              <div className="font-bold text-gray-900 text-sm leading-snug break-words whitespace-normal">{item.name}</div>
                              <div className="text-[11px] text-gray-500">
                                {item.set} • <span className="font-mono text-gray-400" title={item.underlyingIds.join(", ")}>{item.underlyingIds.length > 1 ? `Multiple Serials (${item.underlyingIds.length})` : item.id}</span>
                              </div>
                            </div>
                          </div>

                          {/* Options menu */}
                          <div className="relative flex-shrink-0">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === item.id ? null : item.id);
                              }}
                              className="p-1.5 text-gray-500 hover:text-gray-900 border border-gray-200 bg-gray-50 rounded-lg transition-colors" 
                              title="More options"
                            >
                              <MoreHorizontal size={14} />
                            </button>
                            {activeMenuId === item.id && (
                              <div 
                                className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1 flex flex-col z-[100]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button 
                                  onClick={() => { setActiveMenuId(null); setEditModalItem(item); }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-[#f2f2f2] transition-colors whitespace-nowrap"
                                >
                                  Edit Details
                                </button>
                                <button 
                                  onClick={() => { setActiveMenuId(null); setItemToPrint(item); }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-[#f2f2f2] transition-colors whitespace-nowrap"
                                >
                                  Print SKU Barcode
                                </button>
                                <button 
                                  onClick={() => { setActiveMenuId(null); setStockModalItem(item); }}
                                  disabled={item.quantity === 0}
                                  className={`w-full text-left px-4 py-2.5 text-sm whitespace-nowrap transition-colors ${item.quantity === 0 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-[#f2f2f2]'}`}
                                >
                                  {item.quantity === 0 ? 'Stock Locked (Sold)' : 'Adjust Stock Level'}
                                </button>
                                <div className="my-1 border-t border-gray-100" />
                                <button 
                                  onClick={() => { setActiveMenuId(null); handleDelete(item.id, item.name); }}
                                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-[#961b2b] hover:bg-[#961b2b]/10 transition-colors whitespace-nowrap"
                                >
                                  Delete Item
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Attribute Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                          <span className="px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200/50 text-[10px] font-medium text-gray-800">
                            {item.category}
                          </span>
                          {item.condition !== 'N/A' && (
                            <span className="px-1.5 py-0.5 rounded bg-gray-50 border border-gray-100 text-[10px] text-gray-500">{item.condition}</span>
                          )}
                          {item.foilType !== 'N/A' && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-100/50 text-[10px] text-amber-700 font-medium">✨ {item.foilType}</span>
                          )}
                          {item.category === 'Slab' && item.certNumber ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 border border-purple-100/50 text-[10px] text-purple-700 font-mono">
                              <span className="font-bold tracking-wider">{item.gradingCompany}</span> #{item.certNumber}
                            </span>
                          ) : null}
                        </div>

                        {/* Inventory & Financial Info */}
                        <div className="grid grid-cols-3 gap-2.5 bg-gray-50 rounded-xl p-3 border border-gray-100 text-xs">
                          <div>
                            <span className="text-gray-400 block mb-0.5 uppercase tracking-wider text-[9px] font-semibold">Stock level</span>
                            {item.quantity === 0 ? (
                              <span className="font-bold tracking-wide text-gray-500 uppercase text-[10px] bg-gray-200 px-1.5 py-0.5 rounded">Sold Out</span>
                            ) : (
                              <span className={`font-mono font-bold ${item.quantity < 3 ? 'text-[#961b2b]' : 'text-gray-800'}`}>
                                {item.quantity} units
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-gray-400 block mb-0.5 uppercase tracking-wider text-[9px] font-semibold">Cost Basis</span>
                            <span className="font-mono text-gray-600 block">{formatIDR(item.costBasis)}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block mb-0.5 uppercase tracking-wider text-[9px] font-semibold">Market price</span>
                            <span className="font-mono font-bold text-emerald-600 block">{formatIDR(item.currentPrice)}</span>
                          </div>
                        </div>

                        {/* Cost Batches Sub-list */}
                        {item.batches && item.batches.length > 0 && (
                          <div className="pt-2">
                            <button 
                              onClick={(e) => toggleRow(item.id, e)}
                              className="text-xs text-[#961b2b] font-medium flex items-center gap-1 hover:underline"
                            >
                              {expandedRowIds.includes(item.id) ? 'Collapse Cost Batches' : `View ${item.batches.length} Cost Batches`}
                              {expandedRowIds.includes(item.id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                            
                            {expandedRowIds.includes(item.id) && (
                              <div className="mt-2 pl-3 border-l-2 border-[#961b2b] space-y-1.5 py-1">
                                {item.batches.map(batch => (
                                  <div key={batch.batchId} className="flex justify-between text-[11px] bg-gray-50 border border-gray-100 p-2 rounded-lg font-mono">
                                    <div>
                                      <div className="text-gray-400 text-[9px] uppercase font-bold">Batch ID: {batch.batchId}</div>
                                      <div className="text-gray-600 mt-0.5">{batch.date}</div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-gray-800 font-bold">{batch.qty} Units</div>
                                      <div className="text-gray-500 mt-0.5">{formatIDR(batch.costBasis)}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-gray-200 flex items-center justify-between bg-[#f2f2f2]/30">
          <span className="text-xs text-gray-500">
            Showing <span className="font-medium text-gray-700">1</span> to <span className="font-medium text-gray-700">{Math.min(8, groupedItems.length)}</span> of <span className="font-medium text-gray-700">{groupedItems.length}</span> items
          </span>
          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
              <ChevronLeft size={16} />
            </button>
            <button className="px-3 py-1.5 rounded-md border border-[#961b2b]/30 bg-[#961b2b]/10 text-[#961b2b] text-xs font-medium">
              1
            </button>
            <button className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-100">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <BarcodeScanner 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        onScan={handleScan} 
      />

      {/* Print QR Modal */}
      {itemToPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-200/80 backdrop-blur-sm" onClick={() => setItemToPrint(null)} />
          <div className="relative bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col items-center">
            
            {/* Close Button */}
            <button 
              onClick={() => setItemToPrint(null)}
              className="absolute right-4 top-4 text-gray-500 hover:text-gray-900 transition-colors"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-bold text-gray-900 mb-6">Print Item Label</h3>

            <div 
              id="printable-qr-container" 
              className="bg-white p-6 rounded-xl flex flex-col items-center text-center shadow-inner mb-6 mx-auto w-64"
            >
              <QRCodeSVG 
                value={itemToPrint.id} 
                size={160} 
                level="M" 
                includeMargin={false} 
              />
              <div className="mt-4 text-black w-full">
                <p className="font-bold text-[14px] leading-tight mb-1 truncate">{itemToPrint.name}</p>
                <p className="text-[10px] text-gray-600 uppercase font-semibold mb-2 truncate">
                  {itemToPrint.set} {itemToPrint.cardNumber && `• ${itemToPrint.cardNumber}`}
                </p>
                
                <div className="flex items-center justify-center gap-1 mt-1 flex-wrap">
                  {itemToPrint.category === 'Slab' ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-black/20 bg-gray-200/5 whitespace-nowrap">
                      {itemToPrint.gradingCompany} {itemToPrint.condition}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-black/20 bg-gray-200/5 whitespace-nowrap">
                      {itemToPrint.condition}
                    </span>
                  )}
                  {itemToPrint.foilType !== 'Non-Foil' && itemToPrint.foilType !== 'N/A' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-black/20 bg-gray-200/5 whitespace-nowrap">
                      {itemToPrint.foilType}
                    </span>
                  )}
                </div>
                
                <p className="font-mono text-[11px] text-gray-500 mt-3 pt-2 border-t border-black/10">
                  {itemToPrint.id}
                </p>
              </div>
            </div>

            <button 
              onClick={() => window.print()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#961b2b] hover:bg-[#961b2b]/90 text-gray-900 font-medium rounded-xl transition-all shadow-[0_0_15px_rgba(150,27,43,0.3)]"
            >
              <Printer size={18} />
              Print Label
            </button>
          </div>
        </div>
      )}

      {stockModalItem && (
        <StockAdjustModal 
          item={stockModalItem} 
          onClose={() => setStockModalItem(null)} 
          onSave={(updated) => { onUpdateItem(updated); setStockModalItem(null); }} 
        />
      )}

      {editModalItem && (
        <EditDetailsModal 
          item={editModalItem} 
          onClose={() => setEditModalItem(null)} 
          onSave={(updated) => { onUpdateItem(updated); setEditModalItem(null); }} 
        />
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 text-gray-500 hover:text-gray-900 transition-colors rounded"
      title="Copy to clipboard"
    >
      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
    </button>
  );
}

function StockAdjustModal({ item, onClose, onSave }: { item: InventoryItem; onClose: () => void; onSave: (updatedItem: InventoryItem) => void }) {
  const [showCostPrompt, setShowCostPrompt] = useState(false);
  const [newCostBasis, setNewCostBasis] = useState(item.costBasis || 0);

  const handleMinus = () => {
    if (item.quantity <= 0) return;
    
    // Deduct quantity using FIFO
    let remainingToDeduct = 1;
    const oldBatches = item.batches && item.batches.length > 0 
      ? [...item.batches] 
      : [{ batchId: 'BCH-LEGACY-' + item.id, date: 'Legacy', qty: item.quantity, costBasis: item.costBasis }];
    
    const newBatches = [];
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

    const newQuantity = item.quantity - 1;
    const newCostBasisTotal = newBatches.length > 0 
      ? newBatches.reduce((sum, b) => sum + (b.costBasis * b.qty), 0) / newBatches.reduce((sum, b) => sum + b.qty, 0)
      : item.costBasis;

    onSave({ 
      ...item, 
      quantity: newQuantity, 
      costBasis: Number.isNaN(newCostBasisTotal) ? item.costBasis : newCostBasisTotal, 
      batches: newBatches 
    });
  };

  const handlePlusClick = () => {
    setShowCostPrompt(true);
  };

  const handlePlusConfirm = () => {
    const displayDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const newBatch = {
      batchId: `BCH-${Date.now()}`,
      date: displayDate,
      qty: 1,
      costBasis: newCostBasis
    };

    const oldBatches = item.batches && item.batches.length > 0 
      ? [...item.batches] 
      : [{ batchId: 'BCH-LEGACY-' + item.id, date: 'Legacy', qty: item.quantity, costBasis: item.costBasis }];

    const newBatches = [...oldBatches, newBatch];
    const newQuantity = item.quantity + 1;
    const newCostBasisTotal = newBatches.reduce((sum, b) => sum + (b.costBasis * b.qty), 0) / newQuantity;

    onSave({
      ...item,
      quantity: newQuantity,
      costBasis: newCostBasisTotal,
      batches: newBatches
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#f2f2f2] border border-gray-200 rounded-[12px] shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-bold text-gray-900">Rapid Adjust</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-800"><X size={20}/></button>
        </div>
        <p className="text-sm text-gray-600 mb-6 font-medium">{item.name} {item.set && `• ${item.set}`}</p>
        
        {showCostPrompt ? (
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700">Cost Basis for New Unit</label>
            <CurrencyInput value={newCostBasis} onChange={setNewCostBasis} />
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCostPrompt(false)} className="flex-1 px-4 py-3 text-sm font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handlePlusConfirm} className="flex-1 px-4 py-3 text-sm font-medium bg-[#961b2b] text-gray-100 rounded-lg hover:bg-[#961b2b]/90 transition-colors shadow-sm">
                Confirm +1
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <button 
              onClick={handleMinus}
              disabled={item.quantity <= 0}
              className="flex-1 aspect-square max-h-32 flex flex-col items-center justify-center bg-white border border-gray-200 rounded-2xl text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50 transition-all group shadow-sm"
            >
              <span className="text-5xl font-light mb-1">-1</span>
              <span className="text-xs font-semibold tracking-wider text-gray-400 group-hover:text-red-500 uppercase">Remove</span>
            </button>
            
            <div className="flex flex-col items-center justify-center w-24">
              <span className="text-3xl font-bold font-mono text-gray-900">{item.quantity}</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mt-1">In Stock</span>
            </div>

            <button 
              onClick={handlePlusClick}
              className="flex-1 aspect-square max-h-32 flex flex-col items-center justify-center bg-white border border-gray-200 rounded-2xl text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all group shadow-sm"
            >
              <span className="text-4xl font-light mb-1">+1</span>
              <span className="text-xs font-semibold tracking-wider text-gray-400 group-hover:text-emerald-500 uppercase">Add</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EditDetailsModal({ item, onClose, onSave }: { item: InventoryItem; onClose: () => void; onSave: (updated: InventoryItem) => void }) {
  const [formData, setFormData] = useState<InventoryItem>(item);

  const update = (field: keyof InventoryItem, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#f2f2f2] border border-gray-200 rounded-[12px] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e0e0e0] bg-white">
          <h3 className="text-lg font-bold text-gray-900">Edit Inventory Item</h3>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-[#961b2b] bg-gray-50 hover:bg-[#961b2b]/10 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-4">
            <div className="space-y-1 flex-shrink-0">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Image</label>
              <div className="w-full md:w-[120px] h-[120px] rounded bg-white border border-[#e0e0e0] flex items-center justify-center overflow-hidden">
                {formData.imageUrl ? (
                  <img src={formData.imageUrl} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={20} className="text-gray-400" />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 content-end">
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Item Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => update('name', e.target.value)}
                  className="w-full bg-white border border-[#e0e0e0] rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all block placeholder-gray-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Set Name</label>
                <input
                  type="text"
                  value={formData.set}
                  onChange={(e) => update('set', e.target.value)}
                  className="w-full bg-white border border-[#e0e0e0] rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all placeholder-gray-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Category</label>
                <select 
                  value={formData.category}
                  onChange={(e) => update('category', e.target.value)}
                  className="w-full bg-white border border-[#e0e0e0] rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all appearance-none"
                >
                  <option value="Single">Raw Card</option>
                  <option value="Slab">Graded Slab</option>
                  <option value="Sealed">Sealed Product</option>
                  <option value="Accessory">Accessory</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Card Number</label>
              <input
                type="text"
                value={formData.cardNumber || ''}
                onChange={(e) => update('cardNumber', e.target.value)}
                className="w-full bg-white border border-[#e0e0e0] rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all placeholder-gray-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Rarity</label>
              <input
                type="text"
                value={formData.rarity || ''}
                onChange={(e) => update('rarity', e.target.value)}
                className="w-full bg-white border border-[#e0e0e0] rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all placeholder-gray-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Language</label>
              <select 
                value={formData.language || 'English'}
                onChange={(e) => update('language', e.target.value)}
                className="w-full bg-white border border-[#e0e0e0] rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all appearance-none"
              >
                <option value="English">English</option>
                <option value="Japanese">Japanese</option>
                <option value="Indonesian">Indonesian</option>
                <option value="Traditional Chinese">Traditional Chinese</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Condition</label>
              {formData.category === 'Single' ? (
                <select 
                  value={formData.condition}
                  onChange={(e) => update('condition', e.target.value)}
                  className="w-full bg-white border border-[#e0e0e0] rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all appearance-none"
                >
                  <option value="NM">Near Mint (NM)</option>
                  <option value="LP">Lightly Played (LP)</option>
                  <option value="MP">Moderately Played (MP)</option>
                  <option value="HP">Heavily Played (HP)</option>
                  <option value="DMG">Damaged (DMG)</option>
                </select>
              ) : (
                <div className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm text-gray-400 cursor-not-allowed">
                  N/A
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Foil Type</label>
              <select 
                value={formData.foilType}
                onChange={(e) => update('foilType', e.target.value)}
                className="w-full bg-white border border-[#e0e0e0] rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all appearance-none"
              >
                <option value="Non-Foil">Non-Foil</option>
                <option value="Reverse Holo">Reverse Holo</option>
                <option value="Holo">Holo</option>
                <option value="Textured">Textured / Full Art</option>
                <option value="N/A">N/A</option>
              </select>
            </div>
          </div>

          {formData.category === 'Slab' && (
            <div className="pt-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Grading Company</label>
                  <select 
                    value={formData.gradingCompany || ''}
                    onChange={(e) => update('gradingCompany', e.target.value)}
                    className="w-full bg-white border border-[#e0e0e0] rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all appearance-none"
                  >
                    <option value="" disabled>Select...</option>
                    <option value="PSA">PSA</option>
                    <option value="BGS">BGS</option>
                    <option value="CGC">CGC</option>
                    <option value="SGC">SGC</option>
                    <option value="PCG">PCG</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Grade</label>
                  <input
                    type="text"
                    value={formData.condition || ''}
                    onChange={(e) => update('condition', e.target.value)}
                    className="w-full bg-white border border-[#e0e0e0] rounded px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#961b2b] transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Cert Number</label>
                  <input
                    type="text"
                    value={formData.certNumber || ''}
                    onChange={(e) => update('certNumber', e.target.value)}
                    className="w-full bg-white border border-[#e0e0e0] rounded px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#961b2b] transition-all font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-[#e0e0e0] pt-4">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Cost Basis</label>
              <CurrencyInput 
                value={formData.costBasis} 
                onChange={(v) => update('costBasis', v)} 
                className="w-full bg-white border border-[#e0e0e0] rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Market Price</label>
              <CurrencyInput 
                value={formData.currentPrice} 
                onChange={(v) => update('currentPrice', v)} 
                className="w-full bg-white border border-[#e0e0e0] rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all"
              />
            </div>
          </div>

        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#e0e0e0] bg-white rounded-b-[12px]">
          <button onClick={onClose} className="px-6 py-2.5 text-sm font-medium bg-white text-gray-700 border border-gray-200 rounded hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={() => onSave(formData)} className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold bg-[#961b2b] text-gray-100 rounded-[12px] hover:bg-[#961b2b]/90 transition-all">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

