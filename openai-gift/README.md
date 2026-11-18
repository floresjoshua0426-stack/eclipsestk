# LILLY — ECLIPSE STK × OpenAI gift

## NEW: The Six Signal — live, inspectable browser lab

Run the six-check showcase and generate an original, downloadable IEEE float32 stereo WAV at **[the Six Signal demo](./six-signal/)**. A separate [verification record](./six-signal/VERIFICATION.md) distinguishes live browser checks from mocked worker tests and secure-hosting/device acceptance still pending. The demo does not use private ECLIPSE music or credentials, and the 32-bit sample-file format is not a device-output precision claim.

A public, opt-in browser inference demonstration from Saif Parchment, built through AI-assisted iteration and shared freely for others to inspect and learn from. **Not affiliated with or endorsed by OpenAI.**

## What is actually in this gift

- A compact and independent recreation of the ECLIPSE STK visual language, with the assistant rebranded from the private Jarvis context to **Lilly**.
- Browser-side, opt-in inference against **Qwen/Qwen2.5-0.5B-Instruct-GGUF**, quantized Q5_K_M; exact pinned revision `6dd44a1fb35d11b5d1b28902876ce3cc9e882d0e`, file `qwen2.5-0.5b-instruct-q5_k_m.gguf` (522,186,592 bytes), expected SHA-256 `041474553fcabfc2a2d67903f9d2c2e50bd92528e670da4f33b5d0ce6e59fd55`. These details come from the R116 lineage and previously recorded ECLIPSE model-integrity checks.
- Uses `@wllama/wllama@3.6.1` runtime with native browser execution where supported. Model weights are downloaded directly from a pinned Hugging Face revision *after the visitor explicitly clicks Load*.
- A straightforward single-file public interface, engineering notes, honesty about limitations, and links to separate public projects.

### Transparency / limits

This is **not a newly trained or original foundation model**, nor is it ChatGPT's proprietary model. It does not replicate the entire private ECLIPSE site or contain private login credentials, personal chat, DRM/music files, uploader access, passkeys, or secret configuration. It does not demonstrate any source-access bypass or platform exploit.

The model download is ~522 MB and local inference requires additional runtime memory. Actual load/generation on every iPhone/Safari combination is not certified here. No fake replies are sent if model loading fails. The published page's metadata includes the pinned SHA-256 value for provenance; the simplified demo **does not independently hash-check downloaded bytes** in-browser, unlike the verified private ECLIPSE builds. To obtain stronger byte-level assurance, validate GGUF with a trusted external SHA-256 tool against the expected hash. The original private site should not be replaced with this file.

The project does not record chats in localStorage or send conversations to any site-operated server. Third-party download providers receive normal asset requests; runtime/browser caching may use local storage. A static HTML page cannot enforce device-wide privacy or guarantee that third parties do not log HTTP requests. 

### Technical design

The public demo asks the user to opt in, imports the pinned wllama library from jsDelivr, loads the pinned Qwen GGUF from Hugging Face, then offers a short multi-turn chat. The demo caps output length and history, visibly handles errors and aborts, and avoids silent scripted fallback. The public assistant identity is *Lilly*; system instructions explicitly state it is a local model and not a human or ChatGPT.

### Copyright / licenses

The **original public demo interface and original text** are shared under the MIT license in `LICENSE`. It is an AI-assisted independent contribution. The model and runtime are third-party works governed by their own licenses; see:

- Qwen2.5 GGUF: https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF (license displayed by model publisher)
- wllama: https://github.com/ngxson/wllama (MIT)
- ECLIPSE STK: https://eclipsestk.com (separate ongoing project, not licensed by this demo)

### What was checked for this release

1. Code/package check — syntax, pinned configuration, no embedded API keys, credentials, audio masters, or login interfaces.
2. Browser check — initial page loads in headless Chromium at 1440px and 390px, navigation and controls render without page errors or horizontal overflow, and inference is disabled until opt-in.
3. Publication check — GitHub commit, public path, and external HTTP reachability if deploy propagation completes. A browser-side 522MB model download/generation was not performed; do not infer a true model test from the page-loading checks.

**Purpose:** An open, nonexclusive gift of human-centered AI prototyping and an invitation to inspect the work critically. No obligation to hire or employ the author is implied.