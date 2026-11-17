import PersonalLoanApplication from './PersonalLoanApplication'
import PersonalLoanDocuments, { ocrReady, personalDocumentTypes } from '../../components/applications/PersonalLoanDocuments';
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileUp,
  ShieldCheck,
} from "lucide-react";
import api, { errorMessage } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Field, LoadState, useApi, useToast } from "../../components/common/UI";
import { calculateEMI, money } from "../../utils/format";
const steps = [
  "Choose your loan",
  "Your information",
  "Upload documents",
  "Review & submit",
];
export default function Apply() {
  const { user } = useAuth(),
    toast = useToast(),
    navigate = useNavigate(),
    [params] = useSearchParams(),
    products = useApi("/loan-products");
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [files, setFiles] = useState({});
  const [form, setForm] = useState({
    loanProduct: params.get("product") || "",
    requestedAmount: "",
    tenure: "",
    fullName: user.name,
    phone: user.phone || "",
    address: user.address || "",
    dateOfBirth: user.dateOfBirth?.slice(0, 10) || "",
    employmentType: "SALARIED",
    employerName: "",
    monthlyIncome: "",
    existingLiabilities: "0",
  });
  const product = products.data?.find((p) => p._id === form.loanProduct),
    update = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const isPersonal = product?.name === 'Personal Loan';
  const [ocrDocuments, setOcrDocuments] = useState({});
  const docs = isPersonal ? personalDocumentTypes : [
    ["SALARY_SLIP", "Salary slip / income proof"],
    ["IDENTITY", "Identity document"],
    ...(["Gold Loan", "Property Loan"].includes(product?.name)
      ? [["COLLATERAL", "Collateral ownership document"]]
      : product?.name === "Business Loan"
        ? [["BUSINESS_PROOF", "Business registration document"]]
        : []),
    ["OTHER", "Additional document (optional)"],
  ];
  async function next(e) {
    e.preventDefault();
    if (isPersonal && step >= 2 && !ocrReady(ocrDocuments)) { toast('Upload all three required documents and wait for successful text extraction.', 'error'); return; }
    if (isPersonal && step === 2) {
      setBusy(true);
      try {
        const saved = {};
        for (const type of ['AADHAAR', 'SALARY_SLIP', 'ITR']) {
          const d = ocrDocuments[type];
          const fields = { ...d.editedFields }; delete fields.maskedAadhaarNumber;delete fields.repoId; delete fields.addressExtractionStatus;
          const response = await api.patch('/documents/' + d._id + '/fields', { fields, addressConfirmed: type === 'AADHAAR' ? d.addressConfirmed : undefined });
          saved[type] = { ...response.data, uiStatus: 'ready', editedFields: { ...response.data.extractedFields, ...response.data.correctedFields } };
        }
        setOcrDocuments(saved);

      } catch (err) { toast(errorMessage(err), 'error'); return; }
      finally { setBusy(false); }
    }
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    setBusy(true);
    try {
      if (isPersonal) {
        const response = await api.post('/applications', { ...form, documentIds: ['AADHAAR', 'SALARY_SLIP', 'ITR'].map(type => ocrDocuments[type]._id) });
        toast('Application ' + response.data.applicationId + ' submitted. Documents await manual review.');
        navigate('/applicant/history/' + response.data._id);
        return;
      }
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, v));
      const entries = docs.filter(([key]) => files[key]);
      body.append("documentTypes", JSON.stringify(entries.map(([key]) => key)));
      entries.forEach(([key]) => body.append("documents", files[key]));
      const r = await api.post("/applications", body);
      toast(`Application ${r.data.applicationId} submitted.`);
      navigate(`/applicant/history/${r.data._id}`);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }
  if (isPersonal) return <PersonalLoanApplication key={product._id} product={product} onChangeProduct={() => setForm(previous => ({...previous,loanProduct:''}))}/>;
  if (products.loading || products.error)
    return <LoadState {...products} retry={products.refresh} />;
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">MAKE YOUR NEXT MOVE</span>
          <h1>Let’s make it possible.</h1>
          <p>A few details today. A new possibility tomorrow.</p>
        </div>
      </div>
      <div className="stepper">
        {steps.map((s, i) => (
          <div
            key={s}
            className={i === step ? "active" : i < step ? "done" : ""}
          >
            <span>{i < step ? <Check size={17} /> : `0${i + 1}`}</span>
            <strong>{s}</strong>
          </div>
        ))}
      </div>
      <div className="form-layout">
        <form className="panel application-form" onSubmit={next}>
          <div className="panel-heading">
            <div>
              <span className="eyebrow">STEP {step + 1} OF 4</span>
              <h2>{steps[step]}</h2>
              <p>
                Clear information helps our team make a considered decision.
              </p>
            </div>
          </div>
          <div className="form-body">
            {step === 0 && (
              <>
                <Field label="Loan product">
                  <select
                    name="loanProduct"
                    required
                    value={form.loanProduct}
                    onChange={(e) => {
                      setForm({
                        ...form,
                        loanProduct: e.target.value,
                        requestedAmount: "",
                        tenure: "",
                      });
                      setFiles({}); setOcrDocuments({});
                    }}
                  >
                    <option value="">Select a loan product</option>
                    {products.data.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} · {p.interestRate}% p.a.
                      </option>
                    ))}
                  </select>
                </Field>
                {!products.data.length && (
                  <p className="error-box">
                    No products available. Please contact the administrator.
                  </p>
                )}
                {product && (
                  <>
                    <div className="form-grid">
                      <Field
                        label="Requested amount (₹)"
                        name="requestedAmount"
                        type="number"
                        min={product.minAmount}
                        max={product.maxAmount}
                        step="1"
                        value={form.requestedAmount}
                        onChange={update}
                        required
                      />
                      <Field
                        label="Repayment tenure (months)"
                        name="tenure"
                        type="number"
                        min={product.minTenure}
                        max={product.maxTenure}
                        step="1"
                        value={form.tenure}
                        onChange={update}
                        required
                      />
                    </div>
                    <p className="field-hint">
                      {money(product.minAmount)}–{money(product.maxAmount)} ·{" "}
                      {product.minTenure}–{product.maxTenure} months.
                    </p>
                    <div className="info-strip">
                      <ShieldCheck size={19} />
                      {product.eligibility}
                    </div>
                  </>
                )}
              </>
            )}
            {step === 1 && (
              <div className="form-grid">
                {[
                  ["fullName", "Full name", "text"],
                  ["dateOfBirth", "Date of birth", "date"],
                  ["phone", "Phone number", "tel"],
                  ["address", "Residential address", "text"],
                  ["employerName", "Employer / business name", "text"],
                  ["monthlyIncome", "Monthly income (₹)", "number"],
                  [
                    "existingLiabilities",
                    "Existing monthly liabilities (₹)",
                    "number",
                  ],
                ].map(([key, label, type]) => (
                  <Field
                    key={key}
                    label={label}
                    name={key}
                    type={type}
                    value={form[key]}
                    onChange={update}
                    required
                    min={
                      type === "number"
                        ? key === "monthlyIncome"
                          ? 1
                          : 0
                        : undefined
                    }
                    max={
                      type === "date"
                        ? new Date(
                            new Date().setFullYear(
                              new Date().getFullYear() - 18,
                            ),
                          )
                            .toISOString()
                            .slice(0, 10)
                        : undefined
                    }
                    maxLength={key === "address" ? 500 : 150}
                  />
                ))}
                <Field label="Employment type">
                  <select
                    name="employmentType"
                    value={form.employmentType}
                    onChange={update}
                  >
                    <option value="SALARIED">Salaried</option>
                    <option value="SELF_EMPLOYED">Self employed</option>
                    <option value="BUSINESS_OWNER">Business owner</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>
              </div>
            )}
            {step === 2 && isPersonal && <PersonalLoanDocuments loanProduct={product._id} documents={ocrDocuments} onChange={(type, value) => setOcrDocuments(previous => ({ ...previous, [type]: value }))}/>}
            {step === 2 && !isPersonal && (
              <div className="upload-list">
                {docs.map(([key, label]) => (
                  <label className="upload-zone" key={key}>
                    <FileUp size={25} />
                    <div>
                      <strong>{label}</strong>
                      <small>
                        {files[key]?.name || "PDF, JPG or PNG · Maximum 5 MB"}
                      </small>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        required={key !== "OTHER" && !files[key]}
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file && file.size > 5 * 1024 * 1024) {
                            e.target.value = "";
                            toast("Maximum file size is 5 MB.", "error");
                            return;
                          }
                          setFiles({ ...files, [key]: file });
                        }}
                      />
                    </div>
                    {files[key] && <Check size={20} />}
                  </label>
                ))}
              </div>
            )}
            {step === 3 && (
              <>
                <h3>Your application, at a glance.</h3>
                <dl className="detail-grid">
                  {Object.entries({
                    ...form,
                    loanProduct: product?.name,
                    requestedAmount: money(form.requestedAmount),
                    monthlyIncome: money(form.monthlyIncome),
                    existingLiabilities: money(form.existingLiabilities),
                  }).map(([k, v]) => (
                    <div key={k}>
                      <dt>{k.replace(/([A-Z])/g, " $1")}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <h3 className="subheading">Attached documents</h3>
                {docs
                  .filter(([k]) => isPersonal ? ocrDocuments[k]?.ocrStatus === "COMPLETED" : files[k])
                  .map(([k, label]) => (
                    <p className="file-review" key={k}>
                      <Check size={16} />
                      {label}: {isPersonal ? ocrDocuments[k].originalFileName + " - OCR COMPLETED / NOT VERIFIED" : files[k].name}
                    </p>
                  ))}
                <label className="check-label">
                  <input type="checkbox" required />
                  <span>
                    I confirm these details are accurate and consent to manual
                    review of my application and documents.
                  </span>
                </label>
              </>
            )}
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn secondary"
              disabled={step === 0 || busy}
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <button
              className="btn primary"
              disabled={busy || !products.data.length || (isPersonal && step >= 2 && !ocrReady(ocrDocuments))}
            >
              {busy
                ? "Submitting…"
                : step === 3
                  ? "Submit application"
                  : "Continue"}
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
        <aside className="application-aside">
          <div className="panel estimate-card">
            <span className="stat-icon tone-0">
              <ShieldCheck size={23} />
            </span>
            <h3>A clear picture.</h3>
            <p>Your estimated monthly repayment</p>
            <strong>
              {product && form.requestedAmount && form.tenure
                ? money(
                    calculateEMI(
                      form.requestedAmount,
                      product.interestRate,
                      form.tenure,
                    ).emi,
                  )
                : "—"}
            </strong>
            <span className="field-hint">per month</span>
            <hr />
            <dl>
              <div>
                <dt>Annual interest</dt>
                <dd>{product ? `${product.interestRate}%` : "—"}</dd>
              </div>
              <div>
                <dt>Processing fee</dt>
                <dd>{product ? `${product.processingFee}%` : "—"}</dd>
              </div>
            </dl>
            <small>
              Indicative estimate. Fees excluded. Final terms are subject to
              review and approval.
            </small>
          </div>
          <div className="aside-note">
            <ShieldCheck size={20} />
            <p>
              Your documents are private and accessible only to you and the
              administrator.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
