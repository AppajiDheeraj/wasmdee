import assert from 'node:assert/strict';
import test from 'node:test';
import { getFunctionRuntime, getSuccessMetric } from './runtime-view-model.js';

test('success metric does not invent a percentage without observations', () => {
  assert.deepEqual(getSuccessMetric(0, 0, 0), {
    value: 'N/A',
    detail: 'No completed invocations',
    tone: 'good',
  });
});

test('success metric reports failures and rejections from runtime data', () => {
  assert.deepEqual(getSuccessMetric(10, 2, 3), {
    value: '80.0%',
    detail: '3 rejected',
    tone: 'warn',
  });
});

test('function runtime distinguishes pooled handlers from WASI commands', () => {
  assert.deepEqual(getFunctionRuntime({ abi: 'wasmdee-handler' }), {
    abi: 'wasmdee-handler',
    label: 'Pooled handler',
  });
  assert.deepEqual(getFunctionRuntime(), {
    abi: 'wasi-command',
    label: 'WASI command',
  });
});
