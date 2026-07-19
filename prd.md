# 세일링 환경 대응 시뮬레이션 — PRD

> 문서 상태: **Draft v0.3 · 3턴 강건화 검토 반영**
> 갱신일: `2026-07-19 KST`
> 제품 범위: 브라우저 기반의 물리·판단 훈련 보조 게임. 실제 항해·안전 판단·자격/면허를 대체하지 않는다.
>
> **현재 운영 모델 (2026-07-19):** 프로젝트 소유자의 개인·로컬 사용만을 위한 합성 훈련 prototype이다. certification, 외부 검토자 자격, 독립 authority, formal controlled apply, public distribution, deployment, release는 현재 제품 목표가 아니다. 이 결정은 sailing-domain correctness 또는 실제 안전/항법 권위를 주장하지 않는다.

## 1. 제품 개요

### 1.1 한 줄 정의

변화하는 해양 환경을 관측하고, MVP에서 배정된 Training Sloop의 세일·트림·조타를 실행한 뒤 결과의 원인을 이해하며 같은 조건에서 재도전하는 **브라우저 기반 세일링 학습 시뮬레이션**.

### 1.2 해결하려는 문제

입문 교육 수강생은 바람·조류·파도·조석·날씨가 함께 변할 때 무엇을 관측하고 어떤 세일/트림/침로 결정을 해야 하는지, 그리고 그 결과가 왜 발생했는지를 안전하게 반복 연습하기 어렵다.

### 1.3 제품 원칙

1. **환경은 판단 입력이다.** 환경값은 배경 효과가 아니라 선속·표류·수심 여유·안전·세일/코스 결정에 인과적으로 연결된다.
2. **설명 가능성이 사실성보다 먼저다.** MVP는 고정·재현 가능한 시나리오와 명시적 규칙을 우선하며, 고정밀 CFD·실시간 전 지구 환경 모델은 후속 범위다.
3. **안전 행동을 보상한다.** reef, 감속, 회항, 위험수역 회피는 기록이 느려져도 긍정 평가한다.
4. **게임성은 약한 동기 장치다.** 점수·진행·재시도는 허용하되, 경쟁·보상경제·멀티플레이는 MVP에서 제외한다.
5. **현실 권한을 대체하지 않는다.** 이 제품은 실제 해상 판단, 항법, 기상 해석, 안전교육, 면허·자격을 대신하지 않는다.

## 2. 벤치마크 근거와 설계 적용

| 근거 | 확인한 사실 | 본 제품의 설계 적용 |
|---|---|---|
| Sailaway | 위치별 예보 기반의 바람·구름·파도, 런타임 세일 공기흐름/트림, 항법·레이스 요소를 공개한다. | 환경→트림→선속 결과를 가시화한다. MVP는 실시간 데이터 대신 버전된 시나리오를 사용한다. |
| World Sailing eSailing | Virtual Regatta와의 파트너십 및 브라우저·모바일·태블릿에서의 낮은 진입장벽을 공개한다. | 브라우저 온보딩, 짧은 레슨, 빠른 재시도를 우선한다. 경쟁 기능은 후속이다. |
| NOAA 조류 자료 | 조류는 바람·밀도 차이·조석의 영향을 받고, 조석류는 예측 가능한 패턴을 보일 수 있다고 설명한다. | STW/SOG와 heading/COG를 분리하고 조류 벡터로 표류를 설명·채점한다. |
| NOAA 조석·수위 자료 | 안전한 해양 활동에서 조석·조류·수위 정보의 중요성을 설명한다. | 조석을 수심 여유·좌초 위험·통과 가능 시점에 연결한다. |

상세 조사, 원본 URL, 접근 한계는 [`docs/research/benchmark-sources.md`](docs/research/benchmark-sources.md)를 따른다. 벤치마크의 제품 주장은 공개적으로 확인한 범위에 한정하며, 이 조사 결과가 실제 선박 설계·항해 안전성의 근거가 되지는 않는다.

## 3. 사용자와 사용 맥락

### 3.1 확정 1차 페르소나

- **세일링 입문 교육 수강생:** 기본 용어와 조작을 배우는 중이며, 코치/실습 전후에 환경 관측·판단·조작의 인과관계를 반복 연습해야 하는 학습자.
- **후속 사용자:** 코치/교육자, 기존 크루저 오너. 이들은 MVP의 설계 검토·콘텐츠 확장 대상이지, MVP 난도 기준은 아니다.

### 3.2 Jobs to be Done

| 상황 | 사용자가 하려는 일 | 성공 정의 |
|---|---|---|
| 일정한 바람의 기본 연습 | 상대풍을 읽고 세일·침로의 관계를 체감 | 목표 침로에서 안정적인 세일 상태와 이유를 설명 |
| 돌풍/파도 발생 | 속도보다 위험 관리를 먼저 수행 | 위험 전 reef·감속·안전 침로를 선택 |
| 조류와 마크 접근 | 물 기준 속도와 실제 이동 경로를 구분 | drift를 보정해 안전 여유를 유지하며 마크 도달 |
| 조석·수심 변화 | 시간에 따른 수역 위험을 판단 | 통과/대기/회항 중 근거 있는 선택 |

| 레슨 종료 | 결과의 원인을 학습하고 개선 | 동일 조건 재시도에서 같은 오류 감소 및 원인 설명 |

## 4. 확정 제품 결정

| ID | 확정 결정 | 구현 경계 |
|---|---|---|
| D1 | **브라우저 동작 게임** | 네이티브 설치 없이 데스크톱 브라우저에서 동작한다. 정확한 지원 브라우저·성능 예산은 기술 옵션 비교에서 확정한다. |
| D2 | **입문 교육 수강생** | 경험을 전제하지 않는 용어·조작 설명과 안전 고지를 제공한다. |
| D3 | **다양한 선체·리그 카탈로그의 장기 지원** | monohull/multihull, 마스트 위치·수·종류를 데이터·콘텐츠로 확장 가능하게 설계하되, 실제 구조/다중 마스트 공력 검증은 MVP 범위가 아니다. |
| D4 | **가상 훈련 수역 기본 + 한국 연안 맥락 확장** | MVP는 가상 수역 1개다. 영종도·덕적도 인근 시나리오는 후속 정적 콘텐츠이며 실제 해도·예보·안전 항법을 주장하지 않는다. |
| D5 | **MVP: 가상 수역의 Training Sloop 단일 프로필과 필수 레슨 L01–L05** | MVP 학습 진행은 Sloop 하나로 고정한다. Dinghy는 장기 카탈로그 후보로 유지하되 MVP 프로필·필수 레슨 범위에서는 제외한다. |
| D6 | **물리 훈련 보조 + 약한 게임성** | 점수·진행·재도전은 포함하되, 속도/점수가 안전 위반을 상쇄하면 안 된다. |

## 5. 보트·선체·리그 카탈로그

### 5.1 용어와 분류

선체와 리그를 한 목록으로 섞지 않고 별도의 축으로 모델링한다.

| 축 | 필드 | 장기 후보 |
|---|---|---|
| `hull_configuration` | `family`, `form` | `monohull`: dinghy, keelboat / `multihull`: catamaran, trimaran |
| `rig_configuration` | `rig_plan`, `mast_count`, `mast_roles/types`, 선수→선미 기준 `mast_positions`, `sail_inventory`, 노출 조작 | sloop, cutter, ketch, yawl, schooner |
| `boat_profile` | 선체·리그 참조, 성능 폴라, 흘수, 안전 임계값, 허용 조작, 레슨 호환성, 모델 버전 | Training Dinghy, Training Sloop 및 후속 프로필 |

- **Dinghy/Keelboat/Catamaran/Trimaran**은 주로 선체 형상·부력/안정성 계열이다.
- **Sloop/Cutter/Ketch/Yawl/Schooner**는 주로 리그/마스트와 세일 구성이다.
- 사용자에게는 친숙한 ‘보트 프로필’로 보여주되, 내부 계약은 선체와 리그를 분리한다.

### 5.2 MVP 프로필

| 프로필 | 선체/리그 계약 | 교육적 차이 | MVP 제한 |
|---|---|---|---|
| `training-sloop-v1` | 일반화된 monohull keelboat hull + sloop rig | 메인·지브, reef, 조류/조석 환경에서의 판단을 학습 | 실제 특정 제조사/선형의 성능·안전성을 주장하지 않음 |

MVP의 유일한 플레이 가능 프로필은 `training-sloop-v1`이다. 마스트 위치·수·종류는 MVP에서 **교육용 메타데이터, 시각화, 허용 세일/조작, 폴라 선택**에만 영향을 준다. 구조 하중, 정밀 형상, 마스트 간 공력 간섭, 실제 설계 적합성 계산은 제외한다.

### 5.3 후속 확장

- monohull: keelboat, sloop, cutter, ketch, yawl, schooner 관련 프로필
- multihull: catamaran, trimaran 프로필
- 다중 마스트/다중 세일 교육은 리그별 레슨·조작·폴라·안전 규칙의 도메인 검토 후 추가한다.
- 새 프로필은 기존 시나리오/replay 계약을 깨지 않는 버전형 데이터·콘텐츠 조합으로 선언한다.
- MVP 구현은 `training-sloop-v1`에 필요한 최소 profile fields만 요구한다. 다중 선체·리그의 선택/비교 UI와 그 실제 물리·콘텐츠는 Post-MVP이며, 현재 MVP 수용 기준이 이를 구현하도록 요구하지 않는다.

## 6. 제품 범위

### 6.1 MVP에 포함

- 데스크톱 우선 브라우저 게임과 키보드 중심 조작
- `training-sloop-v1` **단일 플레이 가능 프로필**
- 가상 연안 훈련 수역 1개: 수심, 해안선, 마크/부표, 위험구역
- 시간 변화가 가능한 결정론적 환경: 진풍/돌풍, 조류, 조위, 파도, 시정·경보
- apparent wind, STW/SOG, heading/COG, drift trail, 수심 여유를 보여주는 HUD
- 시드·시나리오 버전·보트 프로필 버전·입력 로그로 재생 가능한 세션
- 학습 루프: `브리핑 → 관측 → 선택·조작 → 체크포인트 → 인과 디브리프 → 동일 조건 재도전`
- 안전·관측·판단·조작·결과를 분리한 평가, 일시정지·속도 조절·리셋, 기본 접근성

### 6.2 MVP에서 제외

- Dinghy, Catamaran, Trimaran, Cutter, Ketch, Yawl, Schooner의 실제 물리·완전 콘텐츠
- 전복/복원, 승무원 체중 이동, 구조 안정성, 정밀 선체 형상, 다중 마스트 공력
- 실시간 전 지구 날씨/조석 API, 실제 항만·수로·한국 연안 해도의 정확성 보장
- 영종도·덕적도 인근의 실제 항법·안전 의사결정 지원
- 멀티플레이, 실시간 레이스, 레이싱 규칙 판정, 경쟁/보상경제
- VR, 고정밀 CFD, 실제 항해 안전 판단, 자격/면허 대비·인증

### 6.3 한국 연안 맥락의 콘텐츠 로드맵

영종도·덕적도 인근은 후속 **정적·버전형 훈련 시나리오**의 지리적 맥락으로 고려한다. 실제 해도/수심/예보/조류를 재현하거나 안전한 항로를 제시하지 않는다. 각 시나리오는 자료 출처, 단순화, 시나리오 버전, ‘실제 항해 자료가 아님’ 고지를 갖춰야 한다.

## 7. 핵심 학습 경험

### 7.1 공통 세션 흐름

1. **상황 브리핑:** 배정된 `training-sloop-v1` 프로필, 해역, 목표, 제약, 안전 고지를 제시한다.
2. **환경 관측:** 풍향/풍속, 조류, 조위, 파도, 시정, 수심 및 Training Sloop에서 가능한 조작 범위를 표시한다.
3. **결정·조작:** 사용자가 해당 레슨에서 Training Sloop에 허용된 세일/reef, 시트, 조타를 수행한다.
4. **체크포인트:** 마크 통과, 위험수역 접근, 돌풍, 얕은 수심 등에서 형성 피드백을 제공한다.
5. **디브리프:** `관측 → 판단 → 행동 → 결과`와 Training Sloop의 선언된 모델 상태가 결과에 미친 원인을 보여준다.
6. **재도전:** 동일 scenario/seed/model/profile version에서 다시 실행해 차이를 비교한다.

### 7.2 확정 MVP 필수 레슨 (C1 완료)

| ID | 레슨 | 환경 변수 | MVP 프로필 | 목표 |
|---|---|---|---|---|
| L01 | 상대풍과 침로 | steady wind | `training-sloop-v1` (고정) | 진풍·상대풍을 관측하며 목표 침로 유지 |
| L02 | 메인·지브 트림 | steady wind | `training-sloop-v1` (고정) | wind angle에 맞춘 sheet 조절로 안정 선속 확보 |
| L03 | 돌풍·파도·reef | gust + wave | `training-sloop-v1` (고정) | 위험 전에 세일 축소/안전 조타 선택 |
| L04 | 조류 보정 | current vector | `training-sloop-v1` (고정) | COG·SOG 차이를 해석해 마크 도달 |
| L05 | 조석·수심·시정 | tide + shallow water + visibility | `training-sloop-v1` (고정) | 통과/대기/회항 판단 |

**C1 — 확정됨:** L01–L05 다섯 개 레슨을 MVP 필수 레슨으로 구성하며, 모든 필수 레슨은 `training-sloop-v1`으로 진행한다. Dinghy용 레슨은 MVP 이후의 카탈로그 확장 항목이다.

### 7.2.1 레슨 계약 및 검증 레코드

각 L01–L05 레슨은 콘텐츠 manifest에서 다음 필드를 반드시 선언한다: `lesson_id`, `scenario_version`, `initial_state`, `required_observations`, `permitted_actions`, `checkpoints`, `pass_semantics`, `fail_semantics`, `safe_recovery_semantics`, `hint_and_debrief`, `retry_comparison`, `validation_record_id`, `failure_or_boundary_acceptance`.

- 레슨 계약은 사용자가 관측해야 할 신호, 허용된 조작, 목표/위험 체크포인트 및 동일 조건 재도전에서 비교할 결과를 설명 가능하게 정의한다.
- `pass/fail/safe_recovery`는 세션을 즉시 종료할지, 계속 진행하되 보상을 제한할지, 회복을 허용할지를 레슨별로 선언한다. 전 제품에 공통인 hard-block 동작을 가정하지 않는다.
- 폴라, reef 시점, 수심 여유, 파도·돌풍·시정 임계값, 채점 가중치와 숙련 기준은 승인 전까지 **시뮬레이션 전용 가정**이며, `validation_record_id`의 승인 상태를 참조한다. PRD는 이를 실제 항해의 안전 수치로 주장하지 않는다.

### 7.3 점수 철학

- 총점은 **관측, 판단, 조작 안정성, 안전, 목표 달성**으로 구성한다.
- 고속 결과가 안전 조건 위반을 상쇄하면 안 된다.
- 모든 점수 변화는 특정 환경 상태와 사용자 행동 이벤트로 설명 가능해야 한다.
- 채점 계약은 위험 episode의 severity, 안전 위반에 대한 보상 제한, 동일 원인·상태가 해소되기 전의 중복 평가 방지, 안전 회복 행동의 별도 설명을 선언한다.
- 안전 위반 뒤의 종료/계속/회복은 레슨 계약과 도메인 검증 상태에 따르며, 어느 경우에도 속도·점수·진행 보상이 안전 위반을 상쇄하지 않는다.

## 8. 시뮬레이션 계약

### 8.0 좌표·단위·방향 규약

모든 scenario와 model contract는 다음 선언 필드를 version과 함께 가져야 한다: 평면 좌표 frame 및 원점, 각도 0°와 회전 방향, wind의 `from` 의미와 current의 `to` 의미, 거리·속력·시간 단위, 수심 기준면(datum), 벡터 합성 순서, 반올림·클램프 정책.

- heading, COG, wind/course 및 drift 관련 표시·계산은 같은 계약의 방향 규약으로 정규화한다.
- 실제 해도·항법 datum 또는 검증되지 않은 물리값을 주장하지 않는다. 초기 선언값은 도메인 검증 전 **가정**이며 validation record로 추적한다.

### 8.1 환경 모델

| 모델 | 최소 입력 | 최소 출력/영향 | MVP 단순화 |
|---|---|---|---|
| 바람 | true wind direction/speed, gust schedule | apparent wind, 세일 유효각, 기본 선속 | 난류/미세 지형풍 제외 |
| 조류 | 위치·시간별 방향/속도 벡터 | SOG/COG, drift trail | 수직 수층·복합 해류 제외 |
| 조석 | 시간별 조위 곡선 | `수심 + 조위 - 흘수` 여유, 위험 이벤트 | 지역 조화상수/실측 연동 제외 |
| 파도 | 높이, 주기, 진행방향 | 선속·조타 안정성 보정 | 개별 파면/파괴파 물리 제외 |
| 날씨 | 시정, 경보, 강수/운량 상태 | 관측 가능성·결정 제약 | 실제 레이더/예보 연동 제외 |

### 8.2 보트 모델

- `boat_profile = hull_configuration + rig_configuration + polar + draft + safety thresholds + controls + model version`.
- 기본 선속은 `(apparent wind angle, wind speed) → target boat speed` 폴라에서 얻는다.
- 트림, reef, 파도, 안전 상태는 명시적 보정 계수로 기본값을 조정한다.
- 조류 벡터를 물 기준 선속에 합성해 SOG/COG를 계산한다.
- 레슨은 Training Sloop에서 허용되는 조작 목록을 선언한다. 지원되지 않는 조작은 시작 전 차단하거나 명확히 비활성화한다.
- 같은 `scenario_version + seed + ordered_input_log + model_version + boat_profile_version + contract_version + coordinate_contract_version + determinism_contract_version + comparison_policy_version`은 §8.3의 승인된 비교 정책에 따라 같은 주요 상태·이벤트·채점 결과를 재현해야 한다.
- 모든 계수·임계값은 콘텐츠/모델 버전으로 기록하고 디브리프에서 사용자 친화적으로 설명한다.
- 결정론 재생의 비교 대상, 입력 순서와 pause/reset 의미는 §8.3 결정론 계약을 단일 기준으로 따른다.

### 8.3 결정론 계약

각 scenario/model contract는 replay에 대해 다음을 사전 선언한다: 시간 진행 방식(fixed tick 또는 동등한 입력 순서 식별자), input log 순서 식별, seed와 난수 소비 정책, 상태 업데이트 순서, 동시 이벤트 tie-break, pause의 비진행 의미, reset의 초기 상태 복원 의미, focus-loss/visibility의 즉시 scheduler 정지와 explicit resume, 비교 대상 state/event/score 필드, 비교 정책 version. `contract_version`은 lesson contract schema와 model-interface bundle의 버전이며 coordinate/determinism/comparison 세부 버전과 별도로 선언한다.

- 같은 `scenario_version + seed + ordered_input_log + model_version + boat_profile_version + contract_version + coordinate_contract_version + determinism_contract_version + comparison_policy_version`은 선언된 비교 대상의 주요 상태 궤적, 이벤트, 채점, 디브리프를 재현해야 한다. 일부 식별 필드가 missing/unknown/incompatible이면 approximate replay를 금지하고 원본 local record를 보존한 채 실행을 거부한다.
- 구현 알고리즘과 수치 tolerance는 PRD 본문에서 발명하지 않으며, 기술 검증 문서와 도메인/QA 승인 레코드에서 versioned policy로 확정한다.

## 9. 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|---|---|---|
| FR-01 | 시나리오 엔진은 환경·지리·목표·안전 조건·seed·버전 및 결정론 contract version을 불러온다. | 동일 replay 식별자는 §8.3에서 승인된 비교 대상·정책에 따라 주요 상태·이벤트·채점 결과를 재현한다. |
| FR-02 | HUD는 환경·Training Sloop 상태·레슨에서 허용된 조작을 표시한다. | 행동 전 판단에 필요한 진풍/상대풍, 조류, 조위, 수심 여유, 파도, 시정과 조작 범위가 식별된다. |
| FR-03 | 사용자는 배정된 Training Sloop와 레슨이 선언한 helm, sheet, sail choice/reef 등 조작을 수행한다. | 각 허용 조작은 보트/세일 상태에 반영되고, 지원 밖 조작은 노출되지 않거나 비활성화된다. |
| FR-04 | 시스템은 STW/SOG와 heading/COG를 분리하고 drift trail을 제공한다. | 조류 0에서 STW/SOG 차이가 사라지고, 조류가 있으면 벡터 합성과 맞는다. |
| FR-05 | 시스템은 수심 여유 임계값에 따른 주의/위험 이벤트를 기록한다. | 임계값 통과 시 정확히 한 번의 이벤트가 남는다. |
| FR-06 | 레슨은 체크포인트와 안전/목표/회복 조건을 제공한다. | L01–L05 각각이 §7.2.1의 전 레슨 계약 필드와 validation record를 가진다. |
| FR-07 | 디브리프는 관측·판단·행동·결과·점수 원인을 연결한다. | 점수 변화마다 원인 이벤트, 안전 episode 및 Training Sloop의 선언된 모델 상태로 이동할 수 있다. |
| FR-08 | 사용자는 동일 조건으로 즉시 재시작하고 결과를 비교한다. | replay에 full identity(`scenario`, `seed`, ordered input, model/profile/contract, coordinate/determinism/comparison-policy version)가 보존되고, 기본 저장·비교는 로컬 브라우저에서만 수행된다. incompatible replay는 stable reason code로 거부하며 original local record를 보존한다. |
| FR-09 | 온보딩과 결과 화면은 실제 항해·안전·자격 대체가 아님을 고지한다. | 신규 사용자가 레슨 전후 고지를 본다. |
| FR-10 | Training Sloop의 버전형 보트 프로필을 제공하고, 후속 선체·리그 확장을 위한 분리된 데이터 방향을 유지한다. | MVP는 `training-sloop-v1`에 필요한 hull/rig/polar/draft/safety/controls/model version 필드만 요구하며, 다른 프로필의 실제 데이터·선택 UI를 요구하지 않는다. |
| FR-11 | Training Sloop와 레슨 호환성을 검증한다. | MVP 카탈로그에는 `training-sloop-v1`만 존재하며 L01–L05는 모두 이 프로필과 호환된다. |
| FR-12 | Training Sloop의 선언된 모델 상태가 성능·조작·결과에 미치는 이유를 설명한다. | 디브리프가 해당 Sloop의 모델 상태·환경·행동을 인과적으로 연결한다. |

## 10. 비기능 요구사항과 검증

- **브라우저:** 네이티브 설치 없이 승인된 데스크톱 브라우저에서 첫 레슨을 시작하고 키보드로 공통 학습 루프를 완료한다.
- **결정론/회귀성:** golden replay로 모델·콘텐츠 변경이 §8.3의 승인된 비교 정책을 깨지 않는지 확인한다.
- **설명 가능성:** 숨은 점수 규칙을 금지하고, 실패/점수/Training Sloop 모델 상태를 관측 가능한 원인과 연결한다.
- **접근성:** 키보드 조작, 색상 외 텍스트/아이콘 구분, 일시정지·속도 조절을 제공한다.
- **데이터 최소화:** MVP는 개인 계정·정밀 위치·실시간 외부 데이터 없이 동작한다. replay와 telemetry의 기본 저장·비교는 로컬 브라우저에 한정하며, 서버 전송은 별도의 제품 결정·사용자 동의·보존·삭제 정책이 승인되기 전까지 금지한다.
- **안전:** 실제 해상 판단·항법·기상·자격 대체 고지를 온보딩과 결과에 표시한다.

### 미래 public-distribution P1 품질 게이트 — 현재 비활성

지원 브라우저 matrix, 성능/입력 지연 예산, 접근성 준수 수준, 파일럿 측정 지표·중단 조건, rollout/rollback 및 replay compatibility 정책은 **향후 public distribution을 별도로 제안할 때만** 필요한 승인 artifact다. 현재 개인·로컬 사용에는 P1 certification/approval이 요구되지 않지만, 이 사실이 지원 범위·도메인 정확성·실제 안전성을 주장하게 하지는 않는다.

### 수용 기준

1. `scenario_version + seed + ordered_input_log + model_version + boat_profile_version + contract_version + coordinate_contract_version + determinism_contract_version + comparison_policy_version`이 같으면 §8.3의 승인된 비교 정책에 따라 주요 상태·이벤트·채점 결과가 재현된다. missing/unknown/incompatible identity는 approximate replay 없이 stable reason code로 거부하고 original local record를 보존한다.
2. 무풍·무조류·무파 fixture 및 조류/조석/파도 단일변수 fixture는 해당 validation record가 선언한 벡터·폴라·수심 비교 정책을 만족한다.
3. MVP 보트 profile은 Training Sloop에 필요한 hull/rig/polar/draft/safety/controls/model version 필드를 버전 관리한다. 다중 hull/rig 비교는 Post-MVP 요구사항이다.
4. MVP에는 `training-sloop-v1`만 존재하고 L01–L05 모두 이 프로필을 사용하며, 지원 밖의 조작은 시작 전에 차단된다.
5. Training Sloop의 선언된 모델 상태로 발생한 성능·조작 결과는 디브리프에서 인과적으로 설명된다.
6. 한국 연안 맥락 시나리오는 정적·버전형 콘텐츠 및 ‘실제 해도/예보/항법 자료가 아님’ 고지를 가진다.
7. 안전 위반은 속도·점수·진행 보상으로 상쇄되지 않는다.
8. 각 출시 대상 레슨은 §12의 도메인 검증 레지스터에서 승인된 validation record를 가져야 한다. 미승인 또는 반려 상태의 레슨은 출시 대상에서 제외된다.
9. 입문 교육 수강생 파일럿, 브라우저/접근성/성능, rollout/rollback은 §12의 승인 artifact가 요구하는 증거·승인 상태를 충족해야 한다.

## 11. 리스크와 완화

| 리스크 | 완화 |
|---|---|
| 다양한 선체·리그 요구로 MVP 범위 폭발 | Sloop 단일 프로필/가상 수역 1개/L01–L05 5개 필수 레슨으로 상한을 둔다. |
| Training Sloop의 단순 모델을 실제 특정 선형으로 오해 | 폴라·흘수·조작·안전 가정을 버전 관리하고 디브리프에 표시한다. |
| 한국 연안 명칭이 실제 항해 도구로 오인됨 | 정적 시나리오·단순화·비항법 고지를 의무화한다. |
| 물리 단순화가 잘못된 자신감 유발 | 실제 항해/자격 대체 금지, 도메인 검토, 안전 우선 채점. |
| 점수만 최적화하는 행동 | 관측·판단·조작·안전을 속도와 분리해 채점. |

## 12. 개인용 G1과 미래 public-distribution 의존성

### 12.0 활성 경로 — 개인용 G1 self-review

현재 G1은 `docs/content/personal-use-g1-self-review-record-v1.md`의 **project-owner self-review 및 limitation acknowledgement**로 완료된다. 이는 L01–L05가 `assumption`/draft 상태임을 수락하고 non-navigation/local-only 경계를 유지하는 개인용 checkpoint일 뿐, reviewer credential, independent authority, formal controlled apply, domain validation, registry promotion, certification, 또는 release approval이 아니다.

### 12.1 미래 public-distribution 전용 도메인 검증 레지스터 — 비활성 경로

L01–L05 및 Training Sloop의 물리·안전·채점 가정은 lesson-level **도메인 검증 레지스터**로 관리한다. 각 레코드는 `validation_record_id`, claim 또는 assumption, source 또는 근거 부재 사유, scenario/model/boat profile/contract/coordinate/determinism/comparison-policy version, reviewer, review_date, disposition(`assumption | partially_validated | validated | rejected`)을 가져야 한다.

초기 machine-readable 초안은 [`docs/content/domain-validation-registry.yaml`](docs/content/domain-validation-registry.yaml)에 두며, 레슨 계약 원문은 [`docs/content/mandatory-lessons-l01-l05.md`](docs/content/mandatory-lessons-l01-l05.md)에 둔다.

- 폴라, 대표 세일 구성, 흘수, 수심 여유, reef·돌풍·파도·시정 임계값, 안전 회복 의미, 채점 가중치 및 레슨 통과 기준은 레지스터의 검증 대상이다.
- `validated`가 아닌 가정은 UI·디브리프에서 시뮬레이션 전용 가정으로 취급하며 실제 항해의 안전 수치로 표현하지 않는다.
- 출시 대상 레슨에 `rejected` 또는 미승인 record가 남아 있으면 그 레슨은 출시에서 제외한다. `validated` record라도 위 version binding 중 하나가 missing, `TBD`, draft, unapproved, incompatible이면 출시에서 제외한다. 승인자와 반려 레슨 disposition 방식은 명시적 사용자/운영 결정이 필요하다.

### 12.2 미래 public-distribution 전용 P1 품질·파일럿·릴리스 승인 artifact

다음은 PRD에서 임의 수치를 확정하지 않으며, 출시 전 별도 승인 artifact에 **값·근거·승인 주체·승인일·중단 조건**을 기록해야 한다.

승인 artifact는 `docs/quality/prototype-and-release-gates.md`의 versioned P1 manifest 최소 필드(artifact identity, 대상 범위, evidence, approver/disposition, stale rule, 필요한 rollback/incompatibility reference)를 모두 가져야 하며, 단순 문서 존재만으로 충족되지 않는다.

| 게이트 | 승인 artifact에서 확정할 내용 |
|---|---|
| Browser/support | 지원 브라우저·운영체제 matrix, 최소 viewport/device class, 성능·입력 지연 예산 |
| Accessibility | 목표 준수 수준, 키보드-only 완료, visible focus, non-color 상태 구분, reduced-motion, 상태 라벨 검증 범위 |
| Beginner pilot | 대상자·모집 방식, 이해도/안전/복기 측정, 성공·중단 기준, 승인자 |
| Release operations | rollout/rollback, replay compatibility, 결함 content/model version의 처리 정책 |
| Replay/telemetry privacy | local-only 기본의 보존 범위, 서버 분석을 도입할 경우 동의·보존·삭제·export 정책 |

### 12.3 미래 public-distribution을 제안할 경우의 다음 결정

1. 세일링 코치/강사 등 도메인 검토자의 확보 주체, 승인 일정, 미승인/반려 레슨의 처리 방식
2. 안전 위반별 세션 동작: 즉시 실패, 계속 진행하되 보상 제한, 안전 회복 허용 중 레슨별 선택
3. Browser/accessibility/pilot/release artifact의 구체 수치·승인 주체·일정
4. 장기 서버 기반 코치 리뷰·분석의 도입 여부와 동의·보존·삭제 정책
5. 영종도·덕적도 인근 Post-MVP 시나리오의 콘텐츠 범위·명칭·단순화·출처·공개 승인 정책

## 13. 조사·기획 추적성

- 조사 근거: [`docs/research/benchmark-sources.md`](docs/research/benchmark-sources.md)
- 최초 Alfred 기획: [`.agent/plans/ALF-20260718-2340-sailing-prd/alfred-response.md`](.agent/plans/ALF-20260718-2340-sailing-prd/alfred-response.md)
- 제품 결정 reconciliation: [`.agent/plans/ALF-20260718-2350-sailing-decisions/alfred-response.md`](.agent/plans/ALF-20260718-2350-sailing-decisions/alfred-response.md)
- Hermes의 최초 검토: [`.agent/plans/ALF-20260718-2340-sailing-prd/hermes-review.md`](.agent/plans/ALF-20260718-2340-sailing-prd/hermes-review.md)
- Hermes의 결정 반영 검토: [`.agent/plans/ALF-20260718-2350-sailing-decisions/hermes-review.md`](.agent/plans/ALF-20260718-2350-sailing-decisions/hermes-review.md)
- 3턴 PRD 강화 검토 종합: [`.agent/plans/ALF-20260719-0010-prd-three-turn/turn3-synthesis.md`](.agent/plans/ALF-20260719-0010-prd-three-turn/turn3-synthesis.md)
- 3턴 Alfred 최종 조정: [`.agent/plans/ALF-20260719-0010-prd-three-turn/turn3-alfred/alfred-response.md`](.agent/plans/ALF-20260719-0010-prd-three-turn/turn3-alfred/alfred-response.md)
- L01–L05 콘텐츠 명세: [`docs/content/mandatory-lessons-l01-l05.md`](docs/content/mandatory-lessons-l01-l05.md)
- 도메인 검증 레지스트리 초안: [`docs/content/domain-validation-registry.yaml`](docs/content/domain-validation-registry.yaml)
- 브라우저 MVP 기술 조사: [`docs/research/browser-mvp-technology-sources.md`](docs/research/browser-mvp-technology-sources.md)
- 기술 옵션 비교: [`docs/architecture/technical-options.md`](docs/architecture/technical-options.md)
- MVP 구현 계획: [`docs/architecture/mvp-technical-plan.md`](docs/architecture/mvp-technical-plan.md)
- 좌표·단위·방향 기술 계약: [`docs/contracts/coordinate-contract.md`](docs/contracts/coordinate-contract.md)
- 결정론·replay 기술 계약: [`docs/contracts/determinism-replay-contract.md`](docs/contracts/determinism-replay-contract.md)
- Prototype/release gate 모델: [`docs/quality/prototype-and-release-gates.md`](docs/quality/prototype-and-release-gates.md)
