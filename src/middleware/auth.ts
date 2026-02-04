/**
 * API Key Authentication Middleware
 */

export interface AuthEnv {
	API_KEY: string;
}

export function authenticate(request: Request, env: AuthEnv): Response | null {
	// Skip auth for health check
	const url = new URL(request.url);
	if (url.pathname === '/' || url.pathname === '/health') {
		return null;
	}
	
	// Check Authorization header
	const authHeader = request.headers.get('Authorization');
	
	if (!authHeader) {
		return new Response(JSON.stringify({ 
			error: 'Missing Authorization header',
			hint: 'Use: Authorization: Bearer <api_key>'
		}), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}
	
	// Extract token
	const [scheme, token] = authHeader.split(' ');
	
	if (scheme !== 'Bearer' || !token) {
		return new Response(JSON.stringify({ 
			error: 'Invalid Authorization format',
			hint: 'Use: Authorization: Bearer <api_key>'
		}), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}
	
	// Validate token (constant-time comparison)
	if (!secureCompare(token, env.API_KEY)) {
		return new Response(JSON.stringify({ 
			error: 'Invalid API key'
		}), {
			status: 403,
			headers: { 'Content-Type': 'application/json' }
		});
	}
	
	// Auth passed
	return null;
}

// Constant-time string comparison to prevent timing attacks
function secureCompare(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}
	
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	
	return result === 0;
}
