/**
 * TrustGraph Validation Agents
 * 
 * Five agent types for trust verification:
 * 1. Consistency Agent - logical coherence checking
 * 2. Source Verification Agent - provenance validation
 * 3. Temporal Logic Agent - time-based reasoning
 * 4. Mathematical Proof Agent - formal verification
 * 5. Semantic Drift Agent - meaning stability tracking
 */

import { ConsistencyAgent } from './agents/consistency';
import { SourceVerificationAgent } from './agents/source';
import { TemporalLogicAgent } from './agents/temporal';
import { MathematicalProofAgent } from './agents/math';
import { SemanticDriftAgent } from './agents/drift';
import { authenticate } from './middleware/auth';

export { 
	ConsistencyAgent, 
	SourceVerificationAgent, 
	TemporalLogicAgent, 
	MathematicalProofAgent, 
	SemanticDriftAgent 
};

export interface Env {
	CONSISTENCY_AGENT: DurableObjectNamespace;
	SOURCE_AGENT: DurableObjectNamespace;
	TEMPORAL_AGENT: DurableObjectNamespace;
	MATH_AGENT: DurableObjectNamespace;
	DRIFT_AGENT: DurableObjectNamespace;
	TRUST_DB: D1Database;
	EMBEDDINGS: VectorizeIndex;
	INTENT_CACHE: KVNamespace;
	AI: Ai;
	API_KEY: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// CORS headers for browser access
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		};
		
		// Handle preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}
		
		// Authenticate API requests
		const authError = authenticate(request, env);
		if (authError) {
			return new Response(authError.body, {
				status: authError.status,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}
		
		const url = new URL(request.url);
		
		// Route to appropriate agent
		if (url.pathname.startsWith('/api/validate')) {
			return handleValidation(request, env);
		}
		
		if (url.pathname.startsWith('/api/intent')) {
			return handleIntent(request, env);
		}
		
		if (url.pathname.startsWith('/api/gossip')) {
			return handleGossip(request, env);
		}
		
		return new Response(JSON.stringify({
			name: 'TrustGraph Validation Agents',
			version: '0.1.0',
			agents: [
				'consistency',
				'source-verification', 
				'temporal-logic',
				'mathematical-proof',
				'semantic-drift'
			],
			endpoints: {
				validate: '/api/validate',
				intent: '/api/intent',
				gossip: '/api/gossip'
			}
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	},
};

async function handleValidation(request: Request, env: Env): Promise<Response> {
	const body = await request.json() as { type: string; claim: string; context?: any };
	const { type, claim, context } = body;
	
	// Get appropriate agent
	let agentNamespace: DurableObjectNamespace;
	switch (type) {
		case 'consistency':
			agentNamespace = env.CONSISTENCY_AGENT;
			break;
		case 'source':
			agentNamespace = env.SOURCE_AGENT;
			break;
		case 'temporal':
			agentNamespace = env.TEMPORAL_AGENT;
			break;
		case 'math':
			agentNamespace = env.MATH_AGENT;
			break;
		case 'drift':
			agentNamespace = env.DRIFT_AGENT;
			break;
		default:
			return new Response(JSON.stringify({ error: 'Unknown agent type' }), { status: 400 });
	}
	
	// Route to agent
	const id = agentNamespace.idFromName('default');
	const agent = agentNamespace.get(id);
	
	return agent.fetch(new Request('http://internal/validate', {
		method: 'POST',
		body: JSON.stringify({ claim, context })
	}));
}

async function handleIntent(request: Request, env: Env): Promise<Response> {
	const body = await request.json() as { text: string };
	const { text } = body;
	
	// Generate embedding via Workers AI
	const embeddingResult = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
		text: [text]
	}) as { data: number[][] };
	
	const embeddingVector = embeddingResult.data[0];
	
	// Store in Vectorize
	const intentId = crypto.randomUUID();
	await env.EMBEDDINGS.upsert([{
		id: intentId,
		values: embeddingVector,
		metadata: { text, timestamp: Date.now() }
	}]);
	
	// Hash the intent (SHA-256 of embedding)
	const hashBuffer = await crypto.subtle.digest('SHA-256', 
		new TextEncoder().encode(JSON.stringify(embeddingVector))
	);
	const intentHash = Array.from(new Uint8Array(hashBuffer))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
	
	return new Response(JSON.stringify({
		intentId,
		intentHash,
		embedding: embeddingVector.slice(0, 5) // First 5 dims for preview
	}), {
		headers: { 'Content-Type': 'application/json' }
	});
}

async function handleGossip(request: Request, env: Env): Promise<Response> {
	const body = await request.json() as { intentHash: string; source: string };
	const { intentHash, source } = body;
	
	// Query similar intents
	// This is where gossip-based alignment happens
	// Find neighbors with similar intent hashes
	
	// For now, return stub
	return new Response(JSON.stringify({
		received: intentHash,
		source,
		neighbors: [],
		consensus: null
	}), {
		headers: { 'Content-Type': 'application/json' }
	});
}
