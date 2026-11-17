import { useState } from "react";
import { ShieldCheck, UserRound } from "lucide-react";
import api, { errorMessage } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Field, LoadState, useApi, useToast } from "../../components/common/UI";
export default function Profile() {
  const result = useApi("/applicant/profile"),
    { setUser } = useAuth(),
    toast = useToast(),
    [busy, setBusy] = useState(false);
  async function save(e, password = false) {
    e.preventDefault();
    const el = e.currentTarget;
    setBusy(true);
    try {
      const r = await api.patch(
        password ? "/auth/password" : "/applicant/profile",
        Object.fromEntries(new FormData(el)),
      );
      if (!password) setUser(r.data);
      else el.reset();
      toast(password ? "Password updated." : "Profile updated.");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }
  if (result.loading || result.error)
    return <LoadState {...result} retry={result.refresh} />;
  const data = result.data;
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">YOUR PERSONAL SPACE</span>
          <h1>My profile</h1>
          <p>Keep your information current and your account secure.</p>
        </div>
      </div>
      <div className="profile-grid">
        <form className="panel" onSubmit={save}>
          <div className="panel-heading">
            <h2>
              <UserRound size={20} />
              Personal information
            </h2>
          </div>
          <div className="form-body form-grid">
            <Field
              label="Full name"
              name="name"
              defaultValue={data.name}
              required
              maxLength={100}
            />
            <Field
              label="Email address"
              type="email"
              value={data.email}
              disabled
            />
            <Field
              label="Phone number"
              name="phone"
              defaultValue={data.phone}
              type="tel"
              pattern="[+0-9 ()-]{7,20}"
              required
            />
            <Field
              label="Date of birth"
              name="dateOfBirth"
              type="date"
              defaultValue={data.dateOfBirth?.slice(0, 10)}
            />
            <div className="full-span">
              <Field
                label="Address"
                name="address"
                defaultValue={data.address}
                required
                maxLength={500}
              />
            </div>
          </div>
          <div className="form-actions">
            <span className="field-hint">
              Email and role are managed securely.
            </span>
            <button className="btn primary" disabled={busy}>
              Save changes
            </button>
          </div>
        </form>
        <form className="panel" onSubmit={(e) => save(e, true)}>
          <div className="panel-heading">
            <h2>
              <ShieldCheck size={20} />
              Password & security
            </h2>
          </div>
          <div className="form-body">
            <Field
              label="Current password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
            <Field
              label="New password"
              name="newPassword"
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />
            <p className="field-hint">
              Use a unique password of at least 12 characters.
            </p>
            <button className="btn secondary" disabled={busy}>
              Update password
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
