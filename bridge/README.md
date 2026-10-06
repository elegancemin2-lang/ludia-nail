# LUDIA Naver Bridge · v0.2

샵 Windows PC의 전용 Chromium에서 원장이 네이버 공식 페이지에 직접 로그인합니다. 비밀번호는 LUDIA 서버에 전송하거나 저장하지 않습니다. CAPTCHA/2FA를 우회하지 않습니다. 기존 Vercel/Supabase 연결을 사용합니다.

## 실행과 실제 DOM 확인

1. `START_NAVER_BRIDGE.cmd` 실행 → 생성된 `config.local.json`에 서버와 같은 32자 이상의 `LUDIA_SYNC_TOKEN` 설정. Supabase 서버 키는 PC에 넣지 않습니다.
2. 다시 실행 → 네이버 공식 페이지에서 로그인 → 해당 샵 예약관리 화면으로 직접 이동.
3. **실계정 DOM을 확인한 후에만** 정확한 `smartplaceUrl`, `bookingRowSelector`, `bookingFields`(예약번호/날짜/시간/상태, 선택 전화번호), `emptyStateSelector`를 설정하고 `selectorsVerified: true`로 변경합니다. 필드마다 예약 행 안에서 보이는 요소가 정확히 하나여야 합니다.
4. 확인 전에는 연결 상태만 보고하고 예약을 업로드하지 않습니다. 기본 주기는 60초, 오류 시 최대 5분까지 재시도 간격을 늘립니다.

수동 실행: Node 20+에서 `npm install`, `npx playwright install chromium`, `npm start`. 환경변수 `LUDIA_BRIDGE_CONFIG`, `LUDIA_SYNC_URL`, `LUDIA_SYNC_TOKEN`, `LUDIA_SMARTPLACE_URL`, `LUDIA_POLL_MS`, `LUDIA_NAVER_PROFILE`, `LUDIA_BOOKING_ROW_SELECTOR`, `LUDIA_BRIDGE_STATE`를 지원합니다. 프로필/설정/상태 파일은 PC 밖으로 업로드하지 않습니다.

## 권한과 저장

- 서버는 기존 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`(또는 service role), `LUDIA_SALON_ID`를 사용합니다. 실제 salon row가 없으면 미설정이며 Connected로 표시하지 않습니다.
- PC 동기화 키는 읽기/충돌 해결 관리자 권한을 주지 않습니다. 외부 연동 관리자 전용 `LUDIA_INTEGRATION_ADMIN_TOKEN`은 32자 이상이며 동기화 키와 **서로 달라야** 합니다. LUDIA 일반 기능의 로그인 조건이 아닙니다.
- 관리자 키는 사용자가 연동 화면에 입력할 때 브라우저 메모리에만 30분 유지합니다. 범위는 서버에서 지정한 한 샵이며 예약표 조회와 충돌 해결에만 사용합니다. 연결을 해제하거나 새로고침하면 제거됩니다.
- `supabase/naver_bridge_reliability.sql`은 기존 DB 구조에 이벤트 멱등 키와 service-role 전용 원자적 수집/충돌 해결 RPC를 추가합니다. 기존 JWT 경로도 유지합니다. 추가로 `naver_service_availability.sql`, `booking_capacity_reactivation.sql`, 기존 `staff_day_slots.sql`도 설치했습니다. 기존 ACL은 유지하며 service role의 매핑 검증만 허용하고 취소/노쇼 복구 시 용량을 다시 검사합니다. 이번 점검에서 INBETWEEN에 적용했으며 기존 데이터 삭제는 없습니다.
- 매핑은 명시적으로 등록된 규칙과 정확한 전화번호만 사용합니다. raw text에서 고객/시술/담당자를 추측하지 않습니다. 신규 미매핑 예약은 미지정으로 표시합니다.
- 동일 담당자 시간이 겹칠 때만 충돌입니다. 원장/직원 동시 예약은 허용합니다. 고객의 견적 금액, 시술 길이와 사진/아트 메타데이터를 동기화 업데이트에서 보존합니다.

## 신뢰성 및 미완료 범위

예약 이벤트마다 설치 ID + 예약번호 + 변경 revision + 정규화 필드 해시로 멱등 키를 만듭니다. 전송 전에 디스크 outbox에 변경을 저장하고, 미확인 batch를 먼저 재시도합니다. 서버가 DB 저장과 예약표 투영에 성공한 뒤에만 PC 확인 상태를 갱신합니다. 서버 저장 후 응답 실패 또는 PC 재시작 중 A→B→A로 바뀌어도 마지막 상태를 누락하지 않습니다. 중간 실패/재시도/중복 전송에 안전하며 목록에서 사라진 예약을 취소로 추정하지 않습니다. 충돌하는 중복 행이나 해석 불가능한 행은 해당 수집을 중단합니다.

`connected`는 확인된 예약 화면의 성공한 sync에만 사용합니다. 로그인 필요/재로그인/selector 확인 필요/오류/마지막 성공 후 10분 초과 상태를 분리합니다. 미확인 화면의 heartbeat는 최근 Sync 시간을 갱신하지 않습니다.

**실제 SmartPlace DOM, 예약 상세의 고객/시술/담당자, 사진 첨부, 리뷰 수집은 아직 실계정 검증 전입니다.** 사진 데이터는 `attachments: []`, `attachmentState: not_verified`로 명시하며 가짜 selector나 자동 사진 견적을 제공하지 않습니다. 실제 DOM/첨부 접근을 확인한 다음 기존 무료 reference matcher로 연결해야 합니다. 가격 분석은 의미론적 비전 AI가 아닌 48개 특징 벡터와 5-view ensemble입니다.
