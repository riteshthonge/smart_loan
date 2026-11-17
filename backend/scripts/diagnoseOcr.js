// Read-only replay of failed stored uploads. Never prints document content/names.
require('dotenv').config({ quiet: true });
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { Document } = require('../models');
const { extract } = require('../services/ocr');
(async () => {
  await require('../config/db')();
  const docs = await Document.find({ ocrStatus: 'FAILED' }).sort({ uploadedAt: -1 }).limit(5);
  console.log(JSON.stringify({ failedRecordsInspected: docs.length, readOnly: true }));
  for (const d of docs) {
    if (!/^[a-f0-9-]{36}$/.test(d.storagePath)) continue;
    try {
      let buffer = await fs.readFile(path.join(require('../middleware/upload').directory, d.storagePath));
      if (d.encryptedOriginal) {
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(process.env.DOCUMENT_ENCRYPTION_KEY, 'hex'), buffer.subarray(4, 16));
        decipher.setAuthTag(buffer.subarray(16, 32)); buffer = Buffer.concat([decipher.update(buffer.subarray(32)), decipher.final()]);
      }
      try { const result = await extract(buffer, d.mimeType, d.documentType); console.log(JSON.stringify({ mimeType: d.mimeType, documentType: d.documentType, replay: 'COMPLETED', extractedCharacters: result.extractedText.length, populatedFields: Object.values(result.extractedFields).filter(v => v !== '' && v != null).length })); }
      catch (error) { console.log(JSON.stringify({ mimeType: d.mimeType, documentType: d.documentType, replay: 'FAILED', diagnostic: error.ocrDiagnostic })); }
    } catch { console.log(JSON.stringify({ replay: 'STORAGE_UNAVAILABLE', message: 'Cannot read/decrypt stored original. No data changed.' })); }
  }
})().catch(() => { console.error('Database diagnostics unavailable. Check backend MongoDB configuration.'); process.exitCode = 1; }).finally(() => require('mongoose').disconnect());
