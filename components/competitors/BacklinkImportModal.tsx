'use client'

import React, { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Upload, X, FileText, CheckCircle2, AlertTriangle, Download } from 'lucide-react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import {
  Dialog as ShadcnDialog,
  DialogContent as ShadcnDialogContent,
  DialogHeader as ShadcnDialogHeader,
  DialogTitle as ShadcnDialogTitle,
  DialogDescription as ShadcnDialogDescription,
  DialogFooter as ShadcnDialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface BacklinkImportModalProps {
  competitorId: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface ColumnMapping {
  source_domain: string
  source_da: string
  source_url: string
  target_url: string
  anchor_text: string
  link_type: string
  date_found: string
  notes: string
}

export function BacklinkImportModal({
  competitorId,
  isOpen,
  onClose,
  onSuccess,
}: BacklinkImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<any[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({
    source_domain: '',
    source_da: '',
    source_url: '',
    target_url: '',
    anchor_text: '',
    link_type: '',
    date_found: '',
    notes: '',
  })

  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [importedCount, setImportedCount] = useState<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      processFile(droppedFile)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      processFile(selectedFile)
    }
  }

  const autoMapHeaders = (headers: string[]) => {
    const initialMapping = { ...mapping }
    
    const findMatch = (options: string[], fields: string[]) => {
      return fields.find(f => 
        options.some(opt => f.toLowerCase().replace(/[^a-z0-9]/g, '').includes(opt))
      ) || ''
    }

    initialMapping.source_domain = findMatch(['domain', 'sourcedomain', 'sourcehost'], headers)
    initialMapping.source_da = findMatch(['da', 'domainauthority', 'authority', 'score', 'sourceda'], headers)
    initialMapping.source_url = findMatch(['sourceurl', 'url', 'fromurl', 'page'], headers)
    initialMapping.target_url = findMatch(['targeturl', 'tourl', 'desturl'], headers)
    initialMapping.anchor_text = findMatch(['anchor', 'anchortext', 'text'], headers)
    initialMapping.link_type = findMatch(['type', 'linktype', 'dofollow'], headers)
    initialMapping.date_found = findMatch(['date', 'found', 'datefound', 'firstseen'], headers)
    initialMapping.notes = findMatch(['notes', 'desc', 'details', 'comment'], headers)

    setMapping(initialMapping)
  }

  const processFile = (selectedFile: File) => {
    const isCSV = selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')
    const isXLSX = selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || selectedFile.name.endsWith('.xlsx')

    if (!isCSV && !isXLSX) {
      setParseError('Please upload a valid CSV or Excel (.xlsx) file.')
      return
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setParseError('File size exceeds 5MB limit.')
      return
    }

    setFile(selectedFile)
    setParseError(null)
    setIsParsing(true)
    setImportedCount(null)

    if (isCSV) {
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: 'greedy',
        complete: (results) => {
          setIsParsing(false)
          if (results.errors.length > 0) {
            console.warn('Papa parse errors:', results.errors)
          }

          const headers = results.meta.fields || []
          if (headers.length === 0) {
            setParseError('The CSV file is empty or has no header row.')
            setFile(null)
            return
          }

          setCsvHeaders(headers)
          setCsvRows(results.data)
          autoMapHeaders(headers)
        },
        error: (err) => {
          setIsParsing(false)
          setParseError(`Failed to parse CSV: ${err.message}`)
          setFile(null)
        }
      })
    } else if (isXLSX) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          
          const firstSheetName = workbook.SheetNames[0]
          if (!firstSheetName) {
            throw new Error('The Excel file is empty.')
          }
          const worksheet = workbook.Sheets[firstSheetName]
          if (!worksheet) {
            throw new Error('Worksheet not found.')
          }
          
          const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 })
          setIsParsing(false)
          
          if (jsonData.length === 0) {
            setParseError('The Excel file is empty.')
            setFile(null)
            return
          }
          
          const headers = (jsonData[0] as string[]) || []
          if (headers.length === 0) {
            setParseError('The Excel file has no header row.')
            setFile(null)
            return
          }

          // Convert remaining rows into objects mapping headers to cell values
          const rows: any[] = []
          for (let i = 1; i < jsonData.length; i++) {
            const rowValues = jsonData[i] as any[]
            if (!rowValues || rowValues.every(val => val === null || val === '')) {
              continue
            }
            
            const rowObj: any = {}
            headers.forEach((header, index) => {
              if (header) {
                rowObj[header] = rowValues[index] !== undefined ? rowValues[index] : ''
              }
            })
            rows.push(rowObj)
          }
          
          setCsvHeaders(headers)
          setCsvRows(rows)
          autoMapHeaders(headers)
        } catch (err: any) {
          setIsParsing(false)
          setParseError(`Failed to parse Excel file: ${err.message}`)
          setFile(null)
        }
      }
      reader.onerror = () => {
        setIsParsing(false)
        setParseError('Failed to read file.')
        setFile(null)
      }
      reader.readAsArrayBuffer(selectedFile)
    }
  }

  const handleMapChange = (field: keyof ColumnMapping, val: string) => {
    setMapping(prev => ({
      ...prev,
      [field]: val === 'none' ? '' : val,
    }))
  }

  const handleImport = async () => {
    if (csvRows.length === 0 || !mapping.source_domain || !mapping.source_da) return

    setIsImporting(true)
    setParseError(null)

    try {
      const normalizeLinkType = (val: any): string => {
        const s = String(val || '').toLowerCase().trim()
        if (s.includes('nofollow') || s.includes('no-follow') || s === 'no' || s === 'n') {
          return 'nofollow'
        }
        if (s.includes('dofollow') || s.includes('follow') || s === 'yes' || s === 'y') {
          return 'dofollow'
        }
        return 'unknown'
      }

      const normalizeDate = (val: any): string => {
        if (val === null || val === undefined || val === '') return ''
        
        // If it's already a JS Date object
        if (val instanceof Date) {
          if (!isNaN(val.getTime())) {
            const yyyy = val.getFullYear()
            const mm = String(val.getMonth() + 1).padStart(2, '0')
            const dd = String(val.getDate()).padStart(2, '0')
            return `${yyyy}-${mm}-${dd}`
          }
        }
        
        // If it's a number (Excel serial date number)
        if (typeof val === 'number') {
          try {
            const date = new Date((val - 25569) * 86400 * 1000)
            if (!isNaN(date.getTime())) {
              const yyyy = date.getFullYear()
              const mm = String(date.getMonth() + 1).padStart(2, '0')
              const dd = String(date.getDate()).padStart(2, '0')
              return `${yyyy}-${mm}-${dd}`
            }
          } catch (e) {
            // ignore
          }
        }
        
        const s = String(val).trim()
        if (!s) return ''
        
        // Check if already YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
        
        // Try parsing string to Date
        try {
          const parsed = new Date(s)
          if (!isNaN(parsed.getTime())) {
            const yyyy = parsed.getFullYear()
            const mm = String(parsed.getMonth() + 1).padStart(2, '0')
            const dd = String(parsed.getDate()).padStart(2, '0')
            return `${yyyy}-${mm}-${dd}`
          }
        } catch (e) {
          // ignore
        }
        return ''
      }

      // Map CSV rows to API payload
      const payload = csvRows.map(row => {
        return {
          source_domain: row[mapping.source_domain] || '',
          source_da: mapping.source_da ? Number(row[mapping.source_da]) || 0 : 0,
          source_url: mapping.source_url ? row[mapping.source_url] || '' : '',
          target_url: mapping.target_url ? row[mapping.target_url] || '' : '',
          anchor_text: mapping.anchor_text ? row[mapping.anchor_text] || '' : '',
          link_type: mapping.link_type ? normalizeLinkType(row[mapping.link_type]) : 'dofollow',
          date_found: mapping.date_found ? normalizeDate(row[mapping.date_found]) : '',
          notes: mapping.notes ? row[mapping.notes] || '' : '',
        }
      })

      const response = await fetch(`/api/competitors/${competitorId}/backlinks/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Import failed')
      }

      setImportedCount(result.data.imported)
      toast.success(`${result.data.imported} backlinks imported successfully!`)
      onSuccess()
    } catch (err: any) {
      console.error(err)
      setParseError(err.message || 'An error occurred during import.')
    } finally {
      setIsImporting(false)
    }
  }

  const resetModal = () => {
    setFile(null)
    setCsvHeaders([])
    setCsvRows([])
    setImportedCount(null)
    setParseError(null)
  }

  const getPreviewData = () => {
    return csvRows.slice(0, 3).map(row => ({
      source_domain: row[mapping.source_domain] || '',
      source_da: mapping.source_da ? row[mapping.source_da] || '0' : '0',
      source_url: mapping.source_url ? row[mapping.source_url] || '' : '',
      anchor_text: mapping.anchor_text ? row[mapping.anchor_text] || '' : '',
    }))
  }

  const isMappingValid = !!mapping.source_domain && !!mapping.source_da

  return (
    <ShadcnDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ShadcnDialogContent className="sm:max-w-2xl bg-card text-card-foreground border-border max-h-[90vh] overflow-y-auto">
        <ShadcnDialogHeader>
          <ShadcnDialogTitle>Import Competitor Backlinks</ShadcnDialogTitle>
          <ShadcnDialogDescription>
            Upload a CSV backlink report (from Ahrefs, SEMrush, or Moz) to run gap analysis.
          </ShadcnDialogDescription>
        </ShadcnDialogHeader>

        {importedCount !== null ? (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Import Completed Successfully</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Imported **{importedCount}** competitor backlink rows.
              </p>
            </div>
            <Button onClick={() => { resetModal(); onClose(); }} className="mt-4">
              Close Modal
            </Button>
          </div>
        ) : !file ? (
          <div className="space-y-4 py-4">
            {parseError && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-primary/50 hover:bg-accent/10 transition-all rounded-lg p-10 flex flex-col items-center justify-center cursor-pointer text-center group"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv,.xlsx"
                className="hidden"
              />
              <Upload className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors mb-3" />
              <p className="text-sm font-semibold text-foreground">Drag and drop backlink CSV or Excel (.xlsx) file here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse local files (max 5MB)</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between p-3 bg-muted/40 border border-border rounded-lg">
              <div className="flex items-center gap-2.5">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground truncate max-w-[300px]">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{(file.size / 1024).toFixed(1)} KB • {csvRows.length} rows</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={resetModal} className="h-8 w-8 text-muted-foreground">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {parseError && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {/* Column Mapping Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Map CSV Columns to Backlink Fields</h4>
              <div className="grid grid-cols-2 gap-4 border border-border rounded-lg p-4 bg-card/50">
                <div className="space-y-1.5">
                  <Label className="text-xs">Source Domain <span className="text-red-500">*</span></Label>
                  <Select
                    value={mapping.source_domain || 'none'}
                    onValueChange={(val) => handleMapChange('source_domain', val)}
                  >
                    <SelectTrigger className="bg-background border-input text-xs h-8">
                      <SelectValue placeholder="Map column..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="none">-- Unmapped --</SelectItem>
                      {csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Source DA <span className="text-red-500">*</span></Label>
                  <Select
                    value={mapping.source_da || 'none'}
                    onValueChange={(val) => handleMapChange('source_da', val)}
                  >
                    <SelectTrigger className="bg-background border-input text-xs h-8">
                      <SelectValue placeholder="Map column..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="none">-- Unmapped --</SelectItem>
                      {csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Source Page URL</Label>
                  <Select
                    value={mapping.source_url || 'none'}
                    onValueChange={(val) => handleMapChange('source_url', val)}
                  >
                    <SelectTrigger className="bg-background border-input text-xs h-8">
                      <SelectValue placeholder="Map column..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="none">-- Unmapped --</SelectItem>
                      {csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Target Destination URL</Label>
                  <Select
                    value={mapping.target_url || 'none'}
                    onValueChange={(val) => handleMapChange('target_url', val)}
                  >
                    <SelectTrigger className="bg-background border-input text-xs h-8">
                      <SelectValue placeholder="Map column..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="none">-- Unmapped --</SelectItem>
                      {csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Anchor Text</Label>
                  <Select
                    value={mapping.anchor_text || 'none'}
                    onValueChange={(val) => handleMapChange('anchor_text', val)}
                  >
                    <SelectTrigger className="bg-background border-input text-xs h-8">
                      <SelectValue placeholder="Map column..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="none">-- Unmapped --</SelectItem>
                      {csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Link Type</Label>
                  <Select
                    value={mapping.link_type || 'none'}
                    onValueChange={(val) => handleMapChange('link_type', val)}
                  >
                    <SelectTrigger className="bg-background border-input text-xs h-8">
                      <SelectValue placeholder="Map column..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="none">-- Unmapped (Default Dofollow) --</SelectItem>
                      {csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Date Found</Label>
                  <Select
                    value={mapping.date_found || 'none'}
                    onValueChange={(val) => handleMapChange('date_found', val)}
                  >
                    <SelectTrigger className="bg-background border-input text-xs h-8">
                      <SelectValue placeholder="Map column..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="none">-- Unmapped (Default Today) --</SelectItem>
                      {csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Notes</Label>
                  <Select
                    value={mapping.notes || 'none'}
                    onValueChange={(val) => handleMapChange('notes', val)}
                  >
                    <SelectTrigger className="bg-background border-input text-xs h-8">
                      <SelectValue placeholder="Map column..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="none">-- Unmapped --</SelectItem>
                      {csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Mapped Row Preview */}
            {isMappingValid && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground">Mapping Preview (First 3 Rows)</h4>
                <div className="border border-border rounded-md overflow-hidden bg-muted/20">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow className="border-b border-border">
                        <TableHead className="h-8 text-[10px]">Source Domain</TableHead>
                        <TableHead className="h-8 text-[10px]">DA</TableHead>
                        <TableHead className="h-8 text-[10px]">Source Page URL</TableHead>
                        <TableHead className="h-8 text-[10px]">Anchor Text</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getPreviewData().map((preview, i) => (
                        <TableRow key={i} className="border-b border-border/50 text-xs">
                          <TableCell className="py-2 font-medium">{preview.source_domain || '-'}</TableCell>
                          <TableCell className="py-2">{preview.source_da || '0'}</TableCell>
                          <TableCell className="py-2 truncate max-w-[150px]">{preview.source_url || '-'}</TableCell>
                          <TableCell className="py-2 truncate max-w-[150px]">{preview.anchor_text || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <ShadcnDialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={resetModal} disabled={isImporting}>
                Reset File
              </Button>
              <Button
                onClick={handleImport}
                disabled={isImporting || !isMappingValid}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isImporting ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2 border-t-primary-foreground" />
                    Importing...
                  </>
                ) : (
                  'Start Backlink Import'
                )}
              </Button>
            </ShadcnDialogFooter>
          </div>
        )}
      </ShadcnDialogContent>
    </ShadcnDialog>
  )
}
