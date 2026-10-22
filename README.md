# INU 벽돌깨기

2026년도 2학기 「AI코딩을 활용한 창의적 앱개발」 중간고사 프로젝트입니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다. PC는 좌우 방향키, 모바일은 게임 화면을 좌우로 스와이프하거나 드래그해 패들을 움직입니다.

## Google Sheets 연결

1. 새 구글 시트를 만들고 확장 프로그램 → Apps Script에서 `google-apps-script/Code.gs`를 붙여 넣습니다.
2. 웹 앱으로 배포하고 접근 권한을 `모든 사용자`로 설정합니다.
3. `.env.example`을 `.env.local`로 복사한 뒤 배포 URL을 `GOOGLE_SHEETS_WEB_APP_URL`에 입력합니다.

URL이 없어도 게임과 브라우저 로컬 Top 3는 정상 동작합니다.
