/**
 * DataGrid Component
 * คอมโพเนนต์ตารางข้อมูล
 *
 * Reusable data grid with sorting, filtering, and pagination
 * Built on MUI X DataGrid
 * Used for listing Daily Reports, Wage Periods, DC lists, etc.
 */

import React from 'react';
import {
  DataGrid as MuiDataGrid,
  GridColDef,
  GridRowsProp,
  GridSortModel,
  GridFilterModel,
  GridPaginationModel,
  GridRowSelectionModel,
  GridCallbackDetails,
  GridRowParams,
} from '@mui/x-data-grid';
import { Box, Paper, Typography, LinearProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';

export interface DataGridProps {
  rows: GridRowsProp;
  columns: GridColDef[];
  loading?: boolean;
  error?: string | null;
  pageSize?: number;
  pageSizeOptions?: number[];
  totalRows?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  sortModel?: GridSortModel;
  onSortModelChange?: (model: GridSortModel) => void;
  filterModel?: GridFilterModel;
  onFilterModelChange?: (model: GridFilterModel) => void;
  selectionModel?: GridRowSelectionModel;
  onSelectionModelChange?: (model: GridRowSelectionModel) => void;
  onRowClick?: (params: GridRowParams) => void;
  onRowDoubleClick?: (params: GridRowParams) => void;
  checkboxSelection?: boolean;
  disableRowSelectionOnClick?: boolean;
  autoHeight?: boolean;
  height?: number | string;
  title?: string;
  noRowsMessage?: string;
  density?: 'compact' | 'standard' | 'comfortable';
}

/**
 * DataGrid component
 * - Sorting (client-side or server-side)
 * - Filtering (column filters)
 * - Pagination (client-side or server-side)
 * - Row selection (checkbox)
 * - Custom styling
 * - Thai locale
 */
export const DataGrid: React.FC<DataGridProps> = ({
  rows,
  columns,
  loading = false,
  error = null,
  pageSize = 10,
  pageSizeOptions = [5, 10, 25, 50, 100],
  totalRows,
  page = 0,
  onPageChange,
  onPageSizeChange,
  sortModel,
  onSortModelChange,
  filterModel,
  onFilterModelChange,
  selectionModel,
  onSelectionModelChange,
  onRowClick,
  onRowDoubleClick,
  checkboxSelection = false,
  disableRowSelectionOnClick = true,
  autoHeight = false,
  height = 600,
  title,
  noRowsMessage,
  density = 'standard',
}) => {
  const { t } = useTranslation();

  /**
   * Handle pagination model change
   */
  const handlePaginationModelChange = (model: GridPaginationModel, details: GridCallbackDetails) => {
    if (onPageChange && model.page !== page) {
      onPageChange(model.page);
    }
    if (onPageSizeChange && model.pageSize !== pageSize) {
      onPageSizeChange(model.pageSize);
    }
  };

  /**
   * Thai locale text for DataGrid
   */
  const localeText = {
    // Toolbar
    toolbarDensity: 'ความหนาแน่น',
    toolbarDensityLabel: 'ความหนาแน่น',
    toolbarDensityCompact: 'กระชับ',
    toolbarDensityStandard: 'มาตรฐาน',
    toolbarDensityComfortable: 'สบาย',
    toolbarColumns: 'คอลัมน์',
    toolbarColumnsLabel: 'เลือกคอลัมน์',
    toolbarFilters: 'ตัวกรอง',
    toolbarFiltersLabel: 'แสดงตัวกรอง',
    toolbarFiltersTooltipHide: 'ซ่อนตัวกรอง',
    toolbarFiltersTooltipShow: 'แสดงตัวกรอง',
    toolbarExport: 'ส่งออก',
    toolbarExportLabel: 'ส่งออก',
    toolbarExportCSV: 'ดาวน์โหลด CSV',
    toolbarExportPrint: 'พิมพ์',

    // Columns panel
    columnsPanelTextFieldLabel: 'ค้นหาคอลัมน์',
    columnsPanelTextFieldPlaceholder: 'ชื่อคอลัมน์',
    columnsPanelShowAllButton: 'แสดงทั้งหมด',
    columnsPanelHideAllButton: 'ซ่อนทั้งหมด',

    // Filter panel
    filterPanelAddFilter: 'เพิ่มตัวกรอง',
    filterPanelDeleteIconLabel: 'ลบ',
    filterPanelOperators: 'ตัวดำเนินการ',
    filterPanelOperatorAnd: 'และ',
    filterPanelOperatorOr: 'หรือ',
    filterPanelColumns: 'คอลัมน์',
    filterPanelInputLabel: 'ค่า',
    filterPanelInputPlaceholder: 'ค่าตัวกรอง',

    // Filter operators
    filterOperatorContains: 'ประกอบด้วย',
    filterOperatorEquals: 'เท่ากับ',
    filterOperatorStartsWith: 'เริ่มต้นด้วย',
    filterOperatorEndsWith: 'สิ้นสุดด้วย',
    filterOperatorIsEmpty: 'ว่างเปล่า',
    filterOperatorIsNotEmpty: 'ไม่ว่างเปล่า',
    filterOperatorIsAnyOf: 'เป็นหนึ่งใน',

    // Pagination
    footerRowSelected: (count: number) => `${count} แถวที่เลือก`,
    footerTotalRows: 'ทั้งหมด:',
    footerPaginationRowsPerPage: 'แถวต่อหน้า:',

    // Row selection
    checkboxSelectionHeaderName: 'เลือก',
    checkboxSelectionSelectAllRows: 'เลือกทั้งหมด',
    checkboxSelectionUnselectAllRows: 'ยกเลิกการเลือกทั้งหมด',

    // No rows
    noRowsLabel: noRowsMessage || 'ไม่มีข้อมูล',
    noResultsOverlayLabel: 'ไม่พบผลลัพธ์',

    // Error
    errorOverlayDefaultLabel: 'เกิดข้อผิดพลาด',

    // Column menu
    columnMenuLabel: 'เมนู',
    columnMenuShowColumns: 'แสดงคอลัมน์',
    columnMenuFilter: 'ตัวกรอง',
    columnMenuHideColumn: 'ซ่อน',
    columnMenuUnsort: 'ยกเลิกการเรียง',
    columnMenuSortAsc: 'เรียงจากน้อยไปมาก',
    columnMenuSortDesc: 'เรียงจากมากไปน้อย',
  };

  return (
    <Box>
      {/* Title */}
      {title && (
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
          {title}
        </Typography>
      )}

      {/* Error Message */}
      {error && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'error.light', color: 'error.dark' }}>
          <Typography variant="body2">{error}</Typography>
        </Paper>
      )}

      {/* DataGrid */}
      <Paper elevation={2}>
        <MuiDataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          density={density}
          autoHeight={autoHeight}
          sx={{
            height: autoHeight ? 'auto' : height,
            border: 'none',
            '& .MuiDataGrid-cell:focus': {
              outline: 'none',
            },
            '& .MuiDataGrid-cell:focus-within': {
              outline: 'none',
            },
            '& .MuiDataGrid-columnHeader:focus': {
              outline: 'none',
            },
            '& .MuiDataGrid-columnHeader:focus-within': {
              outline: 'none',
            },
          }}
          // Pagination
          pageSizeOptions={pageSizeOptions}
          paginationModel={{
            page,
            pageSize,
          }}
          onPaginationModelChange={handlePaginationModelChange}
          paginationMode={totalRows !== undefined ? 'server' : 'client'}
          rowCount={totalRows !== undefined ? totalRows : rows.length}
          // Sorting
          sortModel={sortModel}
          onSortModelChange={onSortModelChange}
          sortingMode={onSortModelChange ? 'server' : 'client'}
          // Filtering
          filterModel={filterModel}
          onFilterModelChange={onFilterModelChange}
          filterMode={onFilterModelChange ? 'server' : 'client'}
          // Selection
          checkboxSelection={checkboxSelection}
          disableRowSelectionOnClick={disableRowSelectionOnClick}
          rowSelectionModel={selectionModel}
          onRowSelectionModelChange={onSelectionModelChange}
          // Row events
          onRowClick={onRowClick}
          onRowDoubleClick={onRowDoubleClick}
          // Locale
          localeText={localeText}
          // Loading overlay
          slots={{
            loadingOverlay: LinearProgress,
          }}
          // Disable column menu by default (can be enabled per column)
          disableColumnMenu={false}
        />
      </Paper>
    </Box>
  );
};

/**
 * Helper function to create column definition
 */
export const createColumn = (
  field: string,
  headerName: string,
  options?: Partial<GridColDef>
): GridColDef => ({
  field,
  headerName,
  flex: 1,
  minWidth: 100,
  ...options,
});

/**
 * Helper function to create date column
 */
export const createDateColumn = (
  field: string,
  headerName: string,
  options?: Partial<GridColDef>
): GridColDef => ({
  field,
  headerName,
  type: 'date',
  flex: 1,
  minWidth: 120,
  valueFormatter: (params) => {
    if (!params.value) return '-';
    const date = new Date(params.value);
    return date.toLocaleDateString('th-TH');
  },
  ...options,
});

/**
 * Helper function to create number column
 */
export const createNumberColumn = (
  field: string,
  headerName: string,
  options?: Partial<GridColDef>
): GridColDef => ({
  field,
  headerName,
  type: 'number',
  flex: 1,
  minWidth: 100,
  align: 'right',
  headerAlign: 'right',
  ...options,
});

/**
 * Helper function to create actions column
 */
export const createActionsColumn = (
  renderCell: GridColDef['renderCell'],
  options?: Partial<GridColDef>
): GridColDef => ({
  field: 'actions',
  headerName: 'การดำเนินการ',
  type: 'actions',
  width: 120,
  renderCell,
  sortable: false,
  filterable: false,
  disableColumnMenu: true,
  ...options,
});

export default DataGrid;
