# Personal Loan ITR upload and OCR

New Personal Loan applications require exactly **three categories**: Aadhaar, the latest one-month salary slip, and ITR. Aadhaar front/back images still form one logical Aadhaar document. Existing applications remain viewable/reviewable, and non-Personal loan workflows are unchanged. No authentication/authorization changes were made.

## Applicant workflow

1. Select Personal Loan and enter the existing loan/personal information.
2. Upload Aadhaar using the existing combined-file or front/back option. Review/correct and confirm its address/PIN.
3. Upload the latest salary slip as before.
4. Use the new required **Upload ITR Document** field. PDF, JPG and PNG are accepted, at most 5 MB. ITR PDFs support up to 20 pages; Aadhaar/salary PDFs retain their four-page limit.
5. Each category displays independent upload progress, OCR status, errors and retry. Continue/final submission remain disabled until all three complete OCR and Aadhaar address confirmation is satisfied.
6. Review/correct ITR fields. Missing textual fields are empty and missing financial amounts are `null` (shown as blank inputs). Zero remains zero. ITR fields are optional when not present in the document; no amount, year or taxpayer name is fabricated to fill gaps.
7. Submit. The backend independently checks exactly three unique, owned, completed documents with the required types. Applicant-submitted role/status fields cannot bypass this. New applications use `documentRequirementsVersion: 3` and start PENDING. OCR never approves an application or creates a disbursed loan.

## ITR extraction

The new parser supports labelled ITR-V acknowledgement text and filed ITR form text. It extracts taxpayer name, masked PAN, assessment year, financial year, form type, acknowledgement number, filing date, gross total income, total income, total tax paid and refund amount when readable.

- Text PDFs first use native PDF text extraction. Scanned pages render to images for Tesseract. JPG/PNG use the existing orientation/preprocessing pipeline and local English language data.
- Filed forms are read across all supported pages, including financial fields near the end. ITR processing has a five-minute timeout and stores up to 200,000 masked OCR characters. Other document limits remain unchanged.
- Financial labels are matched independently. `Gross Total Income` is distinct from `Total Income`. `Tax Payable` is not treated as `Tax Paid` or `Refund`. Components such as TDS/advance tax are not automatically summed into a missing total.
- Indian/Western comma grouping, INR/Rs/rupee prefixes, decimals and explicit zero are normalized numerically. Gross/total income may represent a negative loss. Malformed amounts, collapsed ambiguous columns and missing fields remain unknown for manual correction. Assessment year and financial year are not inferred from each other.
- Taxpayer-name/income values are never hardcoded. The parser is rule-based and does not claim exhaustive coverage of every ITR form version, damaged scan, column layout or handwritten annotation. The review screen handles missing/incorrect fields.

## Privacy and admin review

PAN is masked as e.g. `ABCDE****F` in raw OCR text, structured fields, correction responses, filenames and generated review copies. Aadhaar masking remains in place. A contiguous 15-digit ITR acknowledgement number is preserved as a distinct identifier; it is not incorrectly treated as a 12-digit Aadhaar number. Acknowledgement numbers are available only through authenticated, owner/admin-authorized record access, and are never printed in logs. Original uploaded files remain encrypted privately and are never served directly.

Admin application details now include all three documents, original extracted fields, applicant corrections, missing/not-readable indicators and independent OCR statuses. Monthly salary net income and ITR annual total income are shown in their respective document sections; ITR income never overwrites application monthly salary. A **Preview** button displays a labelled, masked OCR text review PDF. This is not an original-image preview or a claim of layout-preserving redaction. It preserves the existing restriction against exposing identity data from original PDF/image layers. Downloads remain available.

All documents remain `verificationStatus: NOT_VERIFIED` after OCR. Existing Under Review / Approve / Reject actions still require an explicit manual admin decision.

## Setup and fictional fixtures

No new third-party dependencies are required for this update; the existing OCR/PDF/security packages are reused. Keep the existing encryption key and MongoDB configuration. Restart the API to load the new parser/model; refresh React to load the third upload field.

```powershell
cd D:\pbl\backend
npm run demo:itr
npm test
npm start
```

Do not start a second API if port 5000 is already occupied; restart the existing process. The backend still needs permission to launch OCR child processes/worker threads. In another terminal, run React with `npm run dev` inside `frontend`.

The fixture command creates these clearly fictional files under `backend/demo-documents`:

- `fictional-itr-v.pdf`
- `fictional-filed-itr.pdf` (six pages, with financial fields on the last page)
- `fictional-scanned-itr.pdf`
- `fictional-itr.png`, `fictional-itr.jpg`
- `fictional-itr-missing-fields.pdf`

These are labelled test documents, not filed returns or government-issued records. They deliberately contain synthetic identifiers to test masking. Existing Aadhaar/salary demos are generated with `npm run demo:ocr`.

For a manual check, upload Aadhaar + salary + `fictional-itr-v.pdf`, review all three, confirm the Aadhaar address and submit. Open the application as admin and inspect the ITR section and Preview. Confirm that salary net pay and ITR income stay separate, PAN is masked and the application awaits manual review. Use the six-page form, scanned PDF and image fixtures to exercise each OCR path. The sparse fixture must show unknown amounts, not invented zeroes or tax-payable values copied into tax paid.

Frontend checks:

```powershell
cd D:\pbl\frontend
npm test
npm run build
npm run lint
```

New tests cover ITR-V and filed forms, multipage PDFs, scanned PDFs, JPG/PNG, missing fields, tax-label separation, malformed/Indian currency, explicit types, OCR failure/retry, PAN/Aadhaar masking, corrections, MongoDB persistence, applicant isolation, exact three-category submission, frontend readiness gating, admin previews and manual review. Existing Aadhaar front/back, multilingual OCR, salary, auth/admin and calculator tests remain.

Verified in this update: **53 backend tests and 6 frontend tests passed**, production build and lint passed. Seven live HTTP smoke uploads passed for existing Aadhaar/salary formats plus ITR PDF, scanned PDF and image. The check used a temporary fictional applicant and removed its test data afterward. A restricted command runtime reset the larger scanned upload; the same full check passed from an unrestricted local runtime. Run live smoke checks in a normal terminal. A masked fictional ITR review PDF was also rendered and visually inspected.

## Changed files

Created:

- `backend/services/itrFields.js`
- `backend/scripts/generateItrDemo.js`
- `backend/tests/itr-fields.test.js`, `backend/tests/itr-api.test.js`
- `frontend/src/utils/documentRequirements.js`, `documentRequirements.test.js`
- `ITR-WORKFLOW.md`
- The six fictional demo files listed above.

Modified:

- `backend/models/index.js`
- `backend/controllers/documents.js`, `backend/controllers/applications.js`
- `backend/services/extractFields.js`, `documentPrivacy.js`, `personalSubmission.js`, `ocr.js`, `ocrWorker.js`, `ocrErrors.js`, `reviewCopy.js`
- `backend/tests/ocr.test.js`, `backend/package.json` (demo script only)
- `backend/scripts/checkLiveOcr.js` (adds live ITR checks)
- `frontend/src/components/applications/PersonalLoanDocuments.jsx`, `DocumentReview.jsx`
- `frontend/src/pages/applicant/Apply.jsx`, `frontend/src/pages/ApplicationDetail.jsx`
- `frontend/src/index.css`, `frontend/package.json` (test script)
- `OCR-WORKFLOW.md`

Generated build/QA artifacts remain ignored. No `.env`, credentials, dependency lockfiles, existing authentication modules or admin decision controllers were changed for this update.
