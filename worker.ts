interface WorkerEnv {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

const KISSKH_API = 'https://kisskh-api.onrender.com';
const KISSKH_DIRECT_API = 'https://kisskh.co/api';

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
    },
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function fetchJson(url: string, timeoutMs = 25000) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0',
      referer: 'https://kisskh.co/',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) return null;
  const body = await response.text();
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

async function searchKissKh(title: string) {
  const primary = await fetchJson(
    `${KISSKH_API}/search?q=${encodeURIComponent(title)}`
  );
  if (Array.isArray(primary)) return primary;

  return fetchJson(
    `${KISSKH_DIRECT_API}/DramaList/Search?q=${encodeURIComponent(title)}&type=0`
  );
}

function numericId(value: unknown) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 1) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (Number.isSafeInteger(parsed) && parsed >= 1) return parsed;
  }
  return null;
}

function getEpisodeId(item: Record<string, unknown>) {
  return numericId(item.episodeId)
    ?? numericId(item.id)
    ?? numericId(item.Id)
    ?? null;
}

function getEpisodeNumber(item: Record<string, unknown>) {
  return numericId(item.number)
    ?? numericId(item.episodeNumber)
    ?? numericId(item.episode)
    ?? null;
}

async function resolveKissKhEpisodeId(episodeId: number) {
  let resolved = await fetchJson(`${KISSKH_API}/resolve/${episodeId}`);

  let subtitles: Array<{ file?: string; label?: string; kind?: string }> = [];
  if (!resolved) {
    const source = await fetchJson(
      `${KISSKH_DIRECT_API}/Episode/GetSources?episodeId=${episodeId}`
    );
    const subtitleResponse = await fetchJson(
      `${KISSKH_DIRECT_API}/Sub/GetByEpisodeId?episodeId=${episodeId}`
    );
    if (source && typeof source === 'object') {
      resolved = source;
      subtitles = Array.isArray(subtitleResponse)
        ? subtitleResponse.map((item: Record<string, unknown>) => ({
            file: typeof (item.src ?? item.file ?? item.url) === 'string'
              ? String(item.src ?? item.file ?? item.url)
              : undefined,
            label: typeof (item.label ?? item.name) === 'string'
              ? String(item.label ?? item.name)
              : 'Subtitle',
            kind: typeof item.kind === 'string' ? item.kind : 'captions',
          })).filter((item: { file?: string }) => item.file)
        : [];
    }
  } else if (Array.isArray(resolved.subtitles)) {
    subtitles = resolved.subtitles.map((item: Record<string, unknown>) => ({
      file: typeof (item.src ?? item.file ?? item.url) === 'string'
        ? String(item.src ?? item.file ?? item.url)
        : undefined,
      label: typeof (item.label ?? item.name) === 'string'
        ? String(item.label ?? item.name)
        : 'Subtitle',
      kind: typeof item.kind === 'string' ? item.kind : 'captions',
    })).filter((item: { file?: string }) => item.file);
  }

  const stream = resolved?.stream && typeof resolved.stream === 'object'
    ? resolved.stream
    : {};
  const videoUrl =
    stream.Video
    ?? stream.video
    ?? stream.BackupVideo
    ?? stream.backupVideo
    ?? stream.ThirdVideo
    ?? resolved?.videoUrl
    ?? resolved?.video
    ?? resolved?.Video
    ?? resolved?.src;
  if (typeof videoUrl !== 'string' || !videoUrl.trim()) return null;

  return { title: `KissKH Episode ${episodeId}`, videoUrl, subtitles };
}

async function resolveKissKh(title: string, episodeNumber: number) {
  const results = await searchKissKh(title);
  if (!Array.isArray(results)) return null;

  const wanted = normalizeTitle(title);
  const match = results.find((item) =>
    normalizeTitle(item.title ?? '') === wanted
  ) ?? results.find((item) =>
    normalizeTitle(item.title ?? '').includes(wanted) ||
    wanted.includes(normalizeTitle(item.title ?? ''))
  ) ?? results[0];
  const matchId = numericId(match?.id)
    ?? numericId(match?.dramaId)
    ?? numericId(match?.DramaId)
    ?? null;
  if (!matchId) return null;

  const info = await fetchJson(`${KISSKH_API}/info/${matchId}`);
  const directInfo = info ?? await fetchJson(
    `${KISSKH_DIRECT_API}/DramaList/Drama/${matchId}?isq=false`
  );
  if (!directInfo?.episodes || !Array.isArray(directInfo.episodes)) return null;

  const episode = directInfo.episodes.find((item: Record<string, unknown>) =>
    getEpisodeNumber(item) === episodeNumber
  );
  const episodeId = episode ? getEpisodeId(episode) : null;
  if (!episodeId) return null;

  let resolved = await fetchJson(
    `${KISSKH_API}/resolve/${episodeId}`
  );
  if (!resolved) {
    const source = await fetchJson(
      `${KISSKH_DIRECT_API}/Episode/GetSources?episodeId=${episodeId}`
    );
    const subtitles = await fetchJson(
      `${KISSKH_DIRECT_API}/Sub/GetByEpisodeId?episodeId=${episodeId}`
    );
    if (source?.video || source?.Video) {
      resolved = {
        stream: {
          Video: source.video ?? source.Video,
          BackupVideo: source.backupVideo ?? source.BackupVideo,
        },
        subtitles: Array.isArray(subtitles) ? subtitles.map((item: any) => ({
          file: item.src ?? item.file ?? item.url,
          label: item.label ?? item.name ?? 'Subtitle',
          kind: item.kind ?? 'captions',
        })).filter((item: any) => item.file) : [],
      };
    }
  }

  const stream = resolved?.stream && typeof resolved.stream === 'object'
    ? resolved.stream
    : {};
  const videoUrl =
    stream.Video
    ?? stream.video
    ?? stream.BackupVideo
    ?? stream.backupVideo
    ?? stream.ThirdVideo
    ?? resolved?.videoUrl
    ?? resolved?.video
    ?? resolved?.Video;
  if (!videoUrl) return null;

  return {
    title: match.title ?? title,
    videoUrl,
    subtitles: Array.isArray(resolved?.subtitles) ? resolved.subtitles : [],
  };
}

function kissKhPlayerHtml(result: {
  title: string;
  videoUrl: string;
  subtitles: Array<{ file?: string; label?: string; kind?: string }>;
}) {
  const tracks = result.subtitles
    .filter((subtitle) => subtitle.file)
    .map((subtitle, index) =>
      `<track kind="${escapeHtml(subtitle.kind === 'captions' ? 'captions' : 'subtitles')}" src="${escapeHtml(subtitle.file)}" srclang="en" label="${escapeHtml(subtitle.label ?? `Subtitle ${index + 1}`)}">`
    )
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(result.title)} - KissKH</title>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}video{width:100%;height:100%;object-fit:contain}body{font-family:system-ui,sans-serif}</style>
</head><body>
<video id="player" controls autoplay playsinline crossorigin="anonymous">${tracks}</video>
<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js"></script>
<script>
const video=document.getElementById("player");
const source=${JSON.stringify(result.videoUrl)};
if(window.Hls&&Hls.isSupported()){const hls=new Hls({enableWorker:true});hls.loadSource(source);hls.attachMedia(video);}
else{video.src=source;}
</script>
</body></html>`;
}

export default {
  async fetch(request: Request, env: WorkerEnv) {
    const url = new URL(request.url);

    if (url.pathname === '/api/kisskh/search') {
      const title = (url.searchParams.get('title') ?? '').trim();
      if (!title) return jsonResponse({ ok: false, error: 'Title is required' }, 400);
      const results = await searchKissKh(title);
      return jsonResponse({ ok: true, results: Array.isArray(results) ? results.slice(0, 10) : [] });
    }

    if (url.pathname === '/api/kisskh/player') {
      const title = (url.searchParams.get('title') ?? '').trim();
      const season = Number(url.searchParams.get('season') ?? 1);
      const episode = Number(url.searchParams.get('episode') ?? 1);
      const episodeId = numericId(url.searchParams.get('episodeId'));

      if (episodeId) {
        const result = await resolveKissKhEpisodeId(episodeId);
        if (!result) {
          return new Response(
            '<!doctype html><title>Episode unavailable</title><style>body{margin:0;display:grid;place-items:center;height:100vh;background:#000;color:#fff;font-family:system-ui}</style><p>This numeric KissKH episode ID could not be resolved.</p>',
            { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } },
          );
        }
        return new Response(kissKhPlayerHtml(result), {
          headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
        });
      }

      if (!title || !Number.isInteger(episode) || episode < 1) {
        return jsonResponse({ ok: false, error: 'Title and episode are required' }, 400);
      }
      const result = await resolveKissKh(title, episode);
      if (!result) {
        return new Response(
          '<!doctype html><title>Episode unavailable</title><style>body{margin:0;display:grid;place-items:center;height:100vh;background:#000;color:#fff;font-family:system-ui}</style><p>This episode could not be resolved from KissKH.</p>',
          { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } },
        );
      }
      return new Response(kissKhPlayerHtml(result), {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
