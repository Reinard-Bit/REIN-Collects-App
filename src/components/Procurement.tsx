import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Plus, PackageOpen, DollarSign, Calendar, User, Tag, Layers, Clock, Hash, Image as ImageIcon, Upload, Loader2, Trash2, Check, X, QrCode as QrCodeIcon, Camera, Link as LinkIcon, Edit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatIDR } from '../utils/currency';
import { CurrencyInput } from './CurrencyInput';
import { InventoryItem, CatalogItem } from '../App';
import { BatchQRGeneratorModal } from './BatchQRGeneratorModal';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { DB_PATHS } from '../utils/dbConfig';
import { CsvImporter } from './CsvImporter';

export interface ProcurementRecord {
  id: string;
  date: string;
  type: string;
  itemName: string;
  description: string;
  supplier: string;
  totalCost: number;
}

interface ProcurementProps {
  key?: string | number;
  masterCatalog: CatalogItem[];
  onAddItem: (item: InventoryItem) => void;
  procurementRecords: ProcurementRecord[];
  onAddProcurements: (records: ProcurementRecord[]) => void;
  onDeleteProcurement?: (record: ProcurementRecord) => void;
  onEditProcurement?: (record: ProcurementRecord) => void;
  onNavigateToHistory: () => void;
  initialSerialNumber?: string | null;
  onOpenScanner?: () => void;
}

type ProcurementMode = 'manual' | 'scanner' | 'bulk-import';

export function Procurement({ masterCatalog, onAddItem, procurementRecords, onAddProcurements, onDeleteProcurement, onEditProcurement, onNavigateToHistory, initialSerialNumber, onOpenScanner }: ProcurementProps) {
  const [mode, setMode] = useState<ProcurementMode>('manual');
  const [showBatchQRModal, setShowBatchQRModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ProcurementRecord | null>(null);
  const [editForm, setEditForm] = useState({ supplier: '', cost: 0 });

  const handleEditClick = (proc: ProcurementRecord) => {
    setEditingItem(proc);
    setEditForm({ supplier: proc.supplier, cost: proc.totalCost });
  };

  const saveProcurementEdit = async () => {
    if (!editingItem) return;
    try {
      const targetRef = doc(db, DB_PATHS.PROCUREMENTS, (editingItem as any).trueDbId || editingItem.id);
      await updateDoc(targetRef, {
        supplier: editForm.supplier,
        totalCost: editForm.cost
      });
      setEditingItem(null);
    } catch (e) {
      console.error("Failed to update procurement", e);
    }
  };
  
  const recentProcurements = procurementRecords.slice(0, 5);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900">
            Procurement Module
          </h2>
          <p className="text-gray-500 mt-1 text-sm">
            Log new inventory acquisitions and bulk collection intakes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => setShowBatchQRModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium min-h-[44px] flex-1 sm:flex-initial"
          >
            <QrCodeIcon size={16} />
            Bulk Labels
          </button>
          
          {/* Mode Toggle */}
          <div className="flex p-1 bg-white border border-gray-200 rounded-full w-full sm:w-auto justify-between sm:justify-start">
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-full text-sm font-medium transition-all min-h-[38px] ${
                mode === 'manual'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Manual Entry
            </button>
            <button
              onClick={() => setMode('scanner')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2 rounded-full text-sm font-medium transition-all min-h-[38px] ${
                mode === 'scanner'
                  ? 'bg-[#961b2b] text-gray-900 shadow-[0_0_15px_rgba(220,38,38,0.4)]'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${mode === 'scanner' ? 'bg-white animate-pulse' : 'bg-[#961b2b]'}`} />
              Bulk AI Scanner
            </button>
            <button
              onClick={() => setMode('bulk-import')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2 rounded-full text-sm font-medium transition-colors min-h-[38px] ${
                mode === 'bulk-import'
                  ? 'bg-black text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 bg-transparent'
              }`}
            >
              📊 Bulk Import CSV
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-8">
        {mode === 'manual' ? (
          <ManualEntryForm 
            masterCatalog={masterCatalog}
            onAddItem={onAddItem} 
            onAddProcurement={(record) => onAddProcurements([record])}
            initialSerialNumber={initialSerialNumber || ''}
            onOpenScanner={onOpenScanner}
          />
        ) : mode === 'scanner' ? (
          <BulkScannerInterface 
            onAddItems={(items) => {
              items.forEach(onAddItem);
              setMode('manual'); // Switch back after adding
            }} 
            onAddProcurements={(records) => onAddProcurements(records)}
            onOpenScanner={onOpenScanner}
          />
        ) : mode === 'bulk-import' ? (
          <CsvImporter />
        ) : null}
      </div>

      {/* Recent Procurements Ledger */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Recent Procurements</h3>
          <button 
            onClick={onNavigateToHistory}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            View Full History
          </button>
        </div>
        
        <div className="space-y-0">
          {recentProcurements.length === 0 ? (
            <div className="py-8 text-center text-gray-500 text-sm">
              No recent procurements
            </div>
          ) : (
            recentProcurements.map((proc) => (
              <div key={proc.id} className="flex flex-row items-center gap-4 py-4 border-b border-gray-100 bg-white px-2">
                {/* Product Thumbnail */}
                <div className="w-14 h-14 bg-gray-50 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                  <img src={(proc as any).imageUrl || 'https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80'} alt={proc.itemName} className="w-full h-full object-cover opacity-80" />
                </div>

                {/* Text Block (Middle) */}
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 truncate">{proc.itemName}</span>
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-semibold whitespace-nowrap hidden sm:inline-flex ${
                      proc.type === 'Raw Card' 
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' 
                        : proc.type === 'Graded Slab'
                          ? 'bg-purple-500/10 border-purple-500/20 text-purple-500'
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                    }`}>
                      {proc.type}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 truncate mt-0.5">{proc.supplier} • {proc.date}</span>
                  <span className="text-sm font-extrabold text-gray-900 mt-1">Rp {formatIDR(proc.totalCost).replace('Rp', '').trim()}</span>
                </div>

                {/* Modern Action Buttons (Right) */}
                <div className="flex items-center gap-2 ml-auto">
                  <button 
                    onClick={() => handleEditClick(proc)}
                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex-shrink-0"
                    title="Edit"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    onClick={() => onDeleteProcurement?.(proc)}
                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex-shrink-0"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      <BatchQRGeneratorModal 
        isOpen={showBatchQRModal}
        onClose={() => setShowBatchQRModal(false)}
      />

      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingItem(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900">Edit Procurement</h3>
                <button 
                  onClick={() => setEditingItem(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Item Details</label>
                  <p className="text-sm font-medium text-gray-900">{editingItem.itemName}</p>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Supplier</label>
                  <input
                    type="text"
                    value={editForm.supplier}
                    onChange={(e) => setEditForm(prev => ({ ...prev, supplier: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    placeholder="Supplier name"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Cost (Rp)</label>
                  <CurrencyInput
                    id="cost-basis"
                    value={editForm.cost}
                    onChange={(val) => setEditForm(prev => ({ ...prev, cost: val }))}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveProcurementEdit}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BulkScannerInterface({ 
  onAddItems, 
  onAddProcurements,
  onOpenScanner
}: { 
  onAddItems: (items: InventoryItem[]) => void;
  onAddProcurements: (records: ProcurementRecord[]) => void;
  onOpenScanner?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<(InventoryItem & { tempId: string, supplier: string })[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Batch Metadata
  const [batchSupplier, setBatchSupplier] = useState('');
  const [batchDate, setBatchDate] = useState(() => {
    // Format local time to YYYY-MM-DDThh:mm for datetime-local input
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [batchDeliveryFee, setBatchDeliveryFee] = useState(0);
  const [batchPpnImpor, setBatchPpnImpor] = useState(0);
  const [batchPphImpor, setBatchPphImpor] = useState(0);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const simulateAIScan = async (files: FileList | File[]) => {
    setIsScanning(true);
    setScanError(null);
    
    const fileArray = Array.from(files);

    const initialItems: (InventoryItem & { tempId: string, supplier: string, fileObj?: File })[] = fileArray.map((file, index) => {
      const objectUrl = URL.createObjectURL(file);
      
      return {
        tempId: `TEMP-${Date.now()}-${index}`,
        id: `INV-${Date.now()}-${index}`,
        name: '',
        set: '',
        category: 'Single',
        condition: 'NM',
        foilType: 'Non-Foil',
        gradingCompany: null,
        certNumber: null,
        quantity: 1,
        costBasis: 0,
        currentPrice: 0,
        imageUrl: objectUrl,
        cardNumber: '',
        rarity: '',
        language: 'English',
        supplier: '',
        fileObj: file
      };
    });

    setScannedItems(prev => [...prev, ...initialItems.map(item => ({...item, fileObj: undefined}))]);
    setIsScanning(false);

    // Process images via API concurrently
    fileArray.forEach(async (file, index) => {
      const tempId = initialItems[index].tempId;
      try {
        const formData = new FormData();
        formData.append("image", file);
        
        const response = await fetch("/api/scan-card", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const text = await response.text();
          try {
            const data = JSON.parse(text);
            setScannedItems(prev => prev.map(item => {
              if (item.tempId === tempId) {
                return {
                  ...item,
                  name: item.name || data.itemName || '',
                  set: item.set || data.cardSetName || '',
                  cardNumber: item.cardNumber || data.cardNumber || '',
                  rarity: item.rarity || data.rarity || '',
                  foilType: data.foilType && item.foilType === 'Non-Foil' ? data.foilType : item.foilType,
                };
              }
              return item;
            }));
          } catch (e) {
            console.error("Failed to parse JSON for tempId", tempId, text);
            if (text.includes("Cookie check") || text.includes("aistudio_auth_flow")) {
              setScanError("Environment cookie check blocked the AI API. Please open the app in a new tab.");
            }
          }
        } else {
          const text = await response.text();
          let msg = "AI scan failed. You can continue filling out item details.";
          try {
            const jsonErr = JSON.parse(text);
            if (jsonErr.error) msg = jsonErr.error;
          } catch (_) {}
          setScanError(msg);
          console.error("Server API returned error for tempId", tempId, response.status, text);
        }
      } catch (err) {
        console.error("AI Analysis fetch failed for tempId", tempId, err);
        setScanError("Network or server connection failed when analyzing card.");
      }
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      simulateAIScan(e.dataTransfer.files);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      simulateAIScan(e.target.files);
    }
  };

  const updateItem = (tempId: string, field: keyof InventoryItem | 'supplier', value: any) => {
    setScannedItems(prev => prev.map(item => 
      item.tempId === tempId ? { ...item, [field]: value } : item
    ));
  };

  const removeItem = (tempId: string) => {
    setScannedItems(prev => prev.filter(item => item.tempId !== tempId));
  };

  const handleConfirm = () => {
    const totalItems = scannedItems.length;
    if (totalItems === 0) return;

    const totalAdditionalFees = batchPpnImpor + batchPphImpor + batchDeliveryFee;
    const feePerItem = totalAdditionalFees / totalItems;

    const itemsToAdd = scannedItems.map(({ tempId, supplier, ...item }) => {
      const finalAdjustedCost = item.costBasis + feePerItem;
      return {
        ...item,
        costBasis: Math.round(finalAdjustedCost)
      };
    });
    
    const displayDate = new Date(batchDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const records: ProcurementRecord[] = scannedItems.map((item, idx) => ({
      id: `PRC-${Date.now()}-${item.tempId}`,
      date: displayDate,
      type: item.category === 'Slab' ? 'Graded Slab' : item.category === 'Sealed' ? 'Sealed Product' : 'Raw Card',
      itemName: item.name,
      description: `${item.set}${item.cardNumber ? ` • ${item.cardNumber}` : ''}`,
      supplier: batchSupplier || 'Unknown',
      totalCost: itemsToAdd[idx].costBasis
    }));

    onAddProcurements(records.reverse());
    onAddItems(itemsToAdd);
    setScannedItems([]);
    setBatchSupplier('');
    setBatchDeliveryFee(0);
    setBatchPpnImpor(0);
    setBatchPphImpor(0);
  };

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div 
        className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-12 text-center transition-all overflow-hidden ${
          dragActive 
            ? 'border-[#961b2b] bg-[#961b2b]/5' 
            : 'border-gray-200 bg-[#f2f2f2]/90 hover:border-gray-300'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          multiple 
          accept="image/*" 
          className="hidden"
          onChange={handleFileSelect}
        />
        
        {isScanning ? (
          <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 pointer-events-none">
            <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-[#961b2b] animate-spin" />
            <p className="text-base sm:text-lg font-medium text-gray-900 px-2 text-center">AI Vision Scanner analyzing cards...</p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
            {/* Standard Upload File Area */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group cursor-pointer hover:scale-[1.02] active:scale-[0.98] p-4 rounded-xl transition-all flex flex-col items-center text-center max-w-[280px]"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-gray-500 group-hover:text-gray-700 transition-colors" />
              </div>
              <div className="mt-3">
                <p className="text-sm sm:text-base font-bold text-gray-900 leading-tight">Upload Card Images</p>
                <p className="text-xs text-gray-500 mt-2">Drag & drop card/slab images or click to select files</p>
              </div>
            </div>

            {/* Separator Line */}
            <div className="hidden md:block h-20 w-px bg-gray-200 self-center" />
            <div className="md:hidden flex items-center gap-2 w-full max-w-[200px]">
              <div className="h-px bg-gray-200 flex-1" />
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">or</span>
              <div className="h-px bg-gray-250 flex-1" />
            </div>

            {/* QR Scanner Camera Area */}
            <div className="flex flex-col items-center text-center max-w-[280px]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenScanner?.();
                }}
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#961b2b]/10 text-[#961b2b] hover:bg-[#961b2b]/20 hover:scale-[1.05] active:scale-[0.95] flex items-center justify-center transition-all cursor-pointer shadow-sm border border-[#961b2b]/20"
                title="Scan QR Code with Camera"
              >
                <Camera className="w-6 h-6 sm:w-8 sm:h-8" />
              </button>
              <div className="mt-3">
                <p className="text-sm sm:text-base font-bold text-gray-900 leading-tight">Bind QR Code via Camera</p>
                <p className="text-xs text-gray-500 mt-2">Trigger QR camera to bind pre-stickered sleeves instantly</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {scanError && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1">
          <span className="text-lg leading-none">⚠️</span>
          <div className="flex-1">
            <p className="font-bold">AI Scanner Warning</p>
            <p className="text-xs text-amber-700 mt-0.5">{scanError}</p>
          </div>
          <button onClick={() => setScanError(null)} className="text-amber-500 hover:text-amber-700 font-bold text-xs">Dismiss</button>
        </div>
      )}

      {/* Pending Review List */}
      {scannedItems.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Global Batch Metadata Panel */}
          <div className="bg-white border border-[#961b2b]/40 rounded-2xl p-6 space-y-4 shadow-[0_0_15px_rgba(220,38,38,0.05)]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#961b2b] mb-4">Batch Settings & Invoice Metadata</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2 lg:col-span-2">
                <label className="text-sm font-medium text-slate-700">Supplier / Seller</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={batchSupplier}
                    onChange={(e) => setBatchSupplier(e.target.value)}
                    placeholder="Distributor, Walk-in, etc."
                    className="w-full bg-[#f2f2f2] border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-800 placeholder-gray-600 focus:outline-none focus:shadow-[0_0_5px_#961b2b] focus:border-[#961b2b]/50 transition-all block"
                  />
                </div>
              </div>
              <div className="space-y-2 lg:col-span-1">
                <label className="text-sm font-medium text-slate-700">Date & Time</label>
                <input
                  type="datetime-local"
                  value={batchDate}
                  onChange={(e) => setBatchDate(e.target.value)}
                  className="w-full bg-[#f2f2f2] border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:shadow-[0_0_5px_#961b2b] focus:border-[#961b2b]/50 transition-all block appearance-none"
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <label className="text-sm font-medium text-slate-700">Delivery Fee (Rp)</label>
                <CurrencyInput value={batchDeliveryFee} onChange={setBatchDeliveryFee} className="h-[38px] text-sm bg-[#f2f2f2]" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 pt-4 border-t border-gray-200">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">PPN Impor (Rp)</label>
                <CurrencyInput value={batchPpnImpor} onChange={setBatchPpnImpor} className="h-[38px] text-sm bg-[#f2f2f2]" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">PPh Impor (Rp)</label>
                <CurrencyInput value={batchPphImpor} onChange={setBatchPphImpor} className="h-[38px] text-sm bg-[#f2f2f2]" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                Pending Review ({scannedItems.length})
              </h3>
              <button 
                onClick={handleConfirm}
                className="flex items-center gap-2 px-6 py-2 text-sm font-medium bg-[#961b2b] text-gray-900 rounded-lg hover:bg-[#961b2b]/90 shadow-[0_0_15px_rgba(150,27,43,0.3)] transition-all"
              >
                <Check size={16} />
                Confirm & Add All to Vault
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {scannedItems.map((item) => (
              <div key={item.tempId} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row gap-6 group hover:border-gray-300 transition-colors">
                {/* Image Thumbnail */}
                <div className="w-full md:w-32 h-40 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 relative">
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  )}
                  <div className="absolute top-2 right-2 bg-gray-200/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-gray-900 uppercase border border-gray-200">
                    {item.category === 'Slab' ? 'Graded Slab' : item.category === 'Sealed' ? 'Sealed Product' : 'Raw Card'}
                  </div>
                </div>

                {/* Editable Fields */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-semibold text-gray-500">Item Name</label>
                    <input 
                      value={item.name}
                      onChange={(e) => updateItem(item.tempId, 'name', e.target.value)}
                      className="w-full bg-white border border-[#e0e0e0] rounded px-3 py-2 text-sm text-gray-900 focus:border-[#961b2b] focus:outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-semibold text-gray-500">Set</label>
                    <input 
                      value={item.set}
                      onChange={(e) => updateItem(item.tempId, 'set', e.target.value)}
                      className="w-full bg-white border border-[#e0e0e0] rounded px-3 py-2 text-sm text-gray-900 focus:border-[#961b2b] focus:outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-semibold text-gray-500">Card #</label>
                    <input 
                      value={item.cardNumber || ''}
                      onChange={(e) => updateItem(item.tempId, 'cardNumber', e.target.value)}
                      className="w-full bg-white border border-[#e0e0e0] rounded px-3 py-2 text-sm text-gray-900 focus:border-[#961b2b] focus:outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-semibold text-gray-500">Rarity</label>
                    <input 
                      value={item.rarity || ''}
                      onChange={(e) => updateItem(item.tempId, 'rarity', e.target.value)}
                      className="w-full bg-white border border-[#e0e0e0] rounded px-3 py-2 text-sm text-gray-900 focus:border-[#961b2b] focus:outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-semibold text-gray-500">Language</label>
                    <select 
                      value={item.language || 'English'}
                      onChange={(e) => updateItem(item.tempId, 'language', e.target.value)}
                      className="w-full bg-white border border-[#e0e0e0] rounded px-3 py-2 text-sm text-gray-900 focus:border-[#961b2b] focus:outline-none transition-all appearance-none"
                    >
                      <option value="English">English</option>
                      <option value="Japanese">Japanese</option>
                      <option value="Indonesian">Indonesian</option>
                      <option value="Traditional Chinese">Traditional Chinese</option>
                    </select>
                  </div>
                  
                  {item.category === 'Slab' && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-semibold text-gray-500">Grader</label>
                        <select 
                          value={item.gradingCompany || ''}
                          onChange={(e) => updateItem(item.tempId, 'gradingCompany', e.target.value)}
                          className="w-full bg-white border border-[#e0e0e0] rounded px-3 py-2 text-sm text-gray-900 focus:border-[#961b2b] focus:outline-none transition-all appearance-none"
                        >
                          <option value="PSA">PSA</option>
                          <option value="BGS">BGS</option>
                          <option value="CGC">CGC</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-semibold text-gray-500">Grade</label>
                        <input 
                          value={item.condition}
                          onChange={(e) => updateItem(item.tempId, 'condition', e.target.value)}
                          placeholder="10, 9.5..."
                          className="w-full bg-white border border-[#e0e0e0] rounded px-3 py-2 text-sm text-gray-900 focus:border-[#961b2b] focus:outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-semibold text-gray-500">Cert #</label>
                        <input 
                          value={item.certNumber || ''}
                          onChange={(e) => updateItem(item.tempId, 'certNumber', e.target.value)}
                          className="w-full bg-white border border-[#e0e0e0] rounded px-3 py-2 text-sm text-gray-900 focus:border-[#961b2b] focus:outline-none transition-all font-mono"
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-semibold text-gray-500">Cost Basis</label>
                    <CurrencyInput 
                      value={item.costBasis} 
                      onChange={(val) => updateItem(item.tempId, 'costBasis', val)}
                      className="w-full bg-white border border-[#e0e0e0] rounded px-3 py-2 text-sm text-gray-900 focus:border-[#961b2b] focus:outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col justify-start pt-4 sm:pt-6">
                  <button 
                    onClick={() => removeItem(item.tempId)}
                    className="p-2 text-gray-500 hover:text-[#961b2b] hover:bg-[#961b2b]/10 rounded-lg transition-colors"
                    title="Remove Item"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

function ManualEntryForm({ 
  masterCatalog,
  onAddItem, 
  onAddProcurement,
  initialSerialNumber,
  onOpenScanner
}: { 
  masterCatalog: CatalogItem[];
  onAddItem: (item: InventoryItem) => void;
  onAddProcurement: (record: ProcurementRecord) => void;
  initialSerialNumber: string;
  onOpenScanner?: () => void;
}) {
  const [step, setStep] = useState(1);
  const [continuousIntake, setContinuousIntake] = useState(false);
  const [serialNumber, setSerialNumber] = useState(initialSerialNumber || '');
  const [activeQrCode, setActiveQrCode] = useState<string | null>(initialSerialNumber || null);
  const [isBoundToQr, setIsBoundToQr] = useState(false);
  const [isBinding, setIsBinding] = useState(false);

  useEffect(() => {
    if (initialSerialNumber) {
      const sanitized = initialSerialNumber.trim().toUpperCase();
      setSerialNumber(sanitized);
      setActiveQrCode(sanitized);
      setIsBoundToQr(false);
    }
  }, [initialSerialNumber]);

  const [successToast, setSuccessToast] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  
  const [category, setCategory] = useState('Single'); // 'Single' = Raw Card, 'Slab' = Graded Slab, 'Sealed' = Sealed Product
  const [sealedType, setSealedType] = useState('Sealed Box');
  const [costBasis, setCostBasis] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [itemName, setItemName] = useState('');
  const [cardSetName, setCardSetName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [rarity, setRarity] = useState('');
  const [language, setLanguage] = useState('English');
  const [condition, setCondition] = useState('NM');
  const [foilType, setFoilType] = useState('Non-Foil');
  const [gradingCompany, setGradingCompany] = useState('');
  const [grade, setGrade] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [supplier, setSupplier] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Date acquired defaulting to local today (YYYY-MM-DD)
  const [acquisitionDate, setAcquisitionDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const filteredSuggestions = masterCatalog.filter(c => 
    itemName && c?.itemName?.toLowerCase().includes(itemName.toLowerCase())
  ).slice(0, 5);

  const handleSelectSuggestion = (suggestion: CatalogItem) => {
    setItemName(suggestion.itemName);
    setCardSetName(suggestion.setName);
    if (suggestion.cardNumber) setCardNumber(suggestion.cardNumber);
    if (suggestion.rarity) setRarity(suggestion.rarity);
    setShowSuggestions(false);
    clearError('itemName');
    clearError('cardSetName');
  };

  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: false }));
    }
  };

  const isBoxOrCase = category === 'Sealed' && (sealedType === 'Sealed Box' || sealedType === 'Sealed Case');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImageUrl(URL.createObjectURL(file));

      setIsAnalyzing(true);
      setScanError(null);
      try {
        const formData = new FormData();
        formData.append("image", file);

        const response = await fetch("/api/scan-card", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const text = await response.text();
          try {
            const data = JSON.parse(text);
            setItemName(prev => prev || data.itemName || '');
            setCardSetName(prev => prev || data.cardSetName || '');
            setCardNumber(prev => prev || data.cardNumber || '');
            setRarity(prev => prev || data.rarity || '');
            if (data.foilType) {
              setFoilType(prev => prev === 'Non-Foil' ? data.foilType : prev);
            }
          } catch (e) {
            console.error("Failed to parse JSON, raw response:", text);
            if (text.includes("Cookie check") || text.includes("aistudio_auth_flow")) {
              setScanError("Environment cookie check blocked the API. Please open the app in a new tab.");
            } else {
              setScanError("Failed to parse AI response. Please input manually.");
            }
          }
        } else {
          const text = await response.text();
          let msg = "AI scan failed. Please input details manually below.";
          try {
            const jsonErr = JSON.parse(text);
            if (jsonErr.error) msg = jsonErr.error;
          } catch (_) {}
          setScanError(msg);
          console.error("Server error:", response.status, text);
        }
      } catch (err) {
        console.error("AI Analysis failed:", err);
        setScanError("Network or server connection failed when analyzing card.");
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const serialInputRef = useRef<HTMLInputElement>(null);

  const handleBindCardToQr = async () => {
    if (!activeQrCode) return;
    setIsBinding(true);
    setErrors(prev => {
      const copy = { ...prev };
      delete copy.qrBindingRequired;
      return copy;
    });

    try {
      // Exact payload representation matching requirements
      const mapping = {
        qrCode: activeQrCode,
        boundAt: new Date().toISOString(),
        status: 'active'
      };

      // Persistent mapping stored in localStorage to simulate durable Firestore qr_mappings write
      const currentMappings = (() => {
        try {
          return JSON.parse(localStorage.getItem('bandit_qr_mappings') || '[]');
        } catch (_) {
          return [];
        }
      })();

      localStorage.setItem('bandit_qr_mappings', JSON.stringify([...currentMappings, mapping]));

      // Artificial 800ms delay to simulate database write transaction resolution
      await new Promise(resolve => setTimeout(resolve, 800));

      setIsBoundToQr(true);
    } catch (err) {
      console.error("Firebase write mapping failed", err);
    } finally {
      setIsBinding(false);
    }
  };

  const validateStep1 = () => {
    const newErrors: Record<string, boolean> = {};
    if (!itemName || !itemName.trim()) newErrors.itemName = true;
    if (!cardSetName || !cardSetName.trim()) newErrors.cardSetName = true;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, boolean> = {};
    if (category === 'Slab') {
      if (!gradingCompany) newErrors.gradingCompany = true;
      if (!grade || !grade.trim()) newErrors.grade = true;
      if (!certNumber || !certNumber.trim()) newErrors.certNumber = true;
    } else if (category === 'Single') {
      if (!condition) newErrors.condition = true;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors: Record<string, boolean> = {};
    if (!costBasis || typeof costBasis !== 'number' || costBasis <= 0) newErrors.costBasis = true;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    if (!validateStep2()) {
      setStep(2);
      return;
    }
    if (!validateStep3()) {
      setStep(3);
      return;
    }

    if (activeQrCode && !isBoundToQr) {
      setErrors(prev => ({ ...prev, qrBindingRequired: true }));
      setStep(1);
      return;
    }

    // Direct, synchronous read from the physical DOM element to prevent stale state issues
    const activeSerial = serialInputRef.current ? serialInputRef.current.value : serialNumber;
    const sanitizedSerialNumber = activeSerial.trim().toUpperCase();
    const assignedId = sanitizedSerialNumber || `INV-${Date.now()}`;

    // Convert acquisitionDate to display string formatting
    const parts = acquisitionDate.split('-');
    const selectedDateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const formattedAcquisitionDate = selectedDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const finalPayload: any = {
      id: assignedId,
      name: itemName,
      set: cardSetName,
      category,
      condition: category === 'Slab' ? grade : condition,
      foilType: isBoxOrCase ? 'N/A' : foilType,
      gradingCompany: category === 'Slab' ? gradingCompany : null,
      certNumber: category === 'Slab' ? certNumber : null,
      stock: Number(quantity) || 1,
      costBasis: Number(String(costBasis).replace(/[^0-9.-]+/g,"")) || 0,
      currentPrice: 0,
      imageUrl: imageUrl || null,
      cardNumber: isBoxOrCase ? '' : cardNumber,
      rarity: isBoxOrCase ? '' : rarity,
      language,
      acquisitionDate: formattedAcquisitionDate,
      status: "In Stock"
    };

    console.log("📦 Final Procurement Payload:", finalPayload);

    const newItem: InventoryItem = {
      ...finalPayload,
      quantity: finalPayload.stock, // Remap for local application interface
      costBasis: finalPayload.costBasis
    } as unknown as InventoryItem;

    const newRecord: ProcurementRecord = {
      id: `PRC-${Date.now()}`,
      date: formattedAcquisitionDate,
      type: category === 'Slab' ? 'Graded Slab' : category === 'Sealed' ? sealedType : 'Raw Card',
      itemName: itemName,
      description: `${cardSetName}${!isBoxOrCase && cardNumber ? ` • ${cardNumber}` : ''}`,
      supplier: supplier || 'Unknown',
      totalCost: costBasis * quantity
    };

    onAddProcurement(newRecord);
    onAddItem({ ...newItem, id: assignedId });

    if (continuousIntake) {
      setSuccessToast(`Bound to ${assignedId}`);
      setTimeout(() => setSuccessToast(''), 3000);
      setSerialNumber('');
      setActiveQrCode(null);
      setIsBoundToQr(false);
      if (serialInputRef.current) {
        serialInputRef.current.value = '';
      }
      setTimeout(() => serialInputRef.current?.focus(), 50);
      setStep(1);
    } else {
      setItemName('');
      setCardSetName('');
      setImageUrl('');
      setImageFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setCardNumber('');
      setRarity('');
      setCostBasis(0);
      setQuantity(1);
      setSupplier('');
      setCertNumber('');
      setGradingCompany('');
      setGrade('');
      setSerialNumber('');
      setActiveQrCode(null);
      setIsBoundToQr(false);
      if (serialInputRef.current) {
        serialInputRef.current.value = '';
      }
      setStep(1);
    }
    setErrors({});
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (step === 1) {
        if (validateStep1()) setStep(2);
      } else if (step === 2) {
        if (validateStep2()) setStep(3);
      } else if (step === 3) {
        handleSubmit();
      }
    }
  };

  const steps = [
    { number: 1, label: 'Identity' },
    { number: 2, label: 'Attributes' },
    { number: 3, label: 'Financials' }
  ];

  return (
    <div className="space-y-6 max-w-4xl" onKeyDown={handleKeyDown}>
      {/* Wizard Progress Index */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center justify-between w-full">
            {steps.map((st, sIdx) => {
              const isActive = step === st.number;
              const isCompleted = step > st.number;
              
              return (
                <React.Fragment key={st.number}>
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border transition-all duration-300 ${
                      isActive 
                        ? 'bg-[#961b2b] text-white border-[#961b2b]' 
                        : isCompleted 
                          ? 'bg-emerald-500 text-white border-emerald-500' 
                          : 'bg-white text-gray-400 border-gray-200'
                    }`}>
                      {isCompleted ? <Check size={14} /> : st.number}
                    </div>
                    <div className="text-left leading-tight">
                      <span className={`text-[9px] uppercase tracking-wider font-semibold block ${isActive ? 'text-[#961b2b]' : isCompleted ? 'text-emerald-600' : 'text-gray-400'}`}>
                        Step {st.number}
                      </span>
                      <span className={`text-xs font-bold block ${isActive ? 'text-gray-950' : isCompleted ? 'text-gray-700' : 'text-gray-400'}`}>
                        {st.label}
                      </span>
                    </div>
                  </div>
                  {sIdx < steps.length - 1 && (
                    <div className={`flex-1 mx-2 sm:mx-4 h-0.5 transition-all duration-500 ${step > st.number ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {successToast && (
        <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 border border-emerald-200 flex items-center gap-2">
          <Check size={16} />
          {successToast}
        </div>
      )}

      {scanError && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1">
          <span className="text-lg leading-none">⚠️</span>
          <div className="flex-1">
            <p className="font-bold">AI Scanner Warning</p>
            <p className="text-xs text-amber-700 mt-0.5">{scanError}</p>
          </div>
          <button onClick={() => setScanError(null)} className="text-amber-500 hover:text-amber-700 font-bold text-xs">Dismiss</button>
        </div>
      )}

      {/* Wizard Content Segment with motion animations */}
      <div className="min-h-[220px] bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              {/* Top Row: Intake and Serial setup */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div 
                    className={`w-10 h-5 flex items-center rounded-full p-1 cursor-pointer transition-colors ${continuousIntake ? 'bg-[#961b2b]' : 'bg-gray-300'}`}
                    onClick={() => setContinuousIntake(!continuousIntake)}
                  >
                    <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${continuousIntake ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Continuous Intake (Lock Details)</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-700">Bind to QR/Serial (Optional):</label>
                  <div className="flex items-center gap-1.5 bg-white border border-[#e0e0e0] rounded px-2 py-1 focus-within:border-[#961b2b] transition-all">
                    <input
                      type="text"
                      ref={serialInputRef}
                      value={serialNumber}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setSerialNumber(val);
                        setActiveQrCode(val || null);
                        setIsBoundToQr(false);
                      }}
                      placeholder="e.g. SN-001"
                      className="w-24 bg-transparent border-none text-xs text-gray-900 outline-none focus:ring-0 uppercase font-mono"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => onOpenScanner?.()}
                      className="p-1 text-slate-400 hover:text-[#961b2b] hover:bg-[#961b2b]/10 rounded transition-colors"
                      title="Scan QR Code with Camera"
                    >
                      <Camera size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* QR Code Binding Status Panel */}
              {activeQrCode && (
                <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isBoundToQr 
                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800 shadow-sm' 
                    : errors.qrBindingRequired
                      ? 'bg-rose-50 border-rose-250 text-rose-800 shadow-[0_0_12px_rgba(220,38,38,0.08)]'
                      : 'bg-slate-50 border-gray-200 text-slate-800 shadow-sm'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg transition-colors ${
                      isBoundToQr ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <QrCodeIcon size={18} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Intake Target Label (Parent SKU)
                      </span>
                      <span className="text-sm font-mono font-bold tracking-tight">
                        {activeQrCode}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isBoundToQr ? (
                      <button
                        type="button"
                        onClick={handleBindCardToQr}
                        disabled={isBinding}
                        className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-[#961b2b] text-white rounded-lg hover:bg-[#961b2b]/95 shadow transition-all duration-155 min-h-[38px] disabled:opacity-55 cursor-pointer"
                      >
                        {isBinding ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <LinkIcon size={14} />
                            Bind Card to QR Code
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm">
                        <Check size={14} />
                        ✓ Card Bound Successfully
                      </div>
                    )}
                  </div>
                </div>
              )}

              {errors.qrBindingRequired && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-bounce">
                  <span>⚠️</span>
                  <span>You must bind this card to the QR code before saving.</span>
                </div>
              )}

              {/* Main Fields: Photo upload and basic metadata */}
              <div className="grid grid-cols-1 md:grid-cols-[130px_1fr] gap-6">
                <div className="space-y-1 flex-shrink-0">
                  <label className="text-sm font-medium text-slate-700 flex items-center">
                    Image File
                    {isAnalyzing && <span className="ml-1 text-[#961b2b] animate-pulse text-xs">...</span>}
                  </label>
                  <div className="w-full md:w-[130px] h-[130px] rounded-lg bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center overflow-hidden relative group transition-all">
                    {imageUrl ? (
                      <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-gray-400 text-center p-2">
                        <ImageIcon size={22} className="text-gray-400" />
                        <span className="text-[9px] uppercase font-bold tracking-wide">Upload Image</span>
                      </div>
                    )}
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-white/85 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-[#961b2b] animate-spin" />
                      </div>
                    )}
                    {imageUrl && !isAnalyzing && (
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          setImageUrl('');
                          setImageFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                      >
                        <Trash2 size={22} className="text-white" />
                      </button>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      ref={fileInputRef}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 content-end">
                  <div className="flex flex-col gap-1 relative">
                    <label className="text-sm font-medium text-slate-700">Item Name</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={itemName}
                        onChange={(e) => { 
                          setItemName(e.target.value); 
                          setShowSuggestions(true);
                          clearError('itemName'); 
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        placeholder="e.g. Charizard ex"
                        className={`w-full bg-white border ${errors.itemName ? '!border-[#961b2b]' : 'border-[#e0e0e0]'} rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all block placeholder-gray-400`}
                      />
                      
                      <AnimatePresence>
                        {showSuggestions && filteredSuggestions.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto"
                          >
                            {filteredSuggestions.map((suggestion, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleSelectSuggestion(suggestion)}
                                className="w-full text-left px-4 py-2 text-sm text-gray-900 hover:bg-[#961b2b]/10 hover:text-[#961b2b] focus:bg-[#961b2b]/10 focus:text-[#961b2b] focus:outline-none transition-colors border-b border-gray-50 last:border-0"
                              >
                                <div className="font-semibold text-xs text-gray-800">{suggestion.itemName}</div>
                                <div className="text-[10px] text-gray-500 flex items-center gap-2">
                                  <span>{suggestion.setName}</span>
                                  {suggestion.cardNumber && <span>• {suggestion.cardNumber}</span>}
                                  {suggestion.rarity && <span>• {suggestion.rarity}</span>}
                                </div>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    {errors.itemName && <span className="absolute -bottom-4 right-0 text-[10px] font-bold text-[#961b2b]">REQUIRED</span>}
                  </div>

                  <div className="flex flex-col gap-1 relative">
                    <label className="text-sm font-medium text-slate-700">Set Name</label>
                    <input
                      type="text"
                      value={cardSetName}
                      onChange={(e) => { setCardSetName(e.target.value); clearError('cardSetName'); }}
                      placeholder="e.g. 151, Scarlet & Violet"
                      className={`w-full bg-white border ${errors.cardSetName ? '!border-[#961b2b]' : 'border-[#e0e0e0]'} rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all placeholder-gray-400`}
                    />
                    {errors.cardSetName && <span className="absolute -bottom-4 right-0 text-[10px] font-bold text-[#961b2b]">REQUIRED</span>}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              {/* Category selector row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Category</label>
                  <select 
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      clearError('condition');
                    }}
                    className="w-full bg-white border border-[#e0e0e0] rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all appearance-none"
                  >
                    <option value="Single">Raw Card</option>
                    <option value="Slab">Graded Slab</option>
                    <option value="Sealed">Sealed Product</option>
                  </select>
                </div>
                {category === 'Sealed' && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Sealed Type</label>
                    <select 
                      value={sealedType}
                      onChange={(e) => setSealedType(e.target.value)}
                      className="w-full bg-white border border-[#e0e0e0] rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all appearance-none"
                    >
                      <option value="Sealed Box">Sealed Box</option>
                      <option value="Sealed Case">Sealed Case</option>
                      <option value="Sealed Promo/Single">Sealed Promo/Single</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Attributes layout */}
              <div className={`grid grid-cols-2 ${!isBoxOrCase ? 'md:grid-cols-5' : 'md:grid-cols-2'} gap-4`}>
                {!isBoxOrCase && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Card Number</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => { setCardNumber(e.target.value.replace(/[^\d\/-]/g, '')); }}
                      placeholder="e.g. 199/165"
                      className="w-full bg-white border border-[#e0e0e0] rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all placeholder-gray-400"
                    />
                  </div>
                )}
                {!isBoxOrCase && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Rarity</label>
                    <input
                      type="text"
                      value={rarity}
                      onChange={(e) => setRarity(e.target.value)}
                      placeholder="e.g. SIR"
                      className="w-full bg-white border border-[#e0e0e0] rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all placeholder-gray-400"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Language</label>
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-white border border-[#e0e0e0] rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all appearance-none"
                  >
                    <option value="English">English</option>
                    <option value="Japanese">Japanese</option>
                    <option value="Indonesian">Indonesian</option>
                    <option value="Traditional Chinese">Traditional Chinese</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 relative">
                  <label className="text-sm font-medium text-slate-700">Condition</label>
                  {category === 'Single' ? (
                    <select 
                      value={condition}
                      onChange={(e) => { setCondition(e.target.value); clearError('condition'); }}
                      className={`w-full bg-white border ${errors.condition ? '!border-[#961b2b]' : 'border-[#e0e0e0]'} rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all appearance-none`}
                    >
                      <option value="NM">Near Mint (NM)</option>
                      <option value="LP">Lightly Played (LP)</option>
                      <option value="MP">Moderately Played (MP)</option>
                      <option value="HP">Heavily Played (HP)</option>
                      <option value="DMG">Damaged (DMG)</option>
                    </select>
                  ) : (
                    <div className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 cursor-not-allowed">
                      Auto (Grade)
                    </div>
                  )}
                </div>
                {!isBoxOrCase && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Foil Type</label>
                    <select 
                      value={foilType}
                      onChange={(e) => setFoilType(e.target.value)}
                      className="w-full bg-white border border-[#e0e0e0] rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all appearance-none"
                    >
                      <option value="Non-Foil">Non-Foil</option>
                      <option value="Reverse Holo">Reverse Holo</option>
                      <option value="Holo">Holo</option>
                      <option value="Textured">Textured / Full Art</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Slab specifics */}
              {category === 'Slab' && (
                <div className="pt-4 border-t border-gray-100 animate-in slide-in-from-top-1 duration-200">
                  <h4 className="text-xs font-bold text-[#961b2b] uppercase tracking-wider mb-2">Graded Slab Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1 relative">
                      <label className="text-sm font-medium text-slate-700">Grading Company</label>
                      <select 
                        value={gradingCompany}
                        onChange={(e) => { setGradingCompany(e.target.value); clearError('gradingCompany'); }}
                        className={`w-full bg-white border ${errors.gradingCompany ? '!border-[#961b2b]' : 'border-[#e0e0e0]'} rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all appearance-none`}
                      >
                        <option value="" disabled>Select company...</option>
                        <option value="PSA">PSA</option>
                        <option value="BGS">BGS</option>
                        <option value="CGC">CGC</option>
                        <option value="SGC">SGC</option>
                        <option value="PCG">PCG</option>
                      </select>
                      {errors.gradingCompany && <span className="absolute -bottom-4 right-0 text-[10px] font-bold text-[#961b2b]">REQUIRED</span>}
                    </div>
                    <div className="flex flex-col gap-1 relative">
                      <label className="text-sm font-medium text-slate-700">Grade</label>
                      <input
                        type="text"
                        value={grade}
                        onChange={(e) => { setGrade(e.target.value.replace(/[^\d.]/g, '')); clearError('grade'); }}
                        placeholder="e.g. 10, 9.5"
                        className={`w-full bg-white border ${errors.grade ? '!border-[#961b2b]' : 'border-[#e0e0e0]'} rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#961b2b] transition-all`}
                      />
                      {errors.grade && <span className="absolute -bottom-4 right-0 text-[10px] font-bold text-[#961b2b]">REQUIRED</span>}
                    </div>
                    <div className="flex flex-col gap-1 relative">
                      <label className="text-sm font-medium text-slate-700">Cert Number</label>
                      <input
                        type="text"
                        value={certNumber}
                        onChange={(e) => { setCertNumber(e.target.value.replace(/\D/g, '')); clearError('certNumber'); }}
                        placeholder="e.g. 84729104"
                        className={`w-full bg-white border ${errors.certNumber ? '!border-[#961b2b]' : 'border-[#e0e0e0]'} rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#961b2b] transition-all font-mono`}
                      />
                      {errors.certNumber && <span className="absolute -bottom-4 right-0 text-[10px] font-bold text-[#961b2b]">REQUIRED</span>}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="flex flex-col gap-1 relative">
                  <label className="text-sm font-medium text-slate-700">Cost Basis (Amt Paid)</label>
                  <CurrencyInput 
                    value={costBasis} 
                    onChange={(val) => { setCostBasis(val); clearError('costBasis'); }} 
                    className={`w-full h-[38px] bg-white border ${errors.costBasis ? '!border-[#961b2b]' : 'border-[#e0e0e0]'} rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all`}
                  />
                  {errors.costBasis && <span className="absolute -bottom-4 right-0 text-[10px] font-bold text-[#961b2b]">REQUIRED</span>}
                </div>
                <div className="flex flex-col gap-1 relative">
                  <label className="text-sm font-medium text-slate-700">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full h-[38px] bg-white border border-[#e0e0e0] rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Supplier / Seller</label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="Walk-in, Distributor, etc."
                    className="w-full bg-white border border-[#e0e0e0] rounded-lg px-3 py-2 text-sm text-gray-900 h-[38px] placeholder-gray-400 focus:outline-none focus:border-[#961b2b] transition-all"
                  />
                </div>
                {/* Backdated Date picker input */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <Calendar size={12} />
                    Date Acquired (Procurement Date)
                  </label>
                  <input
                    type="date"
                    value={acquisitionDate}
                    onChange={(e) => setAcquisitionDate(e.target.value)}
                    className="w-full bg-white border border-[#e0e0e0] rounded-lg px-3 py-2 text-sm text-gray-800 h-[38px] focus:outline-none focus:border-[#961b2b] transition-all appearance-none"
                    max={new Date().toISOString().split('T')[0]} // Reject future planning
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Buttons */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-150">
        <div>
          {step > 1 && (
            <button
              onClick={() => {
                setErrors({});
                setStep(prev => prev - 1);
              }}
              className="px-5 py-2 text-xs font-bold bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm transition-all duration-150 min-h-[40px]"
            >
              Back
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {step < 3 ? (
            <button
              onClick={() => {
                if (step === 1) {
                  if (validateStep1()) setStep(2);
                } else if (step === 2) {
                  if (validateStep2()) setStep(3);
                }
              }}
              className="px-6 py-2 text-xs font-semibold bg-[#961b2b] text-white rounded-lg hover:bg-[#961b2b]/95 shadow transition-all duration-150 min-h-[40px]"
            >
              Next
            </button>
          ) : (
            <div className="flex flex-col items-end gap-1">
              {activeQrCode && !isBoundToQr && (
                <span className="text-[10px] font-bold text-rose-600 animate-pulse mr-1">
                  ⚠️ Binding to QR required
                </span>
              )}
              <button
                onClick={handleSubmit}
                disabled={activeQrCode ? !isBoundToQr : false}
                className={`flex items-center gap-2 px-6 py-2 text-xs font-bold rounded-lg shadow-lg transition-all duration-150 min-h-[40px] ${
                  activeQrCode && !isBoundToQr
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none border border-gray-300'
                    : 'bg-[#961b2b] text-gray-105 hover:bg-[#961b2b]/95 shadow-[#961b2b]/15 text-white'
                }`}
              >
                <Plus size={15} />
                Add to Inventory
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
