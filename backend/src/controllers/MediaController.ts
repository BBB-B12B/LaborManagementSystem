import { Request, Response } from 'express';
import { storage } from '../config/storage';
import { logger } from '../utils/logger';

export class MediaController {
  /**
   * POST /api/media/upload
   * Upload a file and return the public URL
   */
  async upload(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      const folder = (req.body.folder as string) || 'general';
      
      const fileUrl = await storage.uploadBuffer(
        req.file.buffer,
        folder,
        req.file.originalname,
        req.file.mimetype
      );

      return res.status(200).json({
        success: true,
        data: {
          url: fileUrl,
          filename: req.file.originalname,
          mimeType: req.file.mimetype
        }
      });
    } catch (error) {
      logger.error('Failed to upload media', { error });
      return res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  /**
   * POST /api/media/upload-multiple
   * Upload multiple files
   */
  async uploadMultiple(req: Request, res: Response): Promise<Response> {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ success: false, error: 'No files uploaded' });
      }

      const folder = (req.body.folder as string) || 'general';
      const uploadPromises = files.map(async (file) => {
        const fileUrl = await storage.uploadBuffer(
          file.buffer,
          folder,
          file.originalname,
          file.mimetype
        );
        return {
          url: fileUrl,
          filename: file.originalname
        };
      });

      const results = await Promise.all(uploadPromises);

      return res.status(200).json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Failed to upload multiple media', { error });
      return res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }
}

export const mediaController = new MediaController();
