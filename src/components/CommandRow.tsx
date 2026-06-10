import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { ScriptCommand } from '../types';

interface CommandRowProps {
  script: ScriptCommand;
  key?: string;
}

export default function CommandRow({ script }: CommandRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(script.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100/60 transition-colors duration-200">
      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-slate-800">
            npm run {script.name}
          </span>
          <span className="text-xs font-mono text-slate-400 bg-slate-200/50 px-1.5 py-0.5 rounded">
            {script.command}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">{script.description}</p>
      </div>
      <button
        id={`btn-copy-${script.name}`}
        onClick={handleCopy}
        className="flex items-center justify-center p-2 rounded-md bg-white hover:bg-white text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-300 shadow-xs transition-all duration-200 active:scale-95 cursor-pointer"
        title="Copy command"
      >
        {copied ? (
          <Check className="w-4 h-4 text-emerald-500" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}
