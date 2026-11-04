require('./register-typescript.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  READING_PROGRESS_STORAGE_KEY,
  READING_PROGRESS_SCHEMA_VERSION,
  loadReadingProgress,
  saveReadingProgress
} = require('../../src/data/roshar/progressStorage.ts');

const workIds = ['twok'];
const unitWorkById = new Map([['twok:chapter:001', 'twok']]);
const empty = [{ workId: 'twok', completedUnitIds: [], updatedAt: 't0' }];

function memoryStorage(initial = {}) {
  const values = { ...initial };
  const calls = [];
  return {
    values,
    calls,
    async getItem(key) { calls.push(['get', key]); return values[key] ?? null; },
    async setItem(key, value) { calls.push(['set', key]); values[key] = value; }
  };
}

test('loads empty v2 progress without touching the legacy state key', async () => {
  const storage = memoryStorage({ '@atlas-cosmere/state-v1': JSON.stringify({ librosLeidos: { twok: true } }) });
  const result = await loadReadingProgress(storage, workIds, unitWorkById, 't0');
  assert.equal(result.status, 'empty');
  assert.deepEqual(result.progress, empty);
  assert.deepEqual(storage.calls, [['get', READING_PROGRESS_STORAGE_KEY]]);
});

test('loads and sanitizes only the supported v2 schema', async () => {
  const storage = memoryStorage({
    [READING_PROGRESS_STORAGE_KEY]: JSON.stringify({
      version: READING_PROGRESS_SCHEMA_VERSION,
      progress: [{ workId: 'twok', completedUnitIds: ['twok:chapter:001', 'invalid'], updatedAt: 't1' }]
    })
  });
  const result = await loadReadingProgress(storage, workIds, unitWorkById, 't0');
  assert.equal(result.status, 'loaded');
  assert.deepEqual(result.progress[0].completedUnitIds, ['twok:chapter:001']);
});

test('returns empty progress for malformed JSON or an unsupported schema', async () => {
  for (const serialized of ['{bad json', JSON.stringify({ version: 1, progress: [] }), JSON.stringify({ version: 2, progress: {} })]) {
    const storage = memoryStorage({ [READING_PROGRESS_STORAGE_KEY]: serialized });
    const result = await loadReadingProgress(storage, workIds, unitWorkById, 't0');
    assert.equal(result.status, 'invalid');
    assert.deepEqual(result.progress, empty);
    assert.equal(storage.calls.length, 1);
  }
});

test('reports storage read failures without attempting writes', async () => {
  const storage = {
    calls: [],
    async getItem(key) { this.calls.push(['get', key]); throw new Error('unavailable'); },
    async setItem(key) { this.calls.push(['set', key]); }
  };
  const result = await loadReadingProgress(storage, workIds, unitWorkById, 't0');
  assert.equal(result.status, 'unavailable');
  assert.deepEqual(result.progress, empty);
  assert.deepEqual(storage.calls, [['get', READING_PROGRESS_STORAGE_KEY]]);
});

test('saves sanitized progress only to the new versioned key', async () => {
  const storage = memoryStorage({ '@atlas-cosmere/state-v1': 'legacy' });
  const ok = await saveReadingProgress(storage, [{
    workId: 'twok',
    completedUnitIds: ['twok:chapter:001', 'unknown'],
    updatedAt: 't1'
  }], workIds, unitWorkById, 't0');
  assert.equal(ok, true);
  assert.equal(storage.values['@atlas-cosmere/state-v1'], 'legacy');
  const saved = JSON.parse(storage.values[READING_PROGRESS_STORAGE_KEY]);
  assert.equal(saved.version, 2);
  assert.deepEqual(saved.progress[0].completedUnitIds, ['twok:chapter:001']);
});

test('reports write failures without throwing', async () => {
  const storage = {
    async getItem() { return null; },
    async setItem() { throw new Error('quota'); }
  };
  assert.equal(await saveReadingProgress(storage, empty, workIds, unitWorkById, 't0'), false);
});
