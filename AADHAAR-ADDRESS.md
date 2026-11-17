# Aadhaar address extraction

## What was wrong

The previous parser accepted only English `Address:` followed by a colon or hyphen and flattened all following text into a single line. It had no separate PIN code/language/completeness result, did not understand Marathi/Hindi labels, and could capture unrelated footer or translation text. Image OCR initialized only `eng`. The upload route accepted a single file, so an address printed only on a separate back image never reached OCR.

## Current behavior

- `Address:`, `पत्ता:` and `पता:` start independent address blocks. Subsequent lines stay in order, including house/street/village/taluka/district/state and the PIN. Care-of prefixes (`S/O`, `C/O`, `D/O`, `W/O`) are retained; they can also begin a conservative fallback block when no label is readable.
- A six-digit nonzero-leading Indian PIN is extracted as `postalCode`. Devanagari digits normalize to ASCII. Common OCR spacing between the two three-digit PIN groups is supported.
- Identity fields, masked number lines, UIDAI/web/help footers, document headings and the next address block stop capture. English and Devanagari translation blocks remain separate. A complete English block is preferred by default; applicants can request an available Marathi or Hindi block. There is no translation or location lookup. If Hindi/Marathi cannot be distinguished reliably from the shared script, the language is `und-Deva` rather than a fabricated guess.
- Sharp applies EXIF orientation. An oriented original is always an OCR candidate. Lower-quality results also try an enlarged, grayscale, contrast-normalized, denoised/sharpened alternative; the better recognition is retained. Poor orientation results are compared with quarter-turn alternatives. This is heuristic preprocessing, not a guarantee that blurred/cropped text can be recovered.
- Aadhaar image OCR uses locally installed `eng+hin+mar` trained data. Salary slips keep English OCR. Language files are copied atomically into ignored `backend/.ocr-language-data` and loaded by language code; no document is sent to an external OCR service. Scanned PDF pages render to images. Aadhaar PDFs with a readable header but no usable native address also try rendered-page OCR, rather than assuming their address is in the text layer.
- One logical Aadhaar document can contain either one PDF/image or a front/back image pair. Both source files are encrypted privately. Name/DOB can come from the front while the complete address comes from the back. `addressSource` records `front`, `back` or `combined` where identifiable.

## Fields and statuses

The Document model retains existing fields and adds source/provenance/confirmation metadata. Aadhaar information in `extractedFields` has:

```json
{
  "name": "",
  "dateOfBirth": "",
  "address": "",
  "postalCode": "",
  "addressLanguage": "",
  "addressExtractionStatus": "PENDING"
}
```

The existing `ocrStatus: COMPLETED` remains for compatibility. Independently, `processingStatus: OCR_COMPLETED` means text recognition finished. Address status becomes:

| Status | Meaning |
| --- | --- |
| `ADDRESS_EXTRACTED` | A coherent address block and PIN were found; applicant confirmation is still required. |
| `ADDRESS_INCOMPLETE` | Some address lines were found but the block/PIN is incomplete. |
| `MANUAL_REVIEW_REQUIRED` | No usable address block was found. Address remains empty. |

These statuses are extraction indicators, not proof of correctness, authenticity or loan eligibility. `verificationStatus` remains `NOT_VERIFIED`. OCR cannot invent an unreadable street, district, state or PIN. Incomplete/missing results ask the applicant to upload the back/clearer copy or enter corrections manually.

## Applicant and admin workflow

1. Select Personal Loan and proceed to document uploads.
2. For Aadhaar choose **One PDF (front + back) or one image**, or **Separate front and back images**. Each file may be at most 5 MB. Separate sides must be JPG/PNG; PDFs can contain both sides in one file (maximum four pages).
3. For separate images choose the front and back, then click **Upload and process both sides**. Optional language preference selects the preferred available address block; it does not translate text.
4. After OCR, inspect the multiline address, PIN, language and extraction status. Correct the full address and PIN if needed. Check the address confirmation box. Editing a field clears confirmation, so it must be checked again.
5. Continue saves corrections separately from original OCR output. The backend requires a confirmed address with a PIN for new Aadhaar uploads before application submission. The loan review snapshot uses that confirmed address/PIN. A historical upload without the new confirmation requirement remains compatible.
6. Admin details display original extracted fields, corrections, source and confirmation state. Existing manual loan decisions, authentication and ownership checks are unchanged.

Aadhaar numbers are masked before OCR text/structured fields leave the extraction child or enter MongoDB/API responses. Original images/PDFs remain encrypted and are never downloaded directly. Masked text review downloads continue to be used; image/QR redaction is not claimed. Intermediate preprocessing images stay in memory. Existing stored documents are not silently rewritten; retry/upload them to apply the new extraction logic.

## Safe debugging

Optional backend `.env`:

```dotenv
OCR_DEBUG_ADDRESS=true
```

Restart the API to apply this flag. The `[Aadhaar address structure]` log contains only candidate counts, normalized line indexes, selected-line character counts, whether a PIN was found, language, source side and extraction status. It does **not** print recognized line contents, names, the PIN, Aadhaar numbers, filenames or original images. The same structural metadata is stored as `addressDebug` for diagnosis. Turn the flag off when no longer needed. Existing safe OCR error diagnostics remain available.

## Setup and retest

New dependencies are installed: `sharp`, `@tesseract.js-data/hin`, `@tesseract.js-data/mar`. A fresh checkout needs `npm install` in `backend`. Keep the existing encryption key. The backend runtime must still permit OCR child processes and worker threads.

```powershell
cd D:\pbl\backend
npm install
npm test
npm start
```

In another terminal run the frontend as usual on port 5173. If port 5000 already has the API, restart that process instead of starting a second server.

Test one readable two-sided PDF, separate front/back images and an image with a Marathi or Hindi address. Check order, PIN, source and confirmation. Also try the front alone: if it has no readable address, the UI must request the back/manual correction rather than fabricate it. Check that another applicant cannot read these files or their extracted information.

Automated tests include single-line/multiline English, Marathi, Hindi, all four care-of prefixes, PIN on the final line, bilingual separation, missing/partial addresses, safe diagnostics, separate front/back HTTP uploads, a two-page PDF, a 180-degree scan, real multilingual image OCR, confirmation validation and all existing regression tests. Fixtures are fictional. The Devanagari image tests use a system font capable of rendering the script (Nirmala UI on this Windows workspace; install an equivalent on other test hosts).

## Files changed

Created:

- `backend/services/aadhaarAddress.js`
- `backend/services/imagePreprocessing.js`
- `backend/tests/aadhaar-address.test.js`
- `AADHAAR-ADDRESS.md`

Modified:

- `backend/services/extractFields.js`, `backend/services/ocr.js`, `backend/services/ocrWorker.js`
- `backend/controllers/documents.js`, `backend/routes/documents.js`
- `backend/models/index.js`, `backend/services/personalSubmission.js`
- `backend/package.json`, `backend/package-lock.json`, `backend/.gitignore`, `backend/.env.example`
- `backend/scripts/generateOcrDemo.js`, `backend/tests/ocr.test.js`
- `frontend/src/components/applications/PersonalLoanDocuments.jsx`, `DocumentReview.jsx`
- `frontend/src/pages/applicant/Apply.jsx`, `frontend/src/index.css`
- `OCR-WORKFLOW.md`

No ML, automatic approval, document forgery detection or authentication changes were added.
