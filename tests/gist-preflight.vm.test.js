const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { TextEncoder, TextDecoder } = require('node:util');

const repositoryRoot = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(repositoryRoot, 'index.html'), 'utf8');
const inlineScriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(inlineScriptMatch, 'Inline-Script in index.html nicht gefunden.');

const inlineScript = inlineScriptMatch[1];
new vm.Script(inlineScript, { filename: 'index-inline.js' });
const instrumentedScript = inlineScript
  .replace('      init();', '      // init disabled for isolated Gist preflight tests')
  .replace(
    /    \}\)\(\);\s*$/,
    `      globalThis.__atlasGistPreflightTest = {
        GIST_FILE,
        githubHeaders,
        preflightGistRemote
      };
    })();`
  );
assert.notEqual(instrumentedScript, inlineScript, 'Test-Hook konnte init() nicht ersetzen.');

const context = {
  Blob,
  Date,
  Intl,
  JSON,
  Math,
  TextDecoder,
  TextEncoder,
  URL,
  clearTimeout,
  console,
  crypto: webcrypto,
  setTimeout,
  structuredClone
};
context.globalThis = context;
vm.createContext(context);
new vm.Script(instrumentedScript, { filename: 'index-inline.vm.js' }).runInContext(context);

const api = context.__atlasGistPreflightTest;
const token = 'synthetic-secret-token';
const gistId = 'synthetic-gist-id';

function headers(values = {}) {
  const normalized = Object.fromEntries(Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]));
  return { get(name) { return normalized[String(name).toLowerCase()] || null; } };
}

function response({ status = 200, json, text = '', responseHeaders = {}, bodyReadMustFail = false }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headers(responseHeaders),
    async json() {
      if (bodyReadMustFail) throw new Error('Fehlerantwort darf nicht gelesen werden');
      if (json instanceof Error) throw json;
      return json;
    },
    async text() {
      if (bodyReadMustFail) throw new Error('Fehlerantwort darf nicht gelesen werden');
      return text;
    }
  };
}

function gistWithFile(file, overrides = {}) {
  return {
    updated_at: '2026-06-10T12:34:56Z',
    history: [{ version: 'revision-123' }],
    files: {
      decoy: { content: JSON.stringify({ unsafe: true }) },
      [api.GIST_FILE]: file
    },
    ...overrides
  };
}

async function runWithResponses(responses) {
  const calls = [];
  const queue = [...responses];
  const fetch = async (url, options) => {
    calls.push({ url, options });
    assert.ok(queue.length, 'Unerwarteter zusätzlicher Fetch-Aufruf.');
    return queue.shift();
  };
  const result = await api.preflightGistRemote({ gistId, token, fetch, crypto: webcrypto });
  assert.equal(queue.length, 0, 'Nicht alle erwarteten Fetch-Antworten wurden verwendet.');
  return { result, calls };
}

(async () => {
  for (const [status, expectedStatus, errorCode] of [
    [401, 'authentication-error', 'gist-authentication-failed'],
    [403, 'permission-or-rate-limit-error', 'gist-permission-or-rate-limit'],
    [404, 'not-found-or-inaccessible', 'gist-not-found-or-inaccessible']
  ]) {
    const { result, calls } = await runWithResponses([response({ status, bodyReadMustFail: true })]);
    assert.equal(result.ok, false);
    assert.equal(result.status, expectedStatus);
    assert.equal(result.httpStatus, status);
    assert.equal(result.errorCode, errorCode);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.method, 'GET');
    assert.equal(calls[0].options.cache, 'no-store');
    assert.equal(calls[0].options.headers.Authorization, `token ${token}`);
    assert.equal(calls[0].options.headers['Content-Type'], undefined);
    assert.equal(calls[0].options.headers['Cache-Control'], 'no-cache');
    assert.equal(calls[0].options.headers.Pragma, 'no-cache');
    assert.equal(JSON.stringify(result).includes(token), false);
  }

  const missing = await runWithResponses([response({ json: gistWithFile(null, { files: { decoy: { content: '{"unsafe":true}' } } }) })]);
  assert.equal(missing.result.errorCode, 'gist-file-missing');
  assert.equal(missing.result.remoteKind, 'none');

  const empty = await runWithResponses([response({ json: gistWithFile({ content: '   ', truncated: false }) })]);
  assert.equal(empty.result.status, 'empty-file');
  assert.equal(empty.result.errorCode, 'gist-file-empty');
  assert.equal(empty.result.remoteKind, 'inline');

  const invalid = await runWithResponses([response({ json: gistWithFile({ content: '{broken', truncated: false }) })]);
  assert.equal(invalid.result.status, 'invalid-json');
  assert.equal(invalid.result.errorCode, 'gist-file-invalid-json');

  const inlineContent = JSON.stringify({ expected: true });
  const inline = await runWithResponses([response({
    json: gistWithFile({ content: inlineContent, truncated: false }),
    responseHeaders: { ETag: '"etag-123"' }
  })]);
  assert.equal(inline.result.ok, true);
  assert.equal(inline.result.status, 'ready');
  assert.equal(inline.result.remoteKind, 'inline');
  assert.equal(inline.result.httpStatus, 200);
  assert.equal(inline.result.errorCode, '');
  assert.equal(inline.result.revision, 'revision-123');
  assert.equal(inline.result.etag, '"etag-123"');
  assert.equal(inline.result.updatedAt, '2026-06-10T12:34:56Z');
  assert.match(inline.result.contentFingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.equal(inline.result.json.expected, true);
  assert.equal(inline.result.json.unsafe, undefined);

  const rawContent = JSON.stringify({ fromRaw: true });
  const raw = await runWithResponses([
    response({ json: gistWithFile({ content: '{must-not-be-used}', truncated: true, raw_url: 'https://gist.githubusercontent.test/raw/file' }) }),
    response({ text: rawContent })
  ]);
  assert.equal(raw.result.ok, true);
  assert.equal(raw.result.remoteKind, 'raw');
  assert.equal(raw.result.json.fromRaw, true);
  assert.deepEqual(Array.from(raw.result.warnings), ['gist-file-truncated', 'gist-raw-url-resolved']);
  assert.equal(raw.calls.length, 2);
  assert.equal(raw.calls[1].options.method, 'GET');
  assert.equal(raw.calls[1].options.cache, 'no-store');
  assert.equal(raw.calls[1].options.headers.Accept, 'application/json,text/plain,*/*');
  assert.equal(raw.calls[1].options.headers.Authorization, undefined);
  assert.equal(raw.calls[1].options.headers['Content-Type'], undefined);
  assert.equal(raw.calls[1].options.headers['Cache-Control'], undefined);
  assert.equal(raw.calls[1].options.headers.Pragma, undefined);
  assert.deepEqual(Object.keys(raw.calls[1].options.headers), ['Accept']);

  const rawMissing = await runWithResponses([
    response({ json: gistWithFile({ content: inlineContent, truncated: true }) })
  ]);
  assert.equal(rawMissing.result.ok, false);
  assert.equal(rawMissing.result.status, 'raw-url-missing');
  assert.equal(rawMissing.result.errorCode, 'gist-truncated-without-raw-url');
  assert.equal(rawMissing.calls.length, 1);

  const rawFailed = await runWithResponses([
    response({ json: gistWithFile({ content: inlineContent, truncated: true, raw_url: 'https://gist.githubusercontent.test/raw/file' }) }),
    response({ status: 503, bodyReadMustFail: true })
  ]);
  assert.equal(rawFailed.result.ok, false);
  assert.equal(rawFailed.result.status, 'raw-fetch-error');
  assert.equal(rawFailed.result.remoteKind, 'raw');
  assert.equal(rawFailed.result.httpStatus, 503);
  assert.equal(rawFailed.result.errorCode, 'gist-raw-fetch-failed');
  assert.equal('json' in rawFailed.result, false);

  console.log('Gist-Preflight VM-Tests erfolgreich.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
