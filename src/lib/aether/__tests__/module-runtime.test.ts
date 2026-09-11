import { describe,expect,it } from 'vitest';
import { assertModuleDependenciesAcyclic,hasModuleHandler,parseVersion,stableModuleHash,validateModuleManifest,validateModuleVersion,versionSatisfies } from '../module-runtime';

describe('Phase Q module runtime',()=>{
 it('validates a safe module manifest',()=>{expect(validateModuleManifest({apiVersion:'aether.module/v1',slug:'demo.module',name:'Demo',description:'A test module',kind:'tool',entrypoint:'demo',capabilities:['module.read'],dependencies:[],inputs:[],outputs:['result'],configurationSchema:{},prohibited:['Bypass authorization'] })).toEqual([]);});
 it('rejects dangerous capabilities',()=>{expect(validateModuleManifest({apiVersion:'aether.module/v1',slug:'demo',name:'Demo',description:'',kind:'tool',entrypoint:'demo',capabilities:['roles.modify'],dependencies:[],inputs:[],outputs:[],configurationSchema:{},prohibited:['Bypass authorization']})).toContain('Forbidden capability: roles.modify');});
 it('enforces semantic versions and ranges',()=>{expect(validateModuleVersion('1.2.3')).toEqual([]);expect(parseVersion('2.4.1')).toEqual([2,4,1]);expect(versionSatisfies('1.5.0','^1.2.0')).toBe(true);expect(versionSatisfies('2.0.0','^1.2.0')).toBe(false);expect(versionSatisfies('1.2.9','~1.2.0')).toBe(true);});
 it('detects dependency cycles',()=>{expect(()=>assertModuleDependenciesAcyclic('a',{a:['b'],b:['a']})).toThrow(/cycle/);expect(()=>assertModuleDependenciesAcyclic('a',{a:['b'],b:['c'],c:[]})).not.toThrow();});
 it('hashes deterministically and does not pretend an unregistered handler exists',()=>{expect(stableModuleHash({a:1})).toBe(stableModuleHash({a:1}));expect(hasModuleHandler('definitely-unregistered')).toBe(false);});
});
