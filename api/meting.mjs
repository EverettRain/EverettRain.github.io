// Meting-compatible API for MetingJS (window.meting_api); Hexo copies it to api/meting.mjs and Vercel runs it.
// Audio URLs point at NetEase's official outer-link endpoint, so every listener's own browser fetches the
// audio and NetEase applies its region licensing to the real listener. Resolving audio here instead would
// make NetEase judge this overseas server, which is why public Meting APIs skip most songs.
const NETEASE = 'https://music.163.com';
const REQUEST_HEADERS = {
	Referer: 'https://music.163.com/',
	'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
};
// fee 1 = VIP only, 4 = paid album: never playable for an anonymous listener, so they only cause skips
const UNPLAYABLE_FEES = new Set([1, 4]);
const SONG_DETAIL_BATCH = 500;

const CACHE = {
	// Short enough that edits to the playlist on NetEase show up quickly
	playlist: 'public, s-maxage=600, stale-while-revalidate=86400',
	stable: 'public, s-maxage=86400, stale-while-revalidate=604800',
};

async function netease(path) {
	const response = await fetch(NETEASE + path, { headers: REQUEST_HEADERS });
	if (!response.ok) throw new Error(`NetEase responded ${response.status}`);
	const data = await response.json();
	if (data.code !== 200) throw new Error(`NetEase returned code ${data.code}`);
	return data;
}

async function songDetails(ids) {
	const songs = [];
	for (let i = 0; i < ids.length; i += SONG_DETAIL_BATCH) {
		const batch = JSON.stringify(ids.slice(i, i + SONG_DETAIL_BATCH));
		const data = await netease(`/api/song/detail/?ids=${encodeURIComponent(batch)}`);
		songs.push(...data.songs);
	}
	const byId = new Map(songs.map(song => [song.id, song]));
	return ids.map(id => byId.get(id)).filter(Boolean);
}

// name/artist/url/cover/lrc are what MetingJS and APlayer read; album and duration (seconds) are for the music library page
const toTrack = song => ({
	name: song.name,
	artist: song.artists.map(artist => artist.name).join(' / '),
	album: song.album.name,
	duration: Math.round(song.duration / 1000),
	url: `${NETEASE}/song/media/outer/url?id=${song.id}.mp3`,
	cover: `${song.album.picUrl.replace(/^http:/, 'https:')}?param=300y300`,
	lrc: `/api/meting?server=netease&type=lrc&id=${song.id}`,
});

const isPlayable = song => !UNPLAYABLE_FEES.has(song.fee);

async function playlist(id) {
	const data = await netease(`/api/v6/playlist/detail?id=${id}`);
	const songs = await songDetails(data.playlist.trackIds.map(track => track.id));
	return songs.filter(isPlayable).map(toTrack);
}

async function song(id) {
	return (await songDetails([Number(id)])).filter(isPlayable).map(toTrack);
}

// Translated lines keep their original timestamps, so the player shows each one under its original line
async function lyric(id) {
	const data = await netease(`/api/song/lyric?id=${id}&lv=1&tv=-1`);
	const original = data.lrc?.lyric;
	if (!original) return '[00:00.00]纯音乐，请欣赏';
	const translation = data.tlyric?.lyric;
	return translation ? `${original}\n${translation}` : original;
}

const json = (body, cacheControl, status = 200) =>
	Response.json(body, { status, headers: { 'Cache-Control': cacheControl } });

const fail = (status, message) => json({ error: message }, 'no-store', status);

export async function GET(request) {
	const params = new URL(request.url).searchParams;
	const id = params.get('id') || '';
	if (params.get('server') !== 'netease') return fail(400, 'only server=netease is supported');
	if (!/^\d+$/.test(id)) return fail(400, 'id must be numeric');

	try {
		switch (params.get('type')) {
			case 'playlist':
				return json(await playlist(id), CACHE.playlist);
			case 'song':
				return json(await song(id), CACHE.stable);
			case 'lrc':
				return new Response(await lyric(id), {
					headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': CACHE.stable },
				});
			default:
				return fail(400, 'type must be playlist, song or lrc');
		}
	} catch (error) {
		return fail(502, error.message);
	}
}
