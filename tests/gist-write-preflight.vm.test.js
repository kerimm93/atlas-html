const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { TextDecoder, TextEncoder } = require('node:util');

const repositoryRoot = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(repositoryRoot, 'index.html'), 'utf8');
const inlineScriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(inlineScriptMatch, 'Inline-Script in index.html nicht gefunden.');

const inlineScript = inlineScriptMatch[1];
new vm.Script(inlineScript, { filename: 'index-inline.js' });

const instrumentedScript = inlineScript.replace(
  '      init();',
  `      globalThis.__atlasGistWritePreflightTest = {
        changedGistSnapshotFeatures,
        readRemoteGistSnapshot,
        writeGistAfterPreflight,
        setConfig(nextConfig) { C = Object.assign(defaultConfig(), nextConfig || {}); }
      };`
);
assert.notEqual(instrumentedScript, inlineScript, 'Test-Hook konnte init() nicht ersetzen.');

const alerts = [];
const fetchCalls = [];
let fetchImpl = async () => { throw new Error('fetchImpl nicht gesetzt'); };
const context = {
  Blob,
  Date,
  Intl,
  JSON,
  Math,
  TextDecoder,
  TextEncoder,
  URL,
  Uint8Array,
  alert(message) { alerts.push(String(message)); },
  clearTimeout,
  confirm() { return true; },
  console,
  crypto: webcrypto,
  fetch(...args) {
    fetchCalls.push(args);
    return fetchImpl(...args);
  },
  setTimeout,
  structuredClone
};
context.globalThis = context;
vm.createContext(context);
new vm.Script(instrumentedScript, { filename: 'index-inline.vm.js' }).runInContext(context);

const api = context.__atlasGistWritePreflightTest;
api.setConfig({ gistId: 'gist-123', gistToken: 'secret-token' });

function gistResponse({
  etag = '"etag-1"',
  revision = 'revision-1',
  updatedAt = '2026-06-11T10:00:00.000Z',
  content = '{"format":"roadtrip-encrypted-v1","ciphertext":"abc","salt":"def","iv":"ghi"}'
} = {}) {
  return {
    ok: true,
    status: 200,
    headers: { get(name) { return String(name).toLowerCase() === 'etag' ? etag : ''; } },
    async json() {
      return {
        updated_at: updatedAt,
        history: [{ version: revision }],
        files: { 'roadtrip_data.json': { content } }
      };
    }
  };
}

function patchResponse() {
  return {
    ok: true,
    status: 200,
    async json() { return { files: { 'roadtrip_data.json': {} } }; }
  };
}

(async () => {
  const base = { etag: 'e', revision: 'r', updatedAt: 'u', contentFingerprint: 'f' };
  assert.deepEqual(Array.from(api.changedGistSnapshotFeatures(base, { ...base, etag: 'other' })), ['etag']);
  assert.deepEqual(Array.from(api.changedGistSnapshotFeatures(base, { ...base, revision: 'other' })), ['revision']);
  assert.deepEqual(Array.from(api.changedGistSnapshotFeatures(base, { ...base, updatedAt: 'other' })), ['updatedAt']);
  assert.deepEqual(Array.from(api.changedGistSnapshotFeatures(base, { ...base, contentFingerprint: 'other' })), ['contentFingerprint']);
  assert.deepEqual(Array.from(api.changedGistSnapshotFeatures({ ...base, etag: '' }, { ...base, etag: 'new' })), []);

  fetchCalls.length = 0;
  fetchImpl = async (url, options = {}) => {
    if (options.method === 'PATCH') return patchResponse();
    return gistResponse();
  };
  const initialSnapshot = await api.readRemoteGistSnapshot();
  const success = await api.writeGistAfterPreflight(initialSnapshot, { format: 'encrypted-test' });
  assert.equal(success.status, 'written');
  assert.equal(success.wroteRemote, true);
  assert.equal(fetchCalls.length, 3, 'Initialer GET, Write-Preflight-GET und PATCH erwartet.');
  const patchCall = fetchCalls[2];
  assert.equal(patchCall[1].method, 'PATCH');
  assert.equal(patchCall[1].headers['Content-Type'], 'application/json');
  assert.equal(patchCall[1].headers.Authorization, 'token secret-token');

  fetchCalls.length = 0;
  alerts.length = 0;
  let requestIndex = 0;
  fetchImpl = async (url, options = {}) => {
    requestIndex += 1;
    if (options.method === 'PATCH') throw new Error('PATCH darf bei Konflikt nicht aufgerufen werden');
    return gistResponse({ etag: requestIndex === 1 ? '"etag-1"' : '"etag-2"' });
  };
  const conflictInitial = await api.readRemoteGistSnapshot();
  const conflict = await api.writeGistAfterPreflight(conflictInitial, { format: 'encrypted-test' });
  assert.equal(conflict.status, 'remote-changed-during-sync');
  assert.equal(conflict.direction, 'none');
  assert.equal(conflict.wroteRemote, false);
  assert.equal(conflict.changedLocal, false);
  assert.deepEqual(Array.from(conflict.changedFeatures), ['etag']);
  assert.equal(fetchCalls.length, 2, 'Bei Remote-Änderung darf kein PATCH folgen.');
  assert.ok(alerts.at(-1).includes('Bitte Sync erneut starten'));

  fetchCalls.length = 0;
  alerts.length = 0;
  fetchImpl = async () => ({ ok: false, status: 503 });
  const failedPreflight = await api.writeGistAfterPreflight(initialSnapshot, { format: 'encrypted-test' });
  assert.equal(failedPreflight.status, 'remote-changed-during-sync');
  assert.equal(failedPreflight.reason, 'write-preflight-failed');
  assert.equal(failedPreflight.wroteRemote, false);
  assert.equal(fetchCalls.length, 1);

  const gistPushSource = inlineScript.slice(inlineScript.indexOf('      async function gistPush() {'), inlineScript.indexOf('      async function gistSync() {'));
  assert.ok(gistPushSource.indexOf('readRemoteGistSnapshot()') < gistPushSource.indexOf('writeGistAfterPreflight(initialSnapshot, envelope)'));
  assert.ok(gistPushSource.indexOf('writeGistAfterPreflight(initialSnapshot, envelope)') < gistPushSource.indexOf('_gistStatus.lastPush = syncTs'));

  const gistSyncSource = inlineScript.slice(inlineScript.indexOf('      async function gistSync() {'), inlineScript.indexOf('      async function gistPull()'));
  assert.ok(gistSyncSource.includes('writeGistAfterPreflight(initialSnapshot, envelope)'));
  assert.ok(gistSyncSource.indexOf('writeResult = await writeGistAfterPreflight(initialSnapshot, envelope)') < gistSyncSource.indexOf('_gistStatus.lastPush = syncTs'));

  console.log('Gist-Write-Preflight VM-Tests erfolgreich.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
