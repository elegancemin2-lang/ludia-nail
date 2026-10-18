# v2.65.0 네이버 예약 연결 검증

기준 main: e6e164ce873b0771b28f216f68e32617876bf00b.
검증 대상: Windows 연결 도구 → 실제 렌더링 항목 확인 → 신규/변경/명시적 취소 → PC 앱 저장, 별도 서버 전송 경로.

## 코드 및 격리 검증

- npm test: 68/68 통과. 신규→시간 변경→취소→재확정, 예약번호 중복 방지, 디스크 outbox 재시작, 200건 경계에서 취소 우선 전송, 같은 직원만 충돌, 취소와 이동의 행 순서 독립성, 시간 교환, 보류 복원에 따른 연쇄 충돌 포함.
- npm run check: JavaScript 67개 문법 통과.
- tools/bridge-qa의 node --test dom.test.cjs: 9/9 통과. 합성 DOM이며 SmartPlace 실계정 DOM이 아님. 실제 table 열 제목 자동 확인, 중복 제목/경쟁 테이블/병합 셀/빈 표 거부, 단일 연결 버튼의 저장→실행, PC 수신 신규/변경/취소, 만료 파일과 저장 실패 거부 포함.
- 기존 6개 golden 가격 및 제공된 기준표 유지. 실제 앱 import API의 가격·사진견적 링크·원장 메모 보존, 저장 실패 롤백 확인.
- 로컬 설정 HTTP 보호: 난수 capability/Origin/Host, 고객 원문/키 없는 응답, 확인 전 저장 거부, 다른 매장의 추가 목록 거부, 준비 안 된 서버 거부.
- Node Windows runtime은 공식 v24.22.0 x64/ARM64 SHA-256에 고정. 실제 Windows에서 CMD/다운로드/설치 동작은 미검증.
- ZIP은 21개 allowlisted 소스/예제만 포함. 실제 설정·비밀번호·쿠키·예약·실행 환경·node_modules 미포함.

## 아직 통과했다고 주장할 수 없는 항목

- 실제 매장 네이버 로그인 및 SmartPlace DOM 선택/자동 인식.
- 실제 예약 생성·시간/담당자 변경·취소·재확정의 반복 반영.
- Windows 신규 설치/재시작/절전 복귀, 로그인 만료 및 2FA 이후 재개.
- 서버 DB/매장/키 구성 및 실제 DB 투영·서버 충돌 처리·휴대폰 조회. 기존 환경 연결은 유지하며 DB 변경/삭제나 인증 완화는 하지 않음.
- 전체 날짜/페이지/가상 스크롤의 자동 순회, 첨부사진, 네이버 시간 차단의 양방향 연동은 구현 범위 아님.

## 실제 Production 브라우저 확인 · 2026-10-18

- 코드 커밋: 0ee01ee561fc8392abc5592506cb97bc11037701. Vercel Production dpl_CoBNPZ1RYPuoLjiRQ7jzdttxfJpD READY 확인.
- https://ludianail.vercel.app/ 를 실제 Chrome에서 열어 일반 기능의 로그인 없는 진입, app/runtime/naver 모듈의 v2.65.0, 새 PC 연결 안내를 확인했습니다.
- 안내는 Node 별도 설치/폴더 선택 대신 실행 환경 자동 준비와 전용 LUDIA 창 직접 반영을 설명합니다. 기존 일반 브라우저·휴대폰과 데이터가 별도임을 표시합니다.
- 운영 health를 실제 호출한 결과 ready=false, supabaseConfigured=false, salonConfigured=false, tokenConfigured=false입니다. UI도 미설정/설정 대기/휴대폰 공유 미준비로 표시하며 연결됨으로 표시하지 않습니다.
- 안내의 실제 다운로드 버튼으로 ZIP을 받았습니다. 37,929 bytes이며 소스에서 검사한 ZIP과 바이트 단위 일치. SHA-256: 573401f4e81c02e20715cb2d64018ac589808327c89e1463615c847ec1c2f266.
- 360/375/390/412/430px의 Light/Dark에서 실제 앱 iframe 측정: 예약표 10개 조합 모두 날짜 7개, document.scrollWidth=clientWidth, 예약표 자체 가로 넘침 없음.
- 같은 10개 조합의 PC 안내도 가로 넘침 없고 다운로드 터치 높이 48px. Desktop Light와 390px Dark 화면을 실제 스크린샷으로 시각 확인했습니다. 실제 iPhone/Safari 기기 검증은 아님.
- 관측한 브라우저 로그의 오류는 chrome-extension origin의 metadata 전송 오류이며, 해당 로그에서 앱 origin 오류는 관측하지 않았습니다.
- Production 검증은 UI/배포/다운로드 경로입니다. 실제 Naver 로그인·DOM·예약 수집·Windows 설치·DB 반영 E2E 검증을 대신하지 않습니다.
