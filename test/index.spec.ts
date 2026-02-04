import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

describe('TrustGraph Validation Agents', () => {
	describe('GET /', () => {
		it('returns API info', async () => {
			const request = new Request<unknown, IncomingRequestCfProperties>('http://example.com/');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			const json = await response.json() as any;
			expect(json.name).toBe('TrustGraph Validation Agents');
			expect(json.agents).toContain('consistency');
			expect(json.agents).toContain('semantic-drift');
		});
	});

	describe('POST /api/validate', () => {
		it('validates a claim with consistency agent', async () => {
			const request = new Request<unknown, IncomingRequestCfProperties>('http://example.com/api/validate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'consistency',
					claim: 'The sky is blue'
				})
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			const json = await response.json() as any;
			expect(json).toHaveProperty('valid');
			expect(json).toHaveProperty('confidence');
			expect(typeof json.valid).toBe('boolean');
		});

		it('rejects unknown agent type', async () => {
			const request = new Request<unknown, IncomingRequestCfProperties>('http://example.com/api/validate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'unknown',
					claim: 'Test claim'
				})
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(400);
			const json = await response.json() as any;
			expect(json.error).toBe('Unknown agent type');
		});
	});

	describe('POST /api/intent', () => {
		// Skip in local tests - Vectorize requires remote
		it.skip('generates intent hash and embedding', async () => {
			const request = new Request<unknown, IncomingRequestCfProperties>('http://example.com/api/intent', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					text: 'Build trust infrastructure for AI'
				})
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			const json = await response.json() as any;
			expect(json).toHaveProperty('intentId');
			expect(json).toHaveProperty('intentHash');
			expect(json.intentHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
		});
	});

	describe('POST /api/gossip', () => {
		it('receives gossip messages', async () => {
			const request = new Request<unknown, IncomingRequestCfProperties>('http://example.com/api/gossip', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					intentHash: 'abc123',
					source: 'test-agent'
				})
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			const json = await response.json() as any;
			expect(json.received).toBe('abc123');
			expect(json.source).toBe('test-agent');
		});
	});
});
