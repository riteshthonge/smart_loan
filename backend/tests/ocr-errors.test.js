const { test } = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const { diagnostic } = require('../services/ocrErrors');
test('process-start EPERM is reported and failed starts never leak OCR capacity', async () => {
  const original = childProcess.fork;
  childProcess.fork = () => { const error = new Error('blocked'); error.code = 'EPERM'; throw error; };
  delete require.cache[require.resolve('../services/ocr')];
  try {
    const { extract } = require('../services/ocr');
    for (let i = 0; i < 4; i++) await assert.rejects(extract(Buffer.from('test'), 'application/pdf', 'AADHAAR'), error => {
      assert.equal(error.ocrDiagnostic.code, 'WORKER_START');
      assert.equal(error.ocrDiagnostic.systemCode, 'EPERM');
      return true;
    });
  } finally { childProcess.fork = original; delete require.cache[require.resolve('../services/ocr')]; }
});
test('underlying parser errors become useful diagnostics without copying sensitive messages', () => {
  const error = new Error('Invalid PDF structure; private document number 123456789012'); error.name = 'InvalidPDFException';
  const result = diagnostic(error, 'pdf_open');
  assert.equal(result.code, 'PDF_INVALID'); assert.equal(result.errorName, 'InvalidPDFException');
  assert.ok(!JSON.stringify(result).includes('123456789012')); assert.ok(!JSON.stringify(result).includes('private document'));
  assert.equal(diagnostic(Object.assign(new Error('secret'), { name: 'PasswordException' }), 'pdf_open').code, 'PDF_PASSWORD');
  assert.equal(diagnostic(new Error('NO_TEXT'), 'text_validation').code, 'NO_TEXT');
});
