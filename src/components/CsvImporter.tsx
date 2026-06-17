import React, { useState } from 'react';
import Papa from 'papaparse';
import { db } from '../firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { DB_PATHS, sanitizeNumber } from '../utils/dbConfig';
import { UploadCloud, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';

export function CsvImporter() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importSummary, setImportSummary] = useState<string | null>(null);

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

            // Basic data cleanup
            // Removing 'Rp' or commas from cost values
            const cleanNumber = (val: any) => {
              if (!val) return 0;
              const numericString = val.toString().replace(/Rp|rp|,| /g, '').trim();
              const fromSanitize = sanitizeNumber(numericString);
              return typeof fromSanitize === 'number' && !isNaN(fromSanitize) 
                ? fromSanitize 
                : (Number(numericString) || 0);
            };

            const itemName = row.item_name.trim();
            const set = row.set_number ? row.set_number.trim() : 'Unknown';
            const condition = row.condition ? row.condition.trim() : 'Raw Card';
            const supplier = row.supplier ? row.supplier.trim() : 'Unknown';
            const cost = cleanNumber(row.cost_basis);
            const date = row.date_procured && row.date_procured.trim() !== '' 
              ? row.date_procured.trim() 
              : new Date().toISOString().split('T')[0];

            const cleanItem = {
              id: `INV-IMPORT-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
              name: itemName,
              set: set,
              condition: condition,
              supplier: supplier,
              costBasis: cost,
              currentPrice: cost, // Defaulting current price to cost
              quantity: 1, // Defaulting to 1 as it's not in the template
              acquisitionDate: date,
              dateAdded: date,
              category: 'Single', // Default category
              status: "In Stock"
            };

            acc.push(cleanItem);
            return acc;
          }, []);

          // Uploading in chunks of 500 (Firestore transaction limit)
          const MAX_BATCH_SIZE = 500;
          let updatedCount = 0;

          for (let i = 0; i < mappedItems.length; i += MAX_BATCH_SIZE) {
            const chunk = mappedItems.slice(i, i + MAX_BATCH_SIZE);
            const batch = writeBatch(db);

            chunk.forEach((item) => {
              const docRef = doc(collection(db, DB_PATHS.INVENTORY), item.id);
              batch.set(docRef, item);
            });

            await batch.commit();
            updatedCount += chunk.length;
            setUploadProgress(10 + Math.floor((updatedCount / mappedItems.length) * 90));
          }

          setImportSummary(`Imported ${updatedCount} items successfully.`);
          setFile(null);
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

  return (
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
  );
}
