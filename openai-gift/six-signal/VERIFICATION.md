# THE SIX SIGNAL — three-part verification record

**Release candidate:** 2026-11-18 · independent ECLIPSE STK public gift  
**Scope:** `openai-gift/six-signal/index.html` and `sw.js` only; the root music site and existing Lilly model are untouched.

## Pass 1 — independent browser UI and functional exercise

Performed in local automated Chromium using `page.set_content`, because navigation to locally hosted HTTP pages was blocked by the test environment's network policy. Two viewport sizes: **1440×900** and **390×844**.

- **PASS:** JS executed with zero uncaught page errors at both viewport sizes.
- **PASS:** WAV encoder output had RIFF/WAVE headers, format code 3 IEEE float32, stereo, 48 kHz, 6 s, exactly 2,304,044 bytes.
- **PASS:** Both encoded stereo channels were decoded at a selected sample index and matched the original generated Float32 values.
- **PASS:** Minimal WebAssembly 1.0 byte sequence validated.
- **PASS:** No imported external script, style, or image assets were present, and no horizontal overflow appeared at either tested viewport.
- **PASS:** Browser-triggered 32-bit WAV download completed on both viewports, and the manual Web Audio playback action reached Playing and Stop states.
- **LIMITED:** Web Crypto `crypto.subtle` was not available in this non-secure in-memory test document, so its in-page check returned LIMITED (not a false PASS).
- **LIMITED:** Service Worker and Cache Storage were unavailable in this insecure synthetic page, so its in-page offline check returned LIMITED.

**Observed in-page result: 4/6 passing**, plus two correctly reported environment limitations. These tests are not an end-to-end hosted HTTPS or physical phone certification.

## Pass 2 — independent audio decoder and numerical validation

The exact WAV file created by the page download was opened with independent audio tools, not the page's own parser:

- `ffprobe`: `pcm_f32le`, 48,000 Hz, 2 channels, 32 bits per sample, exactly 6.000000 seconds, file size 2,304,044 bytes.
- `scipy.io.wavfile`: 48,000 Hz; shape 288,000 × 2; NumPy `float32`; distinct left and right samples.
- The reference text `SIX SIGNAL | ECLIPSE STK | 2026` hashes to `4a9705ebf8859c78e8ea9b07fafe25fe0d85059e9b493d1acf1a7f89f492136e` (SHA-256). This digest was separately calculated in Python and embedded for the client-side known-answer check.

These checks verify *source file encoding*, not the analog or Bluetooth output resolution of any device.

## Pass 3 — independent offline worker scope and branch tests

A Node `vm` test executed the actual `sw.js` against controlled CacheStorage and network doubles. Five behaviors passed:

1. Installation created a cache entry for only the demo's HTML.
2. Activation claimed clients.
3. Online navigation used the network path.
4. When the fetch mock failed, a previously cached offline document was returned.
5. Navigation outside the `/openai-gift/six-signal/` scope (including music) was ignored.

**PASS: 5/5 mocked worker expectations.** These checks are *not* a real offline browser-navigation test. Physical iPhone Airplane Mode and HTTPS production readiness still require visitor acceptance testing after deployment.

## Safety and provenance boundaries

- The demo's only JavaScript is embedded in `index.html`; `sw.js` is its own worker, installed only after clicking Run the Six.
- No music catalog, DRM assets, personal notes, microphone, vault archives, credential store or uploaded files are accessed.
- The page is free of third-party runtime imports; external project links navigate only after the visitor clicks them.
- The source and runtime behavior are supplied transparently. This is not an independently trained model or a replacement for ChatGPT.
- Browser storage behavior, final audio output, and background media control remain OS/browser-dependent.

## Release note

The new source is a separate folder in an existing GitHub Pages repository. A source commit proves the files are in GitHub; without fetching the hosted page itself, **public reachability and hosted-HTTPS Web Crypto/service-worker results remain unverified**. Verify from a signed-out browser before sharing the link as a tested production deployment.