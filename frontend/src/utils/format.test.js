import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateEMI } from './format.js'
test('zero-interest repayment divides principal evenly', () => { const r = calculateEMI(1200, 0, 12); assert.equal(r.emi, 100); assert.equal(r.interest, 0); assert.equal(r.total, 1200) })
test('reducing-balance EMI and total match a known amortization case', () => { const r = calculateEMI(100000, 12, 12); assert.ok(Math.abs(r.emi - 8884.878867834168) < 0.00001); assert.ok(Math.abs(r.total - 106618.54641401002) < 0.0001); assert.ok(Math.abs(r.interest - 6618.54641401002) < 0.0001) })
test('empty or invalid calculator inputs do not produce NaN payments', () => { assert.deepEqual(calculateEMI('', 12, 0), { emi: 0, interest: 0, total: 0 }) })
