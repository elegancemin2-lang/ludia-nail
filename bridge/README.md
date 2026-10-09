# LUDIA Naver Bridge · v0.3

샵 Windows PC의 전용 Chromium에서 원장이 네이버 공식 페이지에 직접 로그인합니다. 비밀번호는 LUDIA 서버에 전송하거나 저장하지 않습니다. CAPTCHA/2FA를 우회하지 않습니다. 기존 Vercel/Supabase 연결을 사용합니다.

## 실행과 실제 DOM 확인

1. `START_NAVER_BRIDGE.cmd` 실행 → 생성된 `config.local.json`은 **local 모드**이며 서버 키가 필요하지 않습니다. Supabase 서버 키는 PC에 넣지 않습니다.
2. 다시 실행 → 네이버 공식 페이지에서 로그인 → 해당 샵 예약관리 화면으로 직접 이동.
3. **실계정 DOM을 확인한 후에만** 정확한 `smartplaceUrl`, `bookingRowSelector`, `bookingFields`(예약번호/날짜/시간/상태, 선택 전화번호·고객명·상품·담당자·소요시간), `emptyStateSelector`를 설정하고 `selectorsVerified: true`로 변경합니다. 필드마다 예약 행 안에서 보이는 요소가 정확히 하나여야 합니다. 소요시간은 정수 분으로 실제 표시된 값만 읽습니다.
4. local 모드는 `exports` 폴더에 예약·상태 JSON을 원자적으로 저장합니다. LUDIA **더보기 → 네이버 SmartPlace → PC 자동 파일 확인**에서 폴더를 선택하고 미리보기를 확인하세요. PC Chrome/Edge에서 앱이 열려 있는 동안 확인하며, 이 PC에만 저장합니다. 폰/다른 기기로 자동 공유하지 않습니다.
5. 확인 전에는 예약을 출력하지 않습니다. 기본 주기는 60초, 오류 시 최대 5분까지 재시도 간격을 늘립니다. 사진 첨부 추출은 지원하지 않습니다.

DOM 확인 전 당장 사용할 대안: 네이버에서 예약 내역을 내려받아 LUDIA의 **예약 파일 가져오기**를 사용합니다. XLS·암호 엑셀은 Excel에서 CSV UTF-8로 저장합니다. 실제 네이버 다운로드 열/암호 및 계정 E2E는 아직 검증하지 않았습니다.

서버 모드는 `deliveryMode: server`와 기존 서버와 같은 32자 이상의 `syncToken`이 필요합니다. Vercel의 매장 ID·Supabase 서버 키·동기화 키 및 실제 매장 row가 준비돼야 합니다. deliveryMode 없는 기존 설정은 server 모드를 유지합니다. 모드마다 별도 `stateFile`을 사용하며, 다른 모드의 확인 상태를 재사용하지 않습니다.

수동 실행: Node 20+에서 `npm install`, `npx playwright install chromium`, `npm start`. 환경변수 `LUDIA_BRIDGE_CONFIG`, `LUDIA_SYNC_URL`, `LUDIA_SYNC_TOKEN`, `LUDIA_SMARTPLACE_URL`, `LUDIA_POLL_MS`, `LUDIA_NAVER_PROFILE`, `LUDIA_BOOKING_ROW_SELECTOR`, `LUDIA_BRIDGE_STATE`를 지원합니다. 프로필/설정/상태 파일은 PC 밖으로 업로드하지 않습니다.

## 권한과 저장

- 서버는 기존 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`(또는 service role), `LUDIA_SALON_ID`를 사용합니다. 실제 salon row가 없으면 미설정이며 Connected로 표시하지 않습니다.
- PC 동기화 키는 읽기/충돌 해결 관리자 권한을 주지 않습니다. 외부 연동 관리자 전용 `LUDIA_INTEGRATION_ADMIN_TOKEN`은 32자 이상이며 동기화 키와 **서로 달라야** 합니다. LUDIA 일반 기능의 로그인 조건이 아닙니다.
- 관리자 키는 사용자가 연동 화면에 입력할 때 브라우저 메모리에만 30분 유지합니다. 범위는 서버에서 지정한 한 샵이며 예약표 조회와 충돌 해결에만 사용합니다. 연결을 해제하거나 새로고침하면 제거됩니다.
- `supabase/naver_bridge_reliability.sql`은 기존 DB 구조에 이벤트 멱등 키와 service-role 전용 원자적 수집/충돌 해결 RPC를 추가합니다. 기존 JWT 경로도 유지합니다. 추가로 `naver_service_availability.sql`, `booking_capacity_reactivation.sql`, 기존 `staff_day_slots.sql`도 설치했습니다. 기존 ACL은 유지하며 service role의 매핑 검증만 허용하고 취소/노쇼 복구 시 용량을 다시 검사합니다. 이전 버전 점검에서 INBETWEEN에 적용했으며, v0.3 작업에서는 DB를 변경하지 않았습니다.
- 매핑은 명시적으로 등록된 규칙과 정확한 전화번호만 사용합니다. raw text에서 고객/시술/담당자를 추측하지 않습니다. 신규 미매핑 예약은 미지정으로 표시합니다.
- 동일 담당자 시간이 겹칠 때만 충돌입니다. 원장/직원 동시 예약은 허용합니다. 고객의 견적 금액, 시술 길이와 사진/아트 메타데이터를 동기화 업데이트에서 보존합니다.

## 신뢰성 및 미완료 범위

예약 이벤트마다 설치 ID + 예약번호 + 변경 revision + 정규화 필드 해시로 멱등 키를 만듭니다. 전송 전에 디스크 outbox에 변경을 저장하고, 미확인 batch를 먼저 재시도합니다. 서버가 DB 저장과 예약표 투영에 성공한 뒤에만 PC 확인 상태를 갱신합니다. 서버 저장 후 응답 실패 또는 PC 재시작 중 A→B→A로 바뀌어도 마지막 상태를 누락하지 않습니다. 중간 실패/재시도/중복 전송에 안전하며 목록에서 사라진 예약을 취소로 추정하지 않습니다. 충돌하는 중복 행이나 해석 불가능한 행은 해당 수집을 중단합니다.

`connected`는 확인된 예약 화면의 성공한 sync에만 사용합니다. 로그인 필요/재로그인/selector 확인 필요/오류/마지막 성공 후 10분 초과 상태를 분리합니다. 미확인 화면의 heartbeat는 최근 Sync 시간을 갱신하지 않습니다.

**실제 SmartPlace DOM, 예약 상세의 고객/시술/담당자, 사진 첨부, 리뷰 수집은 아직 실계정 검증 전입니다.** 사진 데이터는 `attachments: []`, `attachmentState: not_verified`로 명시하며 가짜 selector나 자동 사진 견적을 제공하지 않습니다. 실제 DOM/첨부 접근을 확인한 다음 가격 계산 화면으로 연결해야 합니다. 기존 48개 특징 벡터/5-view 비교와 무료 SigLIP2 후보 분석이 있으며, 손톱별 소재·파츠 개수 자동 판독은 완료되지 않았습니다.
