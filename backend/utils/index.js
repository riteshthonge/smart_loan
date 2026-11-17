const crypto = require('crypto');
exports.fail = (status, message) => { const e = new Error(message); e.status = status; throw e; };
exports.wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
exports.text = (value, label, max = 500) => { if (typeof value !== 'string' || !value.trim() || value.trim().length > max) exports.fail(400, `${label} is required (maximum ${max} characters).`); return value.trim(); };
exports.number = (value, label, min = 0, max = 1e12) => { if (value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) exports.fail(400, `${label} must be between ${min} and ${max}.`); return Number(value); };
exports.password = value => { if (typeof value !== 'string' || value.length < 12 || value.length > 128) exports.fail(400, 'Password must contain 12–128 characters.'); return value; };
exports.applicationId = () => `SL-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
exports.personal = b => { const date = new Date(b.dateOfBirth); const age = (Date.now() - date.getTime()) / 31557600000; if (!Number.isFinite(age) || age < 18 || age > 110) exports.fail(400, 'Applicant must be 18 or older with a valid date of birth.'); const phone = exports.text(b.phone, 'Phone', 20); if (!/^[+\d ()-]{7,20}$/.test(phone)) exports.fail(400, 'Enter a valid phone number.'); return { fullName: exports.text(b.fullName, 'Full name', 100), dateOfBirth: date, phone, address: exports.text(b.address, 'Address') }; };
