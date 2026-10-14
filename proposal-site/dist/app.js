import { cloud, withDeadline } from './cloud-client.js?v=5705e323b020';
const $ = (id) => document.getElementById(id);
let admin=false, cloudReady=false, localRecords=[];
const proposals = [{id:'pms',name:'PMS 구축 제안서',builtIn:true,pdfUrl:'assets/pms-proposal.pdf',pages:Array.from({length:25},(_,i)=>({src:`assets/page-${i+1}.png`,name:`${i+1}페이지`}))}];
proposals.push({id:'eumsquare',name:'이음스퀘어 회사소개서(NEW)',subtitle:'EUM SQUARE · COMPANY PROFILE',builtIn:true,pdfUrl:'assets/eumsquare-new-v2/company-profile.pdf',pdf:{name:'이음스퀘어 회사소개서(new).pdf',src:'assets/eumsquare-new-v2/company-profile.pdf'},pages:Array.from({length:19},(_,i)=>({src:`assets/eumsquare-new-v2/page-${i+1}.png`,name:`${i+1}페이지`}))});
proposals.push({id:'pms-new',name:'PMS 구축 제안서(New)',subtitle:'I-ONE SOFT BANK PMS 제안서(건설)_기성관리',builtIn:true,pdfUrl:'assets/pms-new-v5/proposal.pdf',pdf:{name:'아이원_PMS 제안서(건설)_기성관리(new).pdf',src:'assets/pms-new-v5/proposal.pdf'},pages:Array.from({length:26},(_,i)=>({src:`assets/pms-new-v5/page-${i+1}.png`,name:`${i+1}페이지`}))});
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
    if(proposal.figmaUrl){const figma=document.createElement('a');figma.className='pdf-action';figma.textContent='피그마 슬라이드';figma.href=proposal.figmaUrl;figma.target='_blank';figma.rel='noopener noreferrer';figma.setAttribute('aria-label',`${proposal.name} 피그마 슬라이드 (새 탭)`);actions.append(figma);}
    if(proposal.pptx?.src){const pptx=document.createElement('a');pptx.className='pdf-action';pptx.textContent='PPTX 보기';pptx.href=`pptx.html?${new URLSearchParams({src:proposal.pptx.src,name:proposal.pptx.name})}`;pptx.target='_blank';pptx.rel='noopener noreferrer';pptx.setAttribute('aria-label',`${proposal.name} PPTX 보기 (새 탭)`);actions.append(pptx);}
    if(admin){    const edit=document.createElement('button');edit.type='button';edit.className='pdf-action';edit.textContent='수정하기';edit.setAttribute('aria-label',`${proposal.name} 수정하기`);edit.onclick=()=>openEditor(proposal);actions.append(edit);
    const remove=document.createElement('button');remove.type='button';remove.className='pdf-action delete-action';remove.textContent='삭제';remove.setAttribute('aria-label',`${proposal.name} 삭제`);remove.onclick=()=>openDelete(proposal,remove);actions.append(remove);
    }
    bottom.append(count);info.append(meta,title,bottom,actions);button.append(cover);
    button.addEventListener('click',()=>{returnFocus=button;openProposal(proposal.id);});card.append(button,info);$('cards').append(card);
  });
  if(!proposals.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='등록된 제안서가 없습니다. 제안서 추가 버튼으로 새 자료를 등록하세요.';$('cards').append(empty);}
}
let deleting=null,deleteBusy=false,deleteFocus=null,deletingVersion=null;
function openDelete(proposal,button){if(!admin||!cloudReady)return;deleting=proposal;deletingVersion=cloud.getVersion(proposal.id);deleteFocus=button;$('delete-name').textContent=proposal.name;$('delete-error').textContent='';$('delete-dialog').showModal();$('delete-cancel').focus();}
$('delete-cancel').onclick=()=>{if(!deleteBusy)$('delete-dialog').close();};
$('delete-dialog').addEventListener('cancel',event=>{if(deleteBusy)event.preventDefault();});
$('delete-dialog').addEventListener('close',()=>{deleting=null;if(deleteFocus?.isConnected)deleteFocus.focus();else $('add').focus();deleteFocus=null;});
$('delete-form').onsubmit=async event=>{
  event.preventDefault();if(deleteBusy||!deleting)return;
  if(!admin||!cloudReady){$('delete-error').textContent='관리자 로그인과 공용 저장소 연결이 필요합니다.';return;}
  deleteBusy=true;$('delete-confirm').disabled=true;$('delete-cancel').disabled=true;
  try{
    await cloud.remove(deleting.id,deletingVersion);
    const index=proposals.findIndex(item=>item.id===deleting.id);if(index>=0)proposals.splice(index,1);
    renderCards();$('delete-dialog').close();notify('공용 라이브러리에서 삭제했습니다.');
  }catch(error){$('delete-error').textContent=error.code==='PROPOSAL_CONFLICT'?'이 제안서가 다른 곳에서 변경되었습니다. 취소한 뒤 목록을 새로고침하고 최신 내용을 확인해주세요.':error.message||'삭제하지 못했습니다. 잠시 후 다시 시도하세요.';}
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
let pendingImages=[], saving=false, editing=null, editingVersion=null;
let saveController=null;
const saveStatus=document.createElement('p');saveStatus.id='save-status';saveStatus.className='muted small';saveStatus.setAttribute('role','status');saveStatus.hidden=true;
const stopSave=document.createElement('button');stopSave.type='button';stopSave.className='pdf-action';stopSave.textContent='저장 중단';stopSave.hidden=true;
stopSave.onclick=()=>saveController?.abort();$('form-error').before(saveStatus,stopSave);
function openEditor(proposal=null){
  if(!admin){$('auth-dialog').showModal();return;}
  if(!cloudReady){notify('공용 저장소 연결을 확인한 뒤 다시 시도하세요.');return;}
  editing=proposal;editingVersion=proposal?cloud.getVersion(proposal.id):null;$('add-form').reset();$('form-error').textContent='';$('resolve-conflict').hidden=true;
  $('proposal-dialog-title').textContent=proposal?'제안서 수정':'제안서 추가';$('save').textContent=proposal?'수정 내용 저장':'라이브러리에 추가';
  $('proposal-name').value=proposal?.name??'';$('proposal-subtitle').value=proposal?getSubtitle(proposal):'';
  $('existing-pdf').textContent=proposal?.pdfUrl?`현재 PDF: ${proposal.pdf?.name??'PMS 제안서 PDF'} · 새 파일을 선택하지 않으면 유지됩니다.`:'';
  $('remove-pdf').parentElement.hidden=!proposal?.pdfUrl;
  $('figma-url').value=proposal?.figmaUrl??'';
  $('existing-pptx').textContent=proposal?.pptx?`현재 PPTX: ${proposal.pptx.name} · 새 파일을 선택하지 않으면 유지됩니다.`:'';
  $('remove-pptx').parentElement.hidden=!proposal?.pptx;
  pendingImages=proposal?proposal.pages.map(p=>({file:null,record:{name:p.name,...(p.blob?{blob:p.blob}:{src:p.src})},url:p.src})):[];
  renderImageOrder();dialog.showModal();
}
function selectedFiles(){return pendingImages.filter(item=>item.file).map(item=>item.file);}
function draftRecord(name,subtitle,pdfFile){
  return {id:editing?.id??crypto.randomUUID(),builtIn:editing?.builtIn??false,name,subtitle,
    pages:pendingImages.map(item=>item.file?{name:item.file.name,blob:item.file}:item.record),
    pdf:pdfFile?{name:pdfFile.name,blob:pdfFile}:$('remove-pdf').checked?null:editing?.pdf??(editing?.pdfUrl?{name:'PMS 제안서 PDF',src:editing.pdfUrl}:null),
    figmaUrl:$('figma-url').value.trim()||null,
    pptx:$('pptx-file').files[0]?{name:$('pptx-file').files[0].name,blob:$('pptx-file').files[0]}:$('remove-pptx').checked?null:editing?.pptx??null};
}
function upsertProposal(proposal){const index=proposals.findIndex(p=>p.id===proposal.id);if(index<0)proposals.push(proposal);else proposals[index]=proposal;}
async function replacePageImage(item,input){
  const file=input.files[0];input.value='';
  if(!file||saving||item.replacing||!pendingImages.includes(item))return;
  item.replacing=true;renderImageOrder();$('form-error').textContent='';
  try{
    if(!supported.test(file.name))throw new Error('PNG, JPG, WEBP, GIF, AVIF 이미지를 선택하세요.');
    if(file.size>25*1024*1024)throw new Error('25MB 이하 이미지를 선택하세요.');
    await validateImages([file]);
    const index=pendingImages.indexOf(item);
    if(index<0||!dialog.open||saving)return;
    const url=URL.createObjectURL(file);if(item.file)URL.revokeObjectURL(item.url);
    item.file=file;item.url=url;
  }catch(error){if(pendingImages.includes(item)&&dialog.open)$('form-error').textContent=error.message;}
  finally{
    item.replacing=false;
    const index=pendingImages.indexOf(item);
    if(index>=0&&dialog.open){renderImageOrder();$('image-order').children[index].querySelector('.replace-image')?.focus();}
  }
}
function renderImageOrder(){
  $('image-order').replaceChildren();
  $('file-note').textContent=pendingImages.length?`${pendingImages.length}페이지 · 첫 이미지가 라이브러리 썸네일로 사용됩니다.`:'PNG, JPG, WEBP, GIF, AVIF 이미지 지원';
  pendingImages.forEach((item,index)=>{
    const row=document.createElement('li');
    const preview=document.createElement('img');preview.src=item.url;preview.alt=`${index+1}페이지 미리보기`;
    const label=document.createElement('span');label.textContent=`${index+1}${index===0?' · 표지':''} — ${item.file?.name??item.record.name}`;
    const actions=document.createElement('div');actions.className='image-actions';
    const replacement=document.createElement('input');replacement.type='file';replacement.accept=$('files').accept;replacement.hidden=true;
    replacement.setAttribute('aria-label',`${index+1}페이지 교체 이미지`);replacement.onchange=()=>replacePageImage(item,replacement);
    const replace=document.createElement('button');replace.type='button';replace.className='replace-image';replace.textContent=item.replacing?'확인 중…':'수정';
    replace.setAttribute('aria-label',`${index+1}페이지 수정`);replace.disabled=saving||!!item.replacing;
    replace.onclick=()=>{if(!saving&&!item.replacing)replacement.click();};actions.append(replace,replacement);
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
async function validatePdf(file,signal){if(!file)return;if(file.size>200*1024*1024)throw new Error('200MB 이하 PDF를 선택하세요.');const header=new TextDecoder().decode(await withDeadline(()=>file.slice(0,5).arrayBuffer(),{signal}));if(!/\.pdf$/i.test(file.name)||header!=='%PDF-')throw new Error('올바른 PDF 파일을 선택하세요.');}
async function validatePptx(file,signal){if(!file)return;if(file.size>200*1024*1024)throw new Error('200MB 이하 PPTX를 선택하세요.');const header=new Uint8Array(await withDeadline(()=>file.slice(0,4).arrayBuffer(),{signal}));if(!/\.pptx$/i.test(file.name)||header[0]!==80||header[1]!==75||header[2]!==3||header[3]!==4)throw new Error('올바른 PPTX 파일을 선택하세요.');}
function validateFigmaLink(){const value=$('figma-url').value.trim();if(!value)return;let url;try{url=new URL(value);}catch{throw new Error('올바른 Figma Slides 링크를 입력하세요.');}if(url.protocol!=='https:'||!['www.figma.com','figma.com'].includes(url.hostname)||url.username||url.password||url.port||!/^\/slides\/[a-zA-Z0-9]+(?:\/.*)?$/.test(url.pathname))throw new Error('Figma Slides의 https://www.figma.com/slides/ 링크를 입력하세요.');}
async function validateImages(files,signal){for(const file of files){if(file.size>25*1024*1024)throw new Error(`${file.name}: 25MB 이하 이미지를 선택하세요.`);const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await withDeadline(()=>img.decode(),{signal,timeoutMessage:`${file.name}: 이미지 확인 시간이 초과되었습니다. 파일을 다시 선택해주세요.`});}catch(error){if(error.code)throw error;throw new Error(`이미지를 읽을 수 없습니다: ${file.name}`);}finally{URL.revokeObjectURL(url);}}}
$('add-form').onsubmit=async event=>{
  event.preventDefault();$('form-error').textContent='';const files=selectedFiles();const name=$('proposal-name').value.trim();const pdfFile=$('pdf-file').files[0];
  if(saving)return;
  if(pendingImages.some(item=>item.replacing)){$('form-error').textContent='교체할 이미지를 확인 중입니다. 확인이 끝난 뒤 저장해주세요.';return;}
  if(!pendingImages.length||!name){$('form-error').textContent='제안서 이름과 한 장 이상의 이미지를 추가하세요.';return;}
  if(!admin||!cloudReady){$('form-error').textContent='관리자 로그인과 공용 저장소 연결이 필요합니다.';return;}
  saving=true;const controls=Array.from($('add-form').querySelectorAll('button,input'));const disabledStates=controls.map(control=>control.disabled);controls.forEach(control=>control.disabled=true);$('save').textContent='이미지 확인 및 저장 중…';
  saveController=new AbortController();saveStatus.hidden=false;saveStatus.textContent='첨부 파일 확인 중…';stopSave.hidden=false;stopSave.disabled=false;
  try{validateFigmaLink();await validatePdf(pdfFile,saveController.signal);await validatePptx($('pptx-file').files[0],saveController.signal);await validateImages(files,saveController.signal);const record=draftRecord(name,$('proposal-subtitle').value.trim(),pdfFile);const saved=await cloud.save(record,message=>{saveStatus.textContent=message;$('save').textContent='저장 중…';stopSave.disabled=message==='제안서 목록 저장 중…'||message==='저장 결과 확인 중…';},editingVersion,{signal:saveController.signal});upsertProposal(hydrate(saved));renderCards();dialog.close();notify('제안서가 공유되었습니다. 다른 PC에서도 볼 수 있습니다.');}
  catch(error){$('form-error').textContent=error.name==='QuotaExceededError'?'브라우저 저장 공간이 부족합니다. 이미지 용량을 줄여 다시 시도하세요.':error.message||'저장에 실패했습니다. 다시 시도하세요.';$('resolve-conflict').hidden=error.code!=='PROPOSAL_CONFLICT';}
  finally{saving=false;saveController=null;saveStatus.hidden=true;stopSave.hidden=true;controls.forEach((control,i)=>control.disabled=disabledStates[i]);$('save').textContent=editing?'수정 내용 저장':'라이브러리에 추가';}
};
$('resolve-conflict').onclick=async()=>{
  if(saving||!editing)return;
  if(!confirm('다른 곳에서 수정하거나 삭제한 이 제안서를 현재 입력한 내용으로 덮어쓸까요?'))return;
  $('resolve-conflict').disabled=true;
  try{editingVersion=await cloud.refreshVersion(editing.id);$('resolve-conflict').hidden=true;$('resolve-conflict').disabled=false;$('add-form').requestSubmit();}
  catch(error){$('form-error').textContent=error.message;}
  finally{$('resolve-conflict').disabled=false;}
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
