# LUDIA 핵심 기능 · 2026-10-09

v2.63.2 확인: Production에서 일반 XLSX fixture 가져오기 → 원장/직원 동시예약 표시 → CSV 반복 가져오기 0건 추가를 확인했다. 브라우저의 실제 SigLIP2/WASM 추론, 소재 미확정 시 가격 적용 보류, 56,000원 수동 확정 저장·재사용·내보내기(실제 768차원 임베딩 보존)도 확인했다. 360/375/390/412/430px 및 데스크톱에서 예약표 7일과 Light/Dark 가로 넘침 없음, 모바일 사진견적 Light/Dark 동작을 확인했다. **실제 기기 하드웨어 성능, 네이버 계정·다운로드 원본·첨부사진·PC 폴더 자동 수집은 E2E 미검증이다.** DNA 프리셋의 검증되지 않은 학습률 % 표시는 제거했다. 47개 회귀 테스트 및 JavaScript 문법 검사 통과.

## v2.63.0: 지금 사용할 대안과 실제 확인한 제한

현재 INBETWEEN에는 salon row와 네이버 동기화 데이터가 0건이며, Vercel 환경변수 메타데이터에 서버 연동용 Supabase 설정·매장 ID·동기화/관리자 키가 없다. 기존 프로젝트 연결 자체를 새로 만들지는 않았다. 이 상태에서 서버 Bridge가 Connected라고 표시하거나 예약을 저장할 수 있다고 설명하면 안 된다.

`더보기 → 네이버 SmartPlace → 예약 파일 가져오기`에서 CSV/TSV/XLSX 또는 검증된 Bridge JSON을 현재 기기 예약표로 가져온다. 열을 확인하는 미리보기 후 저장하며, 예약번호 기준 반복 가져오기, 명시적 취소/노쇼, 담당자별 중복 보류를 지원한다. 파일에서 사라진 예약은 취소하지 않는다. 기존 예약의 금액·아트 연결·메모를 보존한다. 없는 고객/시술/담당자·파츠 수량을 추측하지 않는다. 미등록 담당자는 미지정으로 표시한다. 소요시간이 없을 때 90분은 소유자가 변경하는 명시적 기본값이다.

암호가 있는 Excel 및 XLS는 사용자가 Excel에서 CSV UTF-8로 변환한다. XLSX는 MIT ExcelJS 4.4.0을 고정하고 앱과 함께 배포한다. 최대 8MB/1,000건, 압축 해제 예상 크기 32MB 제한과 Worker 시간 제한을 적용하며 수식 실행/외부 링크 요청은 하지 않는다. 공식 다운로드 파일의 실제 열·암호 형식은 아직 확인하지 않았다. 일반 CSV/XLSX fixture 검증과 실제 네이버 계정 검증은 구분한다.

PC Bridge의 새 설정 예시는 `deliveryMode: local`이다. 실제 DOM 검증을 마친 뒤 `exports/ludia-naver-bookings.json` 및 상태 JSON을 출력한다. PC Chrome/Edge의 **PC 자동 파일 확인**에서 해당 폴더를 선택하고 미리보기를 확인하면 페이지가 열려 있는 동안 60초마다 읽는다. 오래된 파일/네이버 로그인 만료/미확인 화면이면 자동 반영을 멈춘다. 권한은 읽기 전용이며 재접속 시 폴더를 다시 선택한다. 기존 deliveryMode 없는 설정은 server 모드를 유지한다.

이 경로는 현재 PC/브라우저에만 저장된다. 폰과 PC의 자동 공유, 실제 SmartPlace 로그인·DOM, 예약 첨부사진 자동 추출은 완료되지 않았다. 수동 파일 가져오기와 실시간 네이버 연결은 다른 상태로 표시한다.

## v2.63.0: 무료 로컬 비전

**무료 로컬 AI** 버튼은 실제 Google SigLIP2 Base의 고정 ONNX q8 이미지 인코더를 브라우저 Worker/WASM에서 실행한다. 최초 이미지 가중치는 94,553,333 bytes(약 95MB)이며 브라우저 캐시를 사용한다. 사진은 모델 서버로 전송하지 않는다. 모델 코드·가중치를 최초 받으려면 인터넷이 필요하고, 캐시를 지우면 다시 받는다. 텍스트 임베딩은 같은 revision의 실제 텍스트 인코더로 생성해 저장했으므로 브라우저가 283MB 텍스트 인코더를 추가로 받지 않는다.

소재가 애매하면 기본 시술/가격을 자동 적용하지 않는다. 원컬러·자석젤·그라데이션·전체 디자인 선택 후 기존 단가로 계산한다. 이 모델은 손톱/파츠 개수를 세는 검출기가 아니며 후보 유사도는 정확도 확률이 아니다. 기존 48-reference/5-view 비교도 선택 가능하고 SHA-256 동일 사진 정답 재사용은 유지한다.

원장이 확정한 사진을 저장하면 실제 768차원 임베딩도 기기에 보관한다. 새 사진에서 같은 모델/revision의 확정 사진과 매우 가까우며 다른 소재 정답과 경합하지 않을 때 **기본 소재만** 제안한다. 다른 사진의 파츠 수량·최종금액은 복사하지 않는다. 이것은 신경망 fine-tuning이 아니라 사전학습 인코더를 사용한 정답 사진 검색이다.

CLIP 및 SigLIP2를 기존 사진 5장에 실제 실행했다. CLIP은 존재하지 않는 장식을 후보로 올리는 문제가 있었고, SigLIP2도 소재 점수 차이가 작아 5장 모두 판정을 보류했다. `docs/vision-evaluation.json`은 실제 실행 결과이며 정확도 측정이 아니다. 따라서 자석젤 자동 판독·손가락별 소재·파츠 개수 인식 완료라고 표시하지 않는다.

공개 네일 자료로 NaiLIA/NAIL-STAR(10,625개 이미지 참조 및 설명)를 확인했다. 요청/의도 설명을 소재·수량 정답으로 자동 취급하지 않았고, 원본 사진 사용권·라벨 검증 및 학습 모델 공개 여부 확인이 남았다. 이 자료로 학습했다고 주장하지 않는다. 기존 사용자 가격표와 G01~G06 금액은 재입력 없이 그대로 보존한다.

재현: `tools/vision`에서 `npm ci --ignore-scripts`, `node build-prototypes.mjs`, `node evaluate.mjs`. 평가에는 유료 API 키를 사용하지 않는다.

- [Google SigLIP2 모델·Apache 2.0 라이선스](https://huggingface.co/google/siglip2-base-patch16-224)
- [고정 ONNX 모델](https://huggingface.co/onnx-community/siglip2-base-patch16-224-ONNX/tree/ba1f3b0843f24bc5417d38e19c37b287d719b2f4)
- [NaiLIA 연구](https://nailia-94dpr.kinsta.page/), [NAIL-STAR 데이터](https://huggingface.co/datasets/kanonnon/NAIL-STAR)

아래는 v2.62.0에서 조사한 선택지와 기존 기준의 배경이다.

## 네이버 예약 연동 선택

| 방식 | 현재 판단 | 제약/확인할 것 |
|---|---|---|
| 공식 제휴/기존 미용업 솔루션 | 장기 후보. 네이버는 핸드SOS·아하소프트·뷰카프로·헤어짱 연동을 안내한다. | LUDIA의 제휴 자격/조건과 재연동 가능 여부는 미확인. 타 솔루션이 사진 첨부까지 외부에 제공한다는 근거도 아직 없다. |
| 현재 Windows Playwright Bridge | 당장 진행할 기준 경로. 로그인·예약번호·확정 필드·재시도/멱등성 구조가 이미 있다. | 원장의 공식 로그인, 실제 예약 상세 DOM 및 첨부 접근 확인이 필요하다. 전용 PC와 열린 브라우저가 필요하다. |
| Chrome/Edge 확장 또는 Playwright MCP 확장 | 실제 로그인 탭을 확인하고 selector를 검증하는 보조 후보. | 공식 예약 API를 제공하는 것은 아니다. 자동 수집 범위/PC 상시 실행/확장 권한을 따로 검증해야 한다. LUDIA 전용 확장은 아직 구현하지 않았다. |
| 네이버 공식 내역 다운로드 | 예약 수기 입력을 줄이는 보조 후보. | 실제 내려받기 컬럼과 보호 파일 처리부터 확인해야 한다. 실시간 예약 변경·사진 첨부가 포함된다고 가정하지 않는다. |

일반 NAVER Developers의 공개 API 목록에는 SmartPlace 예약 조회 API가 보이지 않는다. 네이버 로그인 API/플레이스 검색 API가 예약 관리 권한을 주는 것으로 해석하지 않는다. 공식 목록에서 확인하지 못한 것을 모든 제휴 API의 부재로 단정하지 않는다.

`microsoft/playwright-mcp`의 확장 모드는 기존 Chrome/Edge 탭을 연결할 수 있다. 개발/DOM 검증 단계에 활용할 수 있지만 상시 동기화는 현재처럼 명시적 selector와 검증된 필드 기반 작업이 적합하다. 매 60초마다 생성형 AI가 예약 사실을 추측하는 방식은 채택하지 않는다.

Agent-Reach는 공개 웹/소셜 정보 접근 도구 모음이다. 조사한 지원 목록에 네이버 SmartPlace 예약 연동기가 없으며, 설치만으로 샵 예약 권한이나 사진 첨부 스키마가 해결되지 않는다. 발견한 `AllenEdgarPoe/Naver-Crawling-SmartStore`는 Selenium/BeautifulSoup 예약 수집 사례지만 비밀번호를 config에 입력하는 2023년 방식이라 그대로 도입하지 않는다. 비밀번호 저장, CAPTCHA/2FA 우회, 미확인 selector는 추가하지 않는다.

사진은 실제 예약 상세 화면의 첨부를 확인한 뒤 안정적인 예약번호 + 첨부 식별자 + 파일 해시로 연결한다. PC에서 권한 있는 화면을 통해 확인한 바이트만 전달하고, 세션 쿠키/비밀번호/원본의 임시 인증 URL을 공개 저장소로 보내지 않는다. 아직 실제 사진 추출이나 사진 자동 동기화는 완료하지 않았다. 첨부가 실제로 제공되지 않으면 별도의 고객 사진 제출 경로를 검토한다.

## 사진 자동 견적

가격은 기존 샵 기준으로 고정하고 인식 결과는 소재·아트·파츠·수량만 제안한다. 계산은 공유 `pricing-core.js`가 맡는다. 기존 유료 OpenAI 서버 호출은 제거했으며 `/api/price-estimate`는 공개 기준표로 명시된 항목을 계산하는 역할이다. 이미지 요청은 브라우저 판독이 필요하다는 422 응답을 준다.

현재 인식은 48개 색/밝기 벡터의 5-view matcher다. 새로운 사진의 자석/글리터/일반 반사광을 의미론적으로 이해하는 모델은 아니다. 동일 원본의 리사이즈·밝기 변형 통과를 새로운 사진 정확도로 사용하지 않는다. SigLIP2/CLIP 같은 공개 인코더를 실제 정답 사진으로 비교하고, 손톱별 소재 분류 및 파츠 개수 판독을 별도 평가한 다음 교체해야 한다. `data/nail-vision-plan.v1.json`에 분류 항목과 평가 기준을 저장했다. 모델을 다운로드하거나 학습/배포한 것으로 주장하지 않는다.

이번 버전은 원장이 항목·수량·단가·최종금액을 확인하고 **이 사진·견적 정답 저장**을 눌렀을 때만 사진과 정답을 IndexedDB에 보관한다. 사진은 최대 1280px JPEG, 원본 동일성은 SHA-256으로 판별한다. 고객 이름/전화번호/네이버 인증 정보는 기록에 넣지 않는다. 최대 50개이며 용량을 이유로 조용히 지우지 않는다. 같은 사진은 확정 기록을 다시 사용한다. 단가 기준이 변경되면 현재 단가로 다시 계산하고 이전 수동 최종금액을 자동 적용하지 않는다. 새로운 사진에 확정 기록의 수량을 확정 사실처럼 복사하지 않는다.

저장은 기기 로컬이며 기존 샵 계정 모드에서는 salon ID별로 구분한다. 정답 내보내기에 사진과 항목이 포함된다. 기본 가격표 내보내기에는 보존한 기준과 현재 운영 단가가 함께 담긴다. 새로운 학습에 가장 도움이 되는 자료는 자석/글리터/일반 광택을 혼동하기 쉬운 실제 사진과 원장이 확정한 항목별 수량이다. 기존 가격표를 처음부터 다시 입력할 필요는 없다. 원본 기준표에 대한 재대조와 보존이 필요하다면 해당 원본 파일만 다시 제공받아 별도로 보관한다.

## 검증 범위

- 단가·단위는 기존 main의 DEFAULT_PRICING과 전체 동등성 검증. G01~G06 가격 계산 회귀 검증.
- 전체 디자인 중복 합산, 중복 옵션 행, 잘못된 수량, 정답 기록 검증, 단가 변경 후 재계산, 외부 AI/네트워크 호출 없는 API 검증.
- 기존 예약 capacity/시간/동시예약/브리지 재시도 및 scoped 인증 회귀 검증.
- 실제 SmartPlace 계정, 공식 제휴 계약, 첨부 사진 접근, 보지 않은 사진의 소재/개수 인식은 별도 E2E 및 데이터 검증이 남아 있다.

## 조사 출처

- [네이버 공개 API 목록](https://developers.naver.com/products/intro/plan/plan.md)
- [예약-핸드SOS 연동 도움말](https://help.naver.com/alias/booking/20642.naver)
- [예약-뷰카프로 연동 도움말](https://help.naver.com/alias/booking/20644.naver)
- [예약자/주문자 목록 다운로드](https://help.naver.com/service/11712/contents/7582?lang=ko)
- [Playwright MCP](https://github.com/microsoft/playwright-mcp)
- [Agent-Reach](https://github.com/Panniantong/Agent-Reach)
- [SmartPlace Selenium 수집 사례](https://github.com/AllenEdgarPoe/Naver-Crawling-SmartStore)
- [Chrome activeTab 권한](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [Transformers.js](https://huggingface.co/docs/transformers.js/index)
- [SigLIP2](https://huggingface.co/docs/transformers/model_doc/siglip2)
- [CLIP ONNX](https://huggingface.co/Xenova/clip-vit-base-patch32)
