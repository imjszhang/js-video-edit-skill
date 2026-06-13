import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateDecision } from '../src/decision.js';
import type { EditingDecision } from '../src/types.js';

const EXAMPLE_PATH = resolve(import.meta.dirname, '..', 'examples', 'decision.json');

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

test('parses example decision.json', () => {
  const raw = readFileSync(EXAMPLE_PATH, 'utf-8');
  const result = validateDecision(raw);
  const decision = result as EditingDecision;

  assert.strictEqual(decision.scenes.length, 4, 'should have 4 scenes');
});

test('all scenes have required fields', () => {
  const raw = readFileSync(EXAMPLE_PATH, 'utf-8');
  const result = validateDecision(raw);
  const decision = result as EditingDecision;

  for (const scene of decision.scenes) {
    assert.ok(scene.scene_id, `scene ${scene.scene_name} missing scene_id`);
    assert.ok(scene.scene_name, `scene ${scene.scene_id} missing scene_name`);
    assert.ok(Array.isArray(scene.candidates), `scene ${scene.scene_id} missing candidates`);
    assert.ok(scene.selected, `scene ${scene.scene_id} missing selected`);
    assert.ok(typeof scene.in_point === 'number', `scene ${scene.scene_id} missing in_point`);
    assert.ok(typeof scene.out_point === 'number', `scene ${scene.scene_id} missing out_point`);
    assert.ok(scene.reason, `scene ${scene.scene_id} missing reason`);
    assert.ok(scene.candidates.length > 0, `scene ${scene.scene_id} has no candidates`);
  }
});

test('global_settings present with expected keys', () => {
  const raw = readFileSync(EXAMPLE_PATH, 'utf-8');
  const result = validateDecision(raw);
  const decision = result as EditingDecision;

  assert.ok(decision.global_settings, 'missing global_settings');
  assert.ok(decision.global_settings.target_duration, 'missing target_duration');
  assert.ok(decision.global_settings.color_profile, 'missing color_profile');
});

test('rejects invalid JSON', () => {
  assert.throws(() => validateDecision('not json'), /invalid/i);
});

test('rejects missing scenes array', () => {
  const invalid = JSON.stringify({ global_settings: {} });
  assert.throws(() => validateDecision(invalid), /scenes/i);
});

test('rejects scene missing selected file', () => {
  const invalid = JSON.stringify({
    scenes: [{ scene_id: 1, scene_name: 'Test', candidates: [], in_point: 0, out_point: 10, reason: 'test' }],
    global_settings: {},
  });
  assert.throws(() => validateDecision(invalid), /selected/i);
});

console.log('\n✅ All tests passed.');
