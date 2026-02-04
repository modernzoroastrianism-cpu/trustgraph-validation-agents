/**
 * Source Verification Agent
 * 
 * Validates provenance and trustworthiness of information sources.
 * Tracks source reputation over time.
 */

import { DurableObject } from 'cloudflare:workers';

interface SourceResult {
	verified: boolean;
	trustScore: number;
	source: string | null;
	chain: string[];
	warnings: string[];
}

interface SourceRecord {
	id: string;
	name: string;
	trustScore: number;
	verifiedClaims: number;
	falseClaims: number;
	lastUpdated: number;
}

export class SourceVerificationAgent extends DurableObject {
	private sources: Map<string, SourceRecord> = new Map();
	
	constructor(ctx: DurableObjectState, env: any) {
		super(ctx, env);
		
		ctx.blockConcurrencyWhile(async () => {
			const stored = await ctx.storage.get<Map<string, SourceRecord>>('sources');
			if (stored) this.sources = stored;
		});
	}
	
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		
		if (url.pathname === '/validate' && request.method === 'POST') {
			const body = await request.json() as { claim: string; context?: { source?: string } };
			const result = await this.verify(body.claim, body.context?.source);
			return new Response(JSON.stringify(result), {
				headers: { 'Content-Type': 'application/json' }
			});
		}
		
		if (url.pathname === '/register' && request.method === 'POST') {
			const body = await request.json() as { name: string; initialTrust?: number };
			const source = await this.registerSource(body.name, body.initialTrust);
			return new Response(JSON.stringify(source));
		}
		
		if (url.pathname === '/feedback' && request.method === 'POST') {
			const body = await request.json() as { sourceId: string; verified: boolean };
			await this.recordFeedback(body.sourceId, body.verified);
			return new Response(JSON.stringify({ success: true }));
		}
		
		return new Response('Not found', { status: 404 });
	}
	
	async verify(claim: string, sourceId?: string): Promise<SourceResult> {
		const warnings: string[] = [];
		const chain: string[] = [];
		
		if (!sourceId) {
			return {
				verified: false,
				trustScore: 0,
				source: null,
				chain: [],
				warnings: ['No source provided']
			};
		}
		
		const source = this.sources.get(sourceId);
		
		if (!source) {
			return {
				verified: false,
				trustScore: 0,
				source: sourceId,
				chain: [],
				warnings: ['Unknown source']
			};
		}
		
		chain.push(source.name);
		
		// Check trust score
		if (source.trustScore < 0.3) {
			warnings.push(`Source "${source.name}" has low trust score (${(source.trustScore * 100).toFixed(0)}%)`);
		}
		
		// Check for recent false claims
		const falseRate = source.falseClaims / (source.verifiedClaims + source.falseClaims + 1);
		if (falseRate > 0.2) {
			warnings.push(`Source has ${(falseRate * 100).toFixed(0)}% false claim rate`);
		}
		
		return {
			verified: source.trustScore >= 0.5 && falseRate < 0.3,
			trustScore: source.trustScore,
			source: source.name,
			chain,
			warnings
		};
	}
	
	async registerSource(name: string, initialTrust: number = 0.5): Promise<SourceRecord> {
		const id = crypto.randomUUID();
		const source: SourceRecord = {
			id,
			name,
			trustScore: Math.max(0, Math.min(1, initialTrust)),
			verifiedClaims: 0,
			falseClaims: 0,
			lastUpdated: Date.now()
		};
		
		this.sources.set(id, source);
		await this.ctx.storage.put('sources', this.sources);
		
		return source;
	}
	
	async recordFeedback(sourceId: string, verified: boolean): Promise<void> {
		const source = this.sources.get(sourceId);
		if (!source) return;
		
		if (verified) {
			source.verifiedClaims++;
			// Increase trust (with diminishing returns)
			source.trustScore = Math.min(1, source.trustScore + 0.01 * (1 - source.trustScore));
		} else {
			source.falseClaims++;
			// Decrease trust (faster than increase)
			source.trustScore = Math.max(0, source.trustScore - 0.05);
		}
		
		source.lastUpdated = Date.now();
		this.sources.set(sourceId, source);
		await this.ctx.storage.put('sources', this.sources);
	}
}
