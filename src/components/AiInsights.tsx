import React from 'react';
import { BrainCircuit, TrendingUp, ArrowRightLeft, Archive, AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { formatIDR } from '../utils/currency';

export function AiInsights() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-gray-200 p-6 rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-[#961b2b]/10 border border-[#961b2b]/20 flex items-center justify-center">
              <BrainCircuit className="text-[#961b2b]" size={24} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
              REIN Collects AI Engine
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium uppercase tracking-wider">
                Active
              </span>
            </h2>
            <p className="text-gray-500 mt-1 text-sm flex items-center gap-1.5">
              <Clock size={14} />
              Last data sync: Today, 00:15 AM
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 text-sm font-medium bg-[#f2f2f2] border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors">
            Configure AI
          </button>
          <button className="px-4 py-2 text-sm font-medium bg-[#961b2b] text-gray-900 rounded-lg hover:bg-[#961b2b]/90 shadow-[0_0_15px_rgba(150,27,43,0.3)] transition-all">
            Run Manual Sync
          </button>
        </div>
      </div>

      {/* Insight Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2 p-8 text-center border border-dashed border-gray-200 rounded-2xl">
          <BrainCircuit className="mx-auto text-gray-600 mb-4" size={32} />
          <h3 className="text-lg font-medium text-gray-700">No active insights</h3>
          <p className="text-sm text-gray-500 mt-2">Add inventory items and record transactions for the AI engine to generate market velocity and pricing recommendations.</p>
        </div>
      </div>
    </div>
  );
}
