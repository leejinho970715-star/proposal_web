# 제안서 라이브러리

아이원소프트뱅크 PMS 구축 제안서를 1~25페이지 순서대로 보여 주는 정적 웹사이트입니다.

## 사용

- 제안서 카드 선택 → 슬라이드 보기
- 화면 좌우 끝 버튼, 마우스 휠, 트랙패드 또는 좌우 방향키로 페이지 이동
- 모바일에서는 좌우 스와이프, Home / End 키로 첫 페이지 / 마지막 페이지 이동
- 목록의 **제안서 추가**에서 이름 입력 후 여러 이미지 파일 선택
- 이미지는 파일 선택기가 전달한 순서로 추가됩니다. 추가 창의 미리보기에서 앞으로 / 뒤로 버튼으로 순서를 확정하세요. 목록의 이미지 수만큼 슬라이드가 만들어지고 첫 이미지가 표지와 라이브러리 썸네일이 됩니다. 다시 선택하면 기존 목록 뒤에 이미지를 더 추가할 수 있습니다.

추가한 제안서는 현재 브라우저의 IndexedDB에 저장되어 새로고침 후에도 유지됩니다. 서버나 GitHub에 업로드되지 않으며 다른 방문자와 자동 공유되지 않습니다. 브라우저 데이터를 삭제하면 추가 자료도 사라집니다. 모든 방문자에게 공유할 제안서는 저장소에 이미지와 목록을 추가한 뒤 커밋해야 합니다.

## 로컬 실행

Node.js가 설치된 환경에서 저장소 루트에서 실행하세요.

```sh
node proposal-site/server.cjs
```

브라우저에서 http://127.0.0.1:4173 을 엽니다. 별도 패키지 설치나 빌드가 필요 없습니다.

## 파일 구성

- `proposal-site/dist/index.html`: 목록, 슬라이드, 제안서 추가 창
- `proposal-site/dist/style.css`: 반응형 레이아웃
- `proposal-site/dist/app.js`: 슬라이드 이동 및 브라우저 저장
- `proposal-site/dist/assets/page-1.png` ~ `page-25.png`: 원본 제안서 이미지
- `.github/workflows/pages.yml`: main 브랜치 푸시 시 GitHub Pages 자동 배포

## 배포

저장소의 Settings → Pages → Source를 **GitHub Actions**로 설정합니다. `main`에 푸시하면 자동 배포됩니다.

사이트 주소: https://leejinho970715-star.github.io/proposal_web/

## Vercel 배포

GitHub 저장소를 연결하고 Root Directory는 저장소 루트로 유지하세요. 루트의 `vercel.json`이 정적 사이트 폴더인 `proposal-site/dist`를 Output Directory로 지정합니다. 패키지 설치나 빌드 명령은 필요하지 않습니다. `main`에 푸시하면 연결된 Vercel 프로젝트가 자동 재배포됩니다.

Vercel 사이트 주소: https://proposalweb-plum.vercel.app/
