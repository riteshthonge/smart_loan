const { User, Notification, Loan, EMIPayment } = require('../models');
const { text, fail } = require('../utils');
exports.dashboard = async (req, res) => res.json(await require('../services/statistics')(req.user));
exports.profile = async (req, res) => res.json(req.user);
exports.updateProfile = async (req, res) => { const data = {}; for (const k of ['name', 'phone', 'address']) if (req.body[k] !== undefined) data[k] = text(req.body[k], k, k === 'address' ? 500 : 100); if (data.phone && !/^[+\d ()-]{7,20}$/.test(data.phone)) fail(400, 'Enter a valid phone number.'); if (req.body.dateOfBirth) { const d = new Date(req.body.dateOfBirth); if (!Number.isFinite(d.getTime()) || d > new Date()) fail(400, 'Invalid date of birth.'); data.dateOfBirth = d; } res.json(await User.findByIdAndUpdate(req.user._id, data, { returnDocument: 'after', runValidators: true })); };
exports.notifications = async (req, res) => res.json(await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(200));
exports.read = async (req, res) => { const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { isRead: true }, { returnDocument: 'after' }); if (!n) fail(404, 'Notification not found.'); res.json(n); };
exports.loans = async (req, res) => res.json(await Loan.find({ applicant: req.user._id }).populate('application'));
exports.schedule = async (req, res) => { const loan = await Loan.findOne({ _id: req.params.id, applicant: req.user._id }); if (!loan) fail(404, 'Loan not found.'); res.json(await EMIPayment.find({ loan: loan._id }).sort({ dueDate: 1 })); };
