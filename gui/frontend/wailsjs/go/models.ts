export namespace main {
	
	export class InvokeResponse {
	    name: string;
	    stdout: string;
	    stderr: string;
	    exit_code: number;
	    latency_ms: number;
	
	    static createFrom(source: any = {}) {
	        return new InvokeResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.stdout = source["stdout"];
	        this.stderr = source["stderr"];
	        this.exit_code = source["exit_code"];
	        this.latency_ms = source["latency_ms"];
	    }
	}
	export class RuntimeSnapshot {
	    status: string;
	    error?: string;
	    state_dir: string;
	    functions: state.Function[];
	    engine: runtime.EngineStats;
	    dispatcher: runtime.DispatcherStats;
	    function_stats: runtime.FunctionStats[];
	    preload: runtime.PreloadResult;
	
	    static createFrom(source: any = {}) {
	        return new RuntimeSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.error = source["error"];
	        this.state_dir = source["state_dir"];
	        this.functions = this.convertValues(source["functions"], state.Function);
	        this.engine = this.convertValues(source["engine"], runtime.EngineStats);
	        this.dispatcher = this.convertValues(source["dispatcher"], runtime.DispatcherStats);
	        this.function_stats = this.convertValues(source["function_stats"], runtime.FunctionStats);
	        this.preload = this.convertValues(source["preload"], runtime.PreloadResult);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace runtime {
	
	export class DispatcherStats {
	    workers: number;
	    min_workers: number;
	    max_workers: number;
	    queue_size: number;
	    queued: number;
	    utilization: number;
	    accepted: number;
	    rejected: number;
	    completed: number;
	    scale_ups: number;
	    scale_downs: number;
	    scale_down_after_ms?: number;
	
	    static createFrom(source: any = {}) {
	        return new DispatcherStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.workers = source["workers"];
	        this.min_workers = source["min_workers"];
	        this.max_workers = source["max_workers"];
	        this.queue_size = source["queue_size"];
	        this.queued = source["queued"];
	        this.utilization = source["utilization"];
	        this.accepted = source["accepted"];
	        this.rejected = source["rejected"];
	        this.completed = source["completed"];
	        this.scale_ups = source["scale_ups"];
	        this.scale_downs = source["scale_downs"];
	        this.scale_down_after_ms = source["scale_down_after_ms"];
	    }
	}
	export class EngineStats {
	    compiled_modules: number;
	    compile_requests: number;
	    compile_hits: number;
	    invocations: number;
	    evictions: number;
	    host_calls: number;
	    host_call_failures: number;
	    scale_to_zero_after_ms?: number;
	
	    static createFrom(source: any = {}) {
	        return new EngineStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.compiled_modules = source["compiled_modules"];
	        this.compile_requests = source["compile_requests"];
	        this.compile_hits = source["compile_hits"];
	        this.invocations = source["invocations"];
	        this.evictions = source["evictions"];
	        this.host_calls = source["host_calls"];
	        this.host_call_failures = source["host_call_failures"];
	        this.scale_to_zero_after_ms = source["scale_to_zero_after_ms"];
	    }
	}
	export class FunctionStats {
	    name: string;
	    accepted: number;
	    rejected: number;
	    started: number;
	    completed: number;
	    failed: number;
	    in_flight: number;
	    avg_latency_ms: number;
	    last_latency_ms: number;
	    arrival_rate_per_sec: number;
	    last_invoked_at?: string;
	    last_error?: string;
	
	    static createFrom(source: any = {}) {
	        return new FunctionStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.accepted = source["accepted"];
	        this.rejected = source["rejected"];
	        this.started = source["started"];
	        this.completed = source["completed"];
	        this.failed = source["failed"];
	        this.in_flight = source["in_flight"];
	        this.avg_latency_ms = source["avg_latency_ms"];
	        this.last_latency_ms = source["last_latency_ms"];
	        this.arrival_rate_per_sec = source["arrival_rate_per_sec"];
	        this.last_invoked_at = source["last_invoked_at"];
	        this.last_error = source["last_error"];
	    }
	}
	export class PreloadError {
	    name: string;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new PreloadError(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.error = source["error"];
	    }
	}
	export class PreloadResult {
	    requested: number;
	    compiled: number;
	    failed?: PreloadError[];
	
	    static createFrom(source: any = {}) {
	        return new PreloadResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.requested = source["requested"];
	        this.compiled = source["compiled"];
	        this.failed = this.convertValues(source["failed"], PreloadError);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace state {
	
	export class Function {
	    name: string;
	    wasm_path: string;
	    capabilities: string;
	    created_at: number;
	
	    static createFrom(source: any = {}) {
	        return new Function(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.wasm_path = source["wasm_path"];
	        this.capabilities = source["capabilities"];
	        this.created_at = source["created_at"];
	    }
	}

}

