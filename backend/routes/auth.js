const r = require('express').Router();
const c = require('../controllers/auth');
const { wrap } = require('../utils');
const { auth } = require('../middleware/auth');
const { rateLimit } = require('express-rate-limit');
// Session inspection and logout must remain available after failed login attempts.
r.use(['/register', '/login', '/password'], rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many authentication requests. Try again in 15 minutes.' } }));
r.post('/register', wrap(c.register)); r.post('/login', wrap(c.login)); r.get('/me', auth, wrap(c.me)); r.post('/logout', wrap(c.logout)); r.patch('/password', auth, wrap(c.changePassword));
module.exports = r;
