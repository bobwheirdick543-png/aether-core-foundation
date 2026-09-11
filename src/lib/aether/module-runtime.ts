/** Phase Q — provider-independent module contracts, registry and durable execution primitives. */
import type { AgentKey } from './agents';

export type ModuleKind='application'|'game'|'integration'|'tool'|'workflow';
export type ModuleLifecycle='draft'|'validated'|'tested'|'active'|'disabled'|'maintenance'|'rolled_back';
export type ModuleRunStatus='queued'|'running'|'succeeded'|'failed'|'cancelled';
export interface ModuleDependency { slug:string; versionRange:string; optional?:boolean; }
export interface ModuleManifest { apiVersion:'aether.module/v1'; slug:string; name:string; description:string; kind:ModuleKind; entrypoint:string; capabilities:string[]; dependencies:ModuleDependency[]; inputs:string[]; outputs:string[]; configurationSchema:Record<string,unknown>; prohibited:string[]; }
export interface ModuleDefinition { moduleId:string; version:string; manifest:ModuleManifest; config:Record<string,unknown>; configHash:string; }
export interface ModuleExecutionContext { moduleId:string; moduleSlug:string; version:string; taskId:string; runId:string; ownerId:string; inputs:Record<string,unknown>; config:Record<string,unknown>; }
export interface ModuleExecutionResult { status:'succeeded'|'failed'|'cancelled'; outputs?:Record<string,unknown>; error?:string; }
export interface ModuleHandler { execute(context:ModuleExecutionContext):Promise<ModuleExecutionResult>; }

const CAPABILITY_PATTERN=/^[a-z][a-z0-9._:-]{1,95}$/;
const SLUG_PATTERN=/^[a-z0-9][a-z0-9._-]{1,62}$/;
const SEMVER=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const FORBIDDEN_CAPABILITIES=new Set(['roles.modify','permissions.self_modify','security.policy.modify','code.exec.unrestricted','filesystem.host.write','secrets.read','network.unrestricted']);

export function stableModuleHash(value:unknown):string { const json=JSON.stringify(value); let hash=2166136261; for(let i=0;i<json.length;i+=1){hash^=json.charCodeAt(i);hash=Math.imul(hash,16777619);} return(hash>>>0).toString(16).padStart(8,'0'); }
export function parseVersion(version:string):[number,number,number]{const match=version.match(/^(\d+)\.(\d+)\.(\d+)/);if(!match)throw new Error('Version must use semver');return[Number(match[1]),Number(match[2]),Number(match[3])];}
export function versionSatisfies(version:string,range:string):boolean{const v=parseVersion(version),r=String(range||'*').trim();if(r==='*'||r==='latest')return true;const base=parseVersion(r.replace(/^[~^=]/,''));if(r.startsWith('^'))return v[0]===base[0]&&(v[1]>base[1]||(v[1]===base[1]&&v[2]>=base[2]));if(r.startsWith('~'))return v[0]===base[0]&&v[1]===base[1]&&v[2]>=base[2];return v[0]===base[0]&&v[1]===base[1]&&v[2]===base[2];}
export function validateModuleManifest(manifest:unknown):string[]{const errors:string[]=[];if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))return['Module manifest must be an object'];const m=manifest as Record<string,unknown>;if(m.apiVersion!=='aether.module/v1')errors.push('apiVersion must be aether.module/v1');if(typeof m.slug!=='string'||!SLUG_PATTERN.test(m.slug))errors.push('slug is invalid');if(typeof m.name!=='string'||!m.name.trim()||m.name.length>120)errors.push('name is required and must be <=120 characters');if(typeof m.description!=='string'||m.description.length>2000)errors.push('description must be <=2000 characters');if(!['application','game','integration','tool','workflow'].includes(String(m.kind)))errors.push('kind is invalid');if(typeof m.entrypoint!=='string'||!m.entrypoint.trim()||m.entrypoint.length>255)errors.push('entrypoint is required');for(const key of ['capabilities','dependencies','inputs','outputs','prohibited'])if(!Array.isArray(m[key]))errors.push(`${key} must be an array`);if(!m.configurationSchema||typeof m.configurationSchema!=='object'||Array.isArray(m.configurationSchema))errors.push('configurationSchema must be an object');const caps=(Array.isArray(m.capabilities)?m.capabilities:[]).filter((x):x is string=>typeof x==='string');for(const c of caps){if(!CAPABILITY_PATTERN.test(c))errors.push(`Invalid capability: ${c}`);if(FORBIDDEN_CAPABILITIES.has(c))errors.push(`Forbidden capability: ${c}`);}const prohibited=(Array.isArray(m.prohibited)?m.prohibited:[]).map(String).map(x=>x.toLowerCase());if(!prohibited.some(x=>x.includes('bypass authorization')))errors.push('Module must explicitly prohibit bypassing authorization');const deps=(Array.isArray(m.dependencies)?m.dependencies:[]) as unknown[];for(const d of deps){if(!d||typeof d!=='object'){errors.push('Dependency must be an object');continue;}const dep=d as Record<string,unknown>;if(typeof dep.slug!=='string'||!SLUG_PATTERN.test(dep.slug))errors.push('Dependency slug is invalid');if(typeof dep.versionRange!=='string'||!dep.versionRange.trim())errors.push('Dependency versionRange is required');}return[...new Set(errors)];}
export function validateModuleVersion(version:string):string[]{return SEMVER.test(version)?[]:['Version must use semantic versioning (x.y.z)'];}
export function assertModuleDependenciesAcyclic(slug:string,deps:Record<string,string[]>):void{const visiting=new Set<string>(),visited=new Set<string>();const walk=(node:string)=>{if(visiting.has(node))throw new Error(`Module dependency cycle detected at ${node}`);if(visited.has(node))return;visiting.add(node);for(const child of deps[node]??[])walk(child);visiting.delete(node);visited.add(node);};walk(slug);}
export function modulePermissionForCapability(capability:string):string{return `module.capability.${capability}`;}

const HANDLERS=new Map<string,ModuleHandler>();
export function registerModuleHandler(slug:string,handler:ModuleHandler):void{if(!SLUG_PATTERN.test(slug))throw new Error('Invalid module slug');if(HANDLERS.has(slug))throw new Error(`Module handler already registered: ${slug}`);HANDLERS.set(slug,handler);}
export function unregisterModuleHandler(slug:string):void{HANDLERS.delete(slug);}
export function hasModuleHandler(slug:string):boolean{return HANDLERS.has(slug);}
export async function executeRegisteredModule(slug:string,context:ModuleExecutionContext):Promise<ModuleExecutionResult>{const handler=HANDLERS.get(slug);if(!handler)return{status:'failed',error:`No trusted runtime handler registered for module ${slug}`};return handler.execute(context);}
export function registeredModuleSlugs():string[]{return [...HANDLERS.keys()].sort();}

export function moduleAgentKey():AgentKey{return 'module';}
