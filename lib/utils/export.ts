import Papa from 'papaparse'
import { FILE_LIMITS } from '@/lib/constants'

// ============================================================
// TYPES
// ============================================================

export interface CSVExportOptions {
  /** Filename without extension — .csv will be appended */
  filename: string
  /** Column headers in the order they should appear */
  headers: string[]
  /** Field keys matching headers, in same order */
  fields: string[]
  /** The data rows to export */
  data: Record<string, unknown>[]
}

export interface CSVParseResult<T> {
  data: T[]
  errors: CSVParseError[]
  totalRows: number
  validRows: number
}

export interface CSVParseError {
  row: number
  field: string
  message: string
  value: unknown
}

// ============================================================
// CSV EXPORT
// ============================================================

/**
 * Download an array of objects as a CSV file in the browser.
 *
 * Uses PapaParse for reliable CSV serialisation (handles commas, quotes,
 * newlines in field values). Triggers a browser download automatically.
 *
 * @example
 * downloadCSV({
 *   filename: 'citations-export',
 *   headers: ['Directory Name', 'URL', 'Status', 'DA'],
 *   fields: ['directory_name', 'url', 'status', 'domain_authority'],
 *   data: citations,
 * })
 */
export function downloadCSV(options: CSVExportOptions): void {
  const { filename, headers, fields, data } = options

  // Remap data to use display headers
  const rows = data.map((row) => {
    const mapped: Record<string, unknown> = {}
    fields.forEach((field, index) => {
      const header = headers[index] ?? field
      mapped[header] = formatCSVValue(row[field])
    })
    return mapped
  })

  const csv = Papa.unparse(rows, {
    columns: headers,
    quotes: true,
    newline: '\r\n',
  })

  triggerDownload(csv, `${filename}.csv`, 'text/csv;charset=utf-8;')
}

/**
 * Format a raw value for CSV output.
 * - Null/undefined → empty string
 * - Booleans → 'Yes' / 'No'
 * - Dates → ISO string
 * - Objects → JSON string
 */
function formatCSVValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * Trigger a file download in the browser.
 */
function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Revoke object URL after a short delay
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

// ============================================================
// CITATION-SPECIFIC EXPORT
// ============================================================

/**
 * Export citations data as a formatted CSV file.
 */
export function exportCitationsCSV(
  citations: Array<{
    directory_name: string
    url: string
    domain_authority: number
    niche: string | null
    status: string
    date_submitted: string | null
    date_live: string | null
    notes: string | null
  }>,
): void {
  downloadCSV({
    filename: `citations-export-${new Date().toISOString().split('T')[0] ?? 'today'}`,
    headers: [
      'Directory Name',
      'URL',
      'Domain Authority',
      'Niche',
      'Status',
      'Date Submitted',
      'Date Live',
      'Notes',
    ],
    fields: [
      'directory_name',
      'url',
      'domain_authority',
      'niche',
      'status',
      'date_submitted',
      'date_live',
      'notes',
    ],
    data: citations,
  })
}

// ============================================================
// CSV PARSING (Import)
// ============================================================

/**
 * Parse a CSV file and return rows as an array of objects.
 *
 * Validates file size and type before parsing.
 * Returns parsed data + any per-row errors.
 *
 * Used for the citation/backlink CSV import flow.
 */
export async function parseCSVFile(file: File): Promise<{
  headers: string[]
  rows: Record<string, string>[]
  error?: string
}> {
  // File size validation
  if (file.size > FILE_LIMITS.CSV_MAX_SIZE_BYTES) {
    return {
      headers: [],
      rows: [],
      error: `File size exceeds ${FILE_LIMITS.CSV_MAX_SIZE_BYTES / 1024 / 1024}MB limit`,
    }
  }

  // File type validation
  const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain']
  if (!allowedTypes.includes(file.type) && !file.name.endsWith('.csv')) {
    return {
      headers: [],
      rows: [],
      error: 'Only CSV files are accepted',
    }
  }

  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => value.trim(),
      complete: (results) => {
        const rows = results.data

        // Row count validation
        if (rows.length > FILE_LIMITS.CSV_MAX_ROWS) {
          resolve({
            headers: results.meta.fields ?? [],
            rows: [],
            error: `File has ${rows.length} rows. Maximum allowed is ${FILE_LIMITS.CSV_MAX_ROWS} rows.`,
          })
          return
        }

        resolve({
          headers: results.meta.fields ?? [],
          rows,
        })
      },
      error: (error) => {
        resolve({
          headers: [],
          rows: [],
          error: `CSV parse error: ${error.message}`,
        })
      },
    })
  })
}

// ============================================================
// JSON EXPORT (for Reports)
// ============================================================

/**
 * Export a report as a formatted JSON file download.
 */
export function downloadJSON(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2)
  triggerDownload(json, `${filename}.json`, 'application/json;charset=utf-8;')
}
