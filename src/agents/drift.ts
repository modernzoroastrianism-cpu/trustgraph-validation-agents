/**
 * Semantic Drift Agent
 * 
 * Tracks meaning stability over time.
 * Detects when terms or concepts shift meaning.
 * Uses embedding distance to measure semantic change.
 */

import { DurableObject } from 'cloudflare:workers';

interface DriftResult {
	stable: boolean;
	driftScore: number;  // 0 = no drift, 1 = complete meaning change
	history: { timestamp: number; embedding: number[] }[];
	alert: string | null;
}

interface TermHistory {
	term: string;
	snapshots: {
		timestamp: number;
		embedding: number[];
		context: string;
	}[];
}

export class SemanticDriftAgent extends DurableObject {
	private termHistories: Map<string, TermHistory> = new Map();
	private driftThreshold = 0.3; // Alert if drift exceeds 30%
	
	constructor(ctx: DurableObjectState, env: any) {
		super(ctx, env);
		
		ctx.blockConcurrencyWhile(async () => {
			const stored = await ctx.storage.get<Map<string, TermHistory>>('termHistories');
			if (stored) this.termHistories = stored;
		});
	}
	
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		
		if (url.pathname === '/validate' && request.method === 'POST') {
			const body = await request.json() as { claim: string; context?: any };
			// Extract terms and check for drift
			const result = await this.checkDrift(body.claim);
			return new Response(JSON.stringify(result), {
				headers: { 'Content-Type': 'application/json' }
			});
		}
		
		if (url.pathname === '/snapshot' && request.method === 'POST') {
			const body = await request.json() as { term: string; embedding: number[]; context: string };
			await this.recordSnapshot(body.term, body.embedding, body.context);
			return new Response(JSON.stringify({ success: true }));
		}
		
		if (url.pathname === '/history' && request.method === 'GET') {
			const term = url.searchParams.get('term');
			if (!term) return new Response('Missing term', { status: 400 });
			const history = this.termHistories.get(term);
			return new Response(JSON.stringify(history || null), {
				headers: { 'Content-Type': 'application/json' }
			});
		}
		
		return new Response('Not found', { status: 404 });
	}
	
	async checkDrift(claim: string): Promise<DriftResult> {
		// Extract key terms (simplified - would use NLP in production)
		const terms = claim.toLowerCase().split(/\s+/).filter(t => t.length > 4);
		
		let maxDrift = 0;
		let driftingTerm: string | null = null;
		const histories: { timestamp: number; embedding: number[] }[] = [];
		
		for (const term of terms) {
			const history = this.termHistories.get(term);
			if (history && history.snapshots.length > 1) {
				const drift = this.calculateDrift(history.snapshots);
				if (drift > maxDrift) {
					maxDrift = drift;
					driftingTerm = term;
					histories.push(...history.snapshots.map(s => ({
						timestamp: s.timestamp,
						embedding: s.embedding.slice(0, 5) // Truncate for response
					})));
				}
			}
		}
		
		return {
			stable: maxDrift < this.driftThreshold,
			driftScore: maxDrift,
			history: histories,
			alert: maxDrift >= this.driftThreshold 
				? `Term "${driftingTerm}" has drifted ${(maxDrift * 100).toFixed(1)}% from original meaning`
				: null
		};
	}
	
	private calculateDrift(snapshots: { embedding: number[] }[]): number {
		if (snapshots.length < 2) return 0;
		
		const first = snapshots[0].embedding;
		const last = snapshots[snapshots.length - 1].embedding;
		
		// Cosine distance
		return 1 - this.cosineSimilarity(first, last);
	}
	
	private cosineSimilarity(a: number[], b: number[]): number {
		if (a.length !== b.length) return 0;
		
		let dotProduct = 0;
		let normA = 0;
		let normB = 0;
		
		for (let i = 0; i < a.length; i++) {
			dotProduct += a[i] * b[i];
			normA += a[i] * a[i];
			normB += b[i] * b[i];
		}
		
		const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
		return magnitude === 0 ? 0 : dotProduct / magnitude;
	}
	
	async recordSnapshot(term: string, embedding: number[], context: string): Promise<void> {
		let history = this.termHistories.get(term);
		
		if (!history) {
			history = { term, snapshots: [] };
		}
		
		history.snapshots.push({
			timestamp: Date.now(),
			embedding,
			context
		});
		
		// Keep last 100 snapshots
		if (history.snapshots.length > 100) {
			history.snapshots = history.snapshots.slice(-100);
		}
		
		this.termHistories.set(term, history);
		await this.ctx.storage.put('termHistories', this.termHistories);
	}
}
