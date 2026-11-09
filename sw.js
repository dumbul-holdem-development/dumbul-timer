// 덤불홀덤 타이머 — 오프라인 캐시용 서비스 워커
// 와이파이가 있을 때 고양이 이미지·소리를 미리 저장해두고, 끊겨도 그대로 보이게 해줘요.
const CACHE = 'dumbul-timer-v1';
const BASE = new URL(self.registration.scope).pathname;   // 사이트 루트('/') 또는 하위 폴더('/저장소이름/')
const PAGE = BASE + 'index.html';
const PRECACHE = [
  "index.html",
  "cats/cat-bg-gif.gif",
  "cats/cat1.jpg",
  "cats/cat10.jpg",
  "cats/cat11.jpg",
  "cats/cat12.jpg",
  "cats/cat13.jpg",
  "cats/cat14.jpg",
  "cats/cat15.jpg",
  "cats/cat16.jpg",
  "cats/cat17.jpg",
  "cats/cat18.jpg",
  "cats/cat19.jpg",
  "cats/cat2.jpg",
  "cats/cat20.jpg",
  "cats/cat3.jpg",
  "cats/cat4.jpg",
  "cats/cat5.jpg",
  "cats/cat6.jpg",
  "cats/cat7.jpg",
  "cats/cat8.jpg",
  "cats/cat9.jpg",
  "mascot/cat-dance.gif",
  "mascot/deco1.png",
  "mascot/deco2.png",
  "mascot/mascot.png",
  "mascot/timer-cat-left.png",
  "sounds/meow.mp3"
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('dumbul-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isPage(url) {
  return url.pathname === BASE || url.pathname === PAGE;
}
function isOurs(url) {
  return url.origin === location.origin && (
    isPage(url) ||
    url.pathname.startsWith(BASE + 'cats/') ||
    url.pathname.startsWith(BASE + 'mascot/') ||
    url.pathname.startsWith(BASE + 'sounds/')
  );
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!isOurs(url)) return;
  e.respondWith(isPage(url) ? networkFirst(req) : staleWhileRevalidate(req));
});

// 페이지: 온라인이면 최신, 3초 안에 응답이 없거나 오프라인이면 저장된 것
async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(PAGE);
  const net = fetch(req).then((res) => {
    if (res.ok) cache.put(PAGE, res.clone());
    return res;
  });
  if (!cached) return net.catch(() => Response.error());
  return Promise.race([
    net.catch(() => cached),
    new Promise((resolve) => setTimeout(() => resolve(cached), 3000)),
  ]);
}

// 이미지/소리: 저장된 걸 바로 보여주고, 뒤에서 몰래 최신으로 갱신
async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req.url);
  const net = fetch(req.url)
    .then((res) => {
      if (res.ok) cache.put(req.url, res.clone());
      return res;
    })
    .catch(() => null);
  const res = cached || (await net);
  if (!res) return Response.error();
  if (req.headers.has('range') && res.ok) return rangeResponse(req, res);
  return res;
}

// 소리 파일 재생에 쓰이는 부분 요청(Range) 처리
async function rangeResponse(req, res) {
  const buf = await res.clone().arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range'));
  const size = buf.byteLength;
  let start = m && m[1] ? parseInt(m[1], 10) : 0;
  let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
  if (m && !m[1] && m[2]) { start = size - parseInt(m[2], 10); end = size - 1; }
  end = Math.min(end, size - 1);
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
      'Content-Length': String(end - start + 1),
    },
  });
}
