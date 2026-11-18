// Site and page view counts from our self-hosted Umami, replacing the busuanzi counter service.
// Hexo copies this file to api/stats.mjs and Vercel runs it. Umami's stats API needs a login, so the
// credentials live in the Vercel env vars UMAMI_USERNAME / UMAMI_PASSWORD and the browser only gets counts.
const UMAMI = 'https://umami.everettrain.cn';
const WEBSITE_ID = 'cbb6ae5f-f4e0-4258-9da2-43a15f541509';
// Umami treats startAt=0&endAt=1 as "all time"
const ALL_TIME = 'startAt=0&endAt=1';
const MAX_PATH_LENGTH = 512;

// Shared by concurrent requests of a warm instance so they log in once
let tokenPromise;

function login() {
	const { UMAMI_USERNAME: username, UMAMI_PASSWORD: password } = process.env;
	if (!username || !password) return Promise.reject(new Error('UMAMI_USERNAME / UMAMI_PASSWORD are not set'));

	return fetch(`${UMAMI}/api/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password }),
	}).then(async response => {
		if (!response.ok) throw new Error(`Umami login failed: ${response.status}`);
		return (await response.json()).token;
	});
}

async function websiteStats(filter, isRetry = false) {
	tokenPromise ??= login().catch(error => {
		tokenPromise = undefined;
		throw error;
	});
	const token = await tokenPromise;
	const response = await fetch(`${UMAMI}/api/websites/${WEBSITE_ID}/stats?${ALL_TIME}${filter}`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	// Tokens expire; log in again once
	if (response.status === 401 && !isRetry) {
		tokenPromise = undefined;
		return websiteStats(filter, true);
	}
	if (!response.ok) throw new Error(`Umami responded ${response.status}`);
	return response.json();
}

export async function GET(request) {
	const path = new URL(request.url).searchParams.get('path');
	if (path !== null && (!path.startsWith('/') || path.length > MAX_PATH_LENGTH)) {
		return Response.json({ error: 'path must be a site path' }, { status: 400 });
	}

	try {
		const [site, page] = await Promise.all([
			websiteStats(''),
			path === null ? null : websiteStats(`&url=${encodeURIComponent(path)}`),
		]);
		return Response.json(
			{ site_pv: site.pageviews.value, site_uv: site.visitors.value, page_pv: page ? page.pageviews.value : null },
			// Counts may lag a few minutes; in exchange Umami is queried at most once per path per window
			{ headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } },
		);
	} catch (error) {
		return Response.json({ error: error.message }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
	}
}
