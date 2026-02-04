import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

// Helper to create authenticated request
function authRequest(url: string, options: RequestInit = {}): Request {
	const headers = new Headers(options.headers);
	headers.set('Authorization', `Bearer ${env.API_KEY}`);
	return new Request<unknown, IncomingRequestCfProperties>(url, {
		...options,
		headers
	});
}

describe('TrustGraph Validation Agents', () => {
	describe('GET / (public)', () => {
		it('returns API info without auth', async () => {
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

	describe('Authentication', () => {
		it('rejects requests without auth header', async () => {
			const request = new Request<unknown, IncomingRequestCfProperties>('http://example.com/api/validate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'consistency', claim: 'test' })
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(401);
		});

		it('rejects invalid API key', async () => {
			const request = new Request<unknown, IncomingRequestCfProperties>('http://example.com/api/validate', {
				method: 'POST',
				headers: { 
					'Content-Type': 'application/json',
					'Authorization': 'Bearer invalid_key'
				},
				body: JSON.stringify({ type: 'consistency', claim: 'test' })
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(403);
		});
	});

	describe('POST /api/validate (authenticated)', () => {
		it('validates a claim with consistency agent', async () => {
			const request = authRequest('http://example.com/api/validate', {
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
			
			expect(response.status).toBe(200);
			const json = await response.json() as any;
			expect(json).toHaveProperty('valid');
			expect(json).toHaveProperty('confidence');
			expect(typeof json.valid).toBe('boolean');
		});

		it('rejects unknown agent type', async () => {
			const request = authRequest('http://example.com/api/validate', {
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

	describe('POST /api/intent (authenticated)', () => {
		// Skip in local tests - Vectorize requires remote
		it.skip('generates intent hash and embedding', async () => {
			const request = authRequest('http://example.com/api/intent', {
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

	describe('POST /api/gossip (authenticated)', () => {
		it('receives gossip messages', async () => {
			const request = authRequest('http://example.com/api/gossip', {
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
			
			expect(response.status).toBe(200);
			const json = await response.json() as any;
			expect(json.received).toBe('abc123');
			expect(json.source).toBe('test-agent');
		});
	});
});
