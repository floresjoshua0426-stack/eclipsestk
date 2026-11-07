/* ECLIPSE STK R86: retained archives, original bytes, and validated local playback.
 * Deploy beside index.html as JavaScript over HTTPS. This worker never fetches
 * music, models, private data, arbitrary message URLs, or background updates.
 * The page owns consent, original verification, saving, and archive removal.
 */
'use strict';

const WORKER_BUILD = 'eclipse-stk-offline-r86-v1';
const R85_WORKER_BUILD = 'eclipse-stk-offline-r85-v1';
const R84_WORKER_BUILD = 'eclipse-stk-offline-r84-v1';
const R83_WORKER_BUILD = 'eclipse-stk-offline-r83-v1';
const R82_WORKER_BUILD = 'eclipse-stk-offline-r82-v1';
const R81_WORKER_BUILD = 'eclipse-stk-offline-r81-v1';
const R80_WORKER_BUILD = 'eclipse-stk-offline-r80-v1';
const R78_WORKER_BUILD = 'eclipse-stk-offline-r78-v1';
const PRIOR_WORKER_BUILD = 'eclipse-stk-offline-r77-v1';
const R76_WORKER_BUILD = 'eclipse-stk-offline-r76-v1';
const RETAINED_WORKER_BUILD = 'eclipse-stk-offline-r75-v1';
const R74_WORKER_BUILD = 'eclipse-stk-offline-r74-v1';
const R73_WORKER_BUILD = 'eclipse-stk-offline-r73-v1';
const LEGACY_WORKER_BUILD = 'eclipse-stk-offline-r70-v1';
const CAPABILITIES = Object.freeze(['originals-v1', 'listening-v1', 'control-fetch-v1']);
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
const CACHE_READ_TIMEOUT_MS = 30000;
const PROTECTED_BASELINE = 'eclipse-stk-2026-09-23-r50-xion-michael-q5-motherbrain2-fightchat-xion4lock-friendmother-fidelity1-michael-trusted-survivor1-final';
let shellTask = null;
let shellStatusTask = null;
const pendingMessageClients = new Map();
let pendingMessageClientList = null;
let shellAbort = null;
let shellEpoch = 0;
let shellClearing = null;
const pendingCacheReads = new Map();

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

// A stalled native CacheStorage.match cannot be cancelled. Keep its slot until
// it settles, discard a late body, and bound the request that is waiting for it.
// Parallel ranges wait for a free slot instead of cloning a large audio body.
// R84: independent, chunked archive storage. Old CacheStorage data is read-only
// unless the listener explicitly removes a copy. No migration, reset or eviction.
const archiveStorage=(()=>{
 'use strict';
 const DB='eclipse-stk-recovery-files-v1',SCHEMA=1,CHUNK=2*1024*1024,MAX=256*1024*1024,TIMEOUT=30000;
 const base=new URL('./',globalThis.location.href),original='eclipse-stk-originals-v1';
 const paths=new Map([
  [original,'__eclipse_offline_audio__/'],['eclipse-stk-listening-v1','__eclipse_offline_listening__/'],
  ['eclipse-stk-shell-v1','index.html'],['eclipse-stk-archive-index-v1','__eclipse_archive_index__/'],
  ['eclipse-stk-public-catalog-v1','__eclipse_public_catalog__/']
 ]);
 const responseRecords=new WeakMap(),jobs=new Map(),nativePending=new Map(),nativeFailures=new Map();
 let dbTask=null,lastDatabaseError=null,lastLegacyError=null,writeActivity=null;
 function fault(name,code,message,extra={}){const e=new Error(message);Object.assign(e,{name,code,...extra});return e}
 function allowed(name,value){
  if(!paths.has(name))throw fault('ArchiveStorageError','storage_bucket','Unknown archive bucket.');
  const url=new URL(typeof value==='string'?value:value.url,base),path=paths.get(name),expected=new URL(path,base);
  if(url.origin!==base.origin||url.username||url.password||url.search||url.hash||(path.endsWith('/')?!url.pathname.startsWith(expected.pathname):url.href!==expected.href))throw fault('ArchiveStorageError','storage_key','Invalid archive location.');
  return url.href;
 }
 const logical=(name,url)=>name+'\n'+url;
 function note(error){lastDatabaseError={name:error?.name||'Error',code:error?.code||'',message:String(error?.message||'').slice(0,180),at:new Date().toISOString()};return error}
 function openDB(){
  if(dbTask)return dbTask;
  const task=new Promise((resolve,reject)=>{
   if(!globalThis.indexedDB){reject(fault('NotSupportedError','archive_database_unavailable','This browser does not provide the independent archive store.'));return}
   let request,done=false;const timer=setTimeout(()=>finish(reject,fault('ArchiveDatabaseTimeout','archive_database_open_timeout','The independent archive did not open. Existing music was kept.')),TIMEOUT);
   function finish(fn,value){if(done)return;done=true;clearTimeout(timer);fn(value)}
   try{request=indexedDB.open(DB,SCHEMA)}catch(error){finish(reject,error);return}
   request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('files')){const s=db.createObjectStore('files',{keyPath:'key'});s.createIndex('bucket','bucket')}
    if(!db.objectStoreNames.contains('chunks')){const s=db.createObjectStore('chunks',{keyPath:['generation','part']});s.createIndex('generation','generation');s.createIndex('file','file')}
    if(!db.objectStoreNames.contains('uploads'))db.createObjectStore('uploads',{keyPath:'key'});};
   request.onerror=()=>finish(reject,request.error||fault('ArchiveStorageError','archive_database_open','The independent archive could not open.'));
   request.onblocked=()=>finish(reject,fault('ArchiveDatabaseBlocked','archive_database_blocked','Another ECLIPSE tab is holding a storage update. Close the other tabs and retry; saved music was kept.'));
   request.onsuccess=()=>{const db=request.result;if(done){db.close();return}db.onversionchange=()=>{db.close();if(dbTask===task)dbTask=null};db.onclose=()=>{if(dbTask===task)dbTask=null};finish(resolve,db)};
  });dbTask=task;task.catch(error=>{note(error);if(dbTask===task)dbTask=null});return task;
 }
 async function transaction(stores,mode,makeRequest){
  const db=await openDB();return new Promise((resolve,reject)=>{
   let tx,result,problem=null,done=false;
   const finish=(fn,v)=>{if(done)return;done=true;clearTimeout(timer);fn(v)};
   const timer=setTimeout(()=>{problem=fault('ArchiveDatabaseTimeout','archive_database_transaction_timeout','The independent archive operation timed out. No incomplete file was marked saved.');try{tx?.abort()}catch{}finish(reject,problem)},TIMEOUT);
   try{tx=db.transaction(stores,mode)}catch(error){finish(reject,error);return}
   tx.oncomplete=()=>finish(resolve,result);tx.onabort=()=>finish(reject,problem||tx.error||fault('AbortError','archive_database_aborted','The archive transaction was stopped.'));
   tx.onerror=()=>{problem=tx.error||problem};
   try{const req=makeRequest(tx);if(req){req.onsuccess=()=>{result=req.result};req.onerror=()=>{problem=req.error}}}catch(error){problem=error;try{tx.abort()}catch{}finish(reject,error)}
  }).catch(error=>{note(error);throw error});
 }
 const getFile=(name,url)=>transaction(['files'],'readonly',tx=>tx.objectStore('files').get(logical(name,url)));
 const listFiles=name=>transaction(['files'],'readonly',tx=>tx.objectStore('files').index('bucket').getAll(name));
 const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
 function manifest(row,name,url){
  if(!row)return null;
  if(row.version!==SCHEMA||row.key!==logical(name,url)||row.bucket!==name||row.url!==url||!/^r84-[a-f0-9-]{16,90}$/.test(row.generation||'')||row.chunkBytes!==CHUNK||!Number.isSafeInteger(row.size)||row.size<1||row.size>MAX||row.parts!==Math.ceil(row.size/CHUNK)||!Array.isArray(row.headers))throw fault('ArchiveIntegrityError','archive_manifest_invalid','The stored file record did not pass validation. Its bytes were kept.');
  const headers=new Headers(row.headers);if(headers.get('Content-Length')!==String(row.size))throw fault('ArchiveIntegrityError','archive_manifest_size','The stored file length does not match its record.');return row;
 }
 function stream(row,first=0,last=row.size-1){
  let part=Math.floor(first/CHUNK),cancelled=false;
  return new ReadableStream({async pull(controller){
   if(cancelled)return;
   try{
    if(part>=row.parts||part*CHUNK>last){controller.close();return}
    const n=part++,chunk=await transaction(['chunks'],'readonly',tx=>tx.objectStore('chunks').get([row.generation,n]));if(cancelled)return;
    const expected=Math.min(CHUNK,row.size-n*CHUNK);
    if(!chunk||!(chunk.data instanceof ArrayBuffer)||chunk.data.byteLength!==expected||chunk.file!==row.key||await hash(chunk.data)!==chunk.sha256)throw fault('ArchiveIntegrityError','archive_chunk_invalid','A stored audio block could not be verified. Its saved bytes were kept; retry this copy.');
    if(cancelled)return;const from=Math.max(0,first-n*CHUNK),to=Math.min(expected,last+1-n*CHUNK);controller.enqueue(new Uint8Array(chunk.data,from,to-from));
    if(n*CHUNK+to>last)controller.close();
   }catch(error){if(!cancelled)controller.error(error)}
  },cancel(){cancelled=true}},{highWaterMark:0});
 }
 async function freshMatch(name,value){const url=allowed(name,value),row=manifest(await getFile(name,url),name,url);if(!row)return undefined;const headers=new Headers(row.headers);headers.set('X-Eclipse-Storage','indexeddb-chunked-v1');const response=new Response(stream(row),{status:200,headers});responseRecords.set(response,row);return response}
 function range(response,first,last){const row=responseRecords.get(response);if(!row)return null;try{response.body?.cancel().catch(()=>{})}catch{}return stream(row,first,last)}
 async function removeGeneration(generation){return transaction(['chunks'],'readwrite',tx=>{const request=tx.objectStore('chunks').index('generation').openKeyCursor(IDBKeyRange.only(generation));request.onsuccess=()=>{const cursor=request.result;if(cursor){tx.objectStore('chunks').delete(cursor.primaryKey);cursor.continue()}}})}
 // A small staging journal makes a tab-close distinguishable from a finished
 // file. Ownership is checked in the SAME transaction as every chunk/commit.
 // Web Locks permit immediate reclamation after a tab closes. Without locks,
 // an expired lease can be reclaimed; the old writer is fenced from publishing.
 async function uploadTransaction(key,generation,stores,action,claim=false,locked=false){
  let failure=null,previous=null;
  try{await transaction(['uploads',...stores],'readwrite',tx=>{
   const journal=tx.objectStore('uploads'),request=journal.get(key);
   request.onsuccess=()=>{try{
    const prior=request.result;previous=prior;
    if(claim){if(prior&&prior.generation!==generation&&!locked&&Date.now()-prior.updatedAt<300000)throw fault('ArchiveWritePending','storage_write_pending','Another tab may still be saving this song. Close that tab, or retry after its save lease expires.');journal.put({key,generation,updatedAt:Date.now()});}
    else {if(!prior||prior.generation!==generation)throw fault('ArchiveWriteSuperseded','storage_write_superseded','A newer save owns this copy. The interrupted write was not published.');journal.put({...prior,updatedAt:Date.now()});}
    action?.(tx,journal);
   }catch(error){failure=error;try{tx.abort()}catch{}}};
  })}catch(error){throw failure||error}return previous;
 }
 async function releaseUpload(key,generation){
  await transaction(['uploads'],'readwrite',tx=>{const store=tx.objectStore('uploads'),r=store.get(key);r.onsuccess=()=>{if(r.result?.generation===generation)store.delete(key)}});
 }
 async function write(name,value,response,options={}){
  const url=allowed(name,value),key=logical(name,url),locks=globalThis.navigator?.locks;
  if(locks?.request)return locks.request('eclipse-archive:'+DB+':'+key,{mode:'exclusive',ifAvailable:true},lock=>{
   if(!lock)throw fault('ArchiveWritePending','storage_write_pending','Another tab is already saving this copy.');return writeOwned(name,url,response,true,options);
  });
  return writeOwned(name,url,response,false,options);
 }
 async function writeOwned(name,value,response,locked,{signal,onProgress}={}){
  const stopped=()=>{if(signal?.aborted)throw new DOMException('Archive write stopped.','AbortError')};
  // R85: a suspended source/cancel promise must not permanently own the write.
  const bounded=(value,ms=TIMEOUT,abortable=true)=>new Promise((resolve,reject)=>{
   let done=false,timer=null;const finish=(fn,v)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);fn(v)},abort=()=>finish(reject,new DOMException('Archive write stopped.','AbortError'));
   timer=setTimeout(()=>finish(reject,fault('ArchiveStorageTimeout','archive_write_idle','Archive writing stopped making progress. No incomplete copy was published.')),ms);
   if(abortable){signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort()}
   Promise.resolve(value).then(v=>finish(resolve,v),e=>finish(reject,e));
  });
  stopped();
  const url=allowed(name,value),key=logical(name,url);
  if(jobs.has(key))throw fault('ArchiveWritePending','storage_write_pending','This copy is still being saved. A second write has not started.');
  if(!response||response.status!==200||response.redirected||['opaque','opaqueredirect','error'].includes(response.type)||!response.body||response.headers.has('Content-Range')||response.headers.has('Content-Encoding'))throw fault('ArchiveStorageError','archive_response_invalid','Only a complete verified response may be archived.');
  const length=Number(response.headers.get('Content-Length'));if(!Number.isSafeInteger(length)||length<1||length>MAX)throw fault('ArchiveStorageError','archive_length_invalid','The complete archive length is required.');
  const generation='r84-'+(crypto.randomUUID?crypto.randomUUID():[...crypto.getRandomValues(new Uint8Array(24))].map(v=>v.toString(16).padStart(2,'0')).join(''));
  const job={generation};jobs.set(key,job);
  const reader=response.body.getReader();let total=0,part=0,used=0,buffer=new Uint8Array(CHUNK),committed=false;
  const progress=(bytes,phase)=>{writeActivity={bucket:name,url,bytes,total:length,phase,at:Date.now()};try{onProgress?.({...writeActivity})}catch{}};
  const flush=async()=>{stopped();const data=buffer.buffer.slice(0,used),sha256=await bounded(hash(data));stopped();await uploadTransaction(key,generation,['chunks'],tx=>tx.objectStore('chunks').put({generation,part,file:key,data,sha256}));stopped();part++;used=0;progress(Math.min(length,part*CHUNK),'writing')};
  try{
   const abandoned=await uploadTransaction(key,generation,[],null,true,locked);
   if(abandoned&&abandoned.generation!==generation)await removeGeneration(abandoned.generation);
   // Each await occurs BETWEEN transactions. Safari may auto-commit an idle
   // transaction, so no transaction is held open across hashing/stream awaits.
   while(true){stopped();const item=await bounded(reader.read());stopped();if(item.done)break;const bytes=item.value;if(!(bytes instanceof Uint8Array))throw fault('ArchiveStorageError','archive_stream_invalid','The download did not return bytes.');total+=bytes.length;if(total>length)throw fault('ArchiveIntegrityError','archive_length_invalid','The audio response exceeded its verified length.');let offset=0;while(offset<bytes.length){const amount=Math.min(CHUNK-used,bytes.length-offset);buffer.set(bytes.subarray(offset,offset+amount),used);used+=amount;offset+=amount;if(used===CHUNK)await flush()}}
   if(total!==length)throw fault('ArchiveIntegrityError','archive_incomplete','The download ended early. No incomplete copy was marked saved.');if(used)await flush();
   const row={key,bucket:name,url,version:SCHEMA,generation,size:total,parts:part,chunkBytes:CHUNK,headers:[...response.headers],committedAt:new Date().toISOString()};manifest(row,name,url);
   stopped();await uploadTransaction(key,generation,['files'],(tx,journal)=>{tx.objectStore('files').put(row);journal.delete(key)});committed=true;progress(total,'readback');
  }finally{
   if(!committed){try{await bounded(reader.cancel(),2500,false)}catch{}try{await removeGeneration(generation)}catch{}try{await releaseUpload(key,generation)}catch{}}
   try{reader.releaseLock()}catch{}if(jobs.get(key)===job)jobs.delete(key);
  }
 }
 function legacyNames(name){return name===original?['eclipse-stk-originals-recovery-v1',original]:[name]}
 function legacyFault(name,action,error){const value=fault('ArchiveLegacyReadError','legacy_storage_unavailable','An older cache could not be read. Its files were kept; the independent archive can still accept new saves.',{legacyUnavailable:true,storageCache:name,storageAction:action,stage:'storage-legacy-'+action,nativeName:error?.name||'Error',nativeMessage:String(error?.message||'').slice(0,180)});lastLegacyError={cache:name,action,name:value.nativeName,message:value.nativeMessage,at:new Date().toISOString()};return value}
 async function legacyCall(name,action,url){
  const slot=name+':'+action+':'+(url||''),failureSlot=name+':'+action,failed=nativeFailures.get(failureSlot);
  if(failed&&Date.now()-failed.at<10000)throw failed.error;
  let task=nativePending.get(slot);
  if(task&&action==='match')throw fault('ArchiveStorageBusy','legacy_read_pending','The older cache is still reading this copy.');
  if(!task){task=Promise.resolve().then(async()=>{if(!globalThis.caches)throw new Error('CacheStorage unavailable');const cache=await caches.open(name);return action==='keys'?cache.keys():action==='delete'?cache.delete(url):cache.match(url)});nativePending.set(slot,task);task.finally(()=>{if(nativePending.get(slot)===task)nativePending.delete(slot)}).catch(()=>{})}
  let timer,timedOut=false;try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>{timedOut=true;task.then(value=>{try{value?.body?.cancel().catch(()=>{})}catch{}},()=>{});reject(fault('ArchiveStorageTimeout','legacy_read_timeout','An older cache did not answer its read check.'))},8000)})])}catch(error){nativeFailures.set(failureSlot,{at:Date.now(),error});throw error}finally{clearTimeout(timer)}
 }
 async function match(name,value){
  const url=allowed(name,value);let primaryError=null,errors=[];
  try{const fresh=await freshMatch(name,url);if(fresh)return fresh}catch(error){primaryError=error}
  for(const physical of legacyNames(name)){try{const saved=await legacyCall(physical,'match',url);if(saved)return saved}catch(error){errors.push(legacyFault(physical,'match',error))}}
  if(primaryError)throw primaryError;if(errors.length)throw errors[0];return undefined;
 }
 async function keys(name){
  if(!paths.has(name))throw new Error('Unknown archive bucket.');const all=new Map(),verified=new Set(),errors=[];
  try{for(const row of await listFiles(name)){try{const url=allowed(name,row.url);all.set(url,new Request(url));manifest(row,name,url);verified.add(url)}catch(error){errors.push(error)}}}catch(error){errors.push(error)}
  for(const physical of legacyNames(name))try{for(const request of await legacyCall(physical,'keys')){try{const url=allowed(name,request.url);if(!all.has(url))all.set(url,new Request(url))}catch{}}}catch(error){errors.push(legacyFault(physical,'keys',error))}
  const result=[...all.values()];Object.defineProperties(result,{legacyError:{value:errors[0]||null},recoveryURLs:{value:verified},storageErrors:{value:errors.map(e=>({name:e.name,code:e.code||'',cache:e.storageCache||DB}))}});return result;
 }
 async function remove(name,value){
  const url=allowed(name,value),key=logical(name,url);if(jobs.has(key))throw fault('ArchiveWritePending','storage_write_pending','This file is still being saved.');
  // This is reached only through the existing explicit per-song Remove action.
  // Delete every independent revision for this key, never other songs.
  await transaction(['files','chunks'],'readwrite',tx=>{tx.objectStore('files').delete(key);const request=tx.objectStore('chunks').index('file').openKeyCursor(IDBKeyRange.only(key));request.onsuccess=()=>{const c=request.result;if(c){tx.objectStore('chunks').delete(c.primaryKey);c.continue()}}});
  for(const physical of legacyNames(name)){nativeFailures.delete(physical+':delete');try{await legacyCall(physical,'delete',url)}catch(error){throw legacyFault(physical,'delete',error)}}return true;
 }
 const adapters=new Map();
 function open(name){if(!paths.has(name))return Promise.reject(new Error('Unknown archive bucket.'));if(!adapters.has(name))adapters.set(name,Object.freeze({match:value=>match(name,value),freshMatch:value=>freshMatch(name,value),recoveryMatch:value=>freshMatch(name,value),keys:()=>keys(name),put:(value,response,options)=>write(name,value,response,options),delete:value=>remove(name,value)}));return Promise.resolve(adapters.get(name))}
 // A virtual bucket always exists. An unavailable legacy listing must never
 // masquerade as an empty archive and erase its remembered metadata.
 const has=name=>Promise.resolve(paths.has(name));
 return Object.freeze({open,has,match,freshMatch,range,keys,write,resetLegacyChecks:()=>nativeFailures.clear(),snapshot:()=>({backend:'indexeddb-chunked-v1',database:DB,chunkBytes:CHUNK,lastDatabaseError,lastLegacyError,writeActivity:writeActivity?{...writeActivity}:null})});
})();

const originalStoreRecovery=(()=>{
 const legacy='eclipse-stk-originals-v1',recovery='indexeddb-chunked-v1';
 return Object.freeze({legacy,recovery,open:()=>archiveStorage.open(legacy),has:()=>archiveStorage.has(legacy),match:url=>archiveStorage.match(legacy,url),recoveryMatch:url=>archiveStorage.freshMatch(legacy,url),snapshot:()=>({writeCache:recovery,legacyCache:legacy,...archiveStorage.snapshot()})});
})();

async function cachedResponse(url, cacheName, deadline = Date.now() + CACHE_READ_TIMEOUT_MS) {
  const key = cacheName + ':' + url;
  const pending = pendingCacheReads.get(key);
  if (pending) {
    if (pending.abandoned) throw error('STORAGE_BUSY', 'Saved storage is still opening this item.');
    await new Promise((resolve, reject) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) { reject(error('STORAGE_TIMEOUT', 'Saved storage did not respond.')); return; }
      const timer = setTimeout(() => reject(error('STORAGE_TIMEOUT', 'Saved storage did not respond.')), remaining);
      pending.finished.then(() => { clearTimeout(timer); resolve(); });
    });
    return cachedResponse(url, cacheName, deadline);
  }
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw error('STORAGE_TIMEOUT', 'Saved storage did not respond.');
  let release;
  const record = { abandoned: false, finished: new Promise(resolve => { release = resolve; }) };
  pendingCacheReads.set(key, record);
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      done = true; record.abandoned = true;
      reject(error('STORAGE_TIMEOUT', 'Saved storage did not respond.'));
      release();
    }, remaining);
    Promise.resolve().then(() => archiveStorage.open(cacheName).then(cache => cache.match(url))).then(async response => {
      if (done) {
        // The request already timed out, so retain the slot until native cleanup
        // really settles. A bounded cleanup here would allow repeated late
        // responses to accumulate while the browser is still holding the first.
        try { if (response?.body && !response.body.locked) await response.body.cancel('Late saved storage response'); } catch (_) {}
      }
      else { done = true; clearTimeout(timer); resolve(response); }
    }, failure => {
      if (!done) { done = true; clearTimeout(timer); reject(failure); }
    }).finally(() => {
      if (pendingCacheReads.get(key) === record) pendingCacheReads.delete(key);
      release();
    });
  });
}

async function publicClient(id) {
  if (typeof id !== 'string' || !id) return null;
  return validatedMessageClient(id);
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
  if (!key || request.mode === 'navigate') return emptyResponse(404);
  try { if (!(await publicClient(event.clientId))) return emptyResponse(404); }
  catch (_) { return emptyResponse(503, { 'X-Eclipse-Archive-Error': 'client-pending' }); }
  if (!['GET', 'HEAD'].includes(request.method)) return emptyResponse(405, { Allow: 'GET, HEAD' });
  let cached;
  try { cached = await cachedResponse(key.url, listening ? LISTENING_CACHE : ORIGINALS_CACHE); }
  catch (_) { return emptyResponse(503, { 'X-Eclipse-Archive-Error': 'storage-pending' }); }
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
  return new Response(archiveStorage.range(cached, first, last) || rangeStream(cached.body, first, last), { status: range ? 206 : 200, headers });
}

function shellInfo(response) {
  // Keep a previously validated public snapshot usable until the new one is
  // committed. Upgrading this worker never deletes the old page or music.
  if (!response || response.status !== 200 || ![WORKER_BUILD, R85_WORKER_BUILD, R84_WORKER_BUILD, R83_WORKER_BUILD, R82_WORKER_BUILD, R81_WORKER_BUILD, R80_WORKER_BUILD, R78_WORKER_BUILD, PRIOR_WORKER_BUILD, R76_WORKER_BUILD, RETAINED_WORKER_BUILD, R74_WORKER_BUILD, R73_WORKER_BUILD, LEGACY_WORKER_BUILD].includes(response.headers.get('X-Eclipse-Shell-Worker')) ||
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
    const response = await cachedResponse(SHELL_URL, SHELL_CACHE);
    const info = shellInfo(response);
    if (info) return { response, info };
    await cancelBody(response, 'Invalid public shell');
  } catch (_) {}
  return null;
}

function controlFailure(code, message, stage, cause) {
  const value = error(code, message);
  value.stage = stage;
  if (cause) {
    value.nativeName = String(cause.name || 'Error').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
    value.nativeCode = String(cause.code || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
    value.nativeMessage = String(cause.message || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/(?:https?|blob):\S+/gi, '[storage URL]').slice(0, 240);
  }
  return value;
}

function controlDeadline(task, milliseconds, timeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(timeout()), milliseconds);
    Promise.resolve(task).then(value => { clearTimeout(timer); resolve(value); }, failure => { clearTimeout(timer); reject(failure); });
  });
}

function shellStatusPending() {
  return controlFailure('shell_status_pending', 'The browser is still checking the saved page. Its stored files were kept; retry setup after the check finishes.', 'worker-shell-status');
}

async function shellStatus() {
  let record = shellStatusTask;
  if (record && record.timedOut) throw shellStatusPending();
  if (!record) {
    record = { task: null, timedOut: false };
    shellStatusTask = record;
    record.task = (async () => {
      let response;
      try {
        response = await cachedResponse(SHELL_URL, SHELL_CACHE);
        return shellInfo(response) || { shellReady: false };
      } catch (failure) {
        throw controlFailure(failure.code === 'STORAGE_BUSY' || failure.code === 'STORAGE_TIMEOUT' ? 'shell_status_pending' : 'shell_status_failed', 'The browser could not finish checking the saved page. Existing saved files were kept; retry setup.', 'worker-shell-status', failure);
      } finally {
        // Keep this status slot until native body cleanup really settles. A
        // caller deadline must not create a series of abandoned shell bodies.
        try { if (response?.body && !response.body.locked) await response.body.cancel('Status needs no body'); } catch (_) {}
      }
    })();
    record.task.finally(() => { if (shellStatusTask === record) shellStatusTask = null; }).catch(() => {});
  }
  return controlDeadline(record.task, 11000, () => { record.timedOut = true; return shellStatusPending(); });
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
    const cache = await archiveStorage.open(SHELL_CACHE);
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
    const cache = await archiveStorage.open(SHELL_CACHE);
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

const LEGACY_MESSAGE_PROFILES = Object.freeze({
  'eclipse-stk-2026-11-06-r85-resumable-collection': 'eclipse-stk-offline-r85-v1',
  'eclipse-stk-2026-11-06-r82-archive-route-repair': 'eclipse-stk-offline-r82-v1',
  'eclipse-stk-2026-11-06-r81-save-connection-repair': 'eclipse-stk-offline-r81-v1',
  'eclipse-stk-2026-11-06-r80-targeted-recovery': 'eclipse-stk-offline-r80-v1',
  'eclipse-stk-2026-11-06-r79-connection-progress-recovery': 'eclipse-stk-offline-r78-v1',
  'eclipse-stk-2026-11-06-r78-offline-collection': 'eclipse-stk-offline-r78-v1',
  'eclipse-stk-2026-11-06-r77-offline-companion-recovery': 'eclipse-stk-offline-r77-v1',
  'eclipse-stk-2026-11-06-r76-archive-save-recovery': 'eclipse-stk-offline-r76-v1',
  'eclipse-stk-2026-11-06-r75-archive-index-repair': 'eclipse-stk-offline-r75-v1',
  'eclipse-stk-2026-11-06-r74-archive-recovery-guide': 'eclipse-stk-offline-r74-v1',
  'eclipse-stk-2026-11-05-r73-offline-listening-resume': 'eclipse-stk-offline-r73-v1',
  'eclipse-stk-2026-11-05-r70-offline-originals': 'eclipse-stk-offline-r70-v1'
});

function messageIdentity(data) {
  const profile = Object.hasOwn(LEGACY_MESSAGE_PROFILES, data.appBuild) ? LEGACY_MESSAGE_PROFILES[data.appBuild] : '';
  return Object.assign({ workerBuild: profile || WORKER_BUILD, actualWorkerBuild: WORKER_BUILD }, profile ? { compatibilityFor: data.appBuild } : {});
}

function messageFailure(failure, action) {
  const value = { code: String(failure.code || 'offline_error').slice(0, 80), message: String(failure.message || 'The offline action could not finish.').slice(0, 500), stage: failure.stage || (action === 'status' ? 'worker-shell-status' : action === 'activateUpdate' ? 'worker-activation' : 'worker-shell-save') };
  for (const name of ['nativeName', 'nativeCode', 'nativeMessage', 'writeState']) if (typeof failure[name] === 'string') value[name] = failure[name];
  return value;
}

function validMessageClient(client, id) {
  try { return client && client.id === id && client.type === 'window' && publicPath(new URL(client.url)) ? client : null; }
  catch (_) { return null; }
}

function messageClientList() {
  if (pendingMessageClientList) return pendingMessageClientList.task;
  const record = { task: Promise.resolve().then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true })) };
  pendingMessageClientList = record;
  record.task.finally(() => { if (pendingMessageClientList === record) pendingMessageClientList = null; }).catch(() => {});
  return record.task;
}

async function validatedMessageClient(id) {
  if (typeof id !== 'string' || !id) return null;
  let record = pendingMessageClients.get(id);
  if (!record) {
    record = { task: Promise.resolve().then(() => self.clients.get(id)) };
    pendingMessageClients.set(id, record);
    record.task.finally(() => { if (pendingMessageClients.get(id) === record) pendingMessageClients.delete(id); }).catch(() => {});
  }
  // Both answers come from the browser's Clients API. A slow get() is hedged
  // with an exact-id lookup, including not-yet-controlled public pages. Never
  // authorize another tab, an event-supplied URL, or a private page. Explicit
  // negative get() results win if they arrive before an alternative answer.
  return new Promise((resolve, reject) => {
    let done = false, listing = false;
    const finish = (fn, value) => { if (done) return; done = true; clearTimeout(timer); clearTimeout(hedge); fn(value); };
    const list = () => {
      if (done || listing || typeof self.clients.matchAll !== 'function') return;
      listing = true;
      messageClientList().then(clients => {
        if (done || !Array.isArray(clients)) return;
        const exact = clients.find(client => client && client.id === id);
        if (exact) finish(resolve, validMessageClient(exact, id));
        // matchAll skips clients which are not execution-ready. An absent id
        // does not invalidate a still-pending get(); wait for it or the bound.
      }, () => {});
    };
    const timer = setTimeout(() => finish(reject, controlFailure('worker_client_pending', 'The browser is still confirming this page for offline setup. Your saved copies were kept; keep the page open and retry.', 'worker-client')), 4000);
    const hedge = setTimeout(list, 300);
    record.task.then(client => finish(resolve, validMessageClient(client, id)), list);
    // The RPC is bounded, but native calls cannot be cancelled. Their slots
    // remain owned until they settle so a retry cannot pile up native lookups.
  });
}

// R81 control endpoint: same-origin, exact public client, small JSON only.
// This is a local Service Worker route, not an external server or music proxy.
const CONTROL_URL = new URL('__eclipse_offline_control__', BASE_URL).href;
const controlRequests = new Map();
const CONTROL_RECORD_LIMIT = 128;

function validControlRequest(data) {
  return !!data && typeof data === 'object' && !Array.isArray(data) &&
    data.type === 'ECLIPSE_OFFLINE' && data.version === PROTOCOL_VERSION &&
    typeof data.id === 'string' && /^[\w.-]{1,80}$/.test(data.id) &&
    ['hello', 'ensureShell', 'status', 'clearShell', 'activateUpdate'].includes(data.action) &&
    (data.appBuild === undefined || typeof data.appBuild === 'string' && /^eclipse-stk-[A-Za-z0-9-]{1,180}$/.test(data.appBuild)) &&
    (data.refresh === undefined || typeof data.refresh === 'boolean');
}

function controlEnvelope(data, ok, result, authenticated = true) {
  return Object.assign({ type: 'ECLIPSE_OFFLINE_RESULT', version: PROTOCOL_VERSION,
    id: data.id, action: data.action, ok }, messageIdentity(data),
    authenticated ? { capabilities: CAPABILITIES } : {}, result);
}

async function executeControl(data, event) {
  const startedAt = Date.now(), identity = messageIdentity(data);
  if (data.action === 'hello') return {};
  if (data.action === 'ensureShell') {
    const task = ensureShell(data.appBuild || '', data.refresh === true);
    event.waitUntil(task.catch(() => {}));
    return controlDeadline(task, Math.max(1, 57000 - (Date.now() - startedAt)), () => {
      const failure = controlFailure('shell_save_pending', 'The browser is still finishing offline page setup. Its result is unconfirmed; keep this page open and check again.', 'worker-shell-save');
      failure.writeState = 'pending'; return failure;
    });
  }
  if (data.action === 'clearShell') return clearShell();
  if (data.action === 'activateUpdate') {
    await controlDeadline(self.skipWaiting(), 4000, () => controlFailure('worker_activation_pending', 'The browser has not confirmed the offline update request yet. Keep this page open and retry setup.', 'worker-activation'));
    return { activationRequested: true };
  }
  const task = shellStatus();
  if (identity.compatibilityFor) {
    try { return await controlDeadline(task, 4000, shellStatusPending); }
    catch (failure) { return { shellState: 'unknown', statusError: messageFailure(failure, 'status') }; }
  }
  return controlDeadline(task, 11000, shellStatusPending);
}

function dispatchControl(client, data, event) {
  const key = client.id + ':' + data.id;
  const signature = JSON.stringify([data.action, data.appBuild || '', data.refresh === true]);
  const previous = controlRequests.get(key);
  if (previous) {
    if (previous.signature !== signature) return Promise.resolve(controlEnvelope(data, false, { error: messageFailure(error('request_conflict', 'A setup request changed while it was in progress. Retry setup.'), data.action) }));
    return previous.task;
  }
  const now = Date.now();
  for (const [id, record] of controlRequests) {
    if (record.completedAt && now - record.completedAt > 120000) controlRequests.delete(id);
  }
  if (controlRequests.size >= CONTROL_RECORD_LIMIT) {
    for (const [id, record] of controlRequests) {
      if (record.completedAt) controlRequests.delete(id);
      if (controlRequests.size < CONTROL_RECORD_LIMIT) break;
    }
  }
  if (controlRequests.size >= CONTROL_RECORD_LIMIT || [...controlRequests.values()].filter(record => record.clientId === client.id && !record.completedAt).length >= 8) {
    return Promise.resolve(controlEnvelope(data, false, { error: messageFailure(error('control_busy', 'Offline setup is already busy. Existing files were kept; retry after the current operation.'), data.action) }));
  }
  const record = { clientId: client.id, signature, completedAt: 0, task: null };
  // All three routes share this promise. A delayed reply cannot create a second
  // shell save, clear, or activation request while the first is still running.
  record.task = Promise.resolve().then(() => executeControl(data, event)).then(
    result => controlEnvelope(data, true, result),
    failure => controlEnvelope(data, false, { error: messageFailure(failure, data.action) })
  ).finally(() => { record.completedAt = Date.now(); });
  controlRequests.set(key, record);
  return record.task;
}

async function handleMessage(event) {
  const port = event.ports && event.ports[0], data = event.data;
  if (!validControlRequest(data) || event.origin && event.origin !== BASE_URL.origin) return;
  const sendPort = value => { try { if (port) port.postMessage(value); } catch (_) {} };
  let client;
  try {
    const source = event.source;
    client = source && typeof source.id === 'string' && source.id &&
      source.type === 'window' && validMessageClient(source, source.id) ? source :
      await validatedMessageClient(source && source.id);
  } catch (failure) {
    sendPort(controlEnvelope(data, false, { error: messageFailure(failure, data.action) }, false));
    return;
  }
  if (!client) return;
  const value = await dispatchControl(client, data, event);
  sendPort(value);
  try { client.postMessage(value); } catch (_) {}
}

async function handleControlFetch(event, url) {
  const request = event.request;
  if (url.href !== CONTROL_URL || request.method !== 'POST') return emptyResponse(405, { Allow: 'POST' });
  if (request.mode !== 'same-origin' || request.headers.get('X-Eclipse-Control') !== '1' ||
      (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase() !== 'application/json' ||
      request.headers.get('Origin') && request.headers.get('Origin') !== BASE_URL.origin ||
      !event.clientId || Number(request.headers.get('Content-Length') || 0) > 4096) return emptyResponse(403);
  let client, data;
  try {
    client = await validatedMessageClient(event.clientId);
    if (!client) return emptyResponse(403);
    const text = await controlDeadline(request.text(), 3000, () => error('control_body_timeout', 'Setup request was incomplete.'));
    if (new TextEncoder().encode(text).byteLength > 4096) return emptyResponse(413);
    data = JSON.parse(text);
    if (!validControlRequest(data) || !['hello', 'status', 'ensureShell'].includes(data.action)) return emptyResponse(400);
  } catch (_) { return emptyResponse(503); }
  const value = await dispatchControl(client, data, event);
  return new Response(JSON.stringify(value), { status: 200, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Eclipse-Control': '1', 'X-Eclipse-Worker-Actual': WORKER_BUILD
  } });
}


// Installation is inert: no precache, imported code, forced update, or network.
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('message', event => { event.waitUntil(handleMessage(event)); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== BASE_URL.origin) return;
  if (url.pathname === new URL('__eclipse_offline_capabilities__', BASE_URL).pathname && !url.search && !url.hash) {
    // Public, read-only capability metadata. It does not open storage, expose
    // private state, or activate anything. A static-host 404 cannot pass it.
    event.respondWith(event.request.method === 'GET' ? new Response(JSON.stringify({workerBuild:WORKER_BUILD,originalRecovery:originalStoreRecovery.recovery,archiveBackend:archiveStorage.snapshot().backend}), {headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','X-Eclipse-Worker-Actual':WORKER_BUILD}}) : emptyResponse(405));
  } else if (url.pathname === new URL(CONTROL_URL).pathname) {
    event.respondWith(handleControlFetch(event, url));
  } else if (url.pathname.startsWith(LISTENING_PREFIX)) {
    event.respondWith(serveOriginal(event, url, true));
  } else if (url.pathname.startsWith(AUDIO_PREFIX)) {
    event.respondWith(serveOriginal(event, url));
  } else if (event.request.method === 'GET' && event.request.mode === 'navigate' &&
             publicPath(url) && !url.search && !url.hash) {
    event.respondWith(networkFirstShell(event.request));
  }
});
