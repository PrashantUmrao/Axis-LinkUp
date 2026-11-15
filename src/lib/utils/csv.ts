/**
 * Robust CSV Parsing, Generation & Formula Injection Sanitization Utilities.
 * Adheres to RFC 4180 and protects against CSV/Formula Injection (CWE-1236).
 */

export const STUDENT_CSV_HEADERS = [
  'fullName',
  'username',
  'institutionalEmail',
  'department',
  'rollNumber',
  'batchYear',
  'currentSemester',
  'section',
] as const;

export const FACULTY_CSV_HEADERS = [
  'fullName',
  'username',
  'institutionalEmail',
  'department',
  'employeeId',
  'designation',
] as const;

/**
 * Neutralizes potential CSV Formula Injection (CWE-1236).
 * Any string value whose trimmed content begins with `=`, `+`, `-`, `@`, `\t`, or `\r`
 * is prefixed with a single quote `'` so spreadsheet processors (Excel, Calc, Sheets)
 * interpret it as literal text rather than executable bytecode or DDE formulas.
 */
export function sanitizeCsvFormula(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  // Neutralize leading tab or carriage return characters before trimming
  if (str.startsWith('\t') || str.startsWith('\r')) {
    return `'${str}`;
  }

  const trimmed = str.trimStart();

  if (
    trimmed.startsWith('=') ||
    trimmed.startsWith('+') ||
    trimmed.startsWith('-') ||
    trimmed.startsWith('@') ||
    trimmed.startsWith('\t') ||
    trimmed.startsWith('\r')
  ) {
    return `'${str}`;
  }

  return str;
}

/**
 * RFC 4180 compliant CSV text parser.
 * Handles quoted fields, embedded commas, multiline values, and escaped quotation marks ("").
 */
export function parseCsv(csvText: string): string[][] {
  if (!csvText || csvText.trim() === '') {
    return [];
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;
  let i = 0;
  const len = csvText.length;

  while (i < len) {
    const char = csvText[i];
    const nextChar = i + 1 < len ? csvText[i + 1] : '';

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote ("")
        currentField += '"';
        i += 2;
        continue;
      }
      // Toggle quote mode
      insideQuotes = !insideQuotes;
      i++;
      continue;
    }

    if (!insideQuotes) {
      if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
        i++;
        continue;
      }

      if (char === '\r') {
        if (nextChar === '\n') {
          i++; // Skip \r in \r\n
        }
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.some((f) => f.trim() !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      }

      if (char === '\n') {
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.some((f) => f.trim() !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      }
    }

    currentField += char;
    i++;
  }

  // Push final field and row if any
  currentRow.push(currentField);
  if (currentRow.some((f) => f.trim() !== '')) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Serializes headers and rows into a valid, formula-sanitized CSV string.
 */
export function generateCsv(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): string {
  const sanitizeAndEscape = (val: unknown): string => {
    const sanitized = sanitizeCsvFormula(val);
    if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n') || sanitized.includes('\r')) {
      return `"${sanitized.replace(/"/g, '""')}"`;
    }
    return sanitized;
  };

  const headerLine = headers.map(sanitizeAndEscape).join(',');
  const rowLines = rows.map((row) => row.map(sanitizeAndEscape).join(','));

  return [headerLine, ...rowLines].join('\r\n');
}

/**
 * Generates official Student CSV Template with sample instruction row.
 */
export function getStudentCsvTemplate(): string {
  const headers = [...STUDENT_CSV_HEADERS];
  const sampleRows = [
    [
      'Aarav Sharma',
      'aarav.sharma24',
      'aarav.sharma@axiscolleges.in',
      'CSE',
      '24BCSE101',
      2026,
      1,
      'A',
    ],
    [
      'Ananya Patel',
      'ananya.patel',
      'ananya.patel@axiscolleges.in',
      'ECE',
      '24BECE102',
      2026,
      1,
      'B',
    ],
  ];

  return generateCsv(headers, sampleRows);
}

/**
 * Generates official Faculty CSV Template with sample instruction row.
 */
export function getFacultyCsvTemplate(): string {
  const headers = [...FACULTY_CSV_HEADERS];
  const sampleRows = [
    [
      'Dr. Rajesh Verma',
      'rajesh.verma',
      'rajesh.verma@axiscolleges.in',
      'CSE',
      'FAC-CSE-001',
      'Associate Professor',
    ],
    [
      'Dr. Meenakshi Sundaram',
      'm.sundaram',
      'm.sundaram@axiscolleges.in',
      'ECE',
      'FAC-ECE-010',
      'Assistant Professor',
    ],
  ];

  return generateCsv(headers, sampleRows);
}

