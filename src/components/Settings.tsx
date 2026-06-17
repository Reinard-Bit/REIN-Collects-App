import React, { useState } from 'react';
import { 
  Search, 
  Edit, 
  Trash2, 
  Database, 
  Plus, 
  X, 
  Sliders, 
  Check, 
  Info,
  ShieldAlert,
  HelpCircle,
  HardDriveUpload
} from 'lucide-react';
import { CatalogItem } from '../App';
import { useFirebase } from '../contexts/FirebaseContext';
import { firestoreService } from '../utils/firestoreService';
import { CsvImporter } from './CsvImporter';

interface SettingsProps {
  masterCatalog: CatalogItem[];
  onUpdateCatalog: (updatedCatalog: CatalogItem[]) => void;
  outOfPocketCapital?: number;
  cashReserve?: number;
}

export function Settings({ 
  masterCatalog, 
  onUpdateCatalog,
  outOfPocketCapital = 0,
  cashReserve = 0 
}: SettingsProps) {
  const { user } = useFirebase();
  const [activeTab, setActiveTab] = useState<'catalog' | 'preferences' | 'import'>('catalog');
  
  // Search state for autocomplete catalog
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editItem, setEditItem] = useState<CatalogItem | null>(null);
  
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItem, setNewItem] = useState<CatalogItem>({
    itemName: '',
    setName: '',
    cardNumber: '',
    rarity: ''
  });

  // General Preferences state (persisted locally)
  const [storeName, setStoreName] = useState(() => localStorage.getItem('bandit_store_name') || 'REIN Collects');
  const [currencySymbol, setCurrencySymbol] = useState(() => localStorage.getItem('bandit_currency') || 'IDR');
  const [defaultPlatformFee, setDefaultPlatformFee] = useState(() => localStorage.getItem('bandit_def_platform_fee') || '10');
  const [defaultShipping, setDefaultShipping] = useState(() => localStorage.getItem('bandit_def_shipping') || '0');
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);

  const savePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('bandit_store_name', storeName);
    localStorage.setItem('bandit_currency', currencySymbol);
    localStorage.setItem('bandit_def_platform_fee', defaultPlatformFee);
    localStorage.setItem('bandit_def_shipping', defaultShipping);

    if (user) {
      firestoreService.saveSettings(user.uid, {
        storeName,
        currencySymbol,
        defaultPlatformFee,
        defaultShipping,
        outOfPocketCapital,
        cashReserve
      });
    }

    setShowSavedFeedback(true);
    setTimeout(() => setShowSavedFeedback(false), 3000);
  };


  // Filter master catalog matching search query
  const filteredCatalog = masterCatalog.map((item, originalIndex) => ({
    item,
    originalIndex
  })).filter(({ item }) => {
    const term = searchQuery.toLowerCase().trim();
    if (!term) return true;
    return (
      (item?.itemName || '').toLowerCase().includes(term) ||
      (item?.setName || '').toLowerCase().includes(term) ||
      (item?.cardNumber || '').toLowerCase().includes(term) ||
      (item?.rarity || '').toLowerCase().includes(term)
    );
  });

  // Delete Action
  const handleDelete = (originalIndex: number) => {
    const item = masterCatalog[originalIndex];
    if (!item) return;

    const updatedCatalog = [...masterCatalog];
    updatedCatalog.splice(originalIndex, 1);
    onUpdateCatalog(updatedCatalog);
  };

  // Edit Action - opens modal
  const handleStartEdit = (originalIndex: number) => {
    setEditingIndex(originalIndex);
    setEditItem({ ...masterCatalog[originalIndex] });
  };

  // Save Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingIndex === null || !editItem) return;

    if (!editItem.itemName.trim() || !editItem.setName.trim()) {
      console.warn("Item Name and Set Name are required.");
      return;
    }

    const updatedCatalog = [...masterCatalog];
    updatedCatalog[editingIndex] = {
      itemName: editItem.itemName.trim(),
      setName: editItem.setName.trim(),
      cardNumber: editItem.cardNumber?.trim() || undefined,
      rarity: editItem.rarity?.trim() || undefined
    };

    onUpdateCatalog(updatedCatalog);
    setEditingIndex(null);
    setEditItem(null);
  };

  // Create Action
  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.itemName.trim() || !newItem.setName.trim()) {
      console.warn("Item Name and Set Name are required.");
      return;
    }

    const created: CatalogItem = {
      itemName: newItem.itemName.trim(),
      setName: newItem.setName.trim(),
      cardNumber: newItem.cardNumber?.trim() || undefined,
      rarity: newItem.rarity?.trim() || undefined
    };

    onUpdateCatalog([created, ...masterCatalog]);
    setIsAddingNew(false);
    setNewItem({ itemName: '', setName: '', cardNumber: '', rarity: '' });
  };

  return (
    <div id="settings-view-root" className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <span className="text-[#961b2b]">⚙️</span> Settings & Backstage
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Configure system rules, preferences, and handle the autocomplete catalog.
          </p>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex flex-wrap border-b border-gray-200 gap-2 pb-px">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'catalog'
              ? 'border-[#961b2b] text-[#961b2b]'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Database size={16} />
          Master Catalog Management
        </button>
        <button
          onClick={() => setActiveTab('preferences')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'preferences'
              ? 'border-[#961b2b] text-[#961b2b]'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Sliders size={16} />
          General Preferences
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'import'
              ? 'border-[#961b2b] text-[#961b2b]'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <HardDriveUpload size={16} />
          Data Import
        </button>
      </div>

      {/* TABS CONTENT */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-1.5">
                  <Database size={18} className="text-[#961b2b]" />
                  Master Catalog Database ({masterCatalog.length} entries)
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  This database fuels the autocomplete intelligence and scans. Correct typos directly to clean up suggestions.
                </p>
              </div>

              {/* Search & Add New Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search catalog cards..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 text-sm bg-[#f2f2f2] border-transparent rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#961b2b] w-full sm:w-[240px] text-gray-900"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                    >
                      CLEAR
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setIsAddingNew(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-[#961b2b] text-white hover:bg-[#961b2b]/95 text-sm font-semibold rounded-lg transition-colors cursor-pointer shadow-sm shadow-[#961b2b]/10"
                >
                  <Plus size={16} />
                  Add Card Item
                </button>
              </div>
            </div>

            {/* List Table with media query responsive block under 768px */}
            <div className="relative overflow-visible border border-gray-100 rounded-xl">
              <table className="w-full text-left text-sm block md:table">
                <thead>
                  <tr className="hidden md:table-row text-gray-500 border-b border-gray-200 bg-[#f2f2f2]/50 font-semibold">
                    <th className="px-6 py-4">Card Name</th>
                    <th className="px-6 py-4">Expansion Set</th>
                    <th className="px-6 py-4">Card # / Identifier</th>
                    <th className="px-6 py-4">Rarity Label</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 md:table-row-group block w-full">
                  {filteredCatalog.length === 0 ? (
                    <tr className="block md:table-row">
                      <td colSpan={5} className="py-12 text-center text-gray-500 block md:table-cell">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span className="text-2xl">🔍</span>
                          <span className="font-semibold text-gray-800">No cards matched your query</span>
                          <span className="text-xs text-gray-400">Try checking the spelling or register a new card.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCatalog.map(({ item, originalIndex }) => (
                      <React.Fragment key={`${item.itemName}-${item.setName}-${originalIndex}`}>
                        {/* Desktop View Row */}
                        <tr className="hidden md:table-row group hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 font-semibold text-gray-900">
                            {item.itemName}
                          </td>
                          <td className="px-6 py-4 text-gray-700">
                            {item.setName}
                          </td>
                          <td className="px-6 py-4 font-mono text-gray-600">
                            {item.cardNumber || '—'}
                          </td>
                          <td className="px-6 py-4">
                            {item.rarity ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                                {item.rarity}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleStartEdit(originalIndex)}
                                className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Edit Item Details"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(originalIndex)}
                                className="p-1.5 text-gray-400 hover:text-[#961b2b] hover:bg-[#961b2b]/5 rounded-lg transition-colors"
                                title="Delete Item"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Mobile Card Stack Layout (Responsive break down below md / 768px) */}
                        <tr className="md:hidden block w-full border-b border-gray-100 last:border-0 hover:bg-gray-50/10 transition-colors">
                          <td className="block p-4 border-none bg-transparent w-full">
                            <div className="flex flex-col gap-3">
                              {/* Header & title */}
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-bold text-gray-900 text-sm">{item.itemName}</h4>
                                  <p className="text-xs text-gray-500 mt-0.5">Set: <span className="font-medium text-gray-700">{item.setName}</span></p>
                                </div>
                                
                                {/* Trash button for quick mobile deletions */}
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleStartEdit(originalIndex)}
                                    className="p-2 text-gray-500 bg-gray-50 border border-gray-100 rounded-lg text-xs font-semibold block"
                                  >
                                    <Edit size={14} className="inline mr-1" /> Edit
                                  </button>
                                  <button
                                    onClick={() => handleDelete(originalIndex)}
                                    className="p-2 text-red-500 bg-[#961b2b]/5 border border-red-100 rounded-lg text-xs block"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>

                              {/* Card Attributes Grid */}
                              <div className="grid grid-cols-2 gap-4 pt-1 bg-[#f2f2f2]/30 p-2.5 rounded-lg border border-gray-100">
                                <div>
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Card #</span>
                                  <span className="font-mono text-xs text-gray-800 mt-0.5 block truncate">
                                    {item.cardNumber || 'N/A'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Rarity</span>
                                  {item.rarity ? (
                                    <span className="text-xs text-gray-800 mt-0.5 block truncate">
                                      {item.rarity}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400 mt-0.5 block">N/A</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'preferences' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-6">
          <div>
            <h3 className="font-bold text-gray-900 flex items-center gap-1.5 border-b border-gray-100 pb-3">
              <Sliders size={18} className="text-[#961b2b]" />
              Store Information & Base Rules
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Configure baseline defaults used throughout the inventory modules. These values save locally in your active browser instance.
            </p>
          </div>

          <form onSubmit={savePreferences} className="space-y-4 max-w-lg">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest block">Store Brand Name</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full bg-[#f2f2f2] border-transparent rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#961b2b] focus:border-[#961b2b]"
                placeholder="REIN Collects"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest block">Currency Code</label>
                <select
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  className="w-full bg-[#f2f2f2] border-transparent rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#961b2b]"
                >
                  <option value="IDR">IDR (Rp)</option>
                  <option value="USD">USD ($)</option>
                  <option value="SGD">SGD (S$)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest block">Default Platform Fee (%)</label>
                <input
                  type="number"
                  value={defaultPlatformFee}
                  onChange={(e) => setDefaultPlatformFee(e.target.value)}
                  className="w-full bg-[#f2f2f2] border-transparent rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#961b2b]"
                  placeholder="10"
                  min="0"
                  max="100"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest block">Base Shipping Cost ({currencySymbol === 'IDR' ? 'Rp' : currencySymbol})</label>
              <input
                type="number"
                value={defaultShipping}
                onChange={(e) => setDefaultShipping(e.target.value)}
                className="w-full bg-[#f2f2f2] border-transparent rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#961b2b]"
                placeholder="0"
                min="0"
              />
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                type="submit"
                className="px-4 py-2 bg-[#961b2b] text-white hover:bg-[#961b2b]/95 text-sm font-semibold rounded-lg transition-colors cursor-pointer shadow-sm shadow-[#961b2b]/10"
              >
                Save Preferences
              </button>
              {showSavedFeedback && (
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1 animate-in fade-in">
                  <Check size={14} /> Preferences saved!
                </span>
              )}
            </div>
          </form>
        </div>
      )}

      {activeTab === 'import' && (
        <CsvImporter />
      )}

      {/* CREATE CARD MODAL */}
      {isAddingNew && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsAddingNew(false)} />
          <div className="relative bg-[#f2f2f2] border border-gray-200 rounded-xl shadow-2xl p-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <div className="bg-[#961b2b]/10 text-[#961b2b] p-2 rounded-lg">
                  <Database size={20} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Add Item to Catalog</h3>
              </div>
              <button onClick={() => setIsAddingNew(false)} className="p-1 text-gray-400 hover:text-gray-800 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest block">Item Name <span className="text-[#961b2b]">*</span></label>
                <input
                  type="text"
                  required
                  value={newItem.itemName}
                  onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                  placeholder="e.g. Charizard"
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] focus:ring-1 focus:ring-[#961b2b]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest block">Set Name <span className="text-[#961b2b]">*</span></label>
                <input
                  type="text"
                  required
                  value={newItem.setName}
                  onChange={(e) => setNewItem({ ...newItem, setName: e.target.value })}
                  placeholder="e.g. Base Set"
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] focus:ring-1 focus:ring-[#961b2b]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest block">Card # / ID</label>
                  <input
                    type="text"
                    value={newItem.cardNumber}
                    onChange={(e) => setNewItem({ ...newItem, cardNumber: e.target.value })}
                    placeholder="e.g. 4/102"
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] focus:ring-1 focus:ring-[#961b2b] font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest block">Rarity Tag</label>
                  <input
                    type="text"
                    value={newItem.rarity}
                    onChange={(e) => setNewItem({ ...newItem, rarity: e.target.value })}
                    placeholder="e.g. Holo Rare"
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] focus:ring-1 focus:ring-[#961b2b]"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 text-sm font-semibold bg-[#961b2b] text-white hover:bg-[#961b2b]/95 rounded-lg transition-colors cursor-pointer shadow-sm"
                >
                  Add Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT COMPACT MODAL */}
      {editingIndex !== null && editItem && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => { setEditingIndex(null); setEditItem(null); }} />
          <div className="relative bg-[#f2f2f2] border border-gray-200 rounded-xl shadow-2xl p-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <div className="bg-[#961b2b]/10 text-[#961b2b] p-2 rounded-lg">
                  <Edit size={20} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Edit Catalog Profile</h3>
              </div>
              <button 
                onClick={() => { setEditingIndex(null); setEditItem(null); }} 
                className="p-1 text-gray-400 hover:text-gray-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest block font-medium">Item Name <span className="text-[#961b2b]">*</span></label>
                <input
                  type="text"
                  required
                  value={editItem.itemName}
                  onChange={(e) => setEditItem({ ...editItem, itemName: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] focus:ring-1 focus:ring-[#961b2b]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest block font-medium">Set Name <span className="text-[#961b2b]">*</span></label>
                <input
                  type="text"
                  required
                  value={editItem.setName}
                  onChange={(e) => setEditItem({ ...editItem, setName: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] focus:ring-1 focus:ring-[#961b2b]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest block font-medium">Card # / ID</label>
                  <input
                    type="text"
                    value={editItem.cardNumber || ''}
                    onChange={(e) => setEditItem({ ...editItem, cardNumber: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] focus:ring-1 focus:ring-[#961b2b] font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest block font-medium">Rarity Tag</label>
                  <input
                    type="text"
                    value={editItem.rarity || ''}
                    onChange={(e) => setEditItem({ ...editItem, rarity: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#961b2b] focus:ring-1 focus:ring-[#961b2b]"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => { setEditingIndex(null); setEditItem(null); }}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 text-sm font-semibold bg-[#961b2b] text-white hover:bg-[#961b2b]/95 rounded-lg transition-colors cursor-pointer shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
