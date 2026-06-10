import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
import { afterSaleApp } from './firebaseProjectB';

function parseDataUrl(dataUrl: string) {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid data URL format');
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');
  const extension = mimeType.split('/')[1] || 'bin';

  return { buffer, mimeType, extension };
}

function buildPublicUrl(bucketName: string, key: string): string {
  // Use standard Firebase Storage public URL format
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(key)}?alt=media`;
}

export const storage = {
  async uploadFile(dataUrl: string, folder: string): Promise<string> {
    const { buffer, mimeType, extension } = parseDataUrl(dataUrl);
    const sanitizedFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, '-');
    const key = `${sanitizedFolder.replace(/\/+$/g, '')}/${randomUUID()}.${extension}`;

    try {
      const bucket = afterSaleApp.storage().bucket();
      const file = bucket.file(key);

      await file.save(buffer, {
        metadata: { contentType: mimeType },
      });

      return buildPublicUrl(bucket.name, key);
    } catch (error) {
      logger.error('Failed to upload file to After-Sale Firebase Storage', { error });
      throw error;
    }
  },

  async uploadBuffer(
    buffer: Buffer,
    folder: string,
    filename: string,
    mimeType: string
  ): Promise<string> {
    const sanitizedFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, '-');
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '-');
    const key = `${sanitizedFolder.replace(/\/+$/g, '')}/${Date.now()}-${sanitizedFilename}`;

    try {
      const bucket = afterSaleApp.storage().bucket();
      const file = bucket.file(key);

      await file.save(buffer, {
        metadata: { contentType: mimeType },
      });

      return buildPublicUrl(bucket.name, key);
    } catch (error) {
      logger.error('Failed to upload buffer to After-Sale Firebase Storage', { error });
      throw error;
    }
  },
};
