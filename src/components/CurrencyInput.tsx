import React from 'react';
import { parseIDR } from '../utils/currency';

interface Props {
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  className?: string;
  tabIndex?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function CurrencyInput({ value, onChange, placeholder = "0", className = "", tabIndex, onKeyDown }: Props) {
  const displayValue = value === 0 ? '' : new Intl.NumberFormat('id-ID').format(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = parseIDR(e.target.value);
    onChange(rawValue);
  };

  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500/50 font-medium pointer-events-none">Rp</span>
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        tabIndex={tabIndex}
        placeholder={placeholder}
        className={`w-full bg-[#f2f2f2] border border-gray-200 rounded-lg pl-12 pr-4 py-2.5 text-sm text-gray-800 placeholder-gray-600 focus:outline-none focus:shadow-[0_0_5px_#961b2b] focus:border-[#961b2b]/50 transition-all font-mono ${className}`}
      />
    </div>
  );
}
