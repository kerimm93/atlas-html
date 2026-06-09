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

const instrumentedScript = inlineScript.replace(
  '      init();',
  `      globalThis.__atlasSprintExecutionModeTest = {
        SPRINT_EXECUTION_MODES,
        buildSprintExecutionGuardrail,
        getChatWorkflowState,
        getSprintExecutionMode,
        setWorkflowState(projectId, state) {
          ui.chatWorkflowByProject[projectId] = state;
        }
      };`
);
assert.notEqual(instrumentedScript, inlineScript, 'Test-Hook konnte init() nicht ersetzen.');

const context = {
  Blob,
  Date,
  Intl,
  JSON,
  Math,
  URL,
  clearTimeout,
  console,
  setTimeout,
  structuredClone
};
context.globalThis = context;
vm.createContext(context);
new vm.Script(instrumentedScript, { filename: 'index-inline.vm.js' }).runInContext(context);

const api = context.__atlasSprintExecutionModeTest;
const { direct, codexControl } = api.SPRINT_EXECUTION_MODES;

assert.equal(api.getSprintExecutionMode(), direct);

const newState = api.getChatWorkflowState('project_new');
assert.equal(newState.sprintExecutionMode, direct);

api.setWorkflowState('project_missing', { projectId: 'project_missing' });
assert.equal(api.getSprintExecutionMode('project_missing'), direct);

api.setWorkflowState('project_empty', { projectId: 'project_empty', sprintExecutionMode: '' });
assert.equal(api.getSprintExecutionMode('project_empty'), direct);

api.setWorkflowState('project_invalid', { projectId: 'project_invalid', sprintExecutionMode: 'invalid' });
assert.equal(api.getSprintExecutionMode('project_invalid'), direct);

api.setWorkflowState('project_codex', { projectId: 'project_codex', sprintExecutionMode: codexControl });
assert.equal(api.getChatWorkflowState('project_codex').sprintExecutionMode, codexControl);
assert.equal(api.getSprintExecutionMode('project_codex'), codexControl);

assert.equal(api.buildSprintExecutionGuardrail(direct), '');
assert.match(api.buildSprintExecutionGuardrail(codexControl), /App nicht selbst bearbeiten/);
assert.match(api.buildSprintExecutionGuardrail(codexControl), /keine Dateien verändern/);
assert.match(api.buildSprintExecutionGuardrail(codexControl), /vollständigen Codex-Prompt formulieren/);

console.log('Sprint-Arbeitsmodus VM-Tests erfolgreich.');
