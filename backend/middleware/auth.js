const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { fail, wrap } = require('../utils');
exports.auth = wrap(async (req, res, next) => { let payload; try { payload = jwt.verify(req.cookies.session || '', process.env.JWT_SECRET, { algorithms: ['HS256'] }); } catch { fail(401, 'Please sign in to continue.'); } req.user = await User.findById(payload.sub); if (!req.user) fail(401, 'Account not found.'); next(); });
exports.role = role => (req, res, next) => { if (req.user.role !== role) return res.status(403).json({ message: 'Access denied.' }); next(); };
