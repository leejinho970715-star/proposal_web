const params=new URLSearchParams(location.search);
let source;
try{
  source=new URL(params.get('src'));
  if(source.protocol!=='https:'||source.hostname!=='4njv3utqsctfiobp.public.blob.vercel-storage.com'||source.port||source.username||source.password||source.search||source.hash||!/^\/media\/[a-f0-9-]+\.pptx$/.test(source.pathname))throw new Error();
}catch{
  document.getElementById('document-note').textContent='PPTX 링크가 올바르지 않습니다. 제안서 목록에서 다시 열어주세요.';
  source=null;
}
if(source){
  const name=params.get('name')||'제안서.pptx';
  document.getElementById('document-title').textContent=name;
  const download=document.getElementById('document-download');download.href=source.href;download.download=name;download.hidden=false;
  const frame=document.createElement('iframe');frame.src=`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(source.href)}`;frame.title='PowerPoint 미리보기';frame.allowFullscreen=true;frame.referrerPolicy='no-referrer';document.getElementById('document-preview').append(frame);
}
