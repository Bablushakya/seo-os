'use client'

import React, { useState, useRef } from 'react'
 // Wait, we can use Dialog from components/ui/dialog or sheet. Let's see if components/ui/dialog.tsx exists.
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Upload, X, FileText, CheckCircle2, AlertTriangle, Download } from 'lucide-react'
import Papa from 'papaparse'

// Make sure we import Dialog components from components/ui/dialog
import {
  Dialog as ShadcnDialog,
  DialogContent as ShadcnDialogContent,
  DialogHeader as ShadcnDialogHeader,
  DialogTitle as ShadcnDialogTitle,
  DialogDescription as ShadcnDialogDescription,
  DialogFooter as ShadcnDialogFooter,
} from '@/components/ui/dialog'

interface CitationImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface ColumnMapping {
  directory_name: string
  url: string
  domain_authority: string
  niche: string
  status: string
  date_submitted: string
  date_live: string
  notes: string
}

export function CitationImportModal({
  isOpen,
  onClose,
  onSuccess,
}: CitationImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<any[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({
    directory_name: '',
    url: '',
    domain_authority: '',
    niche: '',
    status: '',
    date_submitted: '',
    date_live: '',
    notes: '',
  })
  
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  
  // Import results
  const [importResult, setImportResult] = useState<{
    successCount: number
    failedCount: number
    totalProcessed: number
    errors: Array<{ row: number; data: any; errors: string[] }>
  } | null>(null)

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

  const processFile = (selectedFile: File) => {
    if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
      setParseError('Please upload a valid CSV file.')
      return
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setParseError('File size exceeds 5MB limit.')
      return
    }

    setFile(selectedFile)
    setParseError(null)
    setIsParsing(true)
    setImportResult(null)

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

        // Auto-map columns if common headers match
        const initialMapping = { ...mapping }
        
        const findMatch = (options: string[], fields: string[]) => {
          return fields.find(f => 
            options.some(opt => f.toLowerCase().replace(/[^a-z0-9]/g, '').includes(opt))
          ) || ''
        }

        initialMapping.directory_name = findMatch(['directory', 'name', 'dirname', 'business'], headers)
        initialMapping.url = findMatch(['url', 'link', 'website', 'address'], headers)
        initialMapping.domain_authority = findMatch(['da', 'domainauthority', 'authority', 'score'], headers)
        initialMapping.niche = findMatch(['niche', 'category', 'industry'], headers)
        initialMapping.status = findMatch(['status', 'state'], headers)
        initialMapping.date_submitted = findMatch(['submitted', 'datesubmitted', 'submission'], headers)
        initialMapping.date_live = findMatch(['live', 'datelive', 'pub'], headers)
        initialMapping.notes = findMatch(['notes', 'desc', 'details', 'comment'], headers)

        setMapping(initialMapping)
      },
      error: (err) => {
        setIsParsing(false)
        setParseError(`Failed to parse CSV: ${err.message}`)
        setFile(null)
      }
    })
  }

  const handleMapChange = (field: keyof ColumnMapping, val: string) => {
    setMapping(prev => ({
      ...prev,
      [field]: val === 'none' ? '' : val,
    }))
  }

  const handleImport = async () => {
    if (csvRows.length === 0 || !mapping.directory_name || !mapping.url) return

    setIsImporting(true)
    setParseError(null)

    try {
      // Map the CSV rows to our API payload format
      const payload = csvRows.map(row => {
        return {
          directory_name: row[mapping.directory_name] || '',
          url: row[mapping.url] || '',
          domain_authority: mapping.domain_authority ? Number(row[mapping.domain_authority]) || 0 : 0,
          niche: mapping.niche ? row[mapping.niche] || '' : '',
          status: mapping.status ? (row[mapping.status] || 'pending').toLowerCase().trim() : 'pending',
          date_submitted: mapping.date_submitted ? row[mapping.date_submitted] || null : null,
          date_live: mapping.date_live ? row[mapping.date_live] || null : null,
          notes: mapping.notes ? row[mapping.notes] || '' : '',
        }
      })

      const response = await fetch('/api/citations/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Import failed')
      }

      setImportResult(result.data)
      onSuccess()
    } catch (err: any) {
      console.error(err)
      setParseError(err.message || 'An error occurred during import.')
    } finally {
      setIsImporting(false)
    }
  }

  const downloadErrorReport = () => {
    if (!importResult || importResult.errors.length === 0) return

    const reportRows = importResult.errors.map(err => ({
      'CSV Row': err.row,
      'Directory Name': err.data.directory_name || '',
      'URL': err.data.url || '',
      'DA': err.data.domain_authority || '',
      'Niche': err.data.niche || '',
      'Status': err.data.status || '',
      'Date Submitted': err.data.date_submitted || '',
      'Date Live': err.data.date_live || '',
      'Notes': err.data.notes || '',
      'Error Message': err.errors.join('; '),
    }))

    const csvReport = Papa.unparse(reportRows)
    const blob = new Blob([csvReport], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `citation_import_errors_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const resetModal = () => {
    setFile(null)
    setCsvHeaders([])
    setCsvRows([])
    setImportResult(null)
    setParseError(null)
  }

  const getPreviewData = () => {
    return csvRows.slice(0, 3).map(row => ({
      directory_name: row[mapping.directory_name] || '',
      url: row[mapping.url] || '',
      domain_authority: mapping.domain_authority ? row[mapping.domain_authority] || '0' : '0',
      niche: mapping.niche ? row[mapping.niche] || '' : '',
      status: mapping.status ? row[mapping.status] || 'pending' : 'pending',
    }))
  }

  const isMappingValid = !!mapping.directory_name && !!mapping.url

  return (
    <ShadcnDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ShadcnDialogContent className="max-w-3xl overflow-y-auto max-h-[90vh] bg-card text-card-foreground border-border">
        <ShadcnDialogHeader>
          <ShadcnDialogTitle>Import Citations from CSV</ShadcnDialogTitle>
          <ShadcnDialogDescription>
            Bulk upload citations using a CSV file. Supports mapping columns and previews.
          </ShadcnDialogDescription>
        </ShadcnDialogHeader>

        {parseError && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive flex items-start">
            <AlertTriangle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {!file && !importResult && (
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border hover:border-primary/50 rounded-lg p-10 flex flex-col items-center justify-center cursor-pointer transition-colors"
          >
            <Upload className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground font-medium mb-1">
              Drag & drop CSV file here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground/60">
              Accepted: .csv, max 5MB (Limit: 500 rows per batch)
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              className="hidden"
            />
          </div>
        )}

        {file && !importResult && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-background border border-border rounded-md p-3">
              <div className="flex items-center space-x-3">
                <FileText className="h-6 w-6 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB • {csvRows.length} rows found
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={resetModal} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {isParsing ? (
              <div className="py-6 flex justify-center">
                <LoadingSpinner size="md" label="Parsing CSV file..." />
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold">Map CSV Headers to Fields</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Directory Name <span className="text-red-500">*</span></Label>
                      <Select
                        value={mapping.directory_name || 'none'}
                        onValueChange={(val) => handleMapChange('directory_name', val)}
                      >
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue placeholder="Map header" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          <SelectItem value="none">-- Don't Map --</SelectItem>
                          {csvHeaders.map(h => (
                            <SelectItem key={h} value={h}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Directory URL <span className="text-red-500">*</span></Label>
                      <Select
                        value={mapping.url || 'none'}
                        onValueChange={(val) => handleMapChange('url', val)}
                      >
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue placeholder="Map header" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          <SelectItem value="none">-- Don't Map --</SelectItem>
                          {csvHeaders.map(h => (
                            <SelectItem key={h} value={h}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Domain Authority (DA)</Label>
                      <Select
                        value={mapping.domain_authority || 'none'}
                        onValueChange={(val) => handleMapChange('domain_authority', val)}
                      >
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue placeholder="Map header" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          <SelectItem value="none">-- Don't Map --</SelectItem>
                          {csvHeaders.map(h => (
                            <SelectItem key={h} value={h}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Niche / Category</Label>
                      <Select
                        value={mapping.niche || 'none'}
                        onValueChange={(val) => handleMapChange('niche', val)}
                      >
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue placeholder="Map header" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          <SelectItem value="none">-- Don't Map --</SelectItem>
                          {csvHeaders.map(h => (
                            <SelectItem key={h} value={h}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Submission Status</Label>
                      <Select
                        value={mapping.status || 'none'}
                        onValueChange={(val) => handleMapChange('status', val)}
                      >
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue placeholder="Map header" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          <SelectItem value="none">-- Don't Map (Default Pending) --</SelectItem>
                          {csvHeaders.map(h => (
                            <SelectItem key={h} value={h}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Select
                        value={mapping.notes || 'none'}
                        onValueChange={(val) => handleMapChange('notes', val)}
                      >
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue placeholder="Map header" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          <SelectItem value="none">-- Don't Map --</SelectItem>
                          {csvHeaders.map(h => (
                            <SelectItem key={h} value={h}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {isMappingValid && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Preview (First 3 Rows)</h4>
                    <div className="rounded-md border border-border overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted">
                          <TableRow className="border-border">
                            <TableHead>Directory Name</TableHead>
                            <TableHead>URL</TableHead>
                            <TableHead>DA</TableHead>
                            <TableHead>Niche</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getPreviewData().map((row, idx) => (
                            <TableRow key={idx} className="border-border">
                              <TableCell className="font-medium">{row.directory_name}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{row.url}</TableCell>
                              <TableCell>{row.domain_authority}</TableCell>
                              <TableCell>{row.niche || '-'}</TableCell>
                              <TableCell className="capitalize">{row.status}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {importResult && (
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center py-6 space-y-3">
              <div className="rounded-full bg-green-500/10 p-3">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <h3 className="text-lg font-bold">Import Completed!</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Successfully processed {importResult.totalProcessed} records.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-background border border-border rounded-md p-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-500">{importResult.successCount}</p>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Citations Imported</p>
              </div>
              <div className="border-l border-border">
                <p className="text-2xl font-bold text-red-500">{importResult.failedCount}</p>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Failed Rows</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-destructive flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1.5" />
                    Validation Errors Report
                  </h4>
                  <Button variant="outline" size="sm" onClick={downloadErrorReport} className="h-8 border-border">
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Download Error Report
                  </Button>
                </div>
                <div className="rounded-md border border-border max-h-[200px] overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-muted">
                      <TableRow className="border-border">
                        <TableHead className="w-16">Row</TableHead>
                        <TableHead>Directory Name / URL</TableHead>
                        <TableHead>Error Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.errors.slice(0, 10).map((err, idx) => (
                        <TableRow key={idx} className="border-border">
                          <TableCell className="font-mono text-xs">{err.row}</TableCell>
                          <TableCell>
                            <p className="text-sm font-medium">{err.data?.directory_name || 'Empty'}</p>
                            <p className="text-xs text-muted-foreground max-w-[200px] truncate">{err.data?.url}</p>
                          </TableCell>
                          <TableCell className="text-xs text-destructive">
                            {err.errors.join('; ')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {importResult.errors.length > 10 && (
                    <p className="text-xs text-center text-muted-foreground py-2 border-t border-border">
                      And {importResult.errors.length - 10} more rows... Download full error report to check all.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <ShadcnDialogFooter className="gap-2 sm:gap-0">
          {!importResult ? (
            <>
              <Button
                variant="outline"
                onClick={resetModal}
                disabled={isImporting}
                className="border-border hover:bg-accent hover:text-accent-foreground"
              >
                Reset
              </Button>
              <Button
                onClick={handleImport}
                disabled={isImporting || !file || !isMappingValid}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isImporting ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2 border-t-primary-foreground" />
                    Importing...
                  </>
                ) : (
                  `Import ${csvRows.length || 0} Rows`
                )}
              </Button>
            </>
          ) : (
            <Button onClick={onClose} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              Close
            </Button>
          )}
        </ShadcnDialogFooter>
      </ShadcnDialogContent>
    </ShadcnDialog>
  )
}
