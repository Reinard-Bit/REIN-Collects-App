import React, { useState } from 'react';
import { X, QrCode as QrCodeIcon, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

interface BatchQRGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BatchQRGeneratorModal({ isOpen, onClose }: BatchQRGeneratorModalProps) {
  const [prefix, setPrefix] = useState('SN-');
  const [startNumber, setStartNumber] = useState('100');
  const [quantity, setQuantity] = useState('24');
  const [price, setPrice] = useState('$19.99');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleGenerateAndPrint = async () => {
    try {
      setIsGenerating(true);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a6' });
      
      const qty = Number(quantity) || 0;
      const startNum = Number(startNumber) || 0;
      
      const labelsPerRow = 4;
      const labelsPerColumn = 6;
      const labelsPerPage = labelsPerRow * labelsPerColumn;
      
      const pageWidth = 105;
      const pageHeight = 148;
      const marginX = 5;
      const marginY = 5;
      
      const colWidth = (pageWidth - 2 * marginX) / labelsPerRow;
      const rowHeight = (pageHeight - 2 * marginY) / labelsPerColumn;
      const qrSize = 18;

      for (let i = 0; i < qty; i++) {
        const skuString = `${prefix}${startNum + i}`;
        
        if (i > 0 && i % labelsPerPage === 0) {
          pdf.addPage();
        }
        
        const positionOnPage = i % labelsPerPage;
        const rowIndex = Math.floor(positionOnPage / labelsPerRow);
        const colIndex = positionOnPage % labelsPerRow;
        
        const x = marginX + colIndex * colWidth;
        const y = marginY + rowIndex * rowHeight;
        
        // Add Price
        pdf.setFontSize(8);
        pdf.text(price, x + colWidth / 2, y + 4, { align: 'center' });
        
        // Generate QR code as Data URI
        const qrDataUri = await QRCode.toDataURL(skuString, {
          errorCorrectionLevel: 'M',
          margin: 0,
          width: 200,
        });
        
        // Add QR code image
        pdf.addImage(qrDataUri, 'PNG', x + (colWidth - qrSize) / 2, y + 5, qrSize, qrSize);
        
        // Add SKU text
        pdf.setFontSize(6);
        pdf.text(`SKU: ${skuString}`, x + colWidth / 2, y + 6 + qrSize + 2, { align: 'center' });
      }
      
      pdf.save('REIN-Collects-QR-Labels.pdf');
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsGenerating(false);
    }
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
            <h3 className="text-xl font-bold text-gray-900">Print QR</h3>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-800 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-4 mb-6">
            <p className="text-sm text-gray-600">
                Generate bulk sequential QR labels formatted for high-density A6 sticker sheets (100x150mm).
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Price Label</label>
                    <input 
                        type="text" 
                        value={price} 
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-[#961b2b] focus:ring-1 focus:ring-[#961b2b] font-mono"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</label>
                    <input 
                        type="number" 
                        value={quantity} 
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-[#961b2b] focus:ring-1 focus:ring-[#961b2b] font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-2 uppercase tracking-wide">
                      24 Labels / A6 Sheet &bull; Requires <span className="font-bold text-red-700">{Math.ceil((Number(quantity) || 0) / 24)}</span> Sheet{Math.ceil((Number(quantity) || 0) / 24) === 1 ? '' : 's'}
                    </p>
                </div>
            </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} disabled={isGenerating} className="flex-1 px-4 py-2.5 text-sm font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button 
            onClick={handleGenerateAndPrint} 
            disabled={isGenerating}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-[#961b2b] text-white rounded-lg hover:bg-[#961b2b]/90 transition-colors shadow-sm disabled:opacity-75 disabled:cursor-not-allowed"
          >
            <Printer size={16} className={isGenerating ? "animate-pulse" : ""} />
            {isGenerating ? "Generating PDF..." : "Generate & Print"}
          </button>
        </div>
      </div>
    </div>
  );
}
