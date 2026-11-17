const r = require('express').Router(); const { wrap } = require('../utils'); r.get('/', wrap(require('../controllers/products').list)); module.exports = r;
