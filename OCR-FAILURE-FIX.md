# OCR failure diagnosis and fix

## Exact root cause

The backend was running in a restricted execution sandbox that rejected Node's `child_process.fork()` with **EPERM**. Each OCR upload uses an isolated child process for PDF/image decoding. That child could not start, so the PDF parser and Tesseract never received the file.

This was reproduced using five existing FAILED uploads, without changing them:

- Restricted runtime: all five returned `WORKER_START`, stage `process_start`, system code `EPERM`.
- Runtime with permission to launch child processes: all five extracted text successfully.

The installed `pdf-parse` v2 API (`PDFParse`, `getText`, `getScreenshot`) was already compatible. Tesseract initialization was not the cause of these failures. The controller and worker had discarded the actual exception and replaced it with the generic “Text extraction failed or OCR is busy,” hiding the distinction between a process-launch failure, a busy queue and a bad file.

The backend has been restarted with process-launch permission. A normal local PowerShell terminal can also run it; Windows administrator privileges are not needed. If running in a restricted hosted environment, that environment must permit Node child processes and worker threads.

## Code changes

- Safe, classified diagnostics now retain the failure code/stage, parser exception class, OS process-start error code or child exit status. Backend logs omit filenames, paths, document contents, arbitrary exception messages and stacks.
- MongoDB failures include a useful `ocrError` plus `ocrErrorCode` and `ocrErrorStage`. Existing records are preserved; they are not falsely marked successful by a diagnostic replay.
- Process-start failures release the OCR concurrency slot, including synchronous spawn failures. Repeated failed starts can no longer leave all slots permanently occupied.
- Text PDFs use embedded text extraction page by page. A failed/unreadable text layer falls back to rendered-page Tesseract OCR. Short readable text no longer unnecessarily invokes Tesseract. Scanned PDFs render to images; JPG/PNG go directly through image OCR.
- The Node Tesseract worker path is explicit; English data is local. Tesseract is initialized lazily only when image OCR is needed. Parser and Tesseract cleanup runs on success/failure, and failed cleanup does not discard successfully extracted text.
- Aadhaar masking and NOT_VERIFIED status remain unchanged. Originals remain private and encrypted.
- Upload types remain explicit: the Aadhaar/identity field sends `AADHAAR`, and the salary field sends `SALARY_SLIP`. The backend validates the values. **A filename containing “identity” does not change a salary-field upload into Aadhaar**; choose the correct field. No automatic classification from filenames or content was added.
- The frontend displays backend error codes/stages and has a Retry extraction button. Choosing the same file again also works. Late progress callbacks cannot overwrite a completed result. A response with a mismatched document type is refused.

## Verification

All **22 backend tests** pass, including auth/admin regressions, real OCR, explicit type mapping with misleading filenames, masking, invalid PDF diagnostics and repeated EPERM recovery. Frontend build and lint pass.

The running API was also tested using a temporary fictional applicant with a text salary PDF, scanned Aadhaar PDF, salary JPG and Aadhaar PNG. Every response returned HTTP 201, `ocrStatus: COMPLETED`, correct explicit type, non-empty masked text and `verificationStatus: NOT_VERIFIED`. The test account and its uploads were removed afterward. No existing applicant records were changed.

## Retest

1. Refresh the frontend. If starting manually, run `npm run dev` from `backend` in a normal terminal, with MongoDB running. Avoid launching this process in an execution sandbox that blocks subprocesses. Use port 5000 for the API and 5173 for React as before.
2. Generate current fictional documents if needed: `cd backend`, then `npm run demo:ocr`.
3. Select Personal Loan. Put `fictional-aadhaar.pdf` in **Aadhaar Card Upload** and `fictional-latest-salary.pdf` in **Latest Month Salary Slip Upload**.
4. Confirm OCR completes and inspect the extracted/correctable fields. Use the scanned PDF, PNG and JPG fixtures to exercise Tesseract. Verify Aadhaar appears only as `XXXX XXXX …` in text and fields.
5. For an old FAILED attempt, upload again or press Retry extraction while its file is selected. Historical FAILED records stay FAILED; a new upload produces a new processing result. No filename-based relabeling is performed.
6. For a real failure, read the backend `[OCR extraction failed]` JSON diagnostic. `WORKER_START` with `EPERM` indicates a process permission issue; `PDF_INVALID`, `PDF_PASSWORD`, `NO_TEXT`, `OCR_BUSY` and `OCR_TIMEOUT` have distinct corrective messages.

Optional local checks:

```powershell
cd D:\pbl\backend
npm test
node scripts/diagnoseOcr.js
node scripts/checkLiveOcr.js
cd ..\frontend
npm run build
npm run lint
```

`diagnoseOcr.js` is read-only and prints no document text or filenames. It replays at most five latest failed uploads using the configured encryption key. Run it in the same environment as the API when checking runtime permissions. `checkLiveOcr.js` requires the API/MongoDB running and an active Personal Loan product; it creates and removes only its temporary fictional test data.

## Files changed

Modified:

- `backend/services/ocr.js`
- `backend/services/ocrWorker.js`
- `backend/controllers/documents.js`
- `backend/models/index.js` (additive diagnostic fields only)
- `backend/tests/ocr.test.js`
- `frontend/src/components/applications/PersonalLoanDocuments.jsx`
- `OCR-WORKFLOW.md`

Created:

- `backend/services/ocrErrors.js`
- `backend/tests/ocr-errors.test.js`
- `backend/scripts/diagnoseOcr.js`
- `backend/scripts/checkLiveOcr.js`
- `OCR-FAILURE-FIX.md`

No dependency changes, authentication changes, automatic verification, ML prediction or AI underwriting were added.
