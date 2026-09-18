import {targetSize} from './pdf-core.mjs';
import {createVisualCopy,renderOptions} from './visual-copy.mjs';
import * as pdfjs from './vendor/pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.min.mjs',import.meta.url).href;
const $=id=>document.getElementById(id);
const state={pages:[],file:null,page:0,preview:null,worker:null,busy:false,generation:0,render:0,url:null,job:0,pending:new Map(),visualRequired:false,loadingTask:null,conversion:null};
const dims=s=>`${(s.width*25.4/72).toFixed(1)} × ${(s.height*25.4/72).toFixed(1)} mm`;
const megabytes=n=>`${(n/1024/1024).toFixed(1)} MB`;
function error(message){$('error').textContent=message;$('error').hidden=!message;}
function clearResult(){if(state.url)URL.revokeObjectURL(state.url);state.url=null;$('ready').hidden=true;$('download').removeAttribute('href');}
function busy(value,label=''){
  state.busy=value;
  for(const id of ['size','orientation','file-input'])$(id).disabled=value;
  $('visual-mode').disabled=value||state.visualRequired;
  $('resize').disabled=value||!state.pages.length;
  $('progress-area').hidden=!value;$('progress-label').textContent=label;
}
function clear(){
  state.generation++;state.render++;
  state.conversion?.abort();state.conversion=null;
  state.loadingTask?.destroy().catch(()=>{});state.loadingTask=null;
  $('password-dialog').close();$('pdf-password').value='';passwordCallback=null;
  state.visualRequired=false;$('visual-mode').checked=false;$('conversion-options').hidden=true;
  state.worker?.terminate();state.worker=null;
  for(const {reject} of state.pending.values())reject(new Error('Canceled.'));
  state.pending.clear();state.preview=null;
  state.pages=[];state.file=null;state.page=0;clearResult();error('');busy(false);
  $('file-input').value='';$('dropzone').hidden=false;$('loaded').hidden=true;$('target-dims').textContent='Choose a PDF to begin';
  for(const id of ['before','after']){$(id).width=1;$(id).height=1;delete $(id).dataset.page;}
  $('preview-status').textContent='';
}
function worker(){
  if(state.worker)return state.worker;
  const w=new Worker(new URL('./pdf-worker.mjs',import.meta.url),{type:'module'});
  w.onmessage=({data})=>{
    if(data.progress!==undefined){$('progress').value=data.progress;$('progress-label').textContent=`Resizing pages… ${data.progress}%`;return;}
    const task=state.pending.get(data.id);if(!task)return;
    state.pending.delete(data.id);data.error?task.reject(new Error(data.error)):task.resolve(data);
  };
  w.onerror=()=>{for(const task of state.pending.values())task.reject(new Error('Processing stopped. Try a smaller PDF or a current browser.'));state.pending.clear();w.terminate();state.worker=null;};
  state.worker=w;return w;
}
function request(action,data,transfer=[]){return new Promise((resolve,reject)=>{const id=++state.job;state.pending.set(id,{resolve,reject});worker().postMessage({id,action,...data},transfer);});}
function selectedTarget(){return targetSize(state.pages,$('size').value,$('orientation').value);}
let passwordCallback=null;
function updateConversion(){
  clearResult();
  const visual=$('visual-mode').checked;
  $('resize-label').textContent=visual?'Create visual copy':'Resize PDF';
  $('conversion-note').textContent=visual?'Visible fields and marks become page images. Text will not be selectable, fields will not be editable, and digital-signature validity will not be retained. The new copy has no password protection.':'Keeps PDF text and graphics. Choose a visual copy if a difficult PDF does not convert correctly.';
}
$('password-form').addEventListener('submit',e=>{e.preventDefault();const password=$('pdf-password').value;$('pdf-password').value='';$('password-dialog').close();passwordCallback?.(password);passwordCallback=null;});
$('password-cancel').addEventListener('click',clear);
$('password-dialog').addEventListener('cancel',e=>{e.preventDefault();clear();});
function updateSettings(){
  clearResult();error('');const mode=$('size').value;
  $('orientation-field').hidden=!['a4','letter'].includes(mode);
  $('size-help').textContent={first:'Uses the first page’s displayed width and height.',largest:'Uses the page with the largest area, including its current orientation.',a4:'Standard A4 paper: 210 × 297 mm.',letter:'Standard US Letter paper: 8.5 × 11 inches.'}[mode];
  if(state.pages.length){try{$('target-dims').textContent=dims(selectedTarget());$('resize').disabled=state.busy;}catch(e){error(e.message);$('resize').disabled=true;}}
  drawAfter();
}
async function loadFile(file){
  if(state.busy)return;
  clear();const generation=state.generation;
  if(!file)return;
  if(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf'){error('Please choose a PDF file.');return;}
  if(file.size>100*1024*1024){error('This PDF is larger than 100 MB. Please use a smaller file.');return;}
  if(!file.size){error('This file is empty. Please choose another PDF.');return;}
  busy(true,'Reading your PDF…');$('progress').removeAttribute('value');
  try{
    const bytes=await file.arrayBuffer();
    if(generation!==state.generation)return;
    const vectorBytes=bytes.slice(0);
    let usedPassword=false;
    const task=pdfjs.getDocument({data:bytes,isEvalSupported:false,enableXfa:true,stopAtErrors:true,cMapUrl:new URL('./vendor/cmaps/',import.meta.url).href,cMapPacked:true,standardFontDataUrl:new URL('./vendor/standard_fonts/',import.meta.url).href,wasmUrl:new URL('./vendor/wasm/',import.meta.url).href});
    state.loadingTask=task;
    task.onPassword=(callback,reason)=>{if(generation!==state.generation)return;usedPassword=true;passwordCallback=callback;$('password-message').textContent=reason===2?'Incorrect password. Please try again.':'Enter the password to open this PDF locally in your browser.';$('password-dialog').showModal();$('pdf-password').focus();};
    const preview=await task.promise;
    if(generation!==state.generation)return;
    state.preview=preview;
    if(preview.isPureXfa)throw new Error('This PDF uses dynamic XFA forms. Export a standard PDF from its original application and try again.');
    if(!preview.numPages||preview.numPages>1000)throw new Error('Choose a PDF with between 1 and 1,000 pages.');
    const permissions=await preview.getPermissions();
    if(permissions&&!permissions.includes(pdfjs.PermissionFlag.PRINT)&&!permissions.includes(pdfjs.PermissionFlag.PRINT_HIGH_QUALITY))throw new Error('This PDF restricts printing. Ask its owner for a copy that permits conversion.');
    const pages=[];let hasMarks=false;
    for(let i=1;i<=preview.numPages;i++){
      const page=await preview.getPage(i),view=page.getViewport({scale:1});
      if(generation!==state.generation)return;
      if(![view.width,view.height].every(n=>Number.isFinite(n)&&n>0))throw new Error('This PDF has an invalid page size.');
      pages.push({width:view.width,height:view.height});
      if((await page.getAnnotations({intent:'display'})).some(a=>a.subtype!=='Link'))hasMarks=true;
    }
    let result=null;
    if(!usedPassword)try{result=await request('load',{bytes:vectorBytes},[vectorBytes]);}catch{}
    if(generation!==state.generation)return;
    state.visualRequired=usedPassword||hasMarks||!result||result.visual||result.pages.length!==pages.length||result.pages.some((p,i)=>Math.abs(p.width-pages[i].width)>.1||Math.abs(p.height-pages[i].height)>.1);
    state.pages=pages;state.file=file;state.page=0;
    $('visual-mode').checked=state.visualRequired;$('conversion-options').hidden=false;updateConversion();
    if(state.visualRequired){state.worker?.terminate();state.worker=null;}
    $('filename').textContent=file.name;
    const sizes=new Set(state.pages.map(p=>`${p.width.toFixed(1)}x${p.height.toFixed(1)}`)).size;
    $('file-meta').textContent=`${state.pages.length} page${state.pages.length===1?'':'s'} · ${sizes} page size${sizes===1?'':'s'} · ${megabytes(file.size)}`;
    $('dropzone').hidden=true;$('loaded').hidden=false;updateSettings();
    $('preview-status').textContent='Loading preview…';
    await renderPreview();
  }catch(e){if(generation===state.generation){clear();error(e.message||'This PDF could not be opened.');}}
  finally{if(generation===state.generation){busy(false);if(state.pages.length)try{selectedTarget();}catch{$('resize').disabled=true;}}}
}
async function renderPreview(){
  if(!state.pages.length)return;
  const token=++state.render, index=state.page;
  $('page-count').textContent=`${index+1} / ${state.pages.length}`;
  $('previous').disabled=index===0;$('next').disabled=index===state.pages.length-1;
  $('original-dims').textContent=dims(state.pages[index]);
  if(!state.preview)return;
  $('preview-status').textContent='Loading preview…';
  try{
    const page=await state.preview.getPage(index+1);if(token!==state.render)return;
    const original=page.getViewport({scale:1});
    const viewport=page.getViewport({scale:Math.min(1000/original.width,1000/original.height)});
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(viewport.width));canvas.height=Math.max(1,Math.ceil(viewport.height));
    await page.render({canvasContext:canvas.getContext('2d'),viewport,...renderOptions}).promise;
    if(token!==state.render)return;
    const before=$('before');before.width=canvas.width;before.height=canvas.height;before.getContext('2d').drawImage(canvas,0,0);before.dataset.page=String(index);
    drawAfter();$('preview-status').textContent='Same content and orientation. White space is added where needed.';
  }catch{if(token===state.render)$('preview-status').textContent='Preview unavailable for this page. Review the downloaded PDF.';}
}
function drawAfter(){
  if(!state.pages.length)return;
  let target;try{target=selectedTarget();}catch{return;}
  $('output-dims').textContent=dims(target);
  const before=$('before');if(before.dataset.page!==String(state.page))return;
  const canvas=$('after'),ratio=1000/Math.max(target.width,target.height);
  canvas.width=Math.max(1,Math.round(target.width*ratio));canvas.height=Math.max(1,Math.round(target.height*ratio));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  const scale=Math.min(canvas.width/before.width,canvas.height/before.height);
  const width=before.width*scale,height=before.height*scale;
  ctx.drawImage(before,(canvas.width-width)/2,(canvas.height-height)/2,width,height);
}
async function resize(){
  if(state.busy)throw new Error('Please wait for the current operation.');
  if(!state.pages.length)throw new Error('Choose a PDF first.');
  selectedTarget();clearResult();error('');busy(true,'Resizing your PDF…');$('progress').value=0;
  const generation=state.generation;
  try{
    state.conversion=new AbortController();
    const result=$('visual-mode').checked?await createVisualCopy(state.preview,state.pages,selectedTarget(),{
      signal:state.conversion.signal,
      createCanvas(width,height){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;},
      encodeCanvas:canvas=>new Promise((resolve,reject)=>canvas.toBlob(async blob=>{try{if(!blob)throw new Error('Could not create this page image.');resolve(new Uint8Array(await blob.arrayBuffer()));}catch(e){reject(e);}},'image/jpeg',0.95)),
      onProgress(done,total){$('progress').value=done/total*95;$('progress-label').textContent=`Creating visual copy… ${done} / ${total}`;}
    }):await request('resize',{mode:$('size').value,orientation:$('orientation').value});
    if(generation!==state.generation)return {canceled:true};
    const blob=new Blob([result.bytes],{type:'application/pdf'});state.url=URL.createObjectURL(blob);
    $('download').href=state.url;$('download').download=state.file.name.replace(/\.pdf$/i,'')+'-same-size.pdf';
    $('result-meta').textContent=`${state.pages.length} pages · ${dims(result.target)} · ${megabytes(blob.size)}${result.visual?` · Visual copy (${result.minDpi} dpi minimum)`:''}`;
    $('ready').hidden=false;$('download').focus();
    return {ready:true,pageCount:state.pages.length,width:result.target.width,height:result.target.height};
  }catch(e){if(generation===state.generation)error(e.message);throw e;}
  finally{if(generation===state.generation)busy(false);}
}
$('file-input').addEventListener('change',e=>loadFile(e.target.files[0]));
$('remove').addEventListener('click',clear);
$('visual-mode').addEventListener('change',updateConversion);
for(const id of ['size','orientation'])$(id).addEventListener('change',updateSettings);
$('resize').addEventListener('click',()=>resize().catch(()=>{}));
$('previous').addEventListener('click',()=>{if(state.page>0){state.page--;renderPreview();}});
$('next').addEventListener('click',()=>{if(state.page<state.pages.length-1){state.page++;renderPreview();}});
let dragDepth=0;
document.addEventListener('dragover',e=>e.preventDefault());
document.addEventListener('drop',e=>e.preventDefault());
const dropzone=$('dropzone');
dropzone.addEventListener('dragenter',e=>{e.preventDefault();dragDepth++;dropzone.classList.add('dragging');});
dropzone.addEventListener('dragleave',()=>{dragDepth--;if(dragDepth<=0)dropzone.classList.remove('dragging');});
dropzone.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;dropzone.classList.remove('dragging');if(e.dataTransfer.files.length!==1){error('Choose one PDF at a time.');return;}loadFile(e.dataTransfer.files[0]);});
window.addEventListener('pagehide',clear);
window.addEventListener('pageshow',e=>{if(e.persisted)clear();});
// Optional page-scoped agent access uses exactly the same controls and actions.
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();
  const register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
  register({name:'configure_pdf_page_size',title:'Configure PDF page size',description:'Set the output size for the PDF already chosen by the user. Does not read a new file or create a download.',inputSchema:{type:'object',properties:{size:{type:'string',enum:['first','largest','a4','letter']},orientation:{type:'string',enum:['portrait','landscape']}},required:['size'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(state.busy)throw new Error('Processing is in progress.');if(!input||!['first','largest','a4','letter'].includes(input.size)||input.orientation&&!['portrait','landscape'].includes(input.orientation))throw new Error('Invalid output settings.');if(!state.pages.length)throw new Error('The user must choose a PDF first.');targetSize(state.pages,input.size,input.orientation||'portrait');$('size').value=input.size;$('orientation').value=input.orientation||'portrait';updateSettings();return {size:input.size,...selectedTarget()};}});
  register({name:'create_resized_pdf',title:'Create resized PDF',description:'Resize the currently selected PDF using the visible output settings. Prepares a local download; does not upload, send, or overwrite any file.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:resize});
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
