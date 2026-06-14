'use client'

import React, { useState, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils/cn'
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'

// ============================================================
// TYPES
// ============================================================

export type SortOrder = 'asc' | 'desc' | null

export interface ColumnDef<TData> {
  /** Unique key for this column (matches data field) */
  key: string
  /** Column header label */
  header: string
  /** Render function for the cell */
  cell?: (row: TData, index: number) => React.ReactNode
  /** Whether this column is sortable */
  sortable?: boolean
  /** Column width (Tailwind class or CSS value) */
  width?: string
  /** Text alignment */
  align?: 'left' | 'center' | 'right'
  /** Hide on mobile */
  hideOnMobile?: boolean
}

export interface DataTableProps<TData extends Record<string, unknown>> {
  /** Column definitions */
  columns: ColumnDef<TData>[]
  /** Data rows */
  data: TData[]
  /** Loading state */
  isLoading?: boolean
  /** Number of skeleton rows to show while loading */
  skeletonRows?: number
  /** Called when column header is clicked for sorting */
  onSort?: (key: string, order: 'asc' | 'desc') => void
  /** Current sort key */
  sortKey?: string
  /** Current sort order */
  sortOrder?: 'asc' | 'desc'
  /** Called when a row is clicked */
  onRowClick?: (row: TData) => void
  /** Empty state props */
  emptyState?: {
    title: string
    description?: string
    actionLabel?: string
    onAction?: () => void
  }
  /** Additional class names for the wrapper */
  className?: string
  /** Show row count in footer */
  showCount?: boolean
  /** Total records (for display when using server pagination) */
  totalCount?: number
}

// ============================================================
// SORT ICON
// ============================================================

function SortIcon({
  isActive,
  order,
}: {
  isActive: boolean
  order: SortOrder
}) {
  if (!isActive) {
    return <ChevronsUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />
  }
  return order === 'asc' ? (
    <ChevronUp className="ml-1 h-3 w-3 text-foreground" />
  ) : (
    <ChevronDown className="ml-1 h-3 w-3 text-foreground" />
  )
}

// ============================================================
// COMPONENT
// ============================================================

/**
 * Reusable, sortable data table component.
 *
 * Features:
 * - Sortable column headers with visual sort indicators
 * - Loading skeleton rows
 * - Empty state component
 * - Row click handler
 * - Mobile-responsive (optional column hiding)
 * - Accessible (proper table semantics, aria-sort)
 *
 * From DOC4 Section 9 — UI Components Library (Table)
 *
 * @example
 * <DataTable
 *   columns={[
 *     { key: 'directory_name', header: 'Directory', sortable: true },
 *     { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
 *   ]}
 *   data={citations}
 *   isLoading={isLoading}
 *   onSort={(key, order) => setSort({ key, order })}
 *   sortKey={sort.key}
 *   sortOrder={sort.order}
 *   onRowClick={(row) => router.push(`/citations/${row.id}`)}
 * />
 */
export function DataTable<TData extends Record<string, unknown>>({
  columns,
  data,
  isLoading = false,
  skeletonRows = 5,
  onSort,
  sortKey,
  sortOrder,
  onRowClick,
  emptyState,
  className,
  showCount = true,
  totalCount,
}: DataTableProps<TData>) {
  const [internalSortKey, setInternalSortKey] = useState<string | null>(null)
  const [internalSortOrder, setInternalSortOrder] = useState<SortOrder>(null)

  const activeSortKey = sortKey ?? internalSortKey
  const activeSortOrder = sortOrder ?? internalSortOrder

  const handleSort = useCallback(
    (key: string) => {
      const column = columns.find((c) => c.key === key)
      if (!column?.sortable) return

      let newOrder: 'asc' | 'desc' = 'asc'
      if (activeSortKey === key && activeSortOrder === 'asc') {
        newOrder = 'desc'
      }

      if (onSort) {
        onSort(key, newOrder)
      } else {
        setInternalSortKey(key)
        setInternalSortOrder(newOrder)
      }
    },
    [columns, activeSortKey, activeSortOrder, onSort],
  )

  // Client-side sort when no onSort provided
  const sortedData = React.useMemo(() => {
    if (onSort || !internalSortKey || !internalSortOrder) return data

    return [...data].sort((a, b) => {
      const aVal = a[internalSortKey]
      const bVal = b[internalSortKey]

      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1

      const comparison =
        String(aVal).toLowerCase() < String(bVal).toLowerCase() ? -1 : 1

      return internalSortOrder === 'asc' ? comparison : -comparison
    })
  }, [data, internalSortKey, internalSortOrder, onSort])

  const displayData = onSort ? data : sortedData
  const count = totalCount ?? displayData.length

  return (
    <div className={cn('rounded-md border border-border overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <Table>
          {/* Header */}
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    'h-10 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide',
                    column.sortable &&
                      'cursor-pointer select-none hover:text-foreground transition-colors',
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    column.hideOnMobile && 'hidden md:table-cell',
                    column.width,
                  )}
                  onClick={() => column.sortable && handleSort(column.key)}
                  aria-sort={
                    activeSortKey === column.key
                      ? activeSortOrder === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {column.header}
                    {column.sortable && (
                      <SortIcon
                        isActive={activeSortKey === column.key}
                        order={
                          activeSortKey === column.key ? activeSortOrder : null
                        }
                      />
                    )}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          {/* Body */}
          <TableBody>
            {/* Loading state */}
            {isLoading &&
              Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`} className="border-b border-border/50">
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        'px-4 py-3',
                        column.hideOnMobile && 'hidden md:table-cell',
                      )}
                    >
                      <Skeleton
                        className={cn(
                          'h-4',
                          column.align === 'center' ? 'mx-auto w-16' : 'w-full',
                        )}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {/* Data rows */}
            {!isLoading &&
              displayData.map((row, rowIndex) => (
                <TableRow
                  key={
                    (row['id'] as string | undefined) ?? `row-${rowIndex}`
                  }
                  className={cn(
                    'border-b border-border/50 transition-colors',
                    onRowClick &&
                      'cursor-pointer hover:bg-accent/50',
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        'px-4 py-3 text-sm',
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right',
                        column.hideOnMobile && 'hidden md:table-cell',
                      )}
                    >
                      {column.cell
                        ? column.cell(row, rowIndex)
                        : ((row[column.key] as React.ReactNode) ?? (
                            <span className="text-muted-foreground">—</span>
                          ))}
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {/* Empty state */}
            {!isLoading && displayData.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-0"
                >
                  {emptyState ? (
                    <EmptyState
                      title={emptyState.title}
                      description={emptyState.description}
                      actionLabel={emptyState.actionLabel}
                      onAction={emptyState.onAction}
                      className="py-12"
                    />
                  ) : (
                    <EmptyState
                      title="No records found"
                      description="Try adjusting your filters."
                      className="py-12"
                    />
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer — row count */}
      {showCount && !isLoading && displayData.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/20">
          <span className="text-xs text-muted-foreground">
            {totalCount
              ? `Showing ${displayData.length} of ${count.toLocaleString()} records`
              : `${count.toLocaleString()} record${count !== 1 ? 's' : ''}`}
          </span>
        </div>
      )}
    </div>
  )
}
