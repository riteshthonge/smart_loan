# Personal Loan manual information and conditional documents

This update supersedes the earlier always-three-document Personal Loan flow. It preserves existing authentication, other loan products, OCR, private storage, masking, previews and manual admin decisions.

## Applicant navigation

Select Personal Loan to open:

**Your Information → Save & Continue → Upload Documents → Review & Submit**

Your Information has four sections:

| Section | Fields |
| --- | --- |
| Personal Details | Full name, date of birth |
| Employment Details | Salaried/Self-employed, employer/business name, designation/occupation, duration in whole months |
| Financial Details | Monthly gross income, net income, deductions, existing EMIs, other monthly liabilities, optional additional income, optional credit score, previous loan defaults Yes/No |
| Loan Details | Loan purpose, requested amount, preferred tenure |

Required fields have no fabricated/default financial values. Explicit zero is accepted for liabilities/EMIs. All income/deduction values must be non-negative; net income and deductions cannot exceed gross income. No algebraic value is inferred for an omitted field. Credit score is optional but must be a whole number from 300–900 when supplied. Employment duration is a non-negative whole number of months. Amount/tenure use the current product limits. Backend validation is authoritative; frontend form and validation checks provide immediate feedback.

Save & Continue writes the manual fields to a private MongoDB draft. Back/forward navigation keeps React state. Returning after refresh restores the saved draft and saved document selections. Manual changes made after going Back must be saved again with Save & Continue. Document selections are saved after upload changes; draft-save errors appear in the UI. Drafts do not inflate application/dashboard counts.

## Conditional document requirements

| Employment | Aadhaar | Latest one-month salary | ITR |
| --- | --- | --- | --- |
| Salaried | Required | Required | Optional, unless explicitly requested by admin |
| Self-employed | Required | Not required/shown | Required |

Aadhaar retains combined PDF/image and separate front/back image support. PDF/JPG/PNG, file-size validation, multilingual Aadhaar OCR, preprocessing, retry, corrected fields and address/PIN confirmation remain in place. The salary parser now extracts a labelled deductions value when present, and leaves it null when absent; it never calculates an absent deduction from gross minus net. ITR retains its separate annual financial fields and multipage support.

Every new OCR document requires applicant review/confirmation. Corrections are stored separately from original `extractedFields`. Required documents must complete OCR and be confirmed before submission, unless an actual admin-authorized exception exists for that applicant/category. Salary month must be current/previous month when supplied for the salaried workflow, unless explicitly excepted for manual review.

Optional uploads that failed or were not confirmed are excluded from submission, with that rule explained on the Review screen. Uploads still in progress block final submission until they finish. Self-employed submissions do not link an old salary upload from a previous employment selection.

## Manual data is never replaced by OCR

The final LoanApplication contains a typed **manualApplicationData** snapshot with every manual field. Document stores **extractedFields**, **correctedFields**, **extractedText**, **ocrStatus** and **verificationStatus**, linked to applicant/application. These records remain distinct.

Existing compatibility application fields derive only from manual inputs:

- `monthlyIncome` = manual monthly net income, not salary OCR/ITR income.
- `existingLiabilities` = manual existing EMIs + manual other monthly liabilities.
- Requested amount, tenure, name, DOB and employer derive from manual information.
- Aadhaar address confirmation stays in the Document record; it does not replace manual application data.

ITR annual income is not substituted for monthly income or automatically annualized for comparison. New applications use document-requirements version 4. Existing records are not rewritten or populated with invented manual snapshots.

## Admin controls and comparison

Open **Applicants → View details** to configure Personal Loan requirements before submission, or open a Personal Loan application to manage them during review.

- Require/remove an explicit ITR request for a salaried applicant.
- Grant/revoke a category-specific manual-review exception.
- Supply a mandatory reason and confirm the action.

These are admin-only APIs. The reason, actor and time are recorded in the policy/audit trail. Exceptions apply to that applicant's pending/future Personal Loans until revoked, as stated in the UI. Applicants cannot authorize their own exceptions using body fields or profile updates. At submission, used exceptions are copied into the application with their reason/grant metadata.

Admin application details show the full manual snapshot, document/OCR/correction records, missing-document warnings and a consistency table. Applicable rows display **MATCH**, **MISMATCH** or **NOT_AVAILABLE** for original OCR and, separately, applicant corrections. A genuine zero is not treated as missing. String comparisons normalize case/spacing; they are not fuzzy matching, identity verification or forgery detection. Monthly salary and annual ITR income remain separately labelled.

If an admin requests ITR after a salaried application was submitted, the applicant's details page offers the missing requested category. The applicant uploads, reviews/confirms and attaches it through the existing application API. Approval is blocked while a required document, OCR or confirmation is missing without an authorized exception. An exception allows **manual review**, not automatic approval. Existing approval/rejection dialogs remain, and approval still creates no disbursement/EMI records.

## APIs and persistence

All new applicant routes are protected by the existing applicant auth/role middleware:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/applicant/personal-loan/policy` | Current applicant's requirements/exceptions |
| `GET /api/applicant/personal-loan/draft?loanProduct=...` | Restore own saved manual data and own draft document selection |
| `PUT /api/applicant/personal-loan/draft` | Validate/save `{ loanProduct, manualApplicationData }` |
| `PATCH /api/applicant/personal-loan/draft/documents` | Save `{ loanProduct, documentIds }` with ownership/category checks |
| `POST /api/applications` | Submit `{ loanProduct, manualApplicationData, documentIds }`; conditional requirements rechecked server-side |
| `POST /api/applications/:id/documents` | For an open Personal Loan, attach an already OCR-processed draft using `{ documentId }` |

Admin-only routes:

- `GET /api/admin/applicants/:id/personal-loan-policy`
- `PATCH /api/admin/applicants/:id/personal-loan-policy`

Admin PATCH accepts either `{ itrRequired: true/false, reason }` or `{ exception: { documentType, enabled: true/false }, reason }`. Only Aadhaar, salary and ITR categories are supported. Current requirements are rechecked on submission; changing a policy during a submission causes retry rather than silently using stale rules.

New auxiliary models are `PersonalLoanDraft` (unique per applicant/product) and `PersonalLoanPolicy` (unique per applicant). Final manual data is stored on the existing LoanApplication model as requested. Drafts remain outside submitted-application statistics. No new roles, credentials or third-party dependencies were added.

## Test and run

```powershell
cd D:\pbl\backend
npm test
npm start
```

Restart the existing API instead of starting a second instance on port 5000. Keep MongoDB running and the existing environment/encryption key. OCR still needs a normal runtime permitted to launch child processes/worker threads.

```powershell
cd D:\pbl\frontend
npm test
npm run build
npm run lint
npm run dev
```

Automated verification: **67 backend tests passed**, covering the previous OCR/auth/admin suite plus manual field validation, persisted drafts, salaried/self-employed requirements, required-document failures, manual-vs-OCR separation, policy authorization, exceptions, supplemental ITR uploads and comparison statuses. **9 frontend tests passed**, including conditional readiness, exceptions and manual form validation. Build and lint pass. Fictional documents are used for automated OCR tests. Browser visual automation remains unavailable in this session.

Manual acceptance checks:

1. Create/save a salaried draft, including explicit zero EMIs/liabilities. Navigate Back/forward and refresh after saving; confirm values are retained.
2. Submit Aadhaar + salary without ITR. Enter a manual income different from OCR. Check the final manual snapshot remains unchanged and admin sees MISMATCH.
3. Start a self-employed draft. Confirm salary is not required/shown and Aadhaar + ITR are required. Missing ITR must prevent submission.
4. Try blank required fields, fractional duration/tenure, negative liabilities, invalid DOB and out-of-range credit scores. Both UI/API must reject invalid data.
5. As admin, request ITR for a salaried applicant; refresh requirements as applicant. Test the request before and after submission and attach the requested ITR.
6. As admin, record an exception with a reason for an unreadable/missing document. Confirm it is audited and permits manual review while the document stays FAILED/NOT_VERIFIED. Revoke it and verify it no longer authorizes new submissions.
7. Try these policy APIs or another applicant's draft/document as an applicant; access must be denied. Confirm all prior non-Personal loan flows still work.

## Files changed

Created:

- `backend/services/personalLoanRules.js`, `backend/services/personalLoanReview.js`
- `backend/controllers/personalLoan.js`, `backend/controllers/personalLoanAttachments.js`
- `backend/tests/helpers/personalFixtures.js`, `backend/tests/personal-rules.test.js`, `backend/tests/personal-workflow.test.js`
- `frontend/src/pages/applicant/PersonalLoanApplication.jsx`
- `frontend/src/components/applications/PersonalLoanInformation.jsx`, `DocumentPolicyEditor.jsx`, `PersonalLoanAdminReview.jsx`, `PersonalLoanSupplement.jsx`
- `frontend/src/utils/personalLoanValidation.js`, `personalLoanValidation.test.js`
- `PERSONAL-LOAN-WORKFLOW.md`

Modified:

- `backend/models/index.js`, `backend/services/personalSubmission.js`, `backend/services/extractFields.js`
- `backend/controllers/applications.js`, `backend/controllers/documents.js`, `backend/controllers/admin.js`
- `backend/routes/applicant.js`, `backend/routes/admin.js`
- `backend/tests/ocr.test.js`, `backend/tests/itr-api.test.js`
- `frontend/src/pages/applicant/Apply.jsx`, `frontend/src/pages/ApplicationDetail.jsx`, `frontend/src/pages/admin/Applicants.jsx`
- `frontend/src/components/applications/PersonalLoanDocuments.jsx`
- `frontend/src/utils/documentRequirements.js`, `documentRequirements.test.js`, `frontend/src/index.css`
- `OCR-WORKFLOW.md`

No package/dependency, `.env`, authentication controller/middleware or other loan-product configuration was changed.
