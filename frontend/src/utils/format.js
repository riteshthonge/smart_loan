export const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0)
export const date = value => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
export const statusText = s => s?.toLowerCase().replaceAll('_', ' ')
export function calculateEMI(principal, annualRate, months) { const p = Number(principal), n = Number(months), r = Number(annualRate) / 1200; if (!(p > 0 && n > 0) || r < 0) return { emi: 0, interest: 0, total: 0 }; const emi = r ? p * r / (1 - Math.pow(1 + r, -n)) : p / n; return { emi, interest: emi * n - p, total: emi * n } }
