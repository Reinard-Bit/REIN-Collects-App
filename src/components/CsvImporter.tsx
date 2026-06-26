import React, { useState } from 'react';
import Papa from 'papaparse';
import { db } from '../firebase';
import { collection, doc, writeBatch, increment } from 'firebase/firestore';
import { DB_PATHS, sanitizeNumber } from '../utils/dbConfig';
import { UploadCloud, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';

export const translateCondition = (cond: any) => {
  if (!cond) return 'N/A';
  const lower = String(cond).trim().toLowerCase();
  if (lower.includes('near mint') || lower === 'nm') return 'Near Mint (NM)';
  if (lower.includes('lightly played') || lower === 'lp') return 'Lightly Played (LP)';
  if (lower.includes('moderately played') || lower === 'mp') return 'Moderately Played (MP)';
  if (lower.includes('heavily played') || lower === 'hp') return 'Heavily Played (HP)';
  if (lower.includes('damaged') || lower === 'dmg') return 'Damaged (DMG)';
  return String(cond).trim(); // Fallback
};

export const translateCategory = (cat: any) => {
  if (!cat) return 'Single';
  const lower = String(cat).trim().toLowerCase();
  if (lower.includes('slab') || lower.includes('graded')) return 'Slab';
  if (lower.includes('sealed') || lower.includes('box')) return 'Sealed';
  if (lower.includes('accessory')) return 'Accessory';
  return 'Single'; // Maps "Raw Card" to "Single" to match the table filter UI
};

export const translateFoil = (foil: any) => {
  if (!foil) return 'Non-Foil';
  const lower = String(foil).trim().toLowerCase();
  if (lower.includes('reverse')) return 'Reverse Holo';
  if (lower === 'holo' || lower.includes('hologram')) return 'Holo';
  return 'Non-Foil';
};

interface CsvImporterProps {
  cashReserve?: number;
}

export function CsvImporter({ cashReserve = 0 }: CsvImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  
  const [pendingInventory, setPendingInventory] = useState<any[]>([]);
  const [totalImportCost, setTotalImportCost] = useState(0);
  const [showFundingModal, setShowFundingModal] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setImportSummary(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
        setImportSummary(null);
      } else {
        alert("Please upload a valid .csv file.");
      }
    }
  };

  const processImport = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(10);
    setImportSummary(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const data = results.data as any[];
          
          if (data.length === 0) {
            alert("The CSV file is empty or could not be parsed.");
            setIsUploading(false);
            return;
          }

          // Map the parsed rows to the Firestore inventory schema
          const mappedItems = data.reduce((acc: any[], row: any) => {
            // Skip completely empty rows or rows without an item name
            if (!row.item_name || row.item_name.trim() === '') return acc;

            const cleanItem = {
              id: `INV-IMPORT-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
              name: row.item_name ? row.item_name.trim() : 'Unknown Item',
              set: row.set_name ? row.set_name.trim() : 'Unknown', 
              category: translateCategory(row.category),
              cardNumber: row.card_number ? row.card_number.trim() : '', 
              rarity: row.rarity ? row.rarity.trim() : '',
              language: row.language ? row.language.trim() : 'English',
              condition: translateCondition(row.condition),
              foilType: translateFoil(row.foil_type),
              supplier: row.supplier ? row.supplier.trim() : 'Unknown',
              costBasis: Number(row.cost_basis) || 0,
              currentPrice: Number(row.cost_basis) || 0, // Default market price to match cost initially
              quantity: 1, 
              acquisitionDate: row.date_procured ? row.date_procured.trim() : new Date().toISOString().split('T')[0],
              dateAdded: new Date().toISOString(),
              status: "In Stock"
            };

            acc.push(cleanItem);
            return acc;
          }, []);

          const total = mappedItems.reduce((sum, item) => sum + item.costBasis, 0);
          setPendingInventory(mappedItems);
          setTotalImportCost(total);
          setShowFundingModal(true);
          setIsUploading(false);
        } catch (error) {
          console.error("Error batch writing CSV to Firestore:", error);
          alert("An error occurred during import. Check the console for details.");
        } finally {
          setIsUploading(false);
          setUploadProgress(100);
        }
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
        alert("Failed to parse the CSV file. Please ensure it is correctly formatted.");
        setIsUploading(false);
      }
    });
  };

  const confirmAndUpload = async (fundingMethod: 'waterfall' | 'out-of-pocket') => {
    try {
      setIsUploading(true);
      setShowFundingModal(false);
      const batch = writeBatch(db);

      // 1. Inventory Write
      pendingInventory.forEach((item) => {
        const docRef = doc(collection(db, DB_PATHS.INVENTORY), item.id);
        batch.set(docRef, item);
      });

      // 2. Ledger Write Logic
      const newLedgerId = `LEDGER-IMPORT-${Date.now()}`;
      if (fundingMethod === 'waterfall') {
        const cashToUse = Math.min(cashReserve, totalImportCost);
        const capitalNeeded = totalImportCost - cashToUse;

        if (cashToUse > 0) {
          const ledgerRef = doc(collection(db, DB_PATHS.CASH_LEDGER), newLedgerId + '-CASH');
          batch.set(ledgerRef, {
            id: newLedgerId + '-CASH',
            date: new Date().toISOString(),
            flow: 'Cash Out',
            category: 'Inventory Purchase',
            description: `Bulk Import (${pendingInventory.length} items)`,
            amount: cashToUse,
            createdAt: new Date().toISOString()
          });
        }

        if (capitalNeeded > 0) {
          const capRef = doc(collection(db, DB_PATHS.CAPITAL_INJECTIONS), newLedgerId + '-CAP');
          batch.set(capRef, {
            id: newLedgerId + '-CAP',
            date: new Date().toISOString(),
            description: `Auto-Split Capital Injection for Bulk Import`,
            amount: capitalNeeded,
            injectedAmount: capitalNeeded,
            createdAt: new Date().toISOString()
          });
        }
        
        // Update Settings (cashReserve and outOfPocketCapital)
        const settingsRef = doc(db, DB_PATHS.SETTINGS);
        batch.set(settingsRef, {
          cashReserve: increment(-cashToUse),
          outOfPocketCapital: increment(capitalNeeded)
        }, { merge: true });

      } else {
        const capRef = doc(collection(db, DB_PATHS.CAPITAL_INJECTIONS), newLedgerId + '-CAP');
        batch.set(capRef, {
          id: newLedgerId + '-CAP',
          date: new Date().toISOString(),
          description: `100% Out-of-Pocket Bulk Import`,
          amount: totalImportCost,
          injectedAmount: totalImportCost,
          createdAt: new Date().toISOString()
        });
        
        // Update Settings
        const settingsRef = doc(db, DB_PATHS.SETTINGS);
        batch.set(settingsRef, {
          outOfPocketCapital: increment(totalImportCost)
        }, { merge: true });
      }

      await batch.commit();

      setImportSummary(`Imported ${pendingInventory.length} items successfully.`);
      setFile(null);
      setPendingInventory([]);
      setTotalImportCost(0);
    } catch (error) {
      console.error("Error during import confirmation:", error);
      alert("An error occurred during import. Check the console for details.");
    } finally {
      setIsUploading(false);
      setUploadProgress(100);
    }
  };

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col items-center p-8">
        <div className="w-full max-w-md">
          <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Master Spreadsheet Importer</h2>
          <p className="text-sm text-gray-500 text-center mb-6">Bulk upload overseas purchases to eliminate double data entry. Formats accepted: .csv</p>

          {!file && !importSummary && (
            <div 
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl bg-gray-50/50 p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-blue-500 transition-colors"
            >
              <input 
                type="file" 
                accept=".csv" 
                id="csv-upload" 
                className="hidden" 
                onChange={handleFileChange}
              />
              <label htmlFor="csv-upload" className="flex flex-col items-center cursor-pointer">
                <UploadCloud className="text-gray-400 mb-3" size={40} />
                <span className="text-sm font-semibold text-gray-700">Click to upload or drag and drop</span>
                <span className="text-xs text-gray-500 mt-1">.csv file (Headers recommended)</span>
              </label>
            </div>
          )}

          {file && !isUploading && !importSummary && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between mb-6">
              <div className="flex items-center gap-3 overflow-hidden">
                <FileSpreadsheet className="text-blue-500 flex-shrink-0" size={24} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-blue-600">Ready to import</p>
                </div>
              </div>
              <button 
                onClick={() => setFile(null)} 
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-white transition-colors"
              >
                &times;
              </button>
            </div>
          )}

          {isUploading && (
            <div className="mb-6 w-full">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-gray-700">Uploading to database...</span>
                <span className="text-xs font-semibold text-blue-600">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {importSummary && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex flex-col items-center text-center mb-6">
              <CheckCircle className="text-emerald-500 mb-2" size={32} />
              <h3 className="text-sm font-bold text-emerald-800">Import Complete</h3>
              <p className="text-xs text-emerald-600 mt-1">{importSummary}</p>
              <button 
                onClick={() => setImportSummary(null)} 
                className="mt-4 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-200 transition-colors"
              >
                Import Another File
              </button>
            </div>
          )}

          {file && !isUploading && !importSummary && (
             <button 
               onClick={processImport}
               className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm transition-all flex justify-center items-center gap-2"
             >
               <UploadCloud size={18} />
               Run Master Import
             </button>
          )}
        </div>
      </div>

      {showFundingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Funding Summary</h3>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-gray-700 flex justify-between mb-2">
                <span className="font-medium">Import Summary:</span>
                <span className="font-bold">{pendingInventory.length} Items</span>
              </p>
              <p className="text-gray-700 flex justify-between">
                <span className="font-medium">Total Cost:</span>
                <span className="font-bold text-blue-600">Rp {totalImportCost.toLocaleString('id-ID')}</span>
              </p>
            </div>
            
            <p className="text-sm text-gray-600 mb-4 font-medium">How is this purchase funded?</p>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={() => confirmAndUpload('waterfall')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-sm flex flex-col items-center"
              >
                <span>Auto-Split (Use Cash Reserves First)</span>
                <span className="text-blue-200 text-xs font-normal mt-1">Available: Rp {cashReserve.toLocaleString('id-ID')}</span>
              </button>
              
              <button
                onClick={() => confirmAndUpload('out-of-pocket')}
                className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold py-3 px-4 rounded-lg transition-colors text-sm"
              >
                100% Out-of-Pocket (New Capital Injection)
              </button>
            </div>
            
            <button
              onClick={() => {
                setShowFundingModal(false);
                setPendingInventory([]);
                setTotalImportCost(0);
                setFile(null);
                setIsUploading(false);
              }}
              className="mt-6 w-full text-gray-500 hover:text-gray-700 font-medium text-sm text-center"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
