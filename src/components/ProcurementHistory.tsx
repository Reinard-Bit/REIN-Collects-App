import React, { useState } from 'react';
import { ChevronLeft, Search, Clock } from 'lucide-react';
import { ProcurementRecord } from '../App';
import { formatIDR } from '../utils/currency';

interface ProcurementHistoryProps {
  records: ProcurementRecord[];
  onBack: () => void;
}

export function ProcurementHistory({ records, onBack }: ProcurementHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');

  const tabs = ['All', 'Raw Card', 'Graded Slab', 'Sealed Product'];

  const filteredRecords = records.filter(record => {
    // 1. Filter by Tab (Type)
    const matchesTab = activeTab === 'All' || record.type === activeTab;
    
    // 2. Filter by Search Query
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      record.itemName.toLowerCase().includes(query) ||
      record.description.toLowerCase().includes(query) ||
      record.supplier.toLowerCase().includes(query);

    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Area */}
      <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-900"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">Full History</h2>
            <p className="text-sm text-gray-500 mt-1">Complete log of all procurement intakes and additions.</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Search intakes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-800 placeholder-gray-600 focus:outline-none focus:border-[#961b2b]/50 focus:shadow-[0_0_5px_#961b2b] transition-all"
          />
        </div>
      </div>

      {/* Tabs / Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'bg-[#961b2b]/10 text-[#961b2b] border border-[#961b2b]/30'
                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-100 hover:text-gray-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Data Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="text-gray-500 border-b border-gray-200 bg-[#f2f2f2]/50">
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Item / Description</th>
                <th className="px-6 py-4 font-medium">Supplier</th>
                <th className="px-6 py-4 font-medium text-right">Total Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    No matching records found.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((proc) => (
                  <tr key={proc.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Clock size={14} className="text-gray-500" />
                        {proc.date}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md border text-xs font-medium whitespace-nowrap ${
                        proc.type === 'Raw Card' 
                          ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                          : proc.type === 'Graded Slab'
                            ? 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      }`}>
                        {proc.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{proc.itemName}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{proc.description}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {proc.supplier}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-gray-700">
                      <span className="text-gray-500/50 mr-1">Rp</span>
                      {formatIDR(proc.totalCost).replace('Rp', '').trim()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
