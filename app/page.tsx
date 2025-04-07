'use client';

import { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

interface Student {
  [key: string]: string | undefined;
  'Course'?: string;
  'Full Name'?: string;
  'Exam Marks'?: string;
  'Total'?: string;
  'Classroom'?: string;
}

interface ReferenceStudent {
  [key: string]: string | undefined;
  'Corrected Name'?: string;
  'Classroom'?: string;
}

export default function Home() {
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [processedData, setProcessedData] = useState<Student[] | null>(null);
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
      const referenceData = await readExcelFile(referenceFile);
      const mainData = await readCSVFile(mainFile);
      const matchedData = matchData(mainData, referenceData);
      setProcessedData(matchedData);
    } catch (err) {
      setError(`Error processing files: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const readExcelFile = async (file: File): Promise<ReferenceStudent[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(worksheet) as ReferenceStudent[]);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const readCSVFile = async (file: File): Promise<Student[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          const data = results.data as Record<string, any>[];
          // Map only the required columns from the CSV
          const filteredData = data.map(row => ({
            'Course': row['Course'] || row['course'] || '',
            'Full Name': row['Full Name'] || row['full name'] || row['Full name'] || '',
            'Exam Marks': row['Exam Marks'] || row['exam marks'] || row['Exam marks'] || '',
            'Total': row['Total'] || row['total'] || ''
          }));
          resolve(filteredData);
        },
        error: reject,
      });
    });
  };

  const matchData = (mainData: Student[], referenceData: ReferenceStudent[]): Student[] => {
    return mainData.map((student) => {
      const matchedStudent = referenceData.find((refStudent) => {
        const correctedName = refStudent['Corrected Name']?.toLowerCase().trim();
        const fullName = student['Full Name']?.toLowerCase().trim();
        return correctedName === fullName;
      });
      
      return {
        'Course': student['Course'] || '',
        'Full Name': student['Full Name'] || '',
        'Exam Marks': student['Exam Marks'] || '',
        'Total': student['Total'] || '',
        'Classroom': matchedStudent ? 
          (matchedStudent['classroom'] || 'Found but no classroom') : 
          'Not Found'
      };
    });
  };

  const sortedData = useMemo(() => {
    if (!processedData) return null;
    
    return [...processedData].sort((a, b) => {
      const classroomA = a.Classroom?.toLowerCase() || '';
      const classroomB = b.Classroom?.toLowerCase() || '';
      
      if (classroomA === 'not found') return 1;
      if (classroomB === 'not found') return -1;
      if (classroomA === 'found but no classroom') return 1;
      if (classroomB === 'found but no classroom') return -1;
      
      return classroomA.localeCompare(classroomB);
    });
  }, [processedData]);

  const downloadAsCSV = () => {
    if (!sortedData || !downloadLinkRef.current) return;
    
    const formattedData = sortedData.map(student => ({
      'Course': student['Course'] || '',
      'Full Name': student['Full Name'] || '',
      'Exam Marks': student['Exam Marks'] || '',
      'Total': student['Total'] || '',
      'Classroom': student['Classroom'] === 'Not Found' || 
                  student['Classroom'] === 'Found but no classroom'
        ? student['Classroom']
        : `="${student['Classroom']}"`
    }));

    const csv = Papa.unparse(formattedData, {
      quotes: true,
      escapeChar: '"',
      delimiter: ','
    });

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    downloadLinkRef.current.href = url;
    downloadLinkRef.current.download = 'students_sorted_by_classroom.csv';
    downloadLinkRef.current.click();
    
    URL.revokeObjectURL(url);
  };

  const downloadAsExcel = () => {
    if (!sortedData || !downloadLinkRef.current) return;

    const excelData = sortedData.map(student => ({
      'Course': student['Course'],
      'Full Name': student['Full Name'],
      'Exam Marks': student['Exam Marks'],
      'Total': student['Total'],
      'Classroom': student['Classroom']
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    ws['!cols'] = [
      { wch: 15 }, // Course
      { wch: 25 }, // Full Name
      { wch: 12 }, // Exam Marks
      { wch: 10 }, // Total
      { wch: 15 }  // Classroom
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    
    const excelBuffer = XLSX.write(wb, { 
      bookType: 'xlsx', 
      type: 'array',
      bookSST: true
    });
    
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    const url = URL.createObjectURL(blob);
    downloadLinkRef.current.href = url;
    downloadLinkRef.current.download = 'students_sorted_by_classroom.xlsx';
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
              Upload Main CSV File (must include: Course, Full Name, Exam Marks, Total)
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
              Upload Reference Excel File (must include: Corrected Name, Classroom)
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

        {sortedData && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="mb-4">
              <h2 className="text-lg font-medium text-gray-900">Processing Complete</h2>
              <p className="text-sm text-gray-600">
                Found {sortedData.length} students. {
                  sortedData.filter(s => s.Classroom !== 'Not Found' && s.Classroom !== 'Found but no classroom').length
                } matched with classrooms.
              </p>
            </div>

            <div className="overflow-x-auto mb-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exam Marks</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Classroom</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedData.slice(0, 5).map((student, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student['Course']}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student['Full Name']}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student['Exam Marks']}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student['Total']}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                        student['Classroom'] === 'Not Found' 
                          ? 'text-red-500' 
                          : student['Classroom'] === 'Found but no classroom'
                            ? 'text-yellow-500'
                            : 'text-gray-500'
                      }`}>
                        {student['Classroom']}
                      </td>
                    </tr>
                  ))}
                  {sortedData.length > 5 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                        ... and {sortedData.length - 5} more records
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