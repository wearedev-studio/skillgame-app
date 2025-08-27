import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = 'public/uploads/avatars';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + path.extname(file.originalname);
        cb(null, req.user!._id + '-' + uniqueSuffix);
    }
});

const fileFilter = (req: any, file: any, cb: any) => {
    if (file.mimetype.startsWith('image')) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type, only images allowed!'), false);
    }
};

export const upload = multer({ storage, fileFilter, limits: { fileSize: 1024 * 1024 * 10000 } });