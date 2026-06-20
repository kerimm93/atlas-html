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
        isSyncInProgress() { return _syncInProgress; },
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
function elementStub() {
  return {
    hidden: false,
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    dataset: {},
    addEventListener() {},
    appendChild() {},
    remove() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    setAttribute() {},
    removeAttribute() {}
  };
}
const documentStub = {
  getElementById() { return elementStub(); },
  querySelector() { return elementStub(); },
  querySelectorAll() { return []; },
  addEventListener() {},
  createElement() { return elementStub(); },
  body: { classList: { add() {}, remove() {}, toggle() {} }, appendChild() {} },
  documentElement: { style: { setProperty() {} } }
};
const localStorageStore = new Map();
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
  localStorage: {
    getItem(key) { return localStorageStore.has(String(key)) ? localStorageStore.get(String(key)) : null; },
    setItem(key, value) { localStorageStore.set(String(key), String(value)); },
    removeItem(key) { localStorageStore.delete(String(key)); }
  },
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
    const next = queue.shift();
    return typeof next === 'function' ? next(url, options, calls) : next;
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
  assert.deepEqual(
    Object.keys(api.createGistSyncOutcome()).sort(),
    ['changedLocal', 'details', 'direction', 'errorCode', 'message', 'ok', 'remoteKind', 'shouldMutateState', 'shouldPatchRemote', 'status', 'type', 'warnings', 'wroteRemote'].sort()
  );

  for (const [status, expectedStatus, errorCode] of [
    [401, 'http-401', 'gist-authentication-failed'],
    [403, 'http-403', 'gist-permission-or-rate-limit'],
    [404, 'http-404', 'gist-not-found-or-inaccessible']
  ]) {
    const queued = queuedFetch([response({ status, bodyReadMustFail: true })]);
    const result = await api.preflightGistRemote({ gistId, token, fetch: queued.fetch, crypto: webcrypto });
    queued.assertDone();
    assert.equal(result.ok, false);
    assert.equal(result.status, expectedStatus);
    assert.equal(result.errorCode, errorCode);
    assert.equal(queued.calls[0].options.method, 'GET');
    assert.equal(queued.calls[0].options.cache, undefined);
    assert.deepEqual(Object.keys(queued.calls[0].options.headers).sort(), ['Accept', 'Authorization'].sort());
    assert.equal(queued.calls[0].options.headers.Authorization, `token ${token}`);
    assert.equal(queued.calls[0].options.headers['Cache-Control'], undefined);
    assert.equal(queued.calls[0].options.headers.Pragma, undefined);
    assert.equal(queued.calls[0].options.headers['Content-Type'], undefined);
    assert.equal(JSON.stringify(result).includes(token), false);
  }

  const missing = await preflightFromResponse(response({ json: gistWithFile(null, { files: { decoy: { content: '{"unsafe":true}' } } }) }));
  assert.equal(missing.status, 'missing-file');
  assert.equal(missing.errorCode, 'gist-file-missing');
  assert.equal(missing.gistId, gistId);
  assert.equal(missing.expectedFilename, api.GIST_FILE);
  assert.equal(missing.filePresent, false);
  assert.equal(missing.json, undefined);
  const empty = await preflightFromResponse(response({ json: gistWithFile({ content: '   ', truncated: false }) }));
  assert.equal(empty.errorCode, 'gist-file-empty');
  const invalid = await preflightFromResponse(response({ json: gistWithFile({ content: '{broken', truncated: false }) }));
  assert.equal(invalid.errorCode, 'gist-file-invalid-json');

  const invalidEnvelope = await preflightFromResponse(response({ json: gistWithFile({ content: JSON.stringify({ unrelated: true }), truncated: false }) }));
  assert.equal(invalidEnvelope.status, 'invalid-envelope');
  assert.equal(invalidEnvelope.errorCode, 'gist-format-unsupported');

  const inlineContent = JSON.stringify({ version: 1, state: activeState('expected') });
  const inlineResponse = response({ json: gistWithFile({ content: inlineContent, truncated: false }), responseHeaders: { ETag: '"etag-123"' } });
  const inline = await preflightFromResponse(inlineResponse);
  assert.equal(inline.ok, true);
  assert.equal(inline.status, 'ok');
  assert.equal(inline.remoteKind, 'inline');
  assert.equal(inline.filePresent, true);
  assert.equal(inline.usedRawUrl, false);
  assert.match(inline.contentFingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.equal(inline.json.state.projects[0].id, 'expected');
  assert.equal(inline.json.unsafe, undefined);
  assert.equal(JSON.stringify(inline).includes('\"id\":\"expected\"'), false);

  const rawContent = JSON.stringify({ version: 1, state: activeState('from-raw') });
  const rawQueue = queuedFetch([
    response({ json: gistWithFile({ content: '{must-not-be-used}', truncated: true, raw_url: 'https://gist.githubusercontent.test/raw/file' }) }),
    response({ text: rawContent })
  ]);
  const raw = await api.preflightGistRemote({ gistId, token, fetch: rawQueue.fetch, crypto: webcrypto });
  rawQueue.assertDone();
  assert.equal(raw.ok, true);
  assert.equal(raw.status, 'truncated-loaded');
  assert.equal(raw.remoteKind, 'raw');
  assert.equal(raw.usedRawUrl, true);
  assert.deepEqual(Array.from(raw.warnings), ['gist-file-truncated', 'gist-raw-url-resolved']);
  assert.equal(rawQueue.calls[1].options.cache, undefined);
  assert.deepEqual(Object.keys(rawQueue.calls[1].options.headers).sort(), ['Accept', 'Authorization'].sort());
  assert.equal(rawQueue.calls[1].options.headers.Authorization, `token ${token}`);
  assert.equal(rawQueue.calls[1].options.headers['Cache-Control'], undefined);
  assert.equal(rawQueue.calls[1].options.headers.Pragma, undefined);

  const baseSnapshot = api.createGistPreflightSnapshot({
    ok: true, status: 'ok', remoteKind: 'inline', revision: 'r1', etag: 'e1', updatedAt: 't1', contentFingerprint: 'sha256:a'
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
  assert.equal(writeQueue.calls[1].options.headers['Content-Type'], 'application/json');
  assert.equal(writeQueue.calls[1].options.headers.Authorization, `token ${token}`);
  assert.equal(writeQueue.calls[1].options.headers.Accept, 'application/vnd.github+json');

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


  const weakEtagGet = response({ json: gistWithFile({ content: inlineContent, truncated: false }), responseHeaders: { ETag: 'W/"weak-etag"' } });
  const weakEtagSnapshot = await preflightFromResponse(weakEtagGet);
  const weakEtagQueue = queuedFetch([weakEtagGet]);
  const weakEtagOutcome = await api.safePatchGistRemote({ gistId, token, expectedSnapshot: weakEtagSnapshot, content: '{"encrypted":true}', fetch: weakEtagQueue.fetch, crypto: webcrypto });
  weakEtagQueue.assertDone();
  assert.equal(weakEtagOutcome.errorCode, 'gist-write-precondition-unavailable');
  assert.deepEqual(weakEtagQueue.calls.map(call => call.options.method), ['GET']);

  const changedGet = response({
    json: gistWithFile({ content: JSON.stringify({ version: 1, state: activeState('changed') }), truncated: false }, { history: [{ version: 'revision-999' }] }),
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
  const fingerprintEnvelope = await api.encryptRoadtripGistPayload({ version: 1, state: activeState('fingerprinted') }, passphrase);
  const fingerprintQueue = queuedFetch([
    response({ json: gistWithFile({ content: JSON.stringify(fingerprintEnvelope), truncated: false }), responseHeaders: { ETag: '"fingerprint-etag"' } })
  ]);
  const fingerprintSnapshot = await api.preflightGistRemote({ gistId, token, passphrase, fetch: fingerprintQueue.fetch, crypto: webcrypto });
  fingerprintQueue.assertDone();
  assert.equal(fingerprintSnapshot.status, 'ok');
  assert.match(fingerprintSnapshot.payloadFingerprint, /^sha256:[a-f0-9]{64}$/);

  const wrongPassphraseQueue = queuedFetch([
    response({ json: gistWithFile({ content: JSON.stringify(fingerprintEnvelope), truncated: false }), responseHeaders: { ETag: '"fingerprint-etag"' } })
  ]);
  const wrongPassphraseSnapshot = await api.preflightGistRemote({ gistId, token, passphrase: 'synthetic-wrong-passphrase', fetch: wrongPassphraseQueue.fetch, crypto: webcrypto });
  wrongPassphraseQueue.assertDone();
  assert.equal(wrongPassphraseSnapshot.status, 'wrong-passphrase');
  assert.equal(wrongPassphraseSnapshot.errorCode, 'wrong-passphrase-or-invalid-gist');
  assert.equal(wrongPassphraseSnapshot.payloadFingerprint, '');

  const protectedState = { ...activeState('protected-local'), _lastExported: 'unchanged-export' };
  api.setState(protectedState);
  const missingSyncQueue = queuedFetch([
    response({ json: gistWithFile(null, { files: { decoy: { content: JSON.stringify(activeState('decoy')) } } }), responseHeaders: { ETag: '"missing-etag"' } })
  ]);
  context.fetch = missingSyncQueue.fetch;
  const missingSyncOutcome = await api.gistSync();
  missingSyncQueue.assertDone();
  assert.equal(missingSyncOutcome.errorCode, 'gist-file-missing');
  assert.equal(missingSyncOutcome.wroteRemote, false);
  assert.deepEqual(missingSyncQueue.calls.map(call => call.options.method), ['GET']);
  assert.equal(api.getState().projects[0].id, 'protected-local');
  assert.equal(api.getState()._lastExported, 'unchanged-export');

  api.setState(activeState('initial-local'));
  const initialPushQueue = queuedFetch([
    response({ json: gistWithFile(null, { files: { first_file_fallback_must_not_be_used: { content: JSON.stringify(activeState('decoy')) } } }), responseHeaders: { ETag: '"missing-etag"' } }),
    response({ json: gistWithFile(null, { files: { first_file_fallback_must_not_be_used: { content: JSON.stringify(activeState('decoy')) } } }), responseHeaders: { ETag: '"missing-etag"' } }),
    response({ status: 200, json: gistWithFile({ content: '{}' }) })
  ]);
  context.fetch = initialPushQueue.fetch;
  const initialPushOutcome = await api.gistPush();
  initialPushQueue.assertDone();
  assert.equal(initialPushOutcome.status, 'initialized-remote');
  assert.equal(initialPushOutcome.wroteRemote, true);
  assert.deepEqual(initialPushQueue.calls.map(call => call.options.method), ['GET', 'GET', 'PATCH']);
  assert.equal(initialPushQueue.calls[2].options.headers['If-Match'], '"missing-etag"');
  assert.equal(initialPushQueue.calls[2].options.headers['Content-Type'], 'application/json');
  const initialPatchBody = JSON.parse(initialPushQueue.calls[2].options.body);
  assert.deepEqual(Object.keys(initialPatchBody.files), [api.GIST_FILE]);
  assert.equal(initialPatchBody.files.first_file_fallback_must_not_be_used, undefined);
  assert.equal(JSON.stringify(initialPatchBody).includes('initial-local'), false);
  assert.equal(api.getState().projects[0].id, 'initial-local');
  assert.ok(confirmations.some(message => message.includes('Sicherer Erst-Push')));

  api.setState({ ...activeState('race-local'), _lastExported: 'race-export', _lastGistPushAt: 'race-push' });
  const createdBetweenPreflightsEnvelope = await api.encryptRoadtripGistPayload({ version: 1, state: activeState('remote-created') }, passphrase);
  const createdBetweenPreflightsQueue = queuedFetch([
    response({ json: gistWithFile(null, { files: { decoy: { content: JSON.stringify(activeState('decoy')) } } }), responseHeaders: { ETag: '"race-etag-1"' } }),
    response({ json: gistWithFile({ content: JSON.stringify(createdBetweenPreflightsEnvelope), truncated: false }), responseHeaders: { ETag: '"race-etag-2"' } })
  ]);
  context.fetch = createdBetweenPreflightsQueue.fetch;
  const createdBetweenPreflightsOutcome = await api.gistPush();
  createdBetweenPreflightsQueue.assertDone();
  assert.equal(createdBetweenPreflightsOutcome.status, 'conflict');
  assert.equal(createdBetweenPreflightsOutcome.errorCode, 'remote-changed-during-sync');
  assert.equal(createdBetweenPreflightsOutcome.wroteRemote, false);
  assert.deepEqual(createdBetweenPreflightsQueue.calls.map(call => call.options.method), ['GET', 'GET']);
  assert.equal(api.getState().projects[0].id, 'race-local');
  assert.equal(api.getState()._lastExported, 'race-export');
  assert.equal(api.getState()._lastGistPushAt, 'race-push');

  api.setState(activeState('prepatch-local'));
  const remotePrePatchEnvelope = await api.encryptRoadtripGistPayload({ version: 1, state: activeState('remote-before-local-change') }, passphrase);
  const prePatchLocalChangeQueue = queuedFetch([
    response({ json: gistWithFile({ content: JSON.stringify(remotePrePatchEnvelope), truncated: false }), responseHeaders: { ETag: '"prepatch-etag"' } }),
    () => {
      api.setState(activeState('prepatch-new-local'));
      return response({ json: gistWithFile({ content: JSON.stringify(remotePrePatchEnvelope), truncated: false }), responseHeaders: { ETag: '"prepatch-etag"' } });
    }
  ]);
  context.fetch = prePatchLocalChangeQueue.fetch;
  const prePatchLocalChangeOutcome = await api.gistPush();
  prePatchLocalChangeQueue.assertDone();
  assert.equal(prePatchLocalChangeOutcome.status, 'local-changed-during-push');
  assert.equal(prePatchLocalChangeOutcome.errorCode, 'local-changed-during-push');
  assert.equal(prePatchLocalChangeOutcome.wroteRemote, false);
  assert.deepEqual(prePatchLocalChangeQueue.calls.map(call => call.options.method), ['GET', 'GET']);
  assert.equal(api.getState().projects[0].id, 'prepatch-new-local');

  api.setState(activeState('postpatch-local'));
  const remotePostPatchEnvelope = await api.encryptRoadtripGistPayload({ version: 1, state: activeState('remote-before-postpatch-change') }, passphrase);
  const postPatchLocalChangeQueue = queuedFetch([
    response({ json: gistWithFile({ content: JSON.stringify(remotePostPatchEnvelope), truncated: false }), responseHeaders: { ETag: '"postpatch-etag"' } }),
    response({ json: gistWithFile({ content: JSON.stringify(remotePostPatchEnvelope), truncated: false }), responseHeaders: { ETag: '"postpatch-etag"' } }),
    () => {
      api.setState(activeState('postpatch-new-local'));
      return response({ status: 200, json: gistWithFile({ content: '{}' }) });
    }
  ]);
  context.fetch = postPatchLocalChangeQueue.fetch;
  const postPatchLocalChangeOutcome = await api.gistPush();
  postPatchLocalChangeQueue.assertDone();
  assert.equal(postPatchLocalChangeOutcome.status, 'local-changed-after-push');
  assert.equal(postPatchLocalChangeOutcome.errorCode, 'local-changed-during-push');
  assert.equal(postPatchLocalChangeOutcome.wroteRemote, true);
  assert.deepEqual(postPatchLocalChangeQueue.calls.map(call => call.options.method), ['GET', 'GET', 'PATCH']);
  assert.equal(api.getState().projects[0].id, 'postpatch-new-local');
  assert.equal(api.getState()._lastExported || '', '');
  assert.equal(api.getState()._lastGistPushAt || '', '');
  assert.ok(alerts.some(message => message.includes('Lokale Änderungen bleiben lokal')));

  const invalidJsonQueue = queuedFetch([
    response({ json: gistWithFile({ content: '{corrupt', truncated: false }), responseHeaders: { ETag: '"invalid-etag"' } })
  ]);
  context.fetch = invalidJsonQueue.fetch;
  const invalidJsonOutcome = await api.gistSync();
  invalidJsonQueue.assertDone();
  assert.equal(invalidJsonOutcome.errorCode, 'gist-file-invalid-json');
  assert.equal(invalidJsonOutcome.changedLocal, false);
  assert.equal(api.getState().projects[0].id, 'postpatch-new-local');

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
  const lastPushBeforeSyncConflict = api.getStatus().lastPush;
  const fingerprintBeforeSyncConflict = api.getSyncFingerprint();
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
  assert.equal(api.getStatus().lastPush, lastPushBeforeSyncConflict);
  assert.equal(api.getSyncFingerprint(), fingerprintBeforeSyncConflict);
  assert.equal(JSON.stringify(api.getStatus()).includes(responseSecret), false);
  assert.equal(alerts.some(message => message.includes(responseSecret) || message.includes(token)), false);

  let releaseFetch;
  const blockedFetch = new Promise(resolve => { releaseFetch = resolve; });
  context.fetch = async (url, options = {}) => {
    assert.equal(options.method, 'GET');
    return blockedFetch;
  };
  api.setState(activeState('guarded'));
  const runningSync = api.gistSync();
  await Promise.resolve();
  assert.equal(api.isSyncInProgress(), true);
  const blockedPush = await api.gistPush();
  assert.equal(blockedPush.status, 'sync-in-progress');
  assert.equal(blockedPush.errorCode, 'sync-in-progress');
  releaseFetch(response({ status: 401, bodyReadMustFail: true }));
  const finishedSync = await runningSync;
  assert.equal(finishedSync.errorCode, 'gist-authentication-failed');
  assert.equal(api.getState().projects[0].id, 'guarded');
  assert.equal(api.isSyncInProgress(), false);

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
