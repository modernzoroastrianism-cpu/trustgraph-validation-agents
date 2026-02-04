/**
 * Mathematical Proof Agent
 * 
 * Validates numerical claims and mathematical reasoning.
 * Checks calculations, statistics, and logical proofs.
 */

import { DurableObject } from 'cloudflare:workers';

interface MathResult {
	valid: boolean;
	confidence: number;
	calculations: CalculationCheck[];
	proofSteps: string[];
	errors: string[];
}

interface CalculationCheck {
	expression: string;
	claimed: number | string;
	computed: number | string | null;
	valid: boolean;
}

export class MathematicalProofAgent extends DurableObject {
	private knownConstants: Map<string, number> = new Map([
		['pi', Math.PI],
		['e', Math.E],
		['phi', 1.618033988749895], // Golden ratio
	]);
	
	constructor(ctx: DurableObjectState, env: any) {
		super(ctx, env);
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
		
		if (url.pathname === '/compute' && request.method === 'POST') {
			const body = await request.json() as { expression: string };
			const result = this.safeEval(body.expression);
			return new Response(JSON.stringify({ result }));
		}
		
		return new Response('Not found', { status: 404 });
	}
	
	async validate(claim: string, context?: any): Promise<MathResult> {
		const errors: string[] = [];
		const calculations: CalculationCheck[] = [];
		const proofSteps: string[] = [];
		let confidence = 1.0;
		
		// Extract mathematical expressions
		const mathExpressions = this.extractMathExpressions(claim);
		
		for (const expr of mathExpressions) {
			const check = this.checkCalculation(expr);
			calculations.push(check);
			if (!check.valid) {
				errors.push(`Invalid calculation: ${expr.expression} = ${expr.claimed} (should be ${check.computed})`);
				confidence *= 0.5;
			}
		}
		
		// Check for statistical claims
		const statCheck = this.checkStatisticalClaims(claim);
		if (!statCheck.valid) {
			errors.push(...statCheck.issues);
			confidence *= 0.7;
		}
		
		// Check for logical fallacies in mathematical reasoning
		const logicCheck = this.checkMathLogic(claim);
		if (!logicCheck.valid) {
			errors.push(...logicCheck.issues);
			confidence *= 0.8;
		}
		
		return {
			valid: errors.length === 0,
			confidence,
			calculations,
			proofSteps,
			errors
		};
	}
	
	private extractMathExpressions(claim: string): { expression: string; claimed: string }[] {
		const expressions: { expression: string; claimed: string }[] = [];
		
		// Pattern: "X = Y" or "X equals Y"
		const equalsPattern = /(\d+[\d\s\+\-\*\/\(\)\.]*)\s*(?:=|equals?)\s*(\d+(?:\.\d+)?)/gi;
		let match;
		while ((match = equalsPattern.exec(claim)) !== null) {
			expressions.push({
				expression: match[1].trim(),
				claimed: match[2]
			});
		}
		
		// Pattern: percentages
		const percentPattern = /(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)\s*(?:is|=|equals?)\s*(\d+(?:\.\d+)?)/gi;
		while ((match = percentPattern.exec(claim)) !== null) {
			const percent = parseFloat(match[1]);
			const total = parseFloat(match[2]);
			expressions.push({
				expression: `${percent}% of ${total}`,
				claimed: match[3]
			});
		}
		
		return expressions;
	}
	
	private checkCalculation(expr: { expression: string; claimed: string }): CalculationCheck {
		const computed = this.safeEval(expr.expression);
		const claimedNum = parseFloat(expr.claimed);
		
		// Allow for floating point tolerance
		const tolerance = 0.0001;
		const valid = computed !== null && Math.abs(computed - claimedNum) < tolerance;
		
		return {
			expression: expr.expression,
			claimed: expr.claimed,
			computed,
			valid
		};
	}
	
	private safeEval(expression: string): number | null {
		try {
			// Sanitize: only allow numbers and basic operators
			const sanitized = expression.replace(/[^0-9\+\-\*\/\(\)\.\s%]/g, '');
			
			// Handle percentage
			if (sanitized.includes('%')) {
				const parts = sanitized.match(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/);
				if (parts) {
					return (parseFloat(parts[1]) / 100) * parseFloat(parts[2]);
				}
			}
			
			// Use Function constructor for safe math eval
			// This is limited but safer than raw eval
			const result = new Function(`return ${sanitized}`)();
			return typeof result === 'number' && !isNaN(result) ? result : null;
		} catch {
			return null;
		}
	}
	
	private checkStatisticalClaims(claim: string): { valid: boolean; issues: string[] } {
		const issues: string[] = [];
		
		// Check for impossible percentages (>100% or <0%)
		const percentages = claim.match(/(\d+(?:\.\d+)?)\s*%/g);
		if (percentages) {
			for (const pct of percentages) {
				const value = parseFloat(pct);
				if (value > 100 && !claim.includes('increase') && !claim.includes('growth')) {
					issues.push(`Suspicious percentage: ${pct} (>100%)`);
				}
			}
		}
		
		// Check for sample size issues
		if (claim.includes('survey') || claim.includes('study')) {
			const sampleMatch = claim.match(/(\d+)\s*(?:people|participants|respondents)/);
			if (sampleMatch && parseInt(sampleMatch[1]) < 30) {
				issues.push(`Small sample size: ${sampleMatch[1]} (may not be statistically significant)`);
			}
		}
		
		return { valid: issues.length === 0, issues };
	}
	
	private checkMathLogic(claim: string): { valid: boolean; issues: string[] } {
		const issues: string[] = [];
		
		// Check for division by zero implications
		if (claim.includes('divided by 0') || claim.includes('/ 0')) {
			issues.push('Division by zero is undefined');
		}
		
		// Check for negative under square root (in real number context)
		if (claim.match(/sqrt.*-\d+/) || claim.match(/square root.*negative/i)) {
			if (!claim.includes('imaginary') && !claim.includes('complex')) {
				issues.push('Square root of negative number requires complex numbers');
			}
		}
		
		return { valid: issues.length === 0, issues };
	}
}
