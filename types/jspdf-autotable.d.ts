declare module 'jspdf-autotable' {
    import { jsPDF } from 'jspdf';
    
    interface AutoTableOptions {
      head?: any[][];
      body?: any[][];
      foot?: any[][];
      html?: string;
      startY?: number;
      margin?: any;
      tableWidth?: 'auto' | 'wrap' | number;
      showHead?: 'everyPage' | 'firstPage' | 'never';
      showFoot?: 'everyPage' | 'lastPage' | 'never';
      tableLineWidth?: number;
      tableLineColor?: number | number[];
      styles?: any;
      headStyles?: any;
      bodyStyles?: any;
      footStyles?: any;
      alternateRowStyles?: any;
      columnStyles?: any;
      createdCell?: (cell: any, data: any) => void;
      drawCell?: (cell: any, data: any) => void;
      willDrawCell?: (data: any) => void;
      didDrawCell?: (data: any) => void;
      didParseCell?: (data: any) => void;
      didDrawPage?: (data: any) => void;
    }
  
    const autoTable: (doc: jsPDF, options: AutoTableOptions) => jsPDF;
    export default autoTable;
  }