const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repositoryRoot = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(repositoryRoot, 'index.html'), 'utf8');
const inlineScriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(inlineScriptMatch, 'Inline-Script in index.html nicht gefunden.');

const inlineScript = inlineScriptMatch[1];
new vm.Script(inlineScript, { filename: 'index-inline.js' });

let instrumentedScript = inlineScript.replace('      function renderView() {', '      function renderViewOriginal() {');
const hook = `      globalThis.__atlasProjectBulkImportTest = {
        ATLAS_PROJECT_BULK_IMPORT_TYPE,
        analyzeProjectBulkImport,
        confirmProjectBulkImport,
        createProjectFromData,
        defaultState,
        ensureDefaults,
        ensureProjectDefaults,
        normalizeProjectBulkImportPayload,
        parseAtlasProjectHandoffJson,
        getBulkState() { return ui.projectBulkImport; },
        setBulkState(value) { ui.projectBulkImport = value; },
        setState(nextState) { S = nextState; ensureDefaults(); },
        getState() { return JSON.parse(JSON.stringify(S)); }
      };`;
instrumentedScript = instrumentedScript.replace('      init();', '      // init disabled for project bulk import tests');
instrumentedScript = instrumentedScript.replace(/    \}\)\(\);\s*$/, hook + '\n    })();');
assert.notEqual(instrumentedScript, inlineScript, 'Test-Hook konnte init() nicht ersetzen.');

const localStorageStore = new Map();
function elementStub() { return { hidden: false, innerHTML: '', textContent: '', value: '', checked: false, disabled: false, style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, dataset: {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector() { return elementStub(); }, querySelectorAll() { return []; }, setAttribute() {}, removeAttribute() {}, click() {} }; }

const context = {
  Blob,
  Date,
  Intl,
  JSON,
  Math,
  URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
  alert() {},
  clearTimeout,
  console,
  confirm() { return true; },
  document: {
    getElementById() { return elementStub(); },
    querySelector() { return elementStub(); },
    querySelectorAll() { return []; },
    createElement() { return elementStub(); },
    body: { classList: { add() {}, remove() {}, toggle() {} }, appendChild() {} },
    documentElement: { style: { setProperty() {} } }
  },
  localStorage: {
    getItem(key) { return localStorageStore.has(String(key)) ? localStorageStore.get(String(key)) : null; },
    setItem(key, value) { localStorageStore.set(String(key), String(value)); },
    removeItem(key) { localStorageStore.delete(String(key)); }
  },
  renderSidebarProjects() {},
  renderProjectSelects() {},
  renderView() {},
  setTimeout,
  structuredClone,
  window: null
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
new vm.Script(instrumentedScript, { filename: 'index-inline.vm.js' }).runInContext(context);

const api = context.__atlasProjectBulkImportTest;
assert.equal(api.ATLAS_PROJECT_BULK_IMPORT_TYPE, 'atlas-project-bulk-import-v1');

function payload(projects) {
  return JSON.stringify({
    type: 'atlas-project-bulk-import-v1',
    meta: { source: 'notion-project-database', exportedAt: '2026-06-23T08:00:00.000Z', sourceTool: 'claude' },
    projects
  });
}

let state = api.defaultState();
api.setState(state);
let preview = api.analyzeProjectBulkImport(payload([
  { title: ' Projekt Alpha ', summary: ' A ', status: 'aktiv', tags: [' x ', 'x'], notionUrl: 'https://www.notion.so/alpha', externalId: 'notion-alpha' },
  { title: 'Projekt Beta', currentFocus: 'Fokus', nextStep: 'Weiter', resources: [{ type: 'markdown', title: 'Spec', url: 'https://example.test/spec.md' }] }
]));
assert.equal(preview.counts.new, 2);
assert.equal(preview.entries[0].resources.length, 1);
assert.equal(preview.entries[0].resources[0].type, 'notion');
assert.equal(preview.entries[0].tags.length, 1);
api.setBulkState({ rawJson: payload([]), preview, summary: '', error: '' });
api.confirmProjectBulkImport();
state = api.getState();
assert.equal(state.projects.length, 2, 'zwei eindeutige neue Projekte werden angelegt');
assert.equal(state.projects[0].resources[0].url, 'https://www.notion.so/alpha', 'Notion-URL bleibt am Projekt erhalten');
api.setState(JSON.parse(JSON.stringify(state)));
assert.equal(api.getState().projects[0].resources[0].url, 'https://www.notion.so/alpha', 'Ressource bleibt nach Reload/ensureDefaults erhalten');
const exportedWithResources = JSON.parse(JSON.stringify(api.getState()));

preview = api.analyzeProjectBulkImport(payload([{ title: '   ' }]));
assert.equal(preview.counts.invalid, 1);
assert.equal(preview.entries[0].reason, 'Leerer Titel.');
assert.throws(() => api.analyzeProjectBulkImport('{broken'), /Ungültiges JSON/);

preview = api.analyzeProjectBulkImport(payload([{ title: 'Alpha Update', notionUrl: 'https://www.notion.so/alpha' }]));
assert.equal(preview.counts.duplicates, 1, 'gleiche Notion-URL wird nicht blind importiert');
api.setBulkState({ rawJson: payload([]), preview, summary: '', error: '' });
api.confirmProjectBulkImport();
assert.equal(api.getState().projects.length, 2, 'Update-Kandidat wird beim Confirm übersprungen');

preview = api.analyzeProjectBulkImport(payload([{ title: 'Alpha Extern', externalId: 'notion-alpha' }]));
assert.equal(preview.counts.duplicates, 1, 'gleiche externalId wird nicht blind importiert');
preview = api.analyzeProjectBulkImport(payload([{ title: 'Projekt Alpha' }]));
assert.equal(preview.counts.duplicates, 1, 'sehr ähnlicher Titel wird als Dublette erkannt');

const secretPreview = api.analyzeProjectBulkImport(payload([{ title: 'Secret URL', resources: [{ title: 'Bad', url: 'https://example.test/?token=abc' }] }]));
assert.equal(secretPreview.entries[0].resources.length, 0, 'Secret-haltige Ressourcen-URL wird nicht gespeichert');
assert.match(secretPreview.entries[0].warnings.join('\n'), /Secret/);

function assertSinglePayloadDuplicateImport(projects, expectedReasonPattern) {
  api.setState(api.defaultState());
  const duplicatePreview = api.analyzeProjectBulkImport(payload(projects));
  assert.equal(duplicatePreview.counts.new, 1);
  assert.equal(duplicatePreview.counts.duplicates, 1);
  assert.match(duplicatePreview.entries[1].reason, expectedReasonPattern);
  api.setBulkState({ rawJson: payload([]), preview: duplicatePreview, summary: '', error: '' });
  api.confirmProjectBulkImport();
  assert.equal(api.getState().projects.length, 1, 'Payload-interne Dublette wird beim Confirm übersprungen');
}

assertSinglePayloadDuplicateImport([
  { title: 'Payload External A', externalId: 'same-external-id' },
  { title: 'Payload External B', externalId: 'same-external-id' }
], /Doppelt im Import-Payload: gleiche externalId/);

assertSinglePayloadDuplicateImport([
  { title: 'Payload Notion A', notionUrl: 'https://www.notion.so/payload-same' },
  { title: 'Payload Notion B', notionUrl: 'https://www.notion.so/payload-same' }
], /Doppelt im Import-Payload: gleiche Ressourcen-\/Notion-URL/);

assertSinglePayloadDuplicateImport([
  { title: 'Payload Titel' },
  { title: 'Payload Titel' }
], /Doppelt im Import-Payload: sehr ähnlicher Titel/);

const handoff = api.parseAtlasProjectHandoffJson(JSON.stringify({
  type: 'atlas-project-handoff-v1',
  project: { title: 'Einzelprojekt', summary: 'Summary' },
  sourceChat: { role: 'none' },
  proposedFeatures: [],
  notes: [],
  openQuestions: []
}));
assert.equal(handoff.project.title, 'Einzelprojekt', 'bestehender Einzelprojekt-Handoff bleibt parsbar');

assert.equal(exportedWithResources.projects[0].resources[0].url, 'https://www.notion.so/alpha', 'JSON-Export/Backup-State nimmt Ressourcenfeld mit');

console.log('Projekt-Bulk-Import VM-Tests erfolgreich.');
