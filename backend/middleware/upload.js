const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const { fail } = require('../utils');
exports.directory = path.resolve(__dirname, '../uploads');
exports.upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 5, fields: 30 }, fileFilter: (req, file, cb) => cb(null, true) }).array('documents', 5);
exports.validate = files => { for (const f of files || []) { const b = f.buffer; const actual = b.subarray(0, 5).toString() === '%PDF-' ? 'application/pdf' : b[0] === 255 && b[1] === 216 && b[2] === 255 ? 'image/jpeg' : b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : null; const ext = path.extname(f.originalname).toLowerCase(); if (!actual || actual !== f.mimetype || !({ 'application/pdf': ['.pdf'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] })[actual].includes(ext)) fail(400, 'Only valid PDF, JPG and PNG files are accepted.'); } };
exports.persist = async (file, application, applicant, documentType) => { const { Document } = require('../models'); await fs.mkdir(exports.directory, { recursive: true }); const storagePath = crypto.randomUUID(); await fs.writeFile(path.join(exports.directory, storagePath), file.buffer, { flag: 'wx' }); try { return await Document.create({ application, applicant, documentType, originalFileName: path.basename(file.originalname).slice(0, 200), storagePath, mimeType: file.mimetype, fileSize: file.size }); } catch (e) { await fs.unlink(path.join(exports.directory, storagePath)); throw e; } };
