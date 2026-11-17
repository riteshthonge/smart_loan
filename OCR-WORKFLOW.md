# Personal Loan OCR workflow

**Current manual/conditional workflow:** see [PERSONAL-LOAN-WORKFLOW.md](PERSONAL-LOAN-WORKFLOW.md). Salaried applicants require Aadhaar + salary (ITR optional unless admin-requested); self-employed applicants require Aadhaar + ITR. Manual data stays separate from OCR, with saved drafts, comparisons and audited exceptions. This supersedes the older always-three-category requirement.

**ITR update:** new Personal Loan applications now require Aadhaar + salary slip + ITR. See [ITR-WORKFLOW.md](ITR-WORKFLOW.md) for the current three-category flow, ITR fields, limits, privacy, tests and changed files. Older two-category instructions below describe the previous workflow.

**Aadhaar address/front-back update:** see [AADHAAR-ADDRESS.md](AADHAAR-ADDRESS.md) for the current multilingual parsing, separate-side upload, address/PIN confirmation and statuses. Its workflow supersedes the older single-file Aadhaar instructions below.

For the diagnosed process-launch failure, safe error codes, same-file retry and retesting instructions, see [OCR-FAILURE-FIX.md](OCR-FAILURE-FIX.md). The API must run in an environment that allows Node child processes and worker threads.

Personal Loan now requires **exactly one Aadhaar Card and one latest one-month salary slip**. PDF, JPG and PNG are accepted, with a 5 MB per-file limit. No PAN card, bank statement, employment certificate or optional extra file is requested for Personal Loan. The other existing loan workflows remain unchanged; OCR is enabled for Personal Loan only.

## Run

The new dependencies are installed. On a fresh checkout:

```powershell
cd D:\pbl\backend
npm install
```

Added packages: `tesseract.js`, `@tesseract.js-data/eng`, `pdf-parse`, `@napi-rs/canvas`, `pdfkit`. English Tesseract data is bundled locally. Applicant files are not sent to an OCR service or model API.

Set `DOCUMENT_ENCRYPTION_KEY` in `backend/.env` to a persistent 64-character random hex key. A key has already been generated in this workspace without changing your other environment values. For another environment, generate one with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Keep the key secret and back it up securely with the encrypted upload storage. Do not regenerate it between server restarts. Restart the backend after changing `.env` or code (`npm run dev` or `npm start`). Start the frontend with `npm run dev` in `frontend` as usual. Existing authentication, role authorization and the single-administrator policy are unchanged.

## Applicant flow

1. Select **Personal Loan** and complete the loan/personal information steps.
2. Step 3 displays only **Aadhaar Card Upload** and **Latest Month Salary Slip Upload**.
3. Each selection immediately uploads privately and shows upload progress, text processing, completion or failure. A failed attempt can be retried by choosing the file again. Neither Continue nor final submission is enabled until both documents complete OCR.
4. Inspect the extracted information. Aadhaar fields are name, date of birth, address and a read-only masked number. Salary fields are employee name/ID, employer, salary month, gross salary and net salary. Unreadable fields stay blank rather than being invented.
5. Correct fields as needed. **Continue** saves corrections separately from the original OCR output. Enter any unreadable employee name, employer, salary month and net salary before continuing. Never enter the complete Aadhaar number. The salary month must be the current or previous calendar month, evaluated using Asia/Kolkata time. This is a declared-date check, not an authenticity check.
6. Review and submit. The backend independently checks exactly two owned, completed OCR uploads with the required types. The application stores the confirmed net salary as monthly income. Draft uploads are claimed conditionally so the same documents cannot be submitted concurrently twice. Corrections lock after submission, preserving the review record.

Every document's verification status remains **NOT_VERIFIED**. OCR completion means text was extracted; it never means the document is authentic or that the applicant is eligible for credit.

## Admin flow and privacy

Open an application from the existing admin dashboard. Its details include monthly income, each document's OCR status, original extracted fields, applicant corrections and masked raw OCR text. Existing manual Under Review / Approve / Reject actions remain in place. Approval still creates no disbursement or EMI records.

Original Aadhaar and salary files are retained encrypted with AES-256-GCM using random server filenames, outside the public directory. MongoDB stores only metadata and masked OCR content, not original bytes or full Aadhaar numbers. Aadhaar masking also applies to filenames and editable structured fields before persistence and responses. Raw OCR output is masked inside the processing child before crossing back to Express; worker diagnostics are discarded rather than logged.

**Document download is a labelled, masked OCR text review PDF, not an original image or layout-preserving redaction.** This deliberate restriction prevents an original image, PDF text layer, QR code or embedded metadata from exposing an unmasked Aadhaar number. The original file is never returned by the download API, including to the admin. Original visual authenticity inspection/redaction is outside this implementation. The salary review download uses the same privacy rule because salary slips can include Aadhaar data.

Legacy Personal Loan applications remain in history. Their old unprocessed originals cannot be downloaded safely through this route, so the server refuses those downloads rather than exposing unmasked content. They are not silently reprocessed. Existing non-Personal loan uploads and review flows retain their prior behavior.

## Storage and endpoints

The Document model preserves the existing `applicant` and `application` references and exposes `applicantId`/`applicationId` aliases in OCR/detail responses. Draft documents have `applicationId: null` until submission. Added fields include `ocrStatus`, `extractedText`, `extractedFields`, `correctedFields`, `verificationStatus`, `ocrError`, `loanProduct` and `encryptedOriginal`. `originalFileName`, `storagePath`, `mimeType`, `fileSize` and `uploadedAt` remain. Storage paths and encryption flags are excluded from API responses. Legacy document-type values remain allowed for compatibility with non-Personal loans; the Personal OCR endpoint accepts only `AADHAAR` and `SALARY_SLIP`.

All routes use the existing authentication, CSRF and ownership/role checks:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/documents/ocr` | Applicant-only multipart upload: `document`, `documentType`, `loanProduct`; returns masked metadata and OCR result |
| `GET /api/documents/:id/ocr` | Owner's OCR record, or submitted record for admin |
| `PATCH /api/documents/:id/fields` | Owner-only corrections to a completed, unsubmitted draft; JSON `{ fields: {...} }` |
| `POST /api/applications` | Personal Loan: existing form fields plus JSON `documentIds: [aadhaarId, salaryId]` |
| `GET /api/documents/:id/download` | Authenticated masked review PDF for the owner or submitted-record admin |
| `GET /api/documents/:id` | Existing compatible download route, with the same privacy protections |

OCR uses PDF text extraction first and Tesseract fallback for pages without useful text. Scanned pages are rendered before OCR because Tesseract does not read PDFs directly. There is a four-page PDF limit, a 20-million-pixel image limit, a 120-second processing timeout, a two-job concurrency limit and an upload rate limit. Processing is synchronous for this version; a response lost during processing can be retried by uploading again. Failed/busy jobs are recorded as FAILED and cannot be submitted. Abandoned draft records/files are retained; production should add a retention/cleanup policy and a durable job queue if needed. Processed text is limited to 50,000 masked characters.

## Fictional test documents

```powershell
cd D:\pbl\backend
npm run demo:ocr
```

This creates five obvious fictional fixtures in `backend/demo-documents`: Aadhaar text PDF/PNG, salary text PDF/JPG and scanned Aadhaar PDF. They use the fictional name Asha Demo, Example Demo Labs and an explicitly synthetic number. The salary slip is generated for the previous calendar month. Regenerate it when testing in a later month. These are OCR fixtures, not imitations of issued identity documents.

For a manual end-to-end test, register an applicant, select Personal Loan, upload the two fictional PDFs, inspect/correct fields, submit, then open the application as admin. Download the masked review PDFs and confirm that verification remains NOT_VERIFIED. To exercise Tesseract, use the PNG/JPG or scanned PDF fixture. Try a broken PDF to see failure/retry, and a second applicant to confirm isolation.

```powershell
cd D:\pbl\backend
npm test
cd ..\frontend
npm test
npm run build
npm run lint
```

The original API regression suite now exercises the preserved Gold Loan path. New OCR tests run real text extraction and real Tesseract with a temporary MongoDB server. They cover masking variants, encrypted originals, filenames, exact document counts, file limits/types, owner isolation, failed extraction/retry, corrections, latest-month validation, concurrent submission, admin-safe review downloads and manual approval. Existing authentication and logout tests remain.

## Changed files

Modified:

- `backend/models/index.js`
- `backend/controllers/applications.js`
- `backend/app.js`
- `backend/package.json`, `backend/package-lock.json`
- `backend/.env.example`, ignored `backend/.env` (added encryption key only)
- `backend/tests/api.test.js`
- `frontend/src/pages/applicant/Apply.jsx`
- `frontend/src/pages/ApplicationDetail.jsx`
- `frontend/src/index.css`
- `README.md`, `.gitignore`

Created:

- `backend/controllers/documents.js`, `backend/routes/documents.js`
- `backend/services/documentPrivacy.js`, `extractFields.js`, `ocr.js`, `ocrWorker.js`, `personalSubmission.js`, `reviewCopy.js`
- `backend/scripts/generateOcrDemo.js`, `checkReviewCopy.js`
- `backend/tests/ocr.test.js`
- `frontend/src/components/applications/PersonalLoanDocuments.jsx`, `DocumentReview.jsx`
- `backend/demo-documents/fictional-aadhaar.pdf`, `fictional-aadhaar.png`, `fictional-latest-salary.pdf`, `fictional-latest-salary.jpg`, `fictional-scanned-aadhaar.pdf`
- `OCR-WORKFLOW.md`

Generated QA files live under ignored `tmp/pdfs`; frontend build artifacts remain under ignored `frontend/dist`. No authentication controller, middleware, seed-admin logic or role definition was changed for this update.
