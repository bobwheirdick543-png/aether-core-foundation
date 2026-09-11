import { describe, expect, it } from 'vitest';
import { AGENTS } from '../agents';
import { analyseOptimizationTelemetry, computeOptimizationTelemetry, recommendationFingerprint } from '../optimization-runtime';

describe('Phase P Optimization Agent',()=>{
 it('keeps ten bounded agents and activates optimization',()=>{expect(AGENTS).toHaveLength(10);const agent=AGENTS.find(a=>a.key==='optimization');expect(agent?.status).toBe('enabled');expect(agent?.prohibited).toContain('Auto-apply production changes');expect(agent?.permissions.find(p=>p.permission==='optimization.apply')?.requiresApproval).toBe(true);});
 it('computes deterministic telemetry from real run samples',()=>{const stats=computeOptimizationTelemetry([{id:'1',agent_key:'research',status:'completed',duration_ms:1000,retry_count:0},{id:'2',agent_key:'research',status:'failed',duration_ms:4000,retry_count:1,failure_code:'timeout'},{id:'3',agent_key:'research',status:'completed',duration_ms:2000,retry_count:0},{id:'4',agent_key:'research',status:'failed',duration_ms:5000,retry_count:1},{id:'5',agent_key:'research',status:'completed',duration_ms:3000,retry_count:0}]);expect(stats.total).toBe(5);expect(stats.failed).toBe(2);expect(stats.retried).toBe(2);expect(stats.timedOut).toBe(1);expect(stats.avgDurationMs).toBe(3000);expect(stats.p95DurationMs).toBe(4800);});
 it('does not recommend with insufficient data',()=>{expect(analyseOptimizationTelemetry(computeOptimizationTelemetry([{id:'1',status:'failed'}]))).toEqual([]);});
 it('produces stable fingerprints for equivalent recommendations',()=>{const input={agentKey:'research',category:'latency',title:'slow',evidence:{p95:4}};expect(recommendationFingerprint(input)).toBe(recommendationFingerprint({...input}));});
 it('detects failure and retry pressure',()=>{const runs=Array.from({length:10},(_,i)=>({id:String(i),agent_key:'research',status:i<4?'failed':'completed',duration_ms:1000,retry_count:i<3?1:0}));const stats=computeOptimizationTelemetry(runs);const recs=analyseOptimizationTelemetry(stats);expect(recs.some(r=>r.category==='failures')).toBe(true);expect(recs.some(r=>r.category==='retries')).toBe(true);});
});
