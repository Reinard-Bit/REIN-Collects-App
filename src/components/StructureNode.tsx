import { FileCode, Folder, FileJson, Info } from 'lucide-react';
import { FileNode } from '../types';

interface StructureNodeProps {
  node: FileNode;
  onSelect: (node: FileNode) => void;
  isSelected: boolean;
  key?: string;
}

export default function StructureNode({ node, onSelect, isSelected }: StructureNodeProps) {
  const getIcon = () => {
    if (node.type === 'folder') {
      return <Folder className="w-4 h-4 text-sky-500 fill-sky-50" />;
    }
    if (node.name.endsWith('.json')) {
      return <FileJson className="w-4 h-4 text-amber-500" />;
    }
    return <FileCode className="w-4 h-4 text-emerald-500" />;
  };

  return (
    <button
      id={`node-${node.name.replace('.', '-')}`}
      onClick={() => onSelect(node)}
      className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'bg-indigo-50 border border-indigo-100 text-indigo-900 shadow-xs'
          : 'bg-white hover:bg-slate-50 border border-transparent hover:border-slate-100 text-slate-700'
      }`}
    >
      <div className="flex-shrink-0">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-medium truncate">{node.name}</span>
          {node.important && (
            <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.2 rounded-full font-sans">
              Main
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 truncate mt-0.5">{node.path}</p>
      </div>
    </button>
  );
}
