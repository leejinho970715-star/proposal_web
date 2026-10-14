const params=new URLSearchParams(location.search);
let source;
try{
  source=new URL(params.get('src'));
  const blob=source.hostname==='4njv3utqsctfiobp.public.blob.vercel-storage.com'&&/^\/media\/[a-f0-9-]+\.pptx$/.test(source.pathname);
  const bundled=(source.hostname==='proposalweb-plum.vercel.app'&&/^\/assets\/pptx\/pms-(construction|basic)\.pptx$/.test(source.pathname))||(source.hostname==='leejinho970715-star.github.io'&&/^\/proposal_web\/assets\/pptx\/pms-(construction|basic)\.pptx$/.test(source.pathname));
  if(source.protocol!=='https:'||(!blob&&!bundled)||source.port||source.username||source.password||source.search||source.hash)throw new Error();
}catch{
  document.getElementById('document-note').textContent='PPTX 링크가 올바르지 않습니다. 제안서 목록에서 다시 열어주세요.';
  source=null;
}
if(source){
  const name=params.get('name')||'제안서.pptx';
  document.getElementById('document-title').textContent=name;
  const download=document.getElementById('document-download');download.href=source.href;download.download=name;download.hidden=false;
}
