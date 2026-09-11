import { describe, expect, it } from 'vitest';
import { AGENTS } from '../agents';

describe('Phase P validation gate',()=>{it('keeps optimization agent active',()=>{expect(AGENTS.find(a=>a.key==='optimization')?.status).toBe('enabled');});});
