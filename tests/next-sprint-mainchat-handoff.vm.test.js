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

const instrumentedScript = inlineScript
  .replace('      function renderView() {', '      function renderViewOriginal() {')
  .replace(
    '      init();',
    `      globalThis.__atlasNextSprintHandoffTest = {
        ATLAS_NEXT_SPRINT_MAINCHAT_HANDOFF_TYPE,
        LEGACY_ROADTRIP_NEXT_SPRINT_MAINCHAT_HANDOFF_TYPE,
        buildNextSprintMainchatHandoffPrompt,
        defaultState,
        importNextSprintMainchatHandoff,
        parseNextSprintMainchatHandoffJson,
        setState(nextState) { S = nextState; }
      };`
  );
assert.notEqual(instrumentedScript, inlineScript, 'Test-Hook konnte init() nicht ersetzen.');

const context = {
  Blob,
  Date,
  alert() {},
  Intl,
  JSON,
  Math,
  URL,
  clearTimeout,
  console,
  setTimeout,
  structuredClone,
  renderView() {}
};
context.globalThis = context;
vm.createContext(context);
new vm.Script(instrumentedScript, { filename: 'index-inline.vm.js' }).runInContext(context);

const api = context.__atlasNextSprintHandoffTest;
const atlasType = 'atlas-next-sprint-mainchat-handoff-v1';
const legacyType = 'roadtrip-next-sprint-mainchat-handoff-v1';
assert.equal(api.ATLAS_NEXT_SPRINT_MAINCHAT_HANDOFF_TYPE, atlasType);
assert.equal(api.LEGACY_ROADTRIP_NEXT_SPRINT_MAINCHAT_HANDOFF_TYPE, legacyType);

function handoff(type) {
  return {
    type,
    recommendedSprint: {},
    featureUpdates: [],
    proposedFeatures: []
  };
}

const atlasResult = api.parseNextSprintMainchatHandoffJson(JSON.stringify(handoff(atlasType)));
assert.equal(atlasResult.parsed.type, atlasType);
assert.equal(atlasResult.acceptedLegacyType, false);

const legacyResult = api.parseNextSprintMainchatHandoffJson(JSON.stringify(handoff(legacyType)));
assert.equal(legacyResult.parsed.type, legacyType);
assert.equal(legacyResult.acceptedLegacyType, true);

const stringEncodedResult = api.parseNextSprintMainchatHandoffJson(JSON.stringify(JSON.stringify(handoff(atlasType))));
assert.equal(stringEncodedResult.parsed.type, atlasType);
assert.equal(stringEncodedResult.acceptedLegacyType, false);

const atlasJson = JSON.stringify(handoff(atlasType));
const trailingTextResult = api.parseNextSprintMainchatHandoffJson(atlasJson + '\nWeitere Hinweise zum nächsten Sprint.');
assert.equal(trailingTextResult.parsed.type, atlasType);
assert.equal(trailingTextResult.extractedJson, atlasJson);

const trailingFenceResult = api.parseNextSprintMainchatHandoffJson(atlasJson + '\n```');
assert.equal(trailingFenceResult.parsed.type, atlasType);
assert.equal(trailingFenceResult.extractedJson, atlasJson);

assert.throws(
  () => api.parseNextSprintMainchatHandoffJson(`{"type":"${atlasType}","recommendedSprint":{},("featureUpdates":[]}`),
  error => error.message.includes('Ungültiges JSON.')
    && error.message.includes('Prüfe fehlende oder überzählige Klammern, Kommas oder Anführungszeichen.')
    && error.message.includes('},"featureUpdates" statt },("featureUpdates"')
);

assert.throws(
  () => api.parseNextSprintMainchatHandoffJson(JSON.stringify('{not valid nested JSON')),
  error => error.message.includes('Das Handoff scheint als JSON-String eingefügt worden zu sein.')
    && error.message.includes('Bitte ohne äußere Anführungszeichen einfügen.')
);

assert.throws(
  () => api.parseNextSprintMainchatHandoffJson(JSON.stringify(handoff('unexpected-handoff-v1'))),
  error => error.message.includes('Gefunden: "unexpected-handoff-v1"')
    && error.message.includes(`Erwartet: "${atlasType}"`)
    && error.message.includes(`Legacy-Alias "${legacyType}"`)
);

assert.throws(
  () => api.parseNextSprintMainchatHandoffJson(JSON.stringify({ featureUpdates: [] })),
  error => error.message.includes('Gefunden: (fehlt)')
    && error.message.includes(atlasType)
    && error.message.includes(legacyType)
);

const state = api.defaultState();
state.projects = [{
  id: 'project_test',
  title: 'Testprojekt',
  summary: 'Testkontext',
  currentFocus: '',
  nextStep: '',
  status: 'aktiv',
  mainChatId: '',
  mainChatUrl: ''
}];
state.features = [];
state.notes = [];
state.chats = [];
api.setState(state);

const atlasImportState = { rawJson: '', summary: '' };
const atlasImportReport = api.importNextSprintMainchatHandoff(
  'project_test',
  JSON.stringify(handoff(atlasType)),
  { targetState: atlasImportState, applyRecommendedSprint: false }
);
assert.equal(atlasImportReport.errors.length, 0);
assert.equal(atlasImportState.rawJson.includes(atlasType), true);

const legacyImportState = { rawJson: '', summary: '' };
const legacyImportReport = api.importNextSprintMainchatHandoff(
  'project_test',
  JSON.stringify(handoff(legacyType)),
  { targetState: legacyImportState, applyRecommendedSprint: false }
);
assert.equal(legacyImportReport.errors.length, 0);
assert.ok(legacyImportReport.reasons.includes('Legacy-Roadtrip-Typ akzeptiert.'));

const prompt = api.buildNextSprintMainchatHandoffPrompt('project_test');
assert.ok(prompt.includes(`Der JSON-type muss exakt "${atlasType}" sein.`));
assert.ok(prompt.includes(`neue Handoffs sollen aber "${atlasType}" verwenden.`));
assert.ok(prompt.includes(`ältere Handoffs mit "${legacyType}"`));
assert.ok(prompt.includes(`"type": "${atlasType}"`));

console.log('Next-Sprint-/Hauptchat-Handoff VM-Tests erfolgreich.');
