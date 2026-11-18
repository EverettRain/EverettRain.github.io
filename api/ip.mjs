// Hexo copies this file to api/ip.mjs in the deployed site, where Vercel runs it as a function.
// Vercel attaches the visitor's IP geolocation to every request, so the welcome card gets its data
// from our own deployment instead of a third-party IP service that can disappear.
export function GET(request) {
	const headers = request.headers;
	const city = headers.get('x-vercel-ip-city');

	const body = {
		ip: headers.get('x-real-ip') || '',
		country: headers.get('x-vercel-ip-country') || '',
		region: headers.get('x-vercel-ip-country-region') || '',
		// Vercel percent-encodes non-ASCII city names (RFC 3986)
		city: city ? decodeURIComponent(city) : '',
		lat: parseFloat(headers.get('x-vercel-ip-latitude')),
		lng: parseFloat(headers.get('x-vercel-ip-longitude')),
	};

	// The response differs per visitor, so no shared cache may store it
	return Response.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
}
