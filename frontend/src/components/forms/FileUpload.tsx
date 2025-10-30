/**
 * File Upload Component
 * คอมโพเนนต์อัปโหลดไฟล์
 *
 * File upload component with validation
 * Specialized for Excel files (ScanData import - FR-SD-001)
 */

import React, { useRef, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  LinearProgress,
  Paper,
  IconButton,
  Chip,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  InsertDriveFile as FileIcon,
  Close as CloseIcon,
  CheckCircle as SuccessIcon,
} from '@mui/icons-material';

export interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onFileRemove?: () => void;
  accept?: string; // MIME types (e.g., ".xlsx,.xls")
  maxSize?: number; // Max file size in bytes
  label?: string;
  helperText?: string;
  error?: boolean;
  errorMessage?: string;
  disabled?: boolean;
  required?: boolean;
  showPreview?: boolean;
  uploadProgress?: number; // 0-100 for upload progress
}

/**
 * FileUpload component
 * - Drag and drop support
 * - File validation (type, size)
 * - Upload progress indicator
 * - Preview selected file
 */
export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  onFileRemove,
  accept = '.xlsx,.xls',
  maxSize = 10 * 1024 * 1024, // 10MB default
  label = 'อัปโหลดไฟล์ Excel',
  helperText,
  error = false,
  errorMessage,
  disabled = false,
  required = false,
  showPreview = true,
  uploadProgress,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  /**
   * Validate file
   */
  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
      return `ไฟล์มีขนาดใหญ่เกินไป (สูงสุด ${maxSizeMB} MB)`;
    }

    // Check file type
    const acceptedTypes = accept.split(',').map((t) => t.trim());
    const fileExtension = `.${file.name.split('.').pop()}`;
    const isValidType = acceptedTypes.some((type) => {
      if (type.startsWith('.')) {
        return fileExtension.toLowerCase() === type.toLowerCase();
      }
      return file.type === type;
    });

    if (!isValidType) {
      return `รูปแบบไฟล์ไม่ถูกต้อง (รองรับเฉพาะ ${accept})`;
    }

    return null;
  };

  /**
   * Handle file selection
   */
  const handleFileChange = (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      setValidationError(null);
      return;
    }

    // Validate file
    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      setSelectedFile(null);
      return;
    }

    setValidationError(null);
    setSelectedFile(file);
    onFileSelect(file);
  };

  /**
   * Handle file input change
   */
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    handleFileChange(file);
  };

  /**
   * Handle drag events
   */
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  /**
   * Handle drop event
   */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileChange(file);
    }
  };

  /**
   * Handle remove file
   */
  const handleRemove = () => {
    setSelectedFile(null);
    setValidationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onFileRemove) {
      onFileRemove();
    }
  };

  /**
   * Trigger file input click
   */
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * Format file size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
  };

  const displayError = error || validationError;
  const displayErrorMessage = errorMessage || validationError;

  return (
    <Box>
      {/* Label */}
      <Typography variant="subtitle2" gutterBottom>
        {label}
        {required && <span style={{ color: 'red' }}> *</span>}
      </Typography>

      {/* Upload Area */}
      <Paper
        variant="outlined"
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        sx={{
          p: 3,
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          backgroundColor: dragActive
            ? 'action.hover'
            : disabled
            ? 'action.disabledBackground'
            : 'background.paper',
          borderColor: displayError ? 'error.main' : dragActive ? 'primary.main' : 'divider',
          borderWidth: dragActive ? 2 : 1,
          transition: 'all 0.2s',
          '&:hover': {
            backgroundColor: disabled ? 'action.disabledBackground' : 'action.hover',
          },
        }}
        onClick={!disabled ? handleClick : undefined}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          disabled={disabled}
          style={{ display: 'none' }}
        />

        {selectedFile && showPreview ? (
          /* File Preview */
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <FileIcon color="primary" fontSize="large" />
              <Box sx={{ flex: 1, textAlign: 'left' }}>
                <Typography variant="body1" fontWeight="500">
                  {selectedFile.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatFileSize(selectedFile.size)}
                </Typography>
              </Box>
              {uploadProgress === undefined && (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove();
                  }}
                  disabled={disabled}
                >
                  <CloseIcon />
                </IconButton>
              )}
              {uploadProgress === 100 && <SuccessIcon color="success" />}
            </Box>

            {/* Upload Progress */}
            {uploadProgress !== undefined && uploadProgress < 100 && (
              <Box sx={{ mt: 2 }}>
                <LinearProgress variant="determinate" value={uploadProgress} />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  กำลังอัปโหลด... {uploadProgress}%
                </Typography>
              </Box>
            )}
          </Box>
        ) : (
          /* Upload Prompt */
          <Box>
            <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body1" gutterBottom>
              คลิกหรือลากไฟล์มาวางที่นี่
            </Typography>
            <Typography variant="caption" color="text.secondary">
              รองรับไฟล์ {accept} (สูงสุด {formatFileSize(maxSize)})
            </Typography>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              sx={{ mt: 2 }}
              disabled={disabled}
            >
              เลือกไฟล์
            </Button>
          </Box>
        )}
      </Paper>

      {/* Helper Text / Error Message */}
      {helperText && !displayError && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {helperText}
        </Typography>
      )}

      {displayErrorMessage && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {displayErrorMessage}
        </Alert>
      )}
    </Box>
  );
};

/**
 * Validate Excel file format
 * Checks if file is valid Excel format
 */
export const isValidExcelFile = (file: File): boolean => {
  const validExtensions = ['.xlsx', '.xls'];
  const fileExtension = `.${file.name.split('.').pop()}`;
  return validExtensions.includes(fileExtension.toLowerCase());
};

/**
 * Get file extension
 */
export const getFileExtension = (filename: string): string => {
  return `.${filename.split('.').pop()}`;
};

export default FileUpload;
