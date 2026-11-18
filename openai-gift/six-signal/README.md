# THE SIX SIGNAL — a public ECLIPSE STK / Lilly engineering gift

**Independent AI-assisted project by Saif Parchment · November 2026**  
**No association or endorsement by OpenAI, Apple, Drake, or any other music artist.**

## What the viewer actually gets

A new self-contained ECLIPSE-inspired **Six Signal** interactive demonstration. No accounts, tokens, passkeys, API keys, or model downloads are needed. The visitor can:

- Run **six browser-native checks**, with live PASS / FAIL / LIMITED status and explanations.
- Generate an **original six-second, stereo, 48 kHz, IEEE float32 WAV** entirely within their browser; listen after a deliberate click; download and verify the audio bytes. It is not a song taken from anyone's catalog.
- Generate and download a plain-text report describing the tests and the browser where they ran. Report stays client-side unless the visitor chooses to share it.
- Opt into storing the **public demo page only** for offline reload using a narrow-scope service worker at `/openai-gift/six-signal/` (the page cache is not the same as ECLIPSE music offline archives).
- Reset the demo's offline copy. The worker cannot control ECLIPSE's root music site or the separate Lilly AI page.
- Discover six prior community and engineering projects with their respective deployment/test status explained.

## Exactly what each test proves

1. **WAV byte format.** Byte-level RIFF/WAVE parse confirms format code 3 (IEEE float32), 32 bits per sample, 48,000 Hz, two channels and a six-second data section.
2. **Stereo sample readback.** Reads left and right values from the encoded Float32 buffer and compares them with generated source samples. This is not device-output certification.
3. **Web Crypto.** Uses `crypto.subtle.digest('SHA-256')` and compares with an independently precomputed SHA-256 for a fixed test phrase. Needs a secure context.
4. **WebAssembly capability.** Validates a minimal WASM v1 module; does not prove any 522 MB language model can load.
5. **Self-contained viewport.** Detects externally imported script/style/image assets and horizontal page overflow at the current viewport. This does not assess every accessibility criterion.
6. **Offline page cache.** Registers `sw.js`, caches the demo's own HTML and confirms its cache entry. A successful check means the page is cached, **not** that a real disconnected reload has been tested on the viewer's device. Reload offline to validate physically.

## Audio and platform facts

- 48,000 Hz * 6.00 s * 2 channels * 4 bytes/sample + 44-byte WAV header = **2,304,044 bytes**.
- `fmt` code `3` signals IEEE float PCM; the source WAV may be saved offline.
- Browser playback uses **Web Audio**, which may convert/resample it; the site does not measure the final DAC or Bluetooth output bit depth.
- Saving files locally is not internet *streaming* in Airplane Mode. The demo does not claim a world first.
- Generated audio is optional and never automatically plays. No microphone permission is requested.
- It does not import or use copyrighted music, the private ECLIPSE catalogs, or credentials.

## Files and deployment

Deploy only `index.html` and `sw.js` into the public repository's `openai-gift/six-signal/` directory, retaining those names. GitHub Pages at the `eclipsestk.com` custom domain should map that path to:

https://eclipsestk.com/openai-gift/six-signal/

The site should open in an HTTPS context for Web Crypto and service workers. In a local in-memory sandbox, those two checks can be LIMITED even when the other four pass. The main ECLIPSE index and music service worker must never be replaced with these standalone files. Clicking the *Meet Lilly* link opens the separate pinned-Qwen demonstration, which requires a much larger optional download.

## Release integrity / tests

See [VERIFICATION.md](VERIFICATION.md) for three separate checks: browser behavior, independent audio decoding, and service-worker scope/offline logic. The release notes clearly distinguish executable checks from user-device acceptance testing.

## Rights and intent

The original demonstration code, writing, and original generated signal recipe are offered by the author under the [MIT license](../LICENSE) for the separate public-gift project only. The gift does not relicense the ECLIPSE music platform, artwork, associated source files, third-party models, or anything owned by other creators. The MIT license does **not** compel recipients to use the work only for good; use the open source gift with that understanding. The demonstration is an invitation for engineers to inspect and improve the work, not a guarantee of employment.