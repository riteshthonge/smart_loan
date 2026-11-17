function normalizeRepoId(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim().toUpperCase().replace(/^PLAPP[ \t]+(?=\d)/, 'PLAPP');
  return /^PLAPP\d{1,59}$/.test(normalized) ? normalized : null;
}
function extractRepoId(text) {
  const values = [];
  for (const match of String(text ?? '').matchAll(/^\s*Repo[ _-]*Id\s*[:：=]\s*([^\r\n\f]*)/gim)) {
    const value = normalizeRepoId(match[1]);
    if (value) values.push(value);
  }
  const unique = [...new Set(values)];
  return unique.length === 1 ? unique[0] : null;
}
module.exports = { normalizeRepoId, extractRepoId };
