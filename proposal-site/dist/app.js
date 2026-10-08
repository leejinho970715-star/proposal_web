import { cloud } from './cloud-client.js';
const $ = (id) => document.getElementById(id);
let admin=false, cloudReady=false, localRecords=[];
const proposals = [{id:'pms',name:'PMS 구축 제안서',builtIn:true,pdfUrl:'assets/pms-proposal.pdf',pages:Array.from({length:25},(_,i)=>({src:`assets/page-${i+1}.png`,name:`${i+1}페이지`}))}];
proposals.push({id:'eumsquare',name:'이음스퀘어 회사소개서 (NEW)',subtitle:'EUM SQUARE · COMPANY PROFILE',builtIn:true,pdfUrl:'assets/eumsquare-new/company-profile.pdf',pdf:{name:'이음스퀘어 회사소개서(new).pdf',src:'assets/eumsquare-new/company-profile.pdf'},pages:Array.from({length:17},(_,i)=>({src:`assets/eumsquare-new/page-${i+1}.png`,name:`${i+1}페이지`}))});
proposals.push({id:'pms-new',name:'PMS 구축 제안서(New)',subtitle:'I-ONE SOFT BANK PMS 제안서(건설)_기성관리',builtIn:true,pdfUrl:'assets/pms-new-v2/proposal.pdf',pdf:{name:'아이원_PMS 제안서(건설)_기성관리(new).pdf',src:'assets/pms-new-v2/proposal.pdf'},pages:Array.from({length:26},(_,i)=>({src:`assets/pms-new-v2/page-${i+1}.png`,name:`${i+1}페이지`}))});
const defaults=structuredClone(proposals);
let active=null, page=0, db=null, returnFocus=null;
const urls=[];
function notify(message){$('notice').textContent=message;$('notice').hidden=false;setTimeout(()=>$('notice').hidden=true,5000);}
function renderCards(){
  $('cards').replaceChildren();$('count').textContent=proposals.length;
  proposals.forEach(proposal=>{
    const card=document.createElement('article');card.className='card';
    const button=document.createElement('button');button.className='card-open';button.setAttribute('aria-label',`${proposal.name}, ${proposal.pages.length}페이지 열기`);
    const cover=document.createElement('img');cover.className='cover';cover.src=proposal.pages[0].src;cover.alt=`${proposal.name} 표지`;cover.loading='lazy';
    const info=document.createElement('div');info.className='card-info';
    const meta=document.createElement('div');meta.className='card-meta';meta.textContent=getSubtitle(proposal);meta.hidden=!meta.textContent;
    const title=document.createElement('h3');title.className='card-title';title.textContent=proposal.name;
    const bottom=document.createElement('div');bottom.className='card-bottom';
    const count=document.createElement('span');count.textContent=`${proposal.pages.length} 페이지`;
    const actions=document.createElement('div');actions.className='card-actions';
    const open=document.createElement('button');open.type='button';open.className='slide-action';open.textContent='슬라이드 보가';open.setAttribute('aria-label',`${proposal.name} 슬라이드 보가`);
    open.onclick=()=>{returnFocus=open;openProposal(proposal.id);};actions.append(open);
    if(proposal.pdfUrl){const pdf=document.createElement('a');pdf.className='pdf-action';pdf.textContent='PDF 보기';pdf.href=proposal.pdfUrl;pdf.target='_blank';pdf.rel='noopener noreferrer';pdf.setAttribute('aria-label',`${proposal.name} PDF 보기 (새 탭)`);actions.append(pdf);}
    if(admin){    const edit=document.createElement('button');edit.type='button';edit.className='pdf-action';edit.textContent='수정하기';edit.setAttribute('aria-label',`${proposal.name} 수정하기`);edit.onclick=()=>openEditor(proposal);actions.append(edit);
    const remove=document.createElement('button');remove.type='button';remove.className='pdf-action delete-action';remove.textContent='삭제';remove.setAttribute('aria-label',`${proposal.name} 삭제`);remove.onclick=()=>openDelete(proposal,remove);actions.append(remove);
    }
    bottom.append(count);info.append(meta,title,bottom,actions);button.append(cover);
    button.addEventListener('click',()=>{returnFocus=button;openProposal(proposal.id);});card.append(button,info);$('cards').append(card);
  });
  if(!proposals.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='등록된 제안서가 없습니다. 제안서 추가 버튼으로 새 자료를 등록하세요.';$('cards').append(empty);}
}
let deleting=null,deleteBusy=false,deleteFocus=null;
function openDelete(proposal,button){if(!admin||!cloudReady)return;deleting=proposal;deleteFocus=button;$('delete-name').textContent=proposal.name;$('delete-error').textContent='';$('delete-dialog').showModal();$('delete-cancel').focus();}
$('delete-cancel').onclick=()=>{if(!deleteBusy)$('delete-dialog').close();};
$('delete-dialog').addEventListener('cancel',event=>{if(deleteBusy)event.preventDefault();});
$('delete-dialog').addEventListener('close',()=>{deleting=null;if(deleteFocus?.isConnected)deleteFocus.focus();else $('add').focus();deleteFocus=null;});
$('delete-form').onsubmit=async event=>{
  event.preventDefault();if(deleteBusy||!deleting)return;
  if(!admin||!cloudReady){$('delete-error').textContent='관리자 로그인과 공용 저장소 연결이 필요합니다.';return;}
  deleteBusy=true;$('delete-confirm').disabled=true;$('delete-cancel').disabled=true;
  try{
    await cloud.remove(deleting.id);
    const index=proposals.findIndex(item=>item.id===deleting.id);if(index>=0)proposals.splice(index,1);
    renderCards();$('delete-dialog').close();notify('공용 라이브러리에서 삭제했습니다.');
  }catch(error){$('delete-error').textContent=error.message||'삭제하지 못했습니다. 잠시 후 다시 시도하세요.';}
  finally{deleteBusy=false;$('delete-confirm').disabled=false;$('delete-cancel').disabled=false;}
};
function updatePage(){
  $('current').textContent=String(page+1).padStart(2,'0');$('total').textContent=String(active.pages.length).padStart(2,'0');
  $('top-count').textContent=`${page+1} / ${active.pages.length}`;$('progress-fill').style.width=`${(page+1)/active.pages.length*100}%`;
  $('prev').disabled=page===0;$('next').disabled=page===active.pages.length-1;
}
function openProposal(id){
  const proposal=proposals.find(p=>p.id===id);if(!proposal)throw new Error('제안서를 찾을 수 없습니다.');
  active=proposal;page=0;$('track').replaceChildren();
  proposal.pages.forEach((p,i)=>{const slide=document.createElement('figure');slide.className='slide';slide.setAttribute('aria-label',`${i+1} / ${proposal.pages.length}페이지`);const img=document.createElement('img');img.src=p.src;img.alt=`${proposal.name} ${i+1}페이지`;img.draggable=false;img.loading=i<2?'eager':'lazy';img.addEventListener('error',()=>{img.alt=`${i+1}페이지 이미지를 불러오지 못했습니다.`;});slide.append(img);$('track').append(slide);});
  $('viewer-title').textContent=proposal.name;$('library').hidden=true;$('viewer').hidden=false;$('track').scrollLeft=0;updatePage();$('back').focus();
}
function goTo(next){if(!active)return;page=Math.max(0,Math.min(active.pages.length-1,next));$('track').scrollTo({left:page*$('track').clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});updatePage();}
$('prev').onclick=()=>goTo(page-1);$('next').onclick=()=>goTo(page+1);
$('back').onclick=()=>{$('viewer').hidden=true;$('library').hidden=false;active=null;returnFocus?.focus();};
let scrollFrame=0;
$('track').addEventListener('scroll',()=>{cancelAnimationFrame(scrollFrame);scrollFrame=requestAnimationFrame(()=>{if(!active)return;page=Math.round($('track').scrollLeft/$('track').clientWidth);updatePage();});});
let accumulated=0,lastWheel=0,lockUntil=0;
$('viewer').addEventListener('wheel',event=>{
  if(event.ctrlKey||!active)return;event.preventDefault();
  const now=performance.now();const delta=(Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY)*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1);
  if(now-lastWheel>180)accumulated=0;lastWheel=now;
  if(now<lockUntil){lockUntil=now+180;return;}
  if(Math.sign(accumulated)!==Math.sign(delta))accumulated=0;accumulated+=delta;
  if(Math.abs(accumulated)>=35){goTo(page+Math.sign(accumulated));accumulated=0;lockUntil=now+550;}
},{passive:false});
document.addEventListener('keydown',event=>{
  if(!active||event.ctrlKey||event.metaKey||event.altKey||event.target.matches('input,textarea,select'))return;
  if(['ArrowRight','ArrowDown','PageDown'].includes(event.key)){event.preventDefault();goTo(page+1);}
  if(['ArrowLeft','ArrowUp','PageUp'].includes(event.key)){event.preventDefault();goTo(page-1);}
  if(event.key==='Home'){event.preventDefault();goTo(0);}if(event.key==='End'){event.preventDefault();goTo(active.pages.length-1);}if(event.key==='Escape')$('back').click();
});
let resizeTimer;window.addEventListener('resize',()=>{if(!active)return;const selected=page;clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{$('track').scrollTo({left:selected*$('track').clientWidth,behavior:'instant'});},80);});
function getSubtitle(proposal){return proposal.subtitle??(proposal.builtIn?'I-ONE SOFT BANK PMS 제안서(건설)_기성관리':'MY PROPOSAL');}
const dialog=$('add-dialog');$('add').onclick=()=>openEditor();$('cancel').onclick=()=>{if(!saving)dialog.close();};
const supported=/\.(png|jpe?g|webp|gif|avif)$/i;
let pendingImages=[], saving=false, editing=null;
function openEditor(proposal=null){
  if(!admin){$('auth-dialog').showModal();return;}
  if(!cloudReady){notify('공용 저장소 연결을 확인한 뒤 다시 시도하세요.');return;}
  editing=proposal;$('add-form').reset();$('form-error').textContent='';
  $('proposal-dialog-title').textContent=proposal?'제안서 수정':'제안서 추가';$('save').textContent=proposal?'수정 내용 저장':'라이브러리에 추가';
  $('proposal-name').value=proposal?.name??'';$('proposal-subtitle').value=proposal?getSubtitle(proposal):'';
  $('existing-pdf').textContent=proposal?.pdfUrl?`현재 PDF: ${proposal.pdf?.name??'PMS 제안서 PDF'} · 새 파일을 선택하지 않으면 유지됩니다.`:'';
  $('remove-pdf').parentElement.hidden=!proposal?.pdfUrl;
  pendingImages=proposal?proposal.pages.map(p=>({file:null,record:{name:p.name,...(p.blob?{blob:p.blob}:{src:p.src})},url:p.src})):[];
  renderImageOrder();dialog.showModal();
}
function selectedFiles(){return pendingImages.filter(item=>item.file).map(item=>item.file);}
function draftRecord(name,subtitle,pdfFile){
  return {id:editing?.id??crypto.randomUUID(),builtIn:editing?.builtIn??false,name,subtitle,
    pages:pendingImages.map(item=>item.file?{name:item.file.name,blob:item.file}:item.record),
    pdf:pdfFile?{name:pdfFile.name,blob:new Blob([pdfFile],{type:'application/pdf'})}:$('remove-pdf').checked?null:editing?.pdf??(editing?.pdfUrl?{name:'PMS 제안서 PDF',src:editing.pdfUrl}:null)};
}
function upsertProposal(proposal){const index=proposals.findIndex(p=>p.id===proposal.id);if(index<0)proposals.push(proposal);else proposals[index]=proposal;}
function renderImageOrder(){
  $('image-order').replaceChildren();
  $('file-note').textContent=pendingImages.length?`${pendingImages.length}페이지 · 첫 이미지가 라이브러리 썸네일로 사용됩니다.`:'PNG, JPG, WEBP, GIF, AVIF 이미지 지원';
  pendingImages.forEach((item,index)=>{
    const row=document.createElement('li');
    const preview=document.createElement('img');preview.src=item.url;preview.alt=`${index+1}페이지 미리보기`;
    const label=document.createElement('span');label.textContent=`${index+1}${index===0?' · 표지':''} — ${item.file?.name??item.record.name}`;
    const actions=document.createElement('div');actions.className='image-actions';
    for(const [text,offset] of [['앞으로',-1],['뒤로',1]]){
      const button=document.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-label',`${index+1}페이지 ${text}`);
      button.disabled=index+offset<0||index+offset>=pendingImages.length;
      button.onclick=()=>{if(saving)return;const next=index+offset;[pendingImages[index],pendingImages[next]]=[pendingImages[next],pendingImages[index]];renderImageOrder();$('image-order').children[next].querySelector('button:not(:disabled)')?.focus();};actions.append(button);
    }
    const remove=document.createElement('button');remove.type='button';remove.textContent='제외';remove.setAttribute('aria-label',`${index+1}페이지 제외`);
    remove.onclick=()=>{if(saving)return;if(item.file)URL.revokeObjectURL(item.url);pendingImages.splice(index,1);renderImageOrder();};actions.append(remove);
    row.append(preview,label,actions);$('image-order').append(row);
  });
}
$('files').onchange=()=>{
  const chosen=Array.from($('files').files);const files=chosen.filter(f=>supported.test(f.name));
  pendingImages.push(...files.map(file=>({file,url:URL.createObjectURL(file)})));
  $('files').value='';renderImageOrder();
  $('form-error').textContent=chosen.length!==files.length?'지원하지 않는 파일은 제외되었습니다. PNG, JPG, WEBP, GIF, AVIF 이미지를 선택하세요.':'';
  if(!$('proposal-name').value&&files[0])$('proposal-name').value=files[0].name.replace(/\.[^.]+$/,'').slice(0,100);
};
dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
dialog.addEventListener('close',()=>{pendingImages.filter(item=>item.file).forEach(item=>URL.revokeObjectURL(item.url));pendingImages=[];editing=null;$('add-form').reset();renderImageOrder();});
function openDatabase(){return new Promise((resolve,reject)=>{const request=indexedDB.open('ione-proposal-library',1);request.onupgradeneeded=()=>request.result.createObjectStore('proposals',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function storeRecord(record){return new Promise((resolve,reject)=>{const tx=db.transaction('proposals','readwrite');tx.objectStore('proposals').put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
function hydrate(record){let pdfUrl=record.pdf?.src??null;if(record.pdf?.blob){pdfUrl=URL.createObjectURL(record.pdf.blob);urls.push(pdfUrl);}return {...record,pdfUrl,pages:record.pages.map(p=>{if(!p.blob)return {...p};const src=URL.createObjectURL(p.blob);urls.push(src);return {...p,src};})};}
async function validatePdf(file){if(!file)return;const header=new TextDecoder().decode(await file.slice(0,5).arrayBuffer());if(!/\.pdf$/i.test(file.name)||header!=='%PDF-')throw new Error('올바른 PDF 파일을 선택하세요.');}
async function validateImages(files){for(const file of files){const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();}catch{throw new Error(`이미지를 읽을 수 없습니다: ${file.name}`);}finally{URL.revokeObjectURL(url);}}}
$('add-form').onsubmit=async event=>{
  event.preventDefault();$('form-error').textContent='';const files=selectedFiles();const name=$('proposal-name').value.trim();const pdfFile=$('pdf-file').files[0];
  if(saving)return;
  if(!pendingImages.length||!name){$('form-error').textContent='제안서 이름과 한 장 이상의 이미지를 추가하세요.';return;}
  if(!admin||!cloudReady){$('form-error').textContent='관리자 로그인과 공용 저장소 연결이 필요합니다.';return;}
  saving=true;const controls=Array.from($('add-form').querySelectorAll('button,input'));const disabledStates=controls.map(control=>control.disabled);controls.forEach(control=>control.disabled=true);$('save').textContent='이미지 확인 및 저장 중…';
  try{await validatePdf(pdfFile);await validateImages(files);const record=draftRecord(name,$('proposal-subtitle').value.trim(),pdfFile);const saved=await cloud.save(record,message=>$('save').textContent=message);upsertProposal(hydrate(saved));renderCards();dialog.close();notify('제안서가 공유되었습니다. 다른 PC에서도 볼 수 있습니다.');}
  catch(error){$('form-error').textContent=error.name==='QuotaExceededError'?'브라우저 저장 공간이 부족합니다. 이미지 용량을 줄여 다시 시도하세요.':error.message||'저장에 실패했습니다. 다시 시도하세요.';}
  finally{saving=false;controls.forEach((control,i)=>control.disabled=disabledStates[i]);$('save').textContent=editing?'수정 내용 저장':'라이브러리에 추가';}
};
renderCards();
function renderLocalRecords(){
  $('local-records').replaceChildren();$('migration').hidden=!admin||!localRecords.length;
  for(const record of localRecords){
    const row=document.createElement('div');row.className='local-record';
    const label=document.createElement('span');label.textContent=record.name;
    const button=document.createElement('button');button.className='pdf-action';button.textContent='확인 후 공유하기';
    button.onclick=()=>openEditor(hydrate(record));row.append(label,button);$('local-records').append(row);
  }
}
$('admin').onclick=()=>{if(admin){cloud.logout();admin=false;$('admin').textContent='관리자 로그인';renderCards();renderLocalRecords();}else $('auth-dialog').showModal();};
$('auth-cancel').onclick=()=>$('auth-dialog').close();
$('auth-dialog').addEventListener('close',()=>{$('admin-key').value='';$('auth-error').textContent='';});
$('auth-form').onsubmit=async event=>{
  event.preventDefault();$('auth-submit').disabled=true;$('auth-error').textContent='';
  try{await cloud.login($('admin-key').value);admin=true;$('admin').textContent='관리자 로그아웃';$('auth-dialog').close();renderCards();renderLocalRecords();}
  catch(error){$('auth-error').textContent=error.message;}
  finally{$('auth-submit').disabled=false;}
};
async function loadShared(){
  $('storage-status').textContent='공유 제안서를 불러오는 중…';
  try{const records=await cloud.load();proposals.splice(0,proposals.length,...structuredClone(defaults));for(const record of records){if(record.deleted){const index=proposals.findIndex(p=>p.id===record.id);if(index>=0)proposals.splice(index,1);}else upsertProposal(hydrate(record));}cloudReady=true;renderCards();$('storage-status').textContent='공용 라이브러리 · 추가·수정·삭제한 내용은 모든 기기에서 반영됩니다.';}
  catch(error){cloudReady=false;$('storage-status').textContent=`${error.message} 기존 기본 제안서는 계속 볼 수 있습니다.`;}
}
$('refresh-library').onclick=loadShared;
loadShared();
(async()=>{try{db=await openDatabase();const request=db.transaction('proposals').objectStore('proposals').getAll();request.onsuccess=()=>{localRecords=request.result.filter(record=>!record.deleted);renderLocalRecords();};}catch{/* Shared library remains available without browser storage. */}})();
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'list_proposals',description:'선택 가능한 제안서 목록 조회',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({proposals:proposals.map(p=>({id:p.id,name:p.name,pages:p.pages.length}))})})).catch(()=>{});}catch{}}
