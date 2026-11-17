const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');
const mutate = req => req.set('Origin', 'http://localhost:5173').set('X-Requested-With', 'SmartLoan');

test('logout clears the cookie even after the login rate limit is exhausted', async () => {
  let response;
  for (let i = 0; i < 31; i++) response = await mutate(request(app).post('/api/auth/login')).send({});
  assert.equal(response.status, 429);
  const logout = await mutate(request(app).post('/api/auth/logout')).set('Cookie', 'session=expired-token');
  assert.equal(logout.status, 200);
  const cookie = logout.headers['set-cookie'][0];
  assert.match(cookie, /^session=;/);
  assert.match(cookie, /Expires=Thu, 01 Jan 1970/);
  assert.match(cookie, /HttpOnly/);
  assert.equal((await request(app).get('/api/auth/me')).status, 401);
  assert.equal((await mutate(request(app).post('/api/auth/logout'))).status, 200);
});
