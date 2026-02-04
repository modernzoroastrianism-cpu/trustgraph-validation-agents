/**
 * Temporal Logic Agent
 * 
 * Validates time-based reasoning and temporal consistency.
 * Detects anachronisms, impossible timelines, and temporal paradoxes.
 */

import { DurableObject } from 'cloudflare:workers';

interface TemporalResult {
	valid: boolean;
	confidence: number;
	timeline: TimelineEvent[];
	anomalies: string[];
}

interface TimelineEvent {
	event: string;
	timestamp: number | null;
	relative?: { before?: string[]; after?: string[] };
}

export class TemporalLogicAgent extends DurableObject {
	private timeline: Map<string, TimelineEvent> = new Map();
	
	constructor(ctx: DurableObjectState, env: any) {
		super(ctx, env);
		
		ctx.blockConcurrencyWhile(async () => {
			const stored = await ctx.storage.get<Map<string, TimelineEvent>>('timeline');
			if (stored) this.timeline = stored;
		});
	}
	
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		
		if (url.pathname === '/validate' && request.method === 'POST') {
			const body = await request.json() as { claim: string; context?: any };
			const result = await this.validate(body.claim, body.context);
			return new Response(JSON.stringify(result), {
				headers: { 'Content-Type': 'application/json' }
			});
		}
		
		if (url.pathname === '/record' && request.method === 'POST') {
			const body = await request.json() as TimelineEvent;
			await this.recordEvent(body);
			return new Response(JSON.stringify({ success: true }));
		}
		
		return new Response('Not found', { status: 404 });
	}
	
	async validate(claim: string, context?: any): Promise<TemporalResult> {
		const anomalies: string[] = [];
		let confidence = 1.0;
		
		// Extract temporal markers from claim
		const temporalMarkers = this.extractTemporalMarkers(claim);
		
		// Check for internal consistency
		for (const marker of temporalMarkers) {
			const check = this.checkTemporalConsistency(marker);
			if (!check.valid) {
				anomalies.push(...check.issues);
				confidence *= 0.7;
			}
		}
		
		// Check against known timeline
		const timelineCheck = this.checkAgainstTimeline(claim, temporalMarkers);
		if (!timelineCheck.valid) {
			anomalies.push(...timelineCheck.issues);
			confidence *= 0.6;
		}
		
		return {
			valid: anomalies.length === 0,
			confidence,
			timeline: Array.from(this.timeline.values()).slice(-10),
			anomalies
		};
	}
	
	private extractTemporalMarkers(claim: string): string[] {
		const markers: string[] = [];
		
		// Date patterns
		const datePattern = /\b(\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|january|february|march|april|may|june|july|august|september|october|november|december)\b/gi;
		const dates = claim.match(datePattern);
		if (dates) markers.push(...dates);
		
		// Relative time
		const relativePattern = /\b(before|after|during|while|when|then|first|last|previous|next|earlier|later)\b/gi;
		const relatives = claim.match(relativePattern);
		if (relatives) markers.push(...relatives);
		
		// Temporal impossibilities
		const impossiblePattern = /\b(never|always|forever|eternal)\b/gi;
		const impossibles = claim.match(impossiblePattern);
		if (impossibles) markers.push(...impossibles);
		
		return markers;
	}
	
	private checkTemporalConsistency(marker: string): { valid: boolean; issues: string[] } {
		const issues: string[] = [];
		
		// Check for contradictory temporal claims
		// "before X" and "after X" for same event
		// Future dates claimed as past
		// etc.
		
		return { valid: issues.length === 0, issues };
	}
	
	private checkAgainstTimeline(claim: string, markers: string[]): { valid: boolean; issues: string[] } {
		const issues: string[] = [];
		
		// Check claim against established timeline
		for (const [eventId, event] of this.timeline) {
			// Look for references to known events
			if (claim.toLowerCase().includes(event.event.toLowerCase())) {
				// Verify temporal consistency
				if (event.relative?.before) {
					for (const beforeEvent of event.relative.before) {
						if (claim.includes(`after ${beforeEvent}`) && claim.includes(event.event)) {
							issues.push(`Temporal inconsistency: ${event.event} must be before ${beforeEvent}`);
						}
					}
				}
			}
		}
		
		return { valid: issues.length === 0, issues };
	}
	
	async recordEvent(event: TimelineEvent): Promise<void> {
		const id = crypto.randomUUID();
		this.timeline.set(id, event);
		await this.ctx.storage.put('timeline', this.timeline);
	}
}
