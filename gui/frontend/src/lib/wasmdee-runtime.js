import {
  InvokeFunction,
  RuntimeSnapshot,
  SelectAndDeployFunction,
} from '../../wailsjs/go/main/App';

const hasWailsRuntime = () => Boolean(window.go?.main?.App);

export async function getRuntimeSnapshot() {
  if (!hasWailsRuntime()) {
    return {
      status: 'preview',
      functions: [],
      engine: { compiled_modules: 0, compile_requests: 0, compile_hits: 0, invocations: 0 },
      dispatcher: { workers: 0, queue_size: 0, queued: 0, accepted: 0, rejected: 0, completed: 0 },
      function_stats: [],
      preload: { requested: 0, compiled: 0 },
      proto_faaslets: [],
    };
  }
  return RuntimeSnapshot();
}

export async function invokeRuntimeFunction(name, body, args) {
  if (!hasWailsRuntime()) {
    throw new Error('Desktop runtime is not available in browser preview.');
  }
  return InvokeFunction(name, body, args);
}

export async function selectAndDeployFunction(name) {
  if (!hasWailsRuntime()) {
    return getRuntimeSnapshot();
  }
  return SelectAndDeployFunction(name);
}
