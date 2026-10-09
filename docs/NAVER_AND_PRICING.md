# LUDIA 핵심 기능 · 2026-10-09

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
