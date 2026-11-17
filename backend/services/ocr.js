const { fork } = require('child_process');
const path = require('path');
const { failure } = require('./ocrErrors');
let active = 0;
const MAX_JOBS = 2;
exports.extract = (buffer, mimeType, documentType, options = {}) => new Promise((resolve, reject) => {
  if (active >= MAX_JOBS) return reject(failure('OCR_BUSY', 'queue'));
  active++;
  // Native PDF/canvas libraries run in a separate process, so a native decoder
  // failure cannot crash Express. Ignore diagnostics that may contain OCR text.
  let worker, timer, settled = false;
  const finish = (error, value) => { if (settled) return; settled = true; active--; clearTimeout(timer); if (worker && !worker.killed) worker.kill(); error ? reject(error) : resolve(value); };
  try {
    worker = fork(path.join(__dirname, 'ocrWorker.js'), [], { cwd: path.join(__dirname, '..'), stdio: ['ignore', 'ignore', 'ignore', 'ipc'], serialization: 'advanced', execArgv: ['--max-old-space-size=512'], windowsHide: true });
    timer = setTimeout(() => finish(failure('OCR_TIMEOUT', 'timeout')), documentType === 'ITR' ? 300000 : 120000);
    worker.on('message', result => {
      if (result.error) { const e = failure(result.error.code, result.error.stage); e.ocrDiagnostic = result.error; finish(e); }
      else finish(null, result);
    });
    worker.on('error', error => finish(failure('WORKER_START', 'process_start', { systemCode: ['EPERM', 'EACCES', 'ENOENT', 'ENOMEM'].includes(error.code) ? error.code : 'UNKNOWN' })));
    worker.on('exit', (code, signal) => { if (!settled) finish(failure('WORKER_EXIT', 'process_exit', { exitCode: code, signal: signal || null })); });
    worker.send({ buffer, mimeType, documentType, ...options }, error => { if (error) finish(failure('WORKER_START', 'ipc')); });
  } catch (error) { finish(failure('WORKER_START', 'process_start', { systemCode: ['EPERM', 'EACCES', 'ENOENT', 'ENOMEM'].includes(error.code) ? error.code : 'UNKNOWN' })); }
});
