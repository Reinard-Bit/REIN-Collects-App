import React, { useState } from 'react';
import { X, QrCode as QrCodeIcon, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface BatchQRGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BatchQRGeneratorModal({ isOpen, onClose }: BatchQRGeneratorModalProps) {
  const [prefix, setPrefix] = useState('SN-');
  const [startNumber, setStartNumber] = useState('100');
  const [quantity, setQuantity] = useState('30');
  const [showPreview, setShowPreview] = useState(false);
  const [qrCodes, setQrCodes] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleGenerateAndPrint = () => {
    const qty = parseInt(quantity) || 0;
    const startNum = parseInt(startNumber) || 0;
    const codes = [];
    
    for (let i = 0; i < qty; i++) {
        // Pad the number to 3 digits minimum if starting number is low, otherwise just toString it.
        // Wait, standard sequential SN-001 involves padding. Let's do some padding if length is short.
        const numStr = (startNum + i).toString();
        const paddedNumStr = numStr.length < 3 ? numStr.padStart(3, '0') : numStr;
        codes.push(`${prefix}${paddedNumStr}`);
    }
    
    setQrCodes(codes);
    
    // We defer the print to allow React to render the print grid first
    setTimeout(() => {
        window.print();
        // optionally onClose() after print
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#f2f2f2] border border-gray-200 rounded-xl shadow-2xl p-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-200 hide-on-print">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-[#961b2b]/10 text-[#961b2b] p-2 rounded-lg">
                <QrCodeIcon size={20} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Batch QR Generator</h3>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-800 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-4 mb-6">
            <p className="text-sm text-gray-600">
                Generate bulk sequential QR labels perfectly formatted for 3x10 A4 sticker sheets.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Prefix</label>
                    <input 
                        type="text" 
                        value={prefix} 
                        onChange={(e) => setPrefix(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-[#961b2b] focus:ring-1 focus:ring-[#961b2b]"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Start Number</label>
                    <input 
                        type="number" 
                        value={startNumber} 
                        onChange={(e) => setStartNumber(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-[#961b2b] focus:ring-1 focus:ring-[#961b2b] font-mono"
                    />
                </div>
            </div>
            
            <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity to Generate</label>
                <input 
                    type="number" 
                    value={quantity} 
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-[#961b2b] focus:ring-1 focus:ring-[#961b2b] font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">Standard A4 Sheet = 30 Labels</p>
            </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleGenerateAndPrint} 
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-[#961b2b] text-white rounded-lg hover:bg-[#961b2b]/90 transition-colors shadow-sm"
          >
            <Printer size={16} />
            Generate & Print
          </button>
        </div>
      </div>

      {/* Hidden Print Grid */}
      {qrCodes.length > 0 && (
          <div className="a4-print-container">
              {qrCodes.map((code) => (
                  <div key={code}>
                      <QRCodeSVG value={code} size={150} />
                      <div style={{ marginTop: '8px', fontSize: '14px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {code}
                      </div>
                  </div>
              ))}
          </div>
      )}
    </div>
  );
}
