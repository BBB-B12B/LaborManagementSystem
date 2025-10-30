import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import path from 'path';
import { promises as fs } from 'fs';
import { config } from './index';
import { logger } from '../utils/logger';

const {
  endpoint,
  accessKeyId,
  secretAccessKey,
  bucketName,
  publicUrl,
} = config.cloudflareR2;

const isS3Configured = Boolean(endpoint && accessKeyId && secretAccessKey && bucketName);

const s3Client = isS3Configured
  ? new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: accessKeyId as string,
        secretAccessKey: secretAccessKey as string,
      },
    })
  : null;

if (!isS3Configured) {
  logger.warn(
    'Cloudflare R2 credentials are not fully configured. Falling back to local storage for uploads.'
  );
}

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

function buildPublicUrl(key: string): string {
  if (publicUrl) {
    const trimmed = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
    return `${trimmed}/${key}`;
  }

  if (!endpoint || !bucketName) {
    return key;
  }

  try {
    const endpointUrl = new URL(endpoint);
    return `${endpointUrl.protocol}//${bucketName}.${endpointUrl.host}/${key}`;
  } catch (error) {
    logger.warn('Unable to construct Cloudflare R2 public URL. Returning object key.', { error });
    return key;
  }
}

async function saveLocally(buffer: Buffer, folder: string, extension: string): Promise<string> {
  const uploadsRoot = path.join(process.cwd(), 'uploads');
  const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, '-');
  const targetDir = path.join(uploadsRoot, safeFolder);

  await fs.mkdir(targetDir, { recursive: true });

  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  const fullPath = path.join(targetDir, filename);
  await fs.writeFile(fullPath, buffer);

  return path.join('/uploads', safeFolder, filename).replace(/\\/g, '/');
}

export const storage = {
  async uploadFile(dataUrl: string, folder: string): Promise<string> {
    const { buffer, mimeType, extension } = parseDataUrl(dataUrl);
    const sanitizedFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, '-');
    const key = `${sanitizedFolder.replace(/\/+$/g, '')}/${randomUUID()}.${extension}`;

    if (s3Client && bucketName) {
      try {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
          })
        );

        return buildPublicUrl(key);
      } catch (error) {
        logger.error(
          'Failed to upload file to Cloudflare R2. Falling back to local storage.',
          { error }
        );
      }
    }

    return saveLocally(buffer, sanitizedFolder, extension);
  },
};
