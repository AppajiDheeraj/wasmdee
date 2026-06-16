export function getFunctionRuntime(proto) {
  if (proto?.abi === 'wasmdee-handler') {
    return { abi: 'wasmdee-handler', label: 'Pooled handler' };
  }
  return { abi: 'wasi-command', label: 'WASI command' };
}

export function getSuccessMetric(completed, failed, rejected) {
  if (completed <= 0) {
    return {
      value: 'N/A',
      detail: 'No completed invocations',
      tone: 'good',
    };
  }
  const successRate = ((completed - failed) / completed) * 100;
  return {
    value: `${successRate.toFixed(1)}%`,
    detail: `${rejected || 0} rejected`,
    tone: successRate < 100 ? 'warn' : 'good',
  };
}
