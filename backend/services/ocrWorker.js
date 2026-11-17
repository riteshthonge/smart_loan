const { maskAadhaar } = require('./documentPrivacy');
const { extractFields } = require('./extractFields');
const { parseAddress } = require('./aadhaarAddress');
const { diagnostic } = require('./ocrErrors');
const preprocessing = require('./imagePreprocessing');
let worker, stage = 'dependencies', documentType, languageHint;
process.once('disconnect', () => process.exit(0));
async function getWorker() {
  if (!worker) {
    stage = 'tesseract_init';
    const { createWorker } = require('tesseract.js'), fs = require('fs/promises'), path = require('path');
    const codes = documentType === 'AADHAAR' ? ['eng', 'hin', 'mar'] : ['eng'];
    const langPath = path.resolve(__dirname, '../.ocr-language-data');
    await fs.mkdir(langPath, { recursive: true });
    for (const code of codes) {
      const source = path.join(require(`@tesseract.js-data/${code}`).langPath, `${code}.traineddata.gz`);
      // Use language codes and local paths. Tesseract v7's Lang-object init
      // path serializes binary data as a language name and can exhaust memory.
      const target = path.join(langPath, `${code}.traineddata.gz`);
      const expected = (await fs.stat(source)).size;
      const current = await fs.stat(target).catch(() => null);
      if (!current || current.size !== expected) {
        const temporary = path.join(langPath, `${code}-${require('crypto').randomUUID()}.part`);
        try { await fs.copyFile(source, temporary); await fs.rename(temporary, target); }
        finally { await fs.unlink(temporary).catch(() => {}); }
      }
    }
    worker = await createWorker(codes.join('+'), 1, { langPath, workerPath: require.resolve('tesseract.js/src/worker-script/node/index.js'), cacheMethod: 'none', logger: () => {}, errorHandler: () => {} });
    await worker.setParameters({ preserve_interword_spaces: '1' });
  }
  return worker;
}
function score(data) {
  const fields = documentType === 'AADHAAR' ? parseAddress(data.text, languageHint).fields : null;
  return (data.confidence || 0) + Math.min((data.text.match(/\p{L}/gu) || []).length / 20, 20) + (fields?.addressExtractionStatus === 'ADDRESS_EXTRACTED' ? 100 : fields?.address ? 15 : 0);
}
async function recognize(buffer) {
  stage = 'image_decode';
  const original = await preprocessing.orient(buffer);
  const tess = await getWorker();
  stage = 'tesseract_recognize';
  const baseline = (await tess.recognize(original)).data;
  let best = baseline;
  if (baseline.confidence < 75 || documentType === 'AADHAAR' && parseAddress(baseline.text, languageHint).fields.addressExtractionStatus !== 'ADDRESS_EXTRACTED') {
    try { const enhanced = (await tess.recognize(await preprocessing.enhance(original))).data; if (score(enhanced) > score(best)) best = enhanced; } catch { /* Keep the readable original. */ }
  }
  // EXIF is handled above. For scans without orientation metadata, compare
  // quarter-turn candidates only when the original recognition is poor.
  if (baseline.confidence < 50) for (const angle of [90, 180, 270]) {
    const rotated = (await tess.recognize(await preprocessing.rotate(original, angle))).data;
    if (score(rotated) > score(best)) best = rotated;
  }
  return best.text;
}
async function extractFile(file) {
  const buffer = Buffer.from(file.buffer);
  if (file.mimeType !== 'application/pdf') return recognize(buffer);
  stage = 'pdf_open';
  const { PDFParse } = require('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer), isEvalSupported: false });
  try {
    const info = await parser.getInfo();
    if (info.total > (documentType === 'ITR' ? 20 : 4)) throw new Error('PAGE_LIMIT');
    const pages = [];
    for (let pageNumber = 1; pageNumber <= info.total; pageNumber++) {
      stage = 'pdf_text';
      let text = '';
      try { text = (await parser.getText({ partial: [pageNumber] })).pages[0]?.text || ''; } catch { /* Render unreadable text layers. */ }
      const readable = (text.match(/\p{L}/gu) || []).length >= 5;
      const missingAddress = documentType === 'AADHAAR' && parseAddress(text, languageHint).fields.addressExtractionStatus !== 'ADDRESS_EXTRACTED';
      if (!readable || missingAddress) {
        try {
          stage = 'pdf_render';
          const screenshot = await parser.getScreenshot({ partial: [pageNumber], desiredWidth: 2000 });
          const scanned = await recognize(Buffer.from(screenshot.pages[0].data));
          const addressRank = value => { const f = parseAddress(value, languageHint).fields; return f.addressExtractionStatus === 'ADDRESS_EXTRACTED' ? 2 : f.address ? 1 : 0; };
          if (!readable || addressRank(scanned) > addressRank(text)) text = scanned;
        } catch (error) { if (!readable) throw error; } // Keep usable native PDF text.
      }
      pages.push(text);
    }
    return pages.join('\n\f\n');
  } finally { await parser.destroy().catch(() => {}); }
}
process.once('message', async input => {
  let result;
  try {
    documentType = input.documentType; languageHint = input.languageHint || 'auto';
    const sources = [{ buffer: input.buffer, mimeType: input.mimeType, side: input.side || 'combined' }, ...(input.additionalFiles || [])];
    const parts = [];
    for (const file of sources) parts.push({ side: file.side, text: await extractFile(file) });
    const text = parts.map(p => p.text).join('\n\f\n');
    stage = 'text_validation';
    if ((text.match(/\p{L}/gu) || []).length < 5) throw new Error('NO_TEXT');
    const masked = maskAadhaar(text).slice(0, documentType === 'ITR' ? 200000 : 50000);
    const fields = extractFields(masked, documentType, languageHint);
    // Parse the synthetic reference before masking long digit sequences. This
    // value is a validated PLAPP identifier, never an Aadhaar-number fallback.
    if (documentType === 'AADHAAR') fields.repoId = require('./repositoryId').extractRepoId(text);
    const parsed = documentType === 'AADHAAR' ? parseAddress(masked, languageHint) : null;
    const addressSource = parsed ? parts.find(p => parseAddress(p.text, languageHint).fields.address === fields.address && fields.address)?.side || '' : '';
    result = { extractedText: masked, extractedFields: fields, processingStatus: 'OCR_COMPLETED', addressSource,
      addressDebug: parsed ? { ...parsed.debug, source: addressSource } : undefined };
  } catch (error) { result = { error: diagnostic(error, stage) }; }
  finally { if (worker) await worker.terminate().catch(() => {}); process.send(result, () => process.exit(0)); }
});
