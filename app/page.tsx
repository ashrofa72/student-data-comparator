'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export default function Home() {
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [processedData, setProcessedData] = useState<any[] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const downloadLinkRef = useRef<HTMLAnchorElement>(null);

  const handleMainFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMainFile(file);
      setError('');
    }
  };

  const handleReferenceFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReferenceFile(file);
      setError('');
    }
  };

  const processFiles = async () => {
    if (!mainFile || !referenceFile) {
      setError('Please upload both files');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Process reference Excel file
      const referenceData = await readExcelFile(referenceFile);
      
      // Process main CSV file
      const mainData = await readCSVFile(mainFile);
      
      // Match data and add classrooms
      const matchedData = matchData(mainData, referenceData);
      
      setProcessedData(matchedData);
    } catch (err) {
      setError('Error processing files: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsProcessing(false);
    }
  };

  const readExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  };

  const readCSVFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        complete: (results) => resolve(results.data as any[]),
        error: (error) => reject(error),
      });
    });
  };

  const matchData = (mainData: any[], referenceData: any[]) => {
    return mainData.map((student) => {
      // Find matching student in reference data
      const matchedStudent = referenceData.find((refStudent) => {
        // Case-insensitive comparison with trimmed strings
        const correctedName = refStudent['Corrected Name'] || 
                             refStudent['corrected name'] || 
                             refStudent['Corrected name'] ||
                             refStudent['Name'];
        const fullName = student['Full Name'] || 
                        student['full name'] || 
                        student['Full name'] ||
                        student['Name'];
        
        return correctedName?.toString().trim().toLowerCase() === fullName?.toString().trim().toLowerCase();
      });
      
      return {
        ...student,
        Classroom: matchedStudent ? 
          (matchedStudent['Classroom'] || 
           matchedStudent['classroom'] || 
           matchedStudent['Class'] ||
           'Found but no classroom') : 
          'Not Found',
      };
    });
  };

  const downloadAsCSV = () => {
    if (!processedData || !downloadLinkRef.current) return;
    
    // Format data with proper encoding for Arabic and classroom values
    const formattedData = processedData.map(student => {
      const formattedStudent: Record<string, any> = {};
      
      // Process all fields to ensure proper handling
      Object.entries(student).forEach(([key, value]) => {
        // Handle classroom specially
        if (key === 'Classroom' && 
            value !== 'Not Found' && 
            value !== 'Found but no classroom') {
          formattedStudent[key] = `="${value}"`;
        } 
        // Ensure Arabic/Unicode text is preserved
        else {
          formattedStudent[key] = value;
        }
      });
      
      return formattedStudent;
    });

    // Create CSV with proper encoding
    const csvContent = Papa.unparse(formattedData, {
      quotes: true,       // Force quotes around all strings
      escapeChar: '"',    // Proper escaping for quotes
      delimiter: ','
    });

    // Add UTF-8 BOM (Byte Order Mark) for Excel compatibility
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;
    
    // Create blob with explicit UTF-8 encoding
    const blob = new Blob([csvWithBOM], { 
      type: 'text/csv;charset=utf-8;' 
    });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    downloadLinkRef.current.href = url;
    downloadLinkRef.current.download = 'students_with_classrooms.csv';
    downloadLinkRef.current.click();
    
    // Clean up
    URL.revokeObjectURL(url);
  };

  const downloadAsExcel = () => {
    if (!processedData || !downloadLinkRef.current) return;

    // Create workbook with Arabic text support
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(processedData);
    
    // Set all columns to text format to preserve Arabic
    if (!ws['!cols']) ws['!cols'] = [];
    Object.keys(processedData[0]).forEach((_, i) => {
      ws['!cols'] = ws['!cols'] || [];
      ws['!cols'][i] = { wch: 20 }; // Set column width to 20 as an example
    });
    
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    
    // Generate Excel file with proper encoding
    const excelBuffer = XLSX.write(wb, { 
      bookType: 'xlsx', 
      type: 'array',
      bookSST: true // Keep shared string table for better Unicode support
    });
    
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    const url = URL.createObjectURL(blob);
    downloadLinkRef.current.href = url;
    downloadLinkRef.current.download = 'students_with_classrooms.xlsx';
    downloadLinkRef.current.click();
    
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Student Data Processor</h1>
          <p className="mt-2 text-sm text-gray-600">
            Upload your student data CSV and reference Excel file to add classroom information
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Main CSV File (with Full Name column)
            </label>
            <div className="mt-1 flex items-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleMainFileUpload}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
            </div>
            {mainFile && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {mainFile.name}
              </p>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Reference Excel File (with Corrected Name and Classroom columns)
            </label>
            <div className="mt-1 flex items-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleReferenceFileUpload}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
            </div>
            {referenceFile && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {referenceFile.name}
              </p>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-center">
            <button
              onClick={processFiles}
              disabled={isProcessing || !mainFile || !referenceFile}
              className={`px-4 py-2 rounded-md text-white font-medium ${
                isProcessing || !mainFile || !referenceFile 
                  ? 'bg-blue-300 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isProcessing ? 'Processing...' : 'Process Files'}
            </button>
          </div>
        </div>

        {processedData && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="mb-4">
              <h2 className="text-lg font-medium text-gray-900">Processing Complete</h2>
              <p className="text-sm text-gray-600">
                Found {processedData.length} students. {
                  processedData.filter(s => s.Classroom !== 'Not Found' && s.Classroom !== 'Found but no classroom').length
                } matched with classrooms.
              </p>
            </div>

            <div className="overflow-x-auto mb-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(processedData[0]).map((key) => (
                      <th
                        key={key}
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {processedData.slice(0, 5).map((student, index) => (
                    <tr key={index}>
                      {Object.values(student).map((value, i) => (
                        <td
                          key={i}
                          className={`px-6 py-4 whitespace-nowrap text-sm ${
                            value === 'Not Found' 
                              ? 'text-red-500' 
                              : value === 'Found but no classroom'
                                ? 'text-yellow-500'
                                : 'text-gray-500'
                          }`}
                        >
                          {String(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {processedData.length > 5 && (
                    <tr>
                      <td colSpan={Object.keys(processedData[0]).length} className="px-6 py-4 text-center text-sm text-gray-500">
                        ... and {processedData.length - 5} more records
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={downloadAsCSV}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
              >
                Download as CSV (UTF-8)
              </button>
              <button
                onClick={downloadAsExcel}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium"
              >
                Download as Excel
              </button>
              <a
                ref={downloadLinkRef}
                className="hidden"
                download
              >
                Download
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}