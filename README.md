# SmartLoan AI

**Personal Loan OCR is now implemented.** See [OCR-WORKFLOW.md](OCR-WORKFLOW.md) for the current Aadhaar + latest one-month salary slip flow, encrypted storage configuration, fictional demo documents, tests and the complete changed-file list. The original setup guide below still applies; its generic document instructions apply to other loan products.

A working JavaScript MERN loan management application with separate applicant and administrator portals. React runs at **http://localhost:5173** and Express at **http://localhost:5000**. All dashboard figures and application records come from MongoDB; there are no fabricated financial records.

## Quick start (PowerShell)

Use Node.js 22.12+ or Node.js 24 LTS. Dependencies have been installed in this workspace. For a fresh checkout:

```powershell
cd D:\pbl\backend
npm install
cd ..\frontend
npm install
```

New packages added: frontend `react-router-dom axios lucide-react recharts`; backend `jsonwebtoken bcryptjs multer cookie-parser express-rate-limit helmet`; backend development `supertest mongodb-memory-server`. Existing React, Vite, Tailwind v4, Express, Mongoose and nodemon configurations were retained.

### 1. Start MongoDB

Choose one option:

- **Existing local MongoDB:** start your MongoDB service on port 27017.
- **No local installation:** run the optional command below in a separate terminal. It downloads/runs an actual MongoDB binary, persists data under `backend/.mongo-data`, and must stay running. This is a development convenience, not a production database service.
- **MongoDB Atlas:** put your Atlas connection URI in `MONGO_URI`, including the database name. Configure your Atlas database user and network access. URL-encode special characters in credentials.

```powershell
cd D:\pbl\backend
npm run db:dev
```

Do not run `db:dev` if another server is already using port 27017. The first run may require internet access to download MongoDB.

### 2. Configure the environment

Ignored local `.env` files have already been created, with a randomly generated JWT secret. **No administrator password has been created or hardcoded.** Edit `backend/.env` and supply your own administrator credentials:

```dotenv
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/smartloan_ai
JWT_SECRET=<at least 32 random characters>
FRONTEND_URL=http://localhost:5173
ADMIN_NAME=Administrator
ADMIN_EMAIL=<your administrator email>
ADMIN_PASSWORD=<unique password of 12–128 characters>
```

For a fresh checkout, copy `.env.example` to `.env` in each folder and replace the placeholders. Generate a JWT secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Never commit `.env` or credentials.

`frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:5000/api
```

Use `localhost` consistently in your browser. `127.0.0.1:5173` is a different origin and will fail CSRF checks with the default settings.

### 3. Seed the administrator and products

With MongoDB running:

```powershell
cd D:\pbl\backend
npm run seed:admin
npm run seed:products
```

The administrator seed hashes the environment password and creates at most one ADMIN. Re-running it leaves the existing administrator unchanged. A unique partial database index also enforces one administrator. Public registration always creates APPLICANT accounts and ignores submitted role fields.

The product seed creates the four supported loan configurations and preserves existing settings. Its initial rates are editable development configurations, not live market quotations. It creates no users, loans or applications.

### 4. Start both applications

Terminal for the API:

```powershell
cd D:\pbl\backend
npm run dev
```

Terminal for React:

```powershell
cd D:\pbl\frontend
npm run dev
```

Open **http://localhost:5173**. Health check: **http://localhost:5000/api/health**. Production build: `cd frontend; npm run build`. Production API: `cd backend; npm start`.

## Manual acceptance checks

1. Open `/register`, create an applicant with a unique email and a password of at least 12 characters. You should land on `/applicant/dashboard` with zero applications, zero active loans and no payment due. Sign out and log back in.
2. Create another applicant in a separate browser profile. Each applicant must see only their own applications, documents, loans and notifications.
3. Choose **Apply for a loan**. Select a product and an amount/tenure within its configured limits. Enter an adult applicant's contact, employment, income and liability details.
4. Attach real PDF/JPG/PNG files, at most 5 MB each. Income and identity documents are required. Gold/property loans also require collateral documentation; business loans require business registration proof. Review, confirm and submit. A unique `SL-…` ID and PENDING status should appear.
5. Check **My applications**, status filters, details, document downloads and the submission notification. Add supporting documents while the application is open. Mark notifications read.
6. Sign in with the seeded administrator credentials. Check `/admin/dashboard`, applicant search/pagination and application filters. Open an application and download its documents.
7. Mark it **Under review** and check the applicant notification. Approve it with an amount no greater than requested, or reject a separate application with a reason. Confirm the dialog. Final decisions cannot be repeated or reversed, including concurrent requests.
8. Verify approval leaves the applicant's loan balance and EMI schedule empty: approval does **not** mean disbursement.
9. Edit a loan product as administrator. Check the new rate in the applicant portal and the EMI calculator. Change profile details and change a password using the current password.
10. Try opening `/admin/dashboard` as an applicant and try another applicant's detail/document URL. Access must be refused.

## Automated verification

```powershell
cd D:\pbl\backend
npm test
cd ..\frontend
npm test
npm run build
npm run lint
```

The API tests launch a separate, temporary real MongoDB database and clean up their own uploaded files. They never connect to the configured development database. Three calculator tests check reducing-balance EMI, zero interest and empty input. Ten integration tests cover cookie auth, CSRF, registration role enforcement, isolated empty dashboards, application validation/persistence, resource ownership, file signatures and limits, single-admin enforcement, atomic decisions, notifications, products, profile allowlists, password changes and logout.

## Architecture and files

Created backend files:

- `app.js`, `server.js`, `config/db.js`: Express setup, security, startup and MongoDB connection.
- `models/index.js`: User, LoanProduct, LoanApplication, Document, Notification, Loan and EMIPayment Mongoose models.
- `controllers/auth.js`, `applicant.js`, `admin.js`, `applications.js`, `products.js`: validation and business operations.
- `routes/auth.js`, `applicant.js`, `admin.js`, `applications.js`, `products.js`: endpoint groups.
- `middleware/auth.js`, `upload.js`: JWT/role enforcement and private upload validation/storage.
- `services/statistics.js`, `utils/index.js`: MongoDB statistics and shared validation/helpers.
- `scripts/seedAdmin.js`, `seedProducts.js`, `devDatabase.js`: idempotent seeds and optional persistent development MongoDB.
- `tests/api.test.js`, `uploads/.gitkeep`, `.env.example`, ignored `.env`, `.gitignore`.

Created frontend files:

- `src/context/AuthContext.jsx`, `src/services/api.js`, `src/routes/ProtectedRoute.jsx`, `src/utils/format.js`.
- `src/components/common/UI.jsx`, `src/components/layout/Layout.jsx`, `src/components/applications/ApplicationTable.jsx`, `src/components/dashboard/ApplicationTracker.jsx`.
- `src/pages/auth/AuthPage.jsx`, `src/pages/Dashboard.jsx`, `src/pages/Applications.jsx`, `src/pages/ApplicationDetail.jsx`.
- `src/pages/applicant/Apply.jsx`, `InterestRates.jsx`, `Profile.jsx`, `Notifications.jsx`.
- `src/pages/admin/Applicants.jsx`, `Products.jsx`.
- `src/utils/format.test.js`, `public/favicon.svg`, `.env.example`, ignored `.env`.

Modified files: `frontend/src/App.jsx`, `frontend/src/index.css`, `frontend/vite.config.js`, `frontend/index.html`, `frontend/.gitignore`, both `package.json` and `package-lock.json` files. Added root `README.md` and `.gitignore`. The existing `main.jsx` remains the React entry point. Dashboard charts load separately to reduce the initial bundle.

## API and security

All requested endpoint groups are implemented. Additional endpoints are `POST /api/auth/logout`, `PATCH /api/auth/password`, `GET /api/documents/:id` and `GET /api/health`. Authenticated API calls use an HttpOnly, SameSite=Lax JWT cookie, not localStorage. Mutations require both the configured Origin and `X-Requested-With: SmartLoan`; Axios sends the header automatically. Production cookies require HTTPS (`NODE_ENV=production` sets Secure).

Passwords are bcrypt-hashed with cost 12. Auth routes are rate-limited. Public role assignment and profile privilege changes are blocked. Every applicant resource lookup includes ownership. Uploads are outside the frontend public directory, have random server filenames, a 5 MB per-file limit, a five-file per-request limit, a ten-file per-application limit, extension/MIME/signature checks and authenticated attachment downloads. Client filenames never determine the stored path. Application decisions use conditional atomic updates to prevent duplicate or conflicting final decisions.

## Scope and limitations

- Manual lending decisions only. Personal Loan includes local OCR; there is no ML, document authenticity detection, LLM integration or automatic underwriting.
- Loan and EMI models/read APIs are ready, but a disbursement/activation workflow, payments and collections are intentionally not implemented. Approval creates neither Loan nor EMI records.
- Notifications are in-app; no email/SMS delivery. No password recovery, email verification, user deletion or administrator UI password reset.
- Uploaded files are stored on local disk. Production needs durable private storage/backups, malware scanning, HTTPS, operational monitoring and appropriate data retention. Signature checks are not malware scanning or document authenticity verification.
- JWTs expire after eight hours. Logout clears the current browser cookie; previously copied tokens are not centrally revoked. There is no refresh-token/session revocation service in this version.
- MongoDB mutations and notifications use separate writes for standalone MongoDB compatibility; there is no distributed transaction/outbox. A database failure between writes may leave a status update without its notification. Application submission cleans up application/file writes on upload persistence failure.
- Application/history search, filters and pagination currently run in the frontend over authorized records. Applicant management uses server pagination. For larger deployments, add server pagination/search for applications and notifications (currently latest 200).
- Browser automation was unavailable in the implementation session, so desktop/mobile styles were implemented but not visually inspected. Production build and API integration tests were run successfully.
- Set your own administrator credentials and run the admin seed before administrator sign-in. No development credentials or applicant sample records are included.
