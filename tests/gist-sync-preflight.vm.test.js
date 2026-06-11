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
  .replace('      init();', '      // init disabled for isolated Gist sync tests')
  .replace(
    /    \}\)\(\);\s*$/,
    `      globalThis.__atlasGistSyncTest = {
        GIST_FILE,
        createGistPreflightSnapshot,
        createGistSyncOutcome,
        compareGistPreflightSnapshots,
        decideGistSyncMatrix,
        preflightGistRemote,
        safePatchGistRemote,
        encryptRoadtripGistPayload,
        decryptRoadtripGistPayload,
        areStatesSyncEquivalent,
        isLocalDirtySinceLastGistSync,
        mergeRemoteStateForGistPull,
        rememberSuccessfulGistSyncFingerprint,
        gistSync,
        gistPush,
        setState(value) { S = JSON.parse(JSON.stringify(value)); ensureDefaults(); },
        getState() { return JSON.parse(JSON.stringify(S)); },
        getStatus() { return JSON.parse(JSON.stringify(_gistStatus)); },
        setConfig(value) { Object.assign(C, value); },
        setPassphrase(value) { _gistRememberPassphraseForSession = true; _gistPassphraseSession = value; },
        getSyncFingerprint() { return storageMeta.lastGistSyncFingerprint || ''; }
      };
    })();`
  );
assert.notEqual(instrumentedScript, inlineScript, 'Test-Hook konnte init() nicht ersetzen.');

const alerts = [];
const confirmations = [];
const documentStub = {
  getElementById() { return null; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  addEventListener() {},
  body: { classList: { add() {}, remove() {}, toggle() {} } },
  documentElement: { style: { setProperty() {} } }
};
const context = {
  Blob,
  Date,
  Intl,
  JSON,
  Math,
  TextDecoder,
  TextEncoder,
  URL,
  alert(message) { alerts.push(String(message)); },
  atob(value) { return Buffer.from(String(value), 'base64').toString('binary'); },
  btoa(value) { return Buffer.from(String(value), 'binary').toString('base64'); },
  confirm(message) { confirmations.push(String(message)); return true; },
  clearTimeout,
  console,
  crypto: webcrypto,
  document: documentStub,
  fetch: async () => { throw new Error('fetch not configured'); },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  setTimeout,
  structuredClone
};
context.globalThis = context;
context.window = context;
vm.createContext(context);
new vm.Script(instrumentedScript, { filename: 'index-inline.vm.js' }).runInContext(context);

const api = context.__atlasGistSyncTest;
const token = 'synthetic-secret-token';
const responseSecret = 'github-response-secret-should-never-leak';
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

function activeState(id = 'project-1', title = 'Project') {
  return {
    version: 1,
    projects: [{ id, title, createdAt: '2026-06-10T10:00:00.000Z', updatedAt: '2026-06-10T10:00:00.000Z' }],
    features: [], notes: [], materials: [], chats: [], analyses: [], importVersions: [], unmatchedNotes: [], deletedIds: {}
  };
}

function emptyState() {
  return { version: 1, projects: [], features: [], notes: [], materials: [], chats: [], analyses: [], importVersions: [], unmatchedNotes: [], deletedIds: {} };
}

function queuedFetch(responses) {
  const calls = [];
  const queue = [...responses];
  const fetch = async (url, options = {}) => {
    calls.push({ url, options });
    assert.ok(queue.length, `Unerwarteter zusätzlicher Fetch-Aufruf: ${options.method || 'GET'} ${url}`);
    return queue.shift();
  };
  return { fetch, calls, assertDone() { assert.equal(queue.length, 0, 'Nicht alle erwarteten Fetch-Antworten wurden verwendet.'); } };
}

async function preflightFromResponse(fetchResponse) {
  const queued = queuedFetch([fetchResponse]);
  const result = await api.preflightGistRemote({ gistId, token, fetch: queued.fetch, crypto: webcrypto });
  queued.assertDone();
  return result;
}

(async () => {
  assert.match(String(api.gistSync), /safePatchGistRemote/);
  assert.equal((String(api.gistSync).match(/rememberSuccessfulGistSyncFingerprint/g) || []).length, 2);
  assert.match(String(api.gistPush), /safePatchGistRemote/);
  assert.deepEqual(
    Object.keys(api.createGistSyncOutcome()).sort(),
    ['changedLocal', 'direction', 'errorCode', 'remoteKind', 'status', 'warnings', 'wroteRemote'].sort()
  );

  for (const [status, expectedStatus, errorCode] of [
    [401, 'authentication-error', 'gist-authentication-failed'],
    [403, 'permission-or-rate-limit-error', 'gist-permission-or-rate-limit'],
    [404, 'not-found-or-inaccessible', 'gist-not-found-or-inaccessible']
  ]) {
    const queued = queuedFetch([response({ status, bodyReadMustFail: true })]);
    const result = await api.preflightGistRemote({ gistId, token, fetch: queued.fetch, crypto: webcrypto });
    queued.assertDone();
    assert.equal(result.ok, false);
    assert.equal(result.status, expectedStatus);
    assert.equal(result.errorCode, errorCode);
    assert.equal(queued.calls[0].options.method, 'GET');
    assert.equal(queued.calls[0].options.cache, 'no-store');
    assert.equal(queued.calls[0].options.headers.Authorization, `token ${token}`);
    assert.equal(queued.calls[0].options.headers['Content-Type'], undefined);
    assert.equal(JSON.stringify(result).includes(token), false);
  }

  const missing = await preflightFromResponse(response({ json: gistWithFile(null, { files: { decoy: { content: '{"unsafe":true}' } } }) }));
  assert.equal(missing.errorCode, 'gist-file-missing');
  const empty = await preflightFromResponse(response({ json: gistWithFile({ content: '   ', truncated: false }) }));
  assert.equal(empty.errorCode, 'gist-file-empty');
  const invalid = await preflightFromResponse(response({ json: gistWithFile({ content: '{broken', truncated: false }) }));
  assert.equal(invalid.errorCode, 'gist-file-invalid-json');

  const inlineContent = JSON.stringify({ expected: true });
  const inlineResponse = response({ json: gistWithFile({ content: inlineContent, truncated: false }), responseHeaders: { ETag: '"etag-123"' } });
  const inline = await preflightFromResponse(inlineResponse);
  assert.equal(inline.ok, true);
  assert.equal(inline.remoteKind, 'inline');
  assert.match(inline.contentFingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.equal(inline.json.expected, true);
  assert.equal(inline.json.unsafe, undefined);

  const rawContent = JSON.stringify({ fromRaw: true });
  const rawQueue = queuedFetch([
    response({ json: gistWithFile({ content: '{must-not-be-used}', truncated: true, raw_url: 'https://gist.githubusercontent.test/raw/file' }) }),
    response({ text: rawContent })
  ]);
  const raw = await api.preflightGistRemote({ gistId, token, fetch: rawQueue.fetch, crypto: webcrypto });
  rawQueue.assertDone();
  assert.equal(raw.ok, true);
  assert.equal(raw.remoteKind, 'raw');
  assert.deepEqual(Array.from(raw.warnings), ['gist-file-truncated', 'gist-raw-url-resolved']);
  assert.equal(rawQueue.calls[1].options.headers.Authorization, undefined);

  const baseSnapshot = api.createGistPreflightSnapshot({
    ok: true, status: 'ready', remoteKind: 'inline', revision: 'r1', etag: 'e1', updatedAt: 't1', contentFingerprint: 'sha256:a'
  });
  assert.equal(api.compareGistPreflightSnapshots(baseSnapshot, { ...baseSnapshot }).changed, false);
  for (const [field, value] of [
    ['revision', 'r2'], ['etag', 'e2'], ['updatedAt', 't2'], ['contentFingerprint', 'sha256:b'], ['remoteKind', 'raw'], ['ok', false], ['status', 'network-error']
  ]) {
    const comparison = api.compareGistPreflightSnapshots(baseSnapshot, { ...baseSnapshot, [field]: value });
    assert.equal(comparison.changed, true, `${field} muss als Remote-Änderung gelten.`);
    assert.ok(Array.from(comparison.changedFields).includes(field));
  }

  assert.equal(api.decideGistSyncMatrix(emptyState(), emptyState(), empty), 'no-op-both-empty');
  assert.equal(api.decideGistSyncMatrix(activeState(), emptyState(), empty), 'initialize-remote-after-confirmation');
  assert.equal(api.decideGistSyncMatrix(emptyState(), activeState(), baseSnapshot), 'pull-only');
  assert.equal(api.decideGistSyncMatrix(activeState(), activeState(), baseSnapshot), 'no-op-identical');
  assert.equal(api.decideGistSyncMatrix(activeState('a'), activeState('b'), baseSnapshot), 'reconcile');

  const stableGet = response({ json: gistWithFile({ content: inlineContent, truncated: false }), responseHeaders: { ETag: '"etag-123"' } });
  const writeQueue = queuedFetch([stableGet, response({ status: 200, json: gistWithFile({ content: inlineContent }) })]);
  const writeOutcome = await api.safePatchGistRemote({ gistId, token, expectedSnapshot: inline, content: '{"encrypted":true}', fetch: writeQueue.fetch, crypto: webcrypto });
  writeQueue.assertDone();
  assert.equal(writeOutcome.status, 'success');
  assert.equal(writeOutcome.wroteRemote, true);
  assert.deepEqual(writeQueue.calls.map(call => call.options.method), ['GET', 'PATCH']);
  assert.equal(writeQueue.calls[1].options.headers['If-Match'], '"etag-123"');

  const conditionalConflictQueue = queuedFetch([stableGet, response({ status: 412, bodyReadMustFail: true })]);
  const conditionalConflict = await api.safePatchGistRemote({ gistId, token, expectedSnapshot: inline, content: '{"encrypted":true}', fetch: conditionalConflictQueue.fetch, crypto: webcrypto });
  conditionalConflictQueue.assertDone();
  assert.equal(conditionalConflict.status, 'conflict');
  assert.equal(conditionalConflict.errorCode, 'remote-changed-during-sync');
  assert.equal(conditionalConflict.wroteRemote, false);
  assert.equal(conditionalConflictQueue.calls[1].options.headers['If-Match'], '"etag-123"');

  const noEtagGet = response({ json: gistWithFile({ content: inlineContent, truncated: false }) });
  const noEtagSnapshot = await preflightFromResponse(noEtagGet);
  const noEtagQueue = queuedFetch([noEtagGet]);
  const noEtagOutcome = await api.safePatchGistRemote({ gistId, token, expectedSnapshot: noEtagSnapshot, content: '{"encrypted":true}', fetch: noEtagQueue.fetch, crypto: webcrypto });
  noEtagQueue.assertDone();
  assert.equal(noEtagOutcome.status, 'write-error');
  assert.equal(noEtagOutcome.errorCode, 'gist-write-precondition-unavailable');
  assert.equal(noEtagOutcome.wroteRemote, false);
  assert.deepEqual(noEtagQueue.calls.map(call => call.options.method), ['GET']);

  const changedGet = response({
    json: gistWithFile({ content: JSON.stringify({ changed: true }), truncated: false }, { history: [{ version: 'revision-999' }] }),
    responseHeaders: { ETag: '"etag-999"' }
  });
  const conflictQueue = queuedFetch([changedGet]);
  const conflictOutcome = await api.safePatchGistRemote({ gistId, token, expectedSnapshot: inline, content: '{"encrypted":true}', fetch: conflictQueue.fetch, crypto: webcrypto });
  conflictQueue.assertDone();
  assert.equal(conflictOutcome.status, 'conflict');
  assert.equal(conflictOutcome.errorCode, 'remote-changed-during-sync');
  assert.equal(conflictOutcome.wroteRemote, false);
  assert.deepEqual(conflictQueue.calls.map(call => call.options.method), ['GET']);

  const patchFailureQueue = queuedFetch([stableGet, response({ status: 500, text: responseSecret, bodyReadMustFail: true })]);
  const patchFailure = await api.safePatchGistRemote({ gistId, token, expectedSnapshot: inline, content: '{"encrypted":true}', fetch: patchFailureQueue.fetch, crypto: webcrypto });
  patchFailureQueue.assertDone();
  assert.equal(patchFailure.errorCode, 'gist-patch-failed');
  assert.equal(JSON.stringify(patchFailure).includes(responseSecret), false);
  assert.equal(JSON.stringify(patchFailure).includes(token), false);

  const passphrase = 'correct horse battery staple';
  const identicalState = activeState('identical');
  api.setConfig({ gistId, gistToken: token });
  api.setPassphrase(passphrase);
  api.setState(identicalState);
  const normalizedIdenticalState = api.getState();
  const identicalEnvelope = await api.encryptRoadtripGistPayload({ version: 1, state: normalizedIdenticalState }, passphrase);
  const identicalQueue = queuedFetch([
    response({ json: gistWithFile({ content: JSON.stringify(identicalEnvelope), truncated: false }), responseHeaders: { ETag: '"identical-etag"' } })
  ]);
  context.fetch = identicalQueue.fetch;
  const identicalOutcome = await api.gistSync();
  identicalQueue.assertDone();
  assert.equal(identicalOutcome.status, 'no-op');
  assert.equal(identicalOutcome.wroteRemote, false);
  assert.deepEqual(identicalQueue.calls.map(call => call.options.method), ['GET']);

  const encryptedPayload = await api.encryptRoadtripGistPayload({ version: 1, state: activeState('remote') }, passphrase);
  await assert.rejects(() => api.decryptRoadtripGistPayload(encryptedPayload, 'wrong passphrase'));
  const corruptedPayload = { ...encryptedPayload, ciphertext: encryptedPayload.ciphertext.slice(0, -4) + 'AAAA' };
  await assert.rejects(() => api.decryptRoadtripGistPayload(corruptedPayload, passphrase));

  const localBeforeConflict = { ...activeState('local'), _lastExported: 'old-export', _lastGistPushAt: 'old-push' };
  api.setState(localBeforeConflict);
  const initialEnvelope = await api.encryptRoadtripGistPayload({ version: 1, state: activeState('remote') }, passphrase);
  const changedEnvelope = await api.encryptRoadtripGistPayload({ version: 1, state: activeState('remote-new') }, passphrase);
  const syncConflictQueue = queuedFetch([
    response({ json: gistWithFile({ content: JSON.stringify(initialEnvelope), truncated: false }), responseHeaders: { ETag: '"sync-etag-1"' } }),
    response({ json: gistWithFile({ content: JSON.stringify(changedEnvelope), truncated: false }, { history: [{ version: 'revision-456' }] }), responseHeaders: { ETag: '"sync-etag-2"' } })
  ]);
  context.fetch = syncConflictQueue.fetch;
  const syncConflict = await api.gistSync();
  syncConflictQueue.assertDone();
  assert.equal(syncConflict.errorCode, 'remote-changed-during-sync');
  assert.equal(syncConflict.wroteRemote, false);
  assert.deepEqual(syncConflictQueue.calls.map(call => call.options.method), ['GET', 'GET']);
  const stateAfterConflict = api.getState();
  assert.equal(stateAfterConflict._lastExported, 'old-export');
  assert.equal(stateAfterConflict._lastGistPushAt, 'old-push');
  assert.equal(api.getStatus().lastPush, '');
  assert.equal(api.getSyncFingerprint(), '');
  assert.equal(JSON.stringify(api.getStatus()).includes(responseSecret), false);
  assert.equal(alerts.some(message => message.includes(responseSecret) || message.includes(token)), false);

  const firstPulledState = activeState('timestamp-free-first');
  delete firstPulledState.projects[0].createdAt;
  delete firstPulledState.projects[0].updatedAt;
  api.rememberSuccessfulGistSyncFingerprint(firstPulledState);
  assert.notEqual(api.getSyncFingerprint(), '');

  const secondPulledState = activeState('timestamp-free-second');
  delete secondPulledState.projects[0].createdAt;
  delete secondPulledState.projects[0].updatedAt;
  assert.equal(api.isLocalDirtySinceLastGistSync(firstPulledState, secondPulledState), false);
  const cleanMerge = api.mergeRemoteStateForGistPull(firstPulledState, secondPulledState, { preferRemoteWhenLocalClean: true });
  assert.equal(cleanMerge.projects[0].id, 'timestamp-free-second');

  console.log('Gist-Sync-Preflight VM-Tests erfolgreich.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
