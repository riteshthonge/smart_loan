const r = require('express').Router(); const c = require('../controllers/applicant'); const { wrap } = require('../utils');
const personal=require('../controllers/personalLoan');
r.get('/personal-loan/policy',wrap(personal.policy));r.get('/personal-loan/draft',wrap(personal.getDraft));r.put('/personal-loan/draft',wrap(personal.saveDraft));r.patch('/personal-loan/draft/documents',wrap(personal.saveDocuments));
r.get('/dashboard', wrap(c.dashboard)); r.get('/profile', wrap(c.profile)); r.patch('/profile', wrap(c.updateProfile)); module.exports = r;
