# 제안서 라이브러리

PMS 제안서 25장과 이음스퀘어 회사소개서 17장을 기본 제공하며, 관리자 업로드·수정·삭제를 Vercel Blob에 공용 저장합니다.

## 사용

- 방문자는 슬라이드와 PDF를 열람합니다. 좌우 버튼, 휠, 방향키, 터치로 넘길 수 있습니다.
- **관리자 로그인**에 Vercel의 ADMIN_ACCESS_KEY를 입력합니다. 키는 브라우저 메모리에만 보관하며 새로고침하면 다시 로그인합니다.
- **제안서 추가**에서 제목·소제목·여러 이미지·선택 PDF를 등록합니다. 미리보기에서 순서를 바꿀 수 있고 첫 이미지가 썸네일입니다.
- 저장 후 다른 기기에서도 새로고침하면 같은 자료를 봅니다. GitHub Pages도 동일한 Vercel API를 사용합니다.
- 수정·삭제는 관리자만 할 수 있습니다. 삭제는 모든 방문자의 목록에 적용되며 기존 파일 링크까지 폐기하지는 않습니다.
- 이전 IndexedDB 자료는 로그인 후 **이 브라우저에 보관된 제안서**에서 확인하고 공유할 수 있습니다. 원래 업로드했던 브라우저와 주소에서 접속해야 하며 원본은 자동 삭제하지 않습니다. 기본 등록된 이음스퀘어 자료는 중복 공유하지 않도록 확인하세요.

## 환경 설정과 배포

Vercel 프로젝트에 Public Blob Store를 연결하여 BLOB_READ_WRITE_TOKEN을 주입합니다. ADMIN_ACCESS_KEY는 Production의 Secret으로 32자 이상 무작위 값을 설정합니다. 실제 값은 저장소·채팅에 남기지 않습니다. 키가 없거나 짧으면 쓰기가 차단됩니다.

vercel.json은 npm run build로 빌드하고 proposal-site/dist를 배포합니다. 루트 api/는 Vercel Functions입니다. main 푸시로 Vercel과 GitHub Pages가 자동 배포됩니다.

```sh
npm ci
npm test
npm run build
node proposal-site/server.cjs
```

로컬 정적 서버는 화면 확인용입니다. 실제 API는 Vercel 환경에서 실행됩니다. vercel dev를 쓰려면 프로젝트 환경변수를 로컬에 연결해야 합니다.

## 저장 구조

- media/UUID.extension: 브라우저에서 Blob으로 직접 업로드. 이미지당 25MB, PDF 200MB, 제안서당 300페이지.
- library/catalog.json: 제목·소제목·이미지 순서·PDF URL·삭제 표시. ETag 비교로 동시 수정 충돌을 감지합니다.
- 서버는 동일 저장소의 미디어 URL과 기본 자료 경로만 허용합니다. Blob 토큰은 서버에만 있습니다.
- 실패한 업로드나 삭제한 자료의 파일은 저장소에 남을 수 있습니다. 목록 삭제는 저장 공간 회수나 파일 접근 권한 회수가 아닙니다.
- 기본 자료: assets/page-1.png ~ page-25.png, assets/pms-proposal.pdf, assets/eumsquare/page-1.png ~ page-17.png, assets/eumsquare/company-profile.pdf.

[Vercel](https://proposalweb-plum.vercel.app/) · [GitHub Pages](https://leejinho970715-star.github.io/proposal_web/)
