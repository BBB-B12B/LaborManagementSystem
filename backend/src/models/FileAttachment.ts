/**
 * FileAttachment Model
 * ไฟล์แนบ
 *
 * Description: File attachments for daily reports stored in Cloudflare R2.
 * Firestore Collection: fileAttachments
 */

export type FileType = 'image' | 'document' | 'pdf' | 'excel' | 'other';

export interface FileAttachment {
  id: string;
  fileName: string;
  originalFileName: string;
  fileType: FileType;
  mimeType: string;
  fileSize: number; // bytes
  r2Url: string; // Cloudflare R2 URL
  r2Key: string; // Object key in R2 bucket
  dailyReportId?: string; // Link to Daily Report
  uploadedBy: string;
  uploadedAt: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
}

export interface CreateFileAttachmentInput {
  fileName: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  r2Url: string;
  r2Key: string;
  dailyReportId?: string;
}

/**
 * ระบุประเภทไฟล์จาก MIME type
 */
export function detectFileType(mimeType: string): FileType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return 'excel';
  }
  if (mimeType.startsWith('application/')) return 'document';
  return 'other';
}

/**
 * Firestore document converter for FileAttachment
 */
export const fileAttachmentConverter = {
  toFirestore: (file: Omit<FileAttachment, 'id'>): any => {
    return {
      fileName: file.fileName,
      originalFileName: file.originalFileName,
      fileType: file.fileType,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      r2Url: file.r2Url,
      r2Key: file.r2Key,
      dailyReportId: file.dailyReportId || null,
      uploadedBy: file.uploadedBy,
      uploadedAt: file.uploadedAt,
      isDeleted: file.isDeleted,
      deletedAt: file.deletedAt || null,
      deletedBy: file.deletedBy || null,
    };
  },
  fromFirestore: (snapshot: any): FileAttachment => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      fileName: data.fileName,
      originalFileName: data.originalFileName,
      fileType: data.fileType,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      r2Url: data.r2Url,
      r2Key: data.r2Key,
      dailyReportId: data.dailyReportId,
      uploadedBy: data.uploadedBy,
      uploadedAt: data.uploadedAt.toDate(),
      isDeleted: data.isDeleted || false,
      deletedAt: data.deletedAt?.toDate(),
      deletedBy: data.deletedBy,
    };
  },
};
