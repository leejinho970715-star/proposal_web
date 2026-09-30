const $ = (id) => document.getElementById(id);
const proposals = [{id:'pms',name:'PMS 구축 제안서',builtIn:true,pages:Array.from({length:25},(_,i)=>({src:`assets/page-${i+1}.png`,name:`${i+1}페이지`}))}];
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
    const meta=document.createElement('div');meta.className='card-meta';meta.textContent=proposal.builtIn?'I-ONE SOFT BANK PMS 제안서(건설)_기성관리':'MY PROPOSAL';
    const title=document.createElement('h3');title.className='card-title';title.textContent=proposal.name;
    const bottom=document.createElement('div');bottom.className='card-bottom';
    const count=document.createElement('span');count.textContent=`${proposal.pages.length} 페이지`;
    const open=document.createElement('strong');open.textContent='제안서 보기';bottom.append(count,open);info.append(meta,title,bottom);button.append(cover,info);
    button.addEventListener('click',()=>{returnFocus=button;openProposal(proposal.id);});card.append(button);$('cards').append(card);
  });
}
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
const dialog=$('add-dialog');$('add').onclick=()=>{$('form-error').textContent='';dialog.showModal();};$('cancel').onclick=()=>dialog.close();
const supported=/\.(png|jpe?g|webp|gif|avif)$/i;
let pendingImages=[], saving=false;
function selectedFiles(){return pendingImages.map(item=>item.file);}
function renderImageOrder(){
  $('image-order').replaceChildren();
  $('file-note').textContent=pendingImages.length?`${pendingImages.length}페이지 · 첫 이미지가 라이브러리 썸네일로 사용됩니다.`:'PNG, JPG, WEBP, GIF, AVIF 이미지 지원';
  pendingImages.forEach((item,index)=>{
    const row=document.createElement('li');
    const preview=document.createElement('img');preview.src=item.url;preview.alt=`${index+1}페이지 미리보기`;
    const label=document.createElement('span');label.textContent=`${index+1}${index===0?' · 표지':''} — ${item.file.name}`;
    const actions=document.createElement('div');actions.className='image-actions';
    for(const [text,offset] of [['앞으로',-1],['뒤로',1]]){
      const button=document.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-label',`${index+1}페이지 ${text}`);
      button.disabled=index+offset<0||index+offset>=pendingImages.length;
      button.onclick=()=>{if(saving)return;const next=index+offset;[pendingImages[index],pendingImages[next]]=[pendingImages[next],pendingImages[index]];renderImageOrder();$('image-order').children[next].querySelector('button:not(:disabled)')?.focus();};actions.append(button);
    }
    const remove=document.createElement('button');remove.type='button';remove.textContent='제외';remove.setAttribute('aria-label',`${index+1}페이지 제외`);
    remove.onclick=()=>{if(saving)return;URL.revokeObjectURL(item.url);pendingImages.splice(index,1);renderImageOrder();};actions.append(remove);
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
dialog.addEventListener('close',()=>{pendingImages.forEach(item=>URL.revokeObjectURL(item.url));pendingImages=[];$('add-form').reset();renderImageOrder();});
function openDatabase(){return new Promise((resolve,reject)=>{const request=indexedDB.open('ione-proposal-library',1);request.onupgradeneeded=()=>request.result.createObjectStore('proposals',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function storeRecord(record){return new Promise((resolve,reject)=>{const tx=db.transaction('proposals','readwrite');tx.objectStore('proposals').put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
function hydrate(record){return {...record,pages:record.pages.map(p=>{const src=URL.createObjectURL(p.blob);urls.push(src);return {name:p.name,src};})};}
async function validateImages(files){for(const file of files){const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();}catch{throw new Error(`이미지를 읽을 수 없습니다: ${file.name}`);}finally{URL.revokeObjectURL(url);}}}
$('add-form').onsubmit=async event=>{
  event.preventDefault();$('form-error').textContent='';const files=selectedFiles();const name=$('proposal-name').value.trim();
  if(saving)return;
  if(!files.length||!name){$('form-error').textContent='제안서 이름과 한 장 이상의 이미지를 추가하세요.';return;}
  if(!db){$('form-error').textContent='이 브라우저에서 저장소를 사용할 수 없습니다. 일반 브라우저 창에서 다시 시도하세요.';return;}
  saving=true;const controls=Array.from($('add-form').querySelectorAll('button,input'));const disabledStates=controls.map(control=>control.disabled);controls.forEach(control=>control.disabled=true);$('save').textContent='이미지 확인 및 저장 중…';
  try{await validateImages(files);const record={id:crypto.randomUUID(),name,pages:files.map(f=>({name:f.name,blob:f}))};await storeRecord(record);proposals.push(hydrate(record));renderCards();dialog.close();$('add-form').reset();$('file-note').textContent='PNG, JPG, WEBP, GIF, AVIF 이미지 지원';notify('제안서가 이 브라우저에 저장되었습니다.');}
  catch(error){$('form-error').textContent=error.name==='QuotaExceededError'?'브라우저 저장 공간이 부족합니다. 이미지 용량을 줄여 다시 시도하세요.':error.message||'저장에 실패했습니다. 다시 시도하세요.';}
  finally{saving=false;controls.forEach((control,i)=>control.disabled=disabledStates[i]);$('save').textContent='라이브러리에 추가';}
};
renderCards();
(async()=>{try{db=await openDatabase();const request=db.transaction('proposals').objectStore('proposals').getAll();request.onsuccess=()=>{proposals.push(...request.result.map(hydrate));renderCards();};request.onerror=()=>notify('저장된 제안서를 불러오지 못했습니다.');}catch{notify('브라우저 저장소를 사용할 수 없어 제안서 추가가 제한됩니다.');}})();
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'list_proposals',description:'선택 가능한 제안서 목록 조회',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({proposals:proposals.map(p=>({id:p.id,name:p.name,pages:p.pages.length}))})})).catch(()=>{});}catch{}}
