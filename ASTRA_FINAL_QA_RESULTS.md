# LUDIA NAIL 최종 QA 기록 — 2026-09-27

기준 체크리스트: `ASTRA_FINAL_QA.md`. 최종 실행 코드: **v2.54.6**, `58cddfe4b0d82c7d2d0b45a684eea682ce4e1ccc`.
Production: https://ludianail.vercel.app/

## 1. 수정 완료

| 문제 / 재현 | 원인과 수정 | 검증 / 커밋 |
| --- | --- | --- |
| 예약·고객 HTML 문자열 처리, 로컬 예약의 아트 연결 복원, 세션별 데이터 분리, 캔버스 LIVE 동기화 | 출력 escaping, 예약/고객 snapshot 보존, 세션 세대 검사, 이미지 로드·undo 동기화, SW network-first | 실제 데모 브라우저 + 단위 검증. `f9ca4c58c76b7743caf3841c29cf9efbd1e5adb1` |
| 먼 주간 예약 조회 누락, 상세창 HTML 문자열 해석 | 선택 주 월~일 KST 조회 추가, 상세 출력 escaping | 연말 경계 UI 및 SQL 조회 범위 mock. `689ff822d9153cc0ee84e386d5164aebe060b255` |
| Supabase 인증 클라이언트 중복 경고, Night 파츠 대비 | 단일 인증 클라이언트 공유, 편집 버튼 크기/대비 | 재배포 후 앱 콘솔 경고 사라짐. `070a3bb2e798e469acbf784d61f2acec6eb64f67` |
| 인증 역할에서 Private Storage 조회 시 `permission denied for table sitefit_sites` | 공유 Storage 정책이 다른 제품 테이블을 미리 평가함. 버킷 검사 후 기존 조건을 평가하는 SECURITY INVOKER 함수로 감쌈. 테이블 권한 확대 없음 | 실제 DB authenticated 역할의 격리 테스트 통과. `supabase/storage_policy_bucket_guard.sql`, `71b2615ad5ccad485dcb6c885babaf0ebe6889c5` |
| 전체 손 보기에서 손톱 10개만 격자로 나열 | 양손 실루엣과 독립된 10개 손톱으로 복구. 확대 상태에서 컬러 변경 가능 | 손톱 직접 클릭, 회전/기울기, 전체 손 복귀, 실시간 컬러 실제 검증. `71b2615ad5ccad485dcb6c885babaf0ebe6889c5` |
| 계정 교체 시 부가 화면의 private closure 캐시 잔존 가능 | 계정 변경/로그아웃 경계에서 새 문서로 모든 모듈 캐시 제거. 토큰 갱신 시에는 재시작하지 않음 | 단위 검증 통과; 실계정 전환 UI는 미검증. `71b2615ad5ccad485dcb6c885babaf0ebe6889c5` |
| 3D에서 선택한 손톱과 캔버스 편집 대상 불일치 | 확대 컬러 변경 후 동일 손톱을 캔버스에 연결. 손 이름과 힌트 겹침 해소 | Production에 배포 후 `왼손 엄지 · LIVE` 확인. `ddf6d5baa2a1a6bf0829d6c6afceb0e8d1f58c5f` |
| 클라우드 아트 저장 payload가 실제 DB CHECK 제약과 불일치; 수정 시 version_no=1 중복 | `salon_library`/`ready` 및 UI 전용 상태를 DB 허용값으로 매핑. 메뉴 상태는 snapshot metadata에 보존. project row lock 아래 번호 증가·메뉴 수정·snapshot 추가를 원자적으로 처리하는 SECURITY INVOKER RPC | 실제 DB에서 기존 payload의 제약 오류 재현 후 새 RPC로 수정 2회, 사진/디자인/가격/시간 보존, 타 샵 호출 차단 확인. 로그인 브라우저 E2E는 미검증. `96534f24f6919210257e2a1cb3a83a46f27d620e` |
| 손가락 선택 버튼이 약 15px로 압축되고 undo 버튼이 헤더 밖으로 밀림 | grid 안의 이전 `width:19%`, 헤더 직계 div의 display:grid가 원인. 카드 100% 폭, 전용 flex 액션바로 수정 | 배포 후 약 79×108px 카드, flex 액션바 확인. 실제 drawing→undo→redo의 이미지 복원 확인. `58cddfe4b0d82c7d2d0b45a684eea682ce4e1ccc` |

Vercel은 위 코드 커밋에 success 상태를 반환했으며, Production DOM에서 app.js/styles.css/salon-cloud.js `?v=2.54.6` 로드를 확인했다. 브라우저 테스트 중 발생한 확장 프로그램 metadata 오류는 앱 오류와 분리했다. 마지막 앱 warn/error 수집 결과는 0건이었다.

## 2. 실제 브라우저에서 통과한 플로우

### PC Cloud Browser

실제 제공된 브라우저는 1363×936 화면이었다(스크롤바가 있는 문서 clientWidth는 1348). **요청한 1440×900 / 1920×1080을 검증한 것으로 간주하지 않는다.** 로그인하지 않은 LOCAL 데모로 수행했다.

- 오늘 / 예약 / 고객 / 더보기, Day/Night 전환 및 새로고침.
- 빠른 예약 저장, 같은 주 반영, 상세창 X/backdrop/ESC. 수제디자인 요청 메모 표시.
- 이전 주/다음 주/오늘 및 직원 필터. 2026-12-28~2027-01-03 및 월말 주간의 월~일 순서.
- 이달의 아트 월 이동, 대표사진 메뉴 등록, 정가 70,000 / 할인가 60,000 / 75분 선택 예약. 예약 이미지와 연결이 새로고침 후 유지. 가격만 수정 시 사진 유지. 메뉴에서 내려도 보관함 원본 유지. 이 항목은 앞선 v2.54.1~2.54.2 데모 검증이다.
- 고객 9명 구성 후 1페이지 8명 / 2페이지 1명, 이전/다음, 검색 결과 4명, 데모 새로고침 피드백. PC grid 4열 확인(v2.54.3 전후).
- 프로필 사진 선택, 세 위치 이미지 동일 및 새로고침 유지(앞선 데모 검증). 로그인 Storage 저장은 별도 미검증.
- v2.54.6: 편집 시작, 왼손 엄지 단일 선택, 검지 추가, 컬러·파츠 동시 적용.
- v2.54.6: 실제 펜 드래그 후 프리뷰 이미지가 변경됨(데이터 URL 길이 17,390→27,554). undo 후 이전 이미지와 완전히 같음, redo 후 그린 이미지와 완전히 같음.
- v2.54.6: 저장 전에 LIVE / 10손가락 / 모델 / 다각도에 각각 drawing 2개와 파츠 2개가 표시되고 이미지 로드 성공.
- v2.54.6: 전체 손의 개별 손톱 클릭 확대, 컬러 변경, 드래그 회전·기울기(rotateX -19°, rotateY 35° 관찰), 전체 손 복귀, X/ESC/backdrop 닫기.
- v2.54.6: 시술안 저장 후 일반 새로고침, 보관함 재열기, 파란 엄지와 파츠가 복원되는 화면 확인.
- 일반 새로고침으로 v2.54.2→v2.54.3, 이후 v2.54.5 로드 확인. hard reload나 캐시 삭제를 요구하지 않았다. 최종 새 문서도 v2.54.6.
- 최종 Night 예약 화면에서 문서 가로 overflow 없음. 모든 요청 뷰포트/페이지의 무겹침을 보증하는 결과는 아니다.

### Galaxy / iPhone

360×800, 412×915, 375×812, 430×932 **미검증**. 현재 Cloud Browser의 지원 API에 viewport 변경 기능이 없었다. 모바일이라고 추정하여 통과 처리하지 않았다. 모바일 하단 내비·스와이프·프로필·3열 오늘 카드·2열 고객 배치는 실제 기기 검증이 남는다.

### 브라우저와 구분한 자동/DB 검증

- `node --test tests/final-qa.test.cjs`: **9/9 통과**. selector collection 오류 검사, escaping, 로컬 복원, 클라우드 실패 전파, 선택 주 범위, 계정 경계, SW API 제외 포함.
- 루트 JavaScript **22개 syntax 검사 통과**, `git diff --check` 통과.
- `tests/tenant-isolation.sql`: 실제 DB에서 임시 사용자/샵 2개, authenticated 역할로 고객·예약·아트/snapshot 조회 격리, 교차 INSERT/UPDATE/DELETE 차단, Storage metadata 소유권, 아트 수정 버전/사진/디자인/가격 보존 및 타 샵 RPC 차단 통과. 전부 ROLLBACK. 임시 샵 잔존 0건 확인.
- `ludia_*` 23개 테이블 RLS 유지. `profile-photos`, `ludia-art` 비공개 유지. 새 함수 2개 모두 SECURITY INVOKER. 새 함수에 대한 Security Advisor 경고 없음. 기존 SECURITY DEFINER RPC 경고는 실제 권한 검사 코드를 별도 검토했으며, 프로젝트 전체 경고가 0이라는 뜻은 아니다.
- 현재 저장소 파일/브라우저 코드에서 secret/service_role 실제 키, .env, 네이버 쿠키 파일 노출을 발견하지 않음. Git 전체 과거 이력의 비밀키 감사를 완료했다는 뜻은 아니다.

## 3. 남은 문제

- **P0 검증 게이트**: 두 실계정 브라우저에서 샵 전환·로그아웃·재로그인, Storage HTTP/signed URL 접근 차단은 미검증. SQL RLS 검증 통과로 로그인 E2E를 대체하지 않는다. 현재 재현된 미수정 데이터 유출을 발견한 것은 아니다.
- **P1 검증 게이트**: 지정 6개 뷰포트 × Light/Dark 전체, 모바일 터치/스와이프/파일 선택, 로그인 고객 새로고침의 로딩·실패 피드백, 클라우드 아트 사진 업로드/교체와 재로그인 유지.
- **P1 검증 게이트**: 전체 Network 요청/응답 및 DevTools Cache Storage 목록 검사는 브라우저 도구 범위 밖이었다. 버전 DOM·콘솔·일반 reload 동작 및 SW 코드는 확인했다.
- **P2**: 작은 화면에서의 최종 여백/타이포그래피, 많은 고객 페이지의 숫자 압축 시각 검증. 손 프리뷰는 CSS/SVG 기반 다각도 표시다.

## 4. 실계정 검증 필요

- **Naver SmartPlace**: 신규/변경/취소, 초기 예약 수집, 리뷰 수집, 답글 필요 상태, Bridge 오류 및 복구. UI는 `설정 필요`, 동기화 기록 없음 상태였다. 실제 동기화 성공으로 판정하지 않았다.
- **샵 계정**: 로그인·재로그인, 프로필 Private Storage 저장/교체, 이달의 아트 생성/수정/사진 교체/메뉴 내리기, 실제 예약 가격·시간·artId 유지, 고객 최신 데이터 조회. 실제 테스트 계정 세션이 제공되지 않았다.

## 5. 파일럿 판단

**파일럿 전 수정 필요** — 발견한 오류를 수정·배포했지만 아래 필수 검증 게이트가 남는다.

1. 지정 PC/모바일 뷰포트 전체 통과 증거가 없다.
2. 실제 샵 로그인부터 저장·재로그인까지 E2E가 남는다.
3. Storage SQL 격리는 통과했으나 HTTP/브라우저 접근 검증이 남는다.
4. SmartPlace 실계정 동기화가 검증되지 않았다.

추가 작업은 이 미검증 목록에서 시작한다. 위 통과 항목을 근거 없이 다시 미완료로 돌리거나, 미검증 항목을 통과로 바꾸지 않는다.
