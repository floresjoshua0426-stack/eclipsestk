/* ECLIPSE STK R74: retained archives and bounded cached-response lifetimes.
 * Deploy beside index.html as JavaScript over HTTPS. This worker never fetches
 * music, models, private data, arbitrary message URLs, or background updates.
 * The page owns consent, original verification, saving, and archive removal.
 */
'use strict';

const WORKER_BUILD = 'eclipse-stk-offline-r74-v1';
const PRIOR_WORKER_BUILD = 'eclipse-stk-offline-r73-v1';
const LEGACY_WORKER_BUILD = 'eclipse-stk-offline-r70-v1';
const CAPABILITIES = Object.freeze(['originals-v1', 'listening-v1']);
const PROTOCOL_VERSION = 1;
const ORIGINALS_CACHE = 'eclipse-stk-originals-v1';
const LISTENING_CACHE = 'eclipse-stk-listening-v1';
const SHELL_CACHE = 'eclipse-stk-shell-v1';
const BASE_URL = new URL('./', self.location.href);
const SHELL_URL = new URL('index.html', BASE_URL).href;
const AUDIO_PREFIX = new URL('__eclipse_offline_audio__/', BASE_URL).pathname;
const LISTENING_PREFIX = new URL('__eclipse_offline_listening__/', BASE_URL).pathname;
const MAX_ORIGINAL_BYTES = 256 * 1024 * 1024;
const MAX_SHELL_BYTES = 24 * 1024 * 1024;
const SHELL_PREFIX_BYTES = 16 * 1024;
const SHELL_TIMEOUT_MS = 45000;
const NAVIGATION_TIMEOUT_MS = 8000;
const PROTECTED_BASELINE = 'eclipse-stk-2026-09-23-r50-xion-michael-q5-motherbrain2-fightchat-xion4lock-friendmother-fidelity1-michael-trusted-survivor1-final';
let shellTask = null;
let shellAbort = null;
let shellEpoch = 0;
let shellClearing = null;

function error(code, message) {
  const value = new Error(message);
  value.code = code;
  return value;
}

function publicPath(url) {
  return url.origin === BASE_URL.origin && !url.username && !url.password &&
    (url.pathname === BASE_URL.pathname || url.href.split(/[?#]/)[0] === SHELL_URL);
}

function positiveSize(value, maximum) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,15}$/.test(value)) return 0;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : 0;
}

function disposalLimit(task) {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, 2500);
    Promise.resolve(task).then(() => { clearTimeout(timer); resolve(); }, () => { clearTimeout(timer); resolve(); });
  });
}

async function cancelBody(response, reason) {
  try {
    if (response && response.body && !response.body.locked) {
      await disposalLimit(response.body.cancel(reason));
    }
  } catch (_) {}
}

async function publicClient(id) {
  if (typeof id !== 'string' || !id) return null;
  try {
    const client = await self.clients.get(id);
    return client && client.type === 'window' && publicPath(new URL(client.url)) ? client : null;
  } catch (_) { return null; }
}

function emptyResponse(status, extraHeaders) {
  return new Response(null, {
    status,
    headers: Object.assign({
      'Cache-Control': 'no-store',
      'Content-Length': '0',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin'
    }, extraHeaders || {})
  });
}

function archiveKey(url, prefix = AUDIO_PREFIX) {
  if (url.origin !== BASE_URL.origin || url.username || url.password || url.search || url.hash ||
      !url.pathname.startsWith(prefix)) return null;
  const encoded = url.pathname.slice(prefix.length);
  let key;
  try { key = decodeURIComponent(encoded); } catch (_) { return null; }
  // Decode once only. The canonical key is never an instruction to fetch a URL.
  if (!key || key.length > 1024 || key !== key.trim() || /^\//.test(key) || /^\w+:/.test(key) ||
      /[<>?#\u0000-\u001f\u007f\\]/.test(key) || !/\.wav$/i.test(key) ||
      key.split('/').some(part => !part || part === '.' || part === '..') ||
      encodeURIComponent(key) !== encoded) return null;
  return { key, encoded, url: new URL(prefix + encoded, BASE_URL.origin).href };
}

function originalInfo(response, key) {
  if (!response || response.status !== 200 || ['opaque', 'opaqueredirect', 'error'].includes(response.type) ||
      response.redirected || response.headers.has('Content-Range') || response.headers.has('Content-Encoding')) return null;
  const bytes = positiveSize(response.headers.get('X-Eclipse-Original-Bytes'), MAX_ORIGINAL_BYTES);
  const contentType = (response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (!bytes || response.headers.get('Content-Length') !== String(bytes) ||
      response.headers.get('X-Eclipse-Original-Key') !== key.encoded ||
      !['audio/wav', 'audio/wave', 'audio/x-wav'].includes(contentType)) return null;
  return { bytes };
}

function listeningInfo(response, key) {
  if (!response || response.status !== 200 || ['opaque', 'opaqueredirect', 'error'].includes(response.type) ||
      response.redirected || response.headers.has('Content-Range') || response.headers.has('Content-Encoding')) return null;
  const h = response.headers, bytes = positiveSize(h.get('X-Eclipse-Listening-Bytes'), MAX_ORIGINAL_BYTES);
  const companion = archiveKey(new URL(AUDIO_PREFIX + (h.get('X-Eclipse-Companion-Key') || ''), BASE_URL.origin));
  if (!bytes || bytes < 44 || h.get('Content-Length') !== String(bytes) ||
      h.get('X-Eclipse-Listening-Version') !== '1' || h.get('X-Eclipse-Listening-Kind') !== 'published-listening-copy' ||
      h.get('X-Eclipse-Original-Key') !== key.encoded || !companion || companion.key === key.key ||
      !/(?:^|[_\/ -])(?:BrowserSafe|SafariSafe)(?:[_ .-]|$)/i.test(companion.key) ||
      h.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'audio/wav' ||
      !['16', '24'].includes(h.get('X-Eclipse-Bits')) || !['44100', '48000'].includes(h.get('X-Eclipse-Sample-Rate')) ||
      !['1', '2'].includes(h.get('X-Eclipse-Channels')) || h.get('X-Eclipse-Float') !== 'false' ||
      !/^save-[\w.-]{1,100}$/.test(h.get('X-Eclipse-Commit') || '') ||
      !Number.isFinite(Date.parse(h.get('X-Eclipse-Saved-At') || ''))) return null;
  return { bytes };
}

function byteRange(header, size) {
  if (!header) return null;
  const value = String(header).trim();
  // Unknown units and multipart requests are deliberately ignored (full 200).
  // They must never produce a misleading single-part 206.
  if (!/^bytes\s*=/i.test(value) || value.includes(',')) return null;
  if (value.length > 128) return false;
  const match = /^bytes=\s*(\d*)-(\d*)$/i.exec(value);
  if (!match || (!match[1] && !match[2])) return false;
  const number = text => {
    if (!/^\d{1,16}$/.test(text)) return NaN;
    const result = Number(text);
    return Number.isSafeInteger(result) ? result : NaN;
  };
  let first, last;
  if (!match[1]) {
    const suffix = number(match[2]);
    if (!Number.isFinite(suffix) || suffix <= 0) return false;
    first = Math.max(0, size - suffix);
    last = size - 1;
  } else {
    first = number(match[1]);
    last = match[2] ? number(match[2]) : size - 1;
    if (!Number.isFinite(first) || !Number.isFinite(last) || first >= size || last < first) return false;
    last = Math.min(last, size - 1);
  }
  return { first, last };
}

function originalHeaders(response, info) {
  const headers = new Headers({
    'Content-Type': 'audio/wav',
    'Content-Length': String(info.bytes),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Eclipse-Offline': WORKER_BUILD,
    'X-Eclipse-Original-Key': response.headers.get('X-Eclipse-Original-Key'),
    'X-Eclipse-Original-Bytes': String(info.bytes)
  });
  for (const name of ['Bits', 'Sample-Rate', 'Channels']) {
    const value = response.headers.get('X-Eclipse-' + name);
    if (value && /^\d{1,9}$/.test(value)) headers.set('X-Eclipse-' + name, value);
  }
  const floating = response.headers.get('X-Eclipse-Float');
  if (['true', 'false', '0', '1'].includes(floating)) headers.set('X-Eclipse-Float', floating);
  const savedAt = response.headers.get('X-Eclipse-Saved-At');
  if (savedAt && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(savedAt)) headers.set('X-Eclipse-Saved-At', savedAt);
  return headers;
}

function listeningHeaders(response, info) {
  const headers = originalHeaders(response, info);
  headers.delete('X-Eclipse-Original-Bytes');
  for (const name of ['Listening-Version', 'Listening-Kind', 'Listening-Bytes', 'Companion-Key']) {
    headers.set('X-Eclipse-' + name, response.headers.get('X-Eclipse-' + name));
  }
  return headers;
}

function rangeStream(body, first, last) {
  const reader = body.getReader();
  let offset = 0;
  let complete = false;
  let cleanup = null;
  const stop = reason => {
    if (cleanup) return cleanup;
    complete = true;
    cleanup = Promise.resolve().then(() => reader.cancel(reason)).catch(() => {}).finally(() => {
      try { reader.releaseLock(); } catch (_) {}
    });
    return cleanup;
  };
  // Consume one cached stream, honoring downstream pull/cancel. Seeking near the
  // end discards preceding chunks; it never accumulates or copies the whole WAV.
  return new ReadableStream({
    async pull(controller) {
      try {
        while (!complete) {
          const result = await reader.read();
          if (complete) return;
          if (result.done) throw error('archive_truncated', 'The saved audio ended before the requested bytes.');
          const chunk = result.value;
          if (!(chunk instanceof Uint8Array)) throw error('archive_stream', 'The saved audio has an invalid byte stream.');
          const chunkStart = offset;
          offset += chunk.byteLength;
          if (!Number.isSafeInteger(offset)) throw error('archive_stream', 'The saved audio length is invalid.');
          if (offset <= first) continue;
          const start = Math.max(0, first - chunkStart);
          const end = Math.min(chunk.byteLength, last + 1 - chunkStart);
          if (end > start) {
            const part = chunk.subarray(start, end);
            // A tiny Safari probe must not retain a large cached chunk's backing
            // buffer. Large audio chunks remain zero-copy and backpressured.
            controller.enqueue(part.byteLength <= 65536 && part.buffer.byteLength > part.byteLength ? part.slice() : part);
          }
          if (offset > last) {
            await disposalLimit(stop('Requested bytes delivered'));
            controller.close();
          }
          return;
        }
      } catch (failure) {
        await disposalLimit(stop(failure));
        try { controller.error(failure); } catch (_) {}
      }
    },
    cancel(reason) { return disposalLimit(stop(reason || 'Playback cancelled')); }
  }, { highWaterMark: 0 });
}

async function serveOriginal(event, url, listening = false) {
  const request = event.request;
  const key = archiveKey(url, listening ? LISTENING_PREFIX : AUDIO_PREFIX);
  if (!key || request.mode === 'navigate' || !(await publicClient(event.clientId))) return emptyResponse(404);
  if (!['GET', 'HEAD'].includes(request.method)) return emptyResponse(405, { Allow: 'GET, HEAD' });
  let cached;
  try { cached = await caches.match(key.url, { cacheName: listening ? LISTENING_CACHE : ORIGINALS_CACHE }); }
  catch (_) { return emptyResponse(503); }
  const info = listening ? listeningInfo(cached, key) : originalInfo(cached, key);
  if (!info || !cached.body) {
    await cancelBody(cached, 'Invalid archive entry');
    return emptyResponse(404);
  }
  const headers = listening ? listeningHeaders(cached, info) : originalHeaders(cached, info);
  // Range is defined for GET only. Without a strong If-Range validator, return
  // the complete representation rather than combine possibly different bytes.
  const range = request.method === 'GET' && !request.headers.has('If-Range') ?
    byteRange(request.headers.get('Range'), info.bytes) : null;
  if (range === false) {
    await cancelBody(cached, 'Unsatisfiable range');
    headers.set('Content-Range', 'bytes */' + info.bytes);
    headers.set('Content-Length', '0');
    return new Response(null, { status: 416, headers });
  }
  if (request.method === 'HEAD') {
    await cancelBody(cached, 'HEAD needs no body');
    return new Response(null, { status: 200, headers });
  }
  const first = range ? range.first : 0;
  const last = range ? range.last : info.bytes - 1;
  headers.set('Content-Length', String(last - first + 1));
  if (range) headers.set('Content-Range', 'bytes ' + first + '-' + last + '/' + info.bytes);
  return new Response(rangeStream(cached.body, first, last), { status: range ? 206 : 200, headers });
}

function shellInfo(response) {
  // Keep a previously validated public snapshot usable until the new one is
  // committed. Upgrading this worker never deletes the old page or music.
  if (!response || response.status !== 200 || ![WORKER_BUILD, PRIOR_WORKER_BUILD, LEGACY_WORKER_BUILD].includes(response.headers.get('X-Eclipse-Shell-Worker')) ||
      response.headers.get('X-Eclipse-Shell-URL') !== SHELL_URL ||
      (response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase() !== 'text/html') return null;
  const bytes = positiveSize(response.headers.get('Content-Length'), MAX_SHELL_BYTES);
  const shellBuild = response.headers.get('X-Eclipse-Shell-Build') || '';
  const cachedAt = response.headers.get('X-Eclipse-Shell-Saved-At') || '';
  if (!bytes || !/^eclipse-stk-[A-Za-z0-9-]{1,180}$/.test(shellBuild) ||
      !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(cachedAt)) return null;
  return { shellReady: true, shellBuild, cachedAt, bytes };
}

async function savedShell() {
  try {
    const response = await caches.match(SHELL_URL, { cacheName: SHELL_CACHE });
    const info = shellInfo(response);
    if (info) return { response, info };
    await cancelBody(response, 'Invalid public shell');
  } catch (_) {}
  return null;
}

async function shellStatus() {
  const saved = await savedShell();
  if (!saved) return { shellReady: false };
  await cancelBody(saved.response, 'Status needs no body');
  return saved.info;
}

function metaValue(prefix, name, httpEquiv) {
  const attribute = httpEquiv ? 'http-equiv' : 'name';
  for (const tag of prefix.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = {};
    for (const match of tag.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g)) attrs[match[1].toLowerCase()] = match[3];
    if ((attrs[attribute] || '').toLowerCase() === name.toLowerCase()) return attrs.content || '';
  }
  return '';
}

async function readPublicShell(response, expectedBuild, signal) {
  const responseURL = response && response.url ? new URL(response.url) : null;
  const vary = response ? response.headers.get('Vary') || '' : '';
  if (!response || response.status !== 200 || !['basic', 'default'].includes(response.type) || response.redirected ||
      (responseURL && responseURL.href !== SHELL_URL) ||
      (response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase() !== 'text/html' ||
      response.headers.has('Content-Range') || /(?:^|,)\s*(?:\*|cookie|authorization)\s*(?:,|$)/i.test(vary) ||
      /(?:^|,)\s*private(?:\s|=|,|$)/i.test(response.headers.get('Cache-Control') || '')) {
    await cancelBody(response, 'Public HTML response required');
    throw error('shell_response', 'The server did not return the public ECLIPSE STK page.');
  }
  const declared = response.headers.get('Content-Length');
  if (declared && !positiveSize(declared, MAX_SHELL_BYTES)) {
    await cancelBody(response, 'Shell size limit');
    throw error('shell_size', 'The public page exceeds the offline page limit.');
  }
  if (!response.body) throw error('shell_response', 'The public page has no body.');
  const reader = response.body.getReader();
  const chunks = [];
  const prefixBytes = new Uint8Array(SHELL_PREFIX_BYTES);
  let size = 0, prefixSize = 0;
  try {
    while (true) {
      if (signal.aborted) throw error('shell_cancelled', 'Saving the offline page was cancelled.');
      const { value, done } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array) || size + value.byteLength > MAX_SHELL_BYTES) {
        throw error('shell_size', 'The public page exceeds the offline page limit.');
      }
      size += value.byteLength;
      if (prefixSize < SHELL_PREFIX_BYTES) {
        const part = value.subarray(0, SHELL_PREFIX_BYTES - prefixSize);
        prefixBytes.set(part, prefixSize);
        prefixSize += part.byteLength;
      }
      chunks.push(value);
    }
    // Fetch exposes decoded bytes. A compressed response's network length is
    // not its decoded length; do not relabel or retain its Content-Encoding.
    if (!size || (!response.headers.has('Content-Encoding') && declared && Number(declared) !== size)) {
      throw error('shell_truncated', 'The public page was not received completely.');
    }
    const prefix = new TextDecoder('utf-8', { fatal: true }).decode(prefixBytes.subarray(0, prefixSize), { stream: true });
    const shellBuild = metaValue(prefix, 'stk-patch-build');
    const policy = metaValue(prefix, 'Content-Security-Policy', true);
    if (metaValue(prefix, 'stk-build') !== PROTECTED_BASELINE ||
        !/^eclipse-stk-[A-Za-z0-9-]{1,180}$/.test(shellBuild) ||
        !/default-src\s+'none'/.test(policy) || !/script-src\s/.test(policy) || !/object-src\s+'none'/.test(policy)) {
      throw error('shell_identity', 'The response is not the protected ECLIPSE STK public page.');
    }
    if (expectedBuild && shellBuild !== expectedBuild) {
      throw error('shell_build_mismatch', 'The server page does not match this open release. Reload online, then save offline again.');
    }
    const blob = new Blob(chunks, { type: 'text/html' });
    return { blob, size, shellBuild };
  } catch (failure) {
    await disposalLimit(Promise.resolve().then(() => reader.cancel(failure)));
    throw failure;
  } finally { try { reader.releaseLock(); } catch (_) {} }
}

async function savePublicShell(expectedBuild, refresh, epoch) {
  const current = await shellStatus();
  if (epoch !== shellEpoch) throw error('shell_cancelled', 'Saving the offline page was cancelled.');
  if (!refresh && current.shellReady && (!expectedBuild || current.shellBuild === expectedBuild)) return current;
  const controller = new AbortController();
  shellAbort = controller;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, SHELL_TIMEOUT_MS);
  try {
    const response = await fetch(SHELL_URL, {
      method: 'GET', mode: 'same-origin', credentials: 'omit', redirect: 'error',
      cache: 'no-store', signal: controller.signal
    });
    const body = await readPublicShell(response, expectedBuild, controller.signal);
    if (epoch !== shellEpoch || controller.signal.aborted) throw error('shell_cancelled', 'Saving the offline page was cancelled.');
    const cachedAt = new Date().toISOString();
    const headers = new Headers(response.headers);
    for (const name of ['Content-Encoding', 'Content-Range', 'Set-Cookie', 'Trailer']) headers.delete(name);
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set('Content-Length', String(body.size));
    headers.set('X-Eclipse-Shell-Worker', WORKER_BUILD);
    headers.set('X-Eclipse-Shell-URL', SHELL_URL);
    headers.set('X-Eclipse-Shell-Build', body.shellBuild);
    headers.set('X-Eclipse-Shell-Saved-At', cachedAt);
    const cache = await caches.open(SHELL_CACHE);
    if (epoch !== shellEpoch || controller.signal.aborted) throw error('shell_cancelled', 'Saving the offline page was cancelled.');
    // A stable cache/key replaces the old snapshot atomically. There are no
    // release-number caches to accumulate, and music/model stores are untouched.
    await cache.put(SHELL_URL, new Response(body.blob, { status: 200, headers }));
    if (epoch !== shellEpoch) {
      await cache.delete(SHELL_URL);
      throw error('shell_cancelled', 'Saving the offline page was cancelled.');
    }
    return { shellReady: true, shellBuild: body.shellBuild, cachedAt, bytes: body.size };
  } catch (failure) {
    if (timedOut) throw error('shell_timeout', 'Saving the public page took too long. Try again when the connection is ready.');
    if (failure && failure.code) throw failure;
    if (failure && failure.name === 'QuotaExceededError') throw error('storage_full', 'The browser could not store the public page. Free some space and try again.');
    throw error('shell_unavailable', 'The public page could not be saved. Existing saved songs and the prior page were retained.');
  } finally {
    clearTimeout(timer);
    if (shellAbort === controller) shellAbort = null;
  }
}

async function ensureShell(expectedBuild, refresh) {
  if (shellClearing) await shellClearing;
  while (shellTask) {
    await shellTask;
    const status = await shellStatus();
    if (status.shellReady && (!expectedBuild || status.shellBuild === expectedBuild)) return status;
  }
  if (shellClearing) await shellClearing;
  const task = savePublicShell(expectedBuild, refresh, shellEpoch);
  shellTask = task;
  try { return await task; }
  finally { if (shellTask === task) shellTask = null; }
}

async function clearShell() {
  if (shellClearing) return shellClearing;
  shellEpoch++;
  if (shellAbort) shellAbort.abort();
  const pendingSave = shellTask;
  const task = (async () => {
    if (pendingSave) { try { await pendingSave; } catch (_) {} }
    const cache = await caches.open(SHELL_CACHE);
    await cache.delete(SHELL_URL);
    return { shellReady: false };
  })();
  shellClearing = task;
  try { return await task; }
  finally { if (shellClearing === task) shellClearing = null; }
}

async function networkFirstShell(request) {
  const saved = await savedShell();
  if (!saved) return fetch(request);
  const controller = new AbortController();
  let timer;
  try {
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(error('navigation_timeout', 'The public page is unavailable online.'));
      }, NAVIGATION_TIMEOUT_MS);
    });
    const response = await Promise.race([fetch(request, { signal: controller.signal }), deadline]);
    clearTimeout(timer); // Unused-cache cleanup must not abort the successful online response.
    if (response.status >= 500 && response.status <= 599) {
      await cancelBody(response, 'Using saved public page');
      return saved.response;
    }
    // Authentication failures, redirects, and other authoritative network
    // responses are not replaced. No navigation response is written to Cache.
    await cancelBody(saved.response, 'Using online page');
    return response;
  } catch (_) {
    controller.abort();
    return saved.response;
  } finally { clearTimeout(timer); }
}

async function handleMessage(event) {
  const port = event.ports && event.ports[0];
  const data = event.data;
  if (!port || !data || typeof data !== 'object' || data.type !== 'ECLIPSE_OFFLINE' ||
      data.version !== PROTOCOL_VERSION || typeof data.id !== 'string' || !/^[\w.-]{1,80}$/.test(data.id) ||
      !['ensureShell', 'status', 'clearShell', 'activateUpdate'].includes(data.action) ||
      (event.origin && event.origin !== BASE_URL.origin) ||
      !(await publicClient(event.source && event.source.id))) return;
  let result;
  try {
    if (data.action === 'ensureShell') {
      if (data.appBuild !== undefined && (typeof data.appBuild !== 'string' || !/^eclipse-stk-[A-Za-z0-9-]{1,180}$/.test(data.appBuild))) {
        throw error('invalid_build', 'An ECLIPSE STK release identifier is required.');
      }
      result = await ensureShell(data.appBuild || '', data.refresh === true);
    } else if (data.action === 'clearShell') result = await clearShell();
    else if (data.action === 'activateUpdate') {
      await self.skipWaiting();
      result = await shellStatus();
    } else result = await shellStatus();
    port.postMessage(Object.assign({ type: 'ECLIPSE_OFFLINE_RESULT', version: PROTOCOL_VERSION,
      id: data.id, ok: true, workerBuild: WORKER_BUILD, capabilities: CAPABILITIES }, result));
  } catch (failure) {
    const status = await shellStatus();
    port.postMessage(Object.assign({ type: 'ECLIPSE_OFFLINE_RESULT', version: PROTOCOL_VERSION,
      id: data.id, ok: false, workerBuild: WORKER_BUILD, capabilities: CAPABILITIES,
      error: { code: failure.code || 'offline_error', message: failure.message || 'The offline action could not finish.' }
    }, status));
  }
}

// Installation is inert: no precache, imported code, forced update, or network.
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('message', event => { event.waitUntil(handleMessage(event)); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== BASE_URL.origin) return;
  if (url.pathname.startsWith(LISTENING_PREFIX)) {
    event.respondWith(serveOriginal(event, url, true));
  } else if (url.pathname.startsWith(AUDIO_PREFIX)) {
    event.respondWith(serveOriginal(event, url));
  } else if (event.request.method === 'GET' && event.request.mode === 'navigate' &&
             publicPath(url) && !url.search && !url.hash) {
    event.respondWith(networkFirstShell(event.request));
  }
});
