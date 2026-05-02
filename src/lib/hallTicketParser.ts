import type { ExamType } from './database.types';

export interface HallTicketData {
  studentName: string;
  scalerId: string;
  centreName: string;
  examDate: string;
  examTiming: string;
  examType: ExamType;
}

export function parseHallTicketText(text: string): Partial<HallTicketData> {
  const result: Partial<HallTicketData> = {};

  // Student name
  const nameMatch = text.match(
    /(?:Student\s+)?Name\s*[:\-]\s*([A-Za-z\s]+?)(?:\n|Roll|ID|Reg|Scaler)/i
  );
  if (nameMatch) result.studentName = nameMatch[1].trim();

  // Scaler ID / Roll No
  const idMatch = text.match(
    /(?:Roll\s+No|Scaler\s+ID|Student\s+ID|Registration\s+No|Reg\s+No)\s*[:\-]\s*([A-Z0-9\-]+)/i
  );
  if (idMatch) result.scalerId = idMatch[1].trim();

  // Centre name
  const centreMatch = text.match(
    /(?:Exam\s+)?Centre(?:\s+Name)?\s*[:\-]\s*(.+?)(?:\n|Address|City|State|\d{6})/i
  );
  if (centreMatch) result.centreName = centreMatch[1].trim().replace(/,\s*$/, '');

  // Date: DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD
  const dateMatch = text.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    const raw = dateMatch[1];
    // Normalise to ISO if DD/MM/YYYY
    if (raw.match(/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/)) {
      const sep = raw.includes('/') ? '/' : '-';
      const [dd, mm, yyyy] = raw.split(sep);
      result.examDate = `${yyyy}-${mm}-${dd}`;
    } else {
      result.examDate = raw;
    }
  }

  // Time slot
  const timingMatch = text.match(
    /(?:Time|Timing|Slot|Session)\s*[:\-]\s*(.{3,30}?(?:AM|PM|am|pm))/i
  );
  if (timingMatch) result.examTiming = timingMatch[1].trim();

  // Exam type
  if (/quiz\s*1|test\s*1|QZ1/i.test(text)) result.examType = 'quiz1';
  else if (/quiz\s*2|test\s*2|QZ2/i.test(text)) result.examType = 'quiz2';
  else if (/end\s*term|final|ET\b/i.test(text)) result.examType = 'endterm';

  return result;
}

export async function extractHallTicketData(file: File): Promise<Partial<HallTicketData>> {
  const { default: pdfjsLib } = await import('pdfjs-dist');
  // Use CDN worker for Vite compatibility
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fullText += content.items.map((item: any) => item.str).join(' ') + '\n';
  }

  return parseHallTicketText(fullText);
}

export function normaliseCentreName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
