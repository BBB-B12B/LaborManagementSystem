import { Router } from 'express';
import multer from 'multer';
import { mediaController } from '../../controllers/MediaController';
import { authenticate } from '../middleware/auth';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

router.use(authenticate);

/** Upload single file */
router.post('/upload', upload.single('file'), mediaController.upload);

/** Upload multiple files */
router.post('/upload-multiple', upload.array('files', 10), mediaController.uploadMultiple);

export default router;
