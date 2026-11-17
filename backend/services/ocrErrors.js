// Never log parser messages/stacks verbatim: they may embed file paths or text.
const descriptions = {
  OCR_BUSY: 'OCR is busy. Retry shortly.',
  OCR_TIMEOUT: 'Text extraction timed out. Retry with a smaller or clearer file.',
  WORKER_START: 'The OCR process could not start. Check the backend runtime and dependencies.',
  WORKER_EXIT: 'The OCR process stopped unexpectedly. Check the backend OCR diagnostic log and retry.',
  DEPENDENCY_MISSING: 'An OCR dependency is missing. Run npm install in backend and restart it.',
  PDF_PASSWORD: 'This PDF is password-protected. Upload an unlocked copy.',
  PDF_INVALID: 'The PDF is damaged or is not a valid PDF. Export a new PDF and retry.',
  PDF_PAGE_LIMIT: 'PDF page limit exceeded: up to 20 pages for ITR, or 4 pages for Aadhaar/salary slips.',
  PDF_RENDER: 'The scanned PDF could not be rendered. Export it again or upload JPG/PNG pages.',
  PDF_PARSE: 'The PDF text could not be read. Export a new PDF or upload a clear JPG/PNG.',
  IMAGE_LIMIT: 'The image exceeds the 20-million-pixel limit. Resize it and retry.',
  IMAGE_DECODE: 'The image could not be decoded. Export a new JPG or PNG and retry.',
  TESSERACT_INIT: 'Tesseract could not initialize. Check the installed worker and English language data.',
  TESSERACT_RECOGNIZE: 'Image OCR failed. Retry with a clearer image.',
  NO_TEXT: 'No readable text was found. Upload a clearer scan or a PDF with selectable text.',
  OCR_FAILED: 'Text extraction failed. Check the backend OCR diagnostic log and retry.',
};
function diagnostic(error, stage = 'unknown') {
  let code = 'OCR_FAILED';
  const name = String(error?.name || ''), message = String(error?.message || '');
  if (descriptions[error?.code]) code = error.code;
  else if (error?.code === 'MODULE_NOT_FOUND' || error?.code === 'ERR_MODULE_NOT_FOUND') code = 'DEPENDENCY_MISSING';
  else if (/PasswordException/.test(name) || /password/i.test(message)) code = 'PDF_PASSWORD';
  else if (/InvalidPDFException/.test(name) || /invalid pdf|pdf structure|pdf header/i.test(message)) code = 'PDF_INVALID';
  else if (message === 'PAGE_LIMIT') code = 'PDF_PAGE_LIMIT';
  else if (message === 'IMAGE_LIMIT') code = 'IMAGE_LIMIT';
  else if (message === 'NO_TEXT') code = 'NO_TEXT';
  else code = ({ pdf_open: 'PDF_PARSE', pdf_text: 'PDF_PARSE', pdf_render: 'PDF_RENDER', image_decode: 'IMAGE_DECODE', tesseract_init: 'TESSERACT_INIT', tesseract_recognize: 'TESSERACT_RECOGNIZE' })[stage] || 'OCR_FAILED';
  const safeNames = ['Error', 'TypeError', 'RangeError', 'PasswordException', 'InvalidPDFException', 'UnknownErrorException', 'FormatError'];
  return { code, stage, errorName: safeNames.includes(name) ? name : 'Error', message: descriptions[code] };
}
function failure(code, stage, details = {}) { const e = new Error(descriptions[code] || descriptions.OCR_FAILED); e.ocrDiagnostic = { code, stage, message: e.message, ...details }; if (code === 'OCR_BUSY') e.status = 429; return e; }
module.exports = { diagnostic, failure, descriptions };
