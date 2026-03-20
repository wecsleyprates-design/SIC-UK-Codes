import { join, extname } from "path";
import multer from "multer";

const storage = multer.diskStorage({
	destination(req, file, callback) {
		switch (file.fieldname) {
			default: {
				callback(null, join(".data", "files"));
				break;
			}
		}
	},
	filename(req, file, callback) {
		callback(null, `${file.fieldname}-${Date.now()}${extname(file.originalname)}`);
	}
});

const memoryStorage = multer.memoryStorage();

export const uploadMiddleware = (fieldName, type) => {
	return multer({
		storage,
		limits: { fieldSize: 25 * 1024 * 1024 },
		fileFilter: (req, file, cb) => {
			if (file.mimetype === type || !type) {
				cb(null, true);
			} else {
				cb(null, false);
			}
		}
	}).single(fieldName);
};

export const uploadMultipleMiddleware = fieldName => {
	return multer({ storage, limits: { fieldSize: 25 * 1024 * 1024 } }).any(fieldName);
};

export const externalUploadMiddleware = (fieldName, type) => {
	return multer({
		memoryStorage,
		limits: { fieldSize: 25 * 1024 * 1024 },
		fileFilter: (req, file, cb) => {
			if (file.mimetype === type || !type) {
				cb(null, true);
			} else {
				cb(null, false);
			}
		}
	}).single(fieldName);
};

export const externalUploadMultipleMiddleware = fieldName => {
	return multer({ memoryStorage, limits: { fieldSize: 25 * 1024 * 1024 } }).any(fieldName);
};
