require('dotenv').config();
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { password, text } = require('../utils');
(async () => { const email = text(process.env.ADMIN_EMAIL, 'ADMIN_EMAIL', 254).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid ADMIN_EMAIL.'); const pass = password(process.env.ADMIN_PASSWORD); await require('../config/db')(); await User.init(); const existing = await User.findOne({ role: 'ADMIN' }); if (existing) { console.log('An administrator already exists. No changes made.'); return; } await User.create({ name: process.env.ADMIN_NAME || 'Administrator', email, passwordHash: await bcrypt.hash(pass, 12), role: 'ADMIN' }); console.log('Administrator created.'); })().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => require('mongoose').disconnect());
