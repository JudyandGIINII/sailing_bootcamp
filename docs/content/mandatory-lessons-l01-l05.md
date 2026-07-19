# Training Sloop MVP — L01–L05 콘텐츠 명세

> 상태: **Draft v0.1 · 도메인 검증 전**
> 대상: `training-sloop-v1` · 합성 가상 훈련 수역 · 데스크톱 브라우저 MVP
> 권한 경계: 실제 항해·항법·기상·안전 판단·자격 교육을 대체하지 않는다.

## 1. 목적과 범위

이 문서는 PRD §7.2.1의 레슨 계약을 L01–L05에 적용한다. 다섯 레슨 모두 `training-sloop-v1`을 사용하며, 다른 보트 선택·비교, 한국 연안 이름, 실시간 해양 데이터, 실제 항법 조언은 범위 밖이다.

물리 파라미터, 폴라, 흘수, 안전 경계, reef 시점, 조석/파도/시정 효과, 점수 가중치, 통과 기준은 모두 **시뮬레이션 전용 가정**이다. 각 레슨은 `docs/content/domain-validation-registry.yaml`의 validation record가 `validated`가 될 때까지 출시 불가다.

## 2. 공통 계약

### 2.1 공통 버전 참조

| 필드 | 값/정책 |
|---|---|
| `boat_profile_version` | `training-sloop-v1` |
| `contract_version` | `lesson-model-contract-v0-draft`: lesson schema와 model-interface bundle; coordinate/determinism/comparison 세부 정책을 대체하지 않음 |
| `coordinate_contract_version` | `coordinate-contract-v1-draft` — PRD §8.0의 승인 전 가정 계약 |
| `determinism_contract_version` | `determinism-replay-contract-v1-draft` — PRD §8.3 및 input lifecycle 계약 |
| `comparison_policy_version` | `comparison-policy-v1-draft` — golden replay canonical fields/equality-tolerance 구조; 항해 임계값을 승인하지 않음 |
| replay identity | `scenario_version + seed + ordered_input_log + model_version + boat_profile_version + contract_version + coordinate_contract_version + determinism_contract_version + comparison_policy_version` — 모든 필드가 호환되어야 함 |
| 저장 경계 | replay/telemetry는 로컬 브라우저 한정. 서버 전송은 별도 승인 전 금지. 사용자는 replay 목록 조회·개별 삭제가 가능하며 reset은 기존 attempt를 암묵적으로 지우지 않음 |

### 2.2 방향·좌표·결정론 선언

모든 레슨 manifest는 PRD §8.0의 좌표 frame·원점, 각도 0°·회전 방향, wind `from`, current `to`, 거리/속력/시간 단위, 수심 datum, 벡터 합성 순서, 반올림·클램프 정책을 명시적으로 참조한다. 실제 값은 검증 전 가정이며 각 validation record에서 검토한다.

모든 레슨은 PRD §8.3 및 `docs/contracts/determinism-replay-contract.md`에 따라 시간 진행 방식 또는 동등한 입력 순서 식별자, seed/난수 소비 정책, state-update 순서, event tie-break, pause(시뮬레이션 비진행), reset(선언된 초기상태 복원), 비교 대상 state/event/score/debrief 필드를 선언한다. focus-loss/visibility는 scheduler cadence를 즉시 정지하고 explicit resume action 뒤에만 재개되며, key-repeat은 선언된 logical action으로 정규화한다.

identity가 missing/unknown/incompatible이면 레슨은 approximate replay를 하지 않고 stable reason code로 거부한다. 이때 원본 local replay payload는 삭제하거나 변경하지 않는다.

### 2.3 공통 점수·안전 불변식

- 점수는 관측, 판단, 조작 안정성, 시뮬레이션 안전, 목표 달성을 분리한다.
- 속도·진행·최종 위치는 시뮬레이션 안전 위반을 상쇄하지 못한다.
- 모든 점수 변화는 환경 상태와 사용자 행동 이벤트를 참조한다.
- 회복은 최초 위험 이벤트를 삭제하지 않는다. 동일 원인·상태가 해소되기 전의 중복 평가는 금지한다.
- 세션 종료/계속/회복은 레슨별 `pass/fail/safe_recovery` 의미와 검증 상태에 따른다. 공통 hard-block 동작을 가정하지 않는다.

## 3. 레슨 계약

### L01 — 상대풍과 침로

| 필드 | 명세 |
|---|---|
| `lesson_id` | `L01` |
| `scenario_version` | `l01-scenario-v0-draft` |
| `validation_record_id` | `VR-L01-v0` |
| `initial_state` | `training-sloop-v1`, 목표 침로, steady-wind 합성 fixture. 비초점 환경 효과는 중립화하거나 manifest에 선언한다. |
| `required_observations` | true-wind `from`, apparent-wind 상태, heading, COG, 목표 침로와의 관계, 보트 반응. |
| `permitted_actions` | helm, pause, reset. 지원하지 않는 세일 조작은 숨기거나 비활성화한다. |
| `checkpoints` | 진풍/상대풍/침로 신호 구분 → 관측에 근거한 helm 보정 → manifest의 침로 유지 상태 도달 → 디브리프에서 인과 설명. |
| `pass_semantics` | 모든 체크포인트를 완료하고 미해결 시뮬레이션 경계 이벤트가 없다. |
| `fail_semantics` | 필수 관측 누락, 목표 미달, 또는 선언된 terminal boundary 통과. 속도는 보상 근거가 될 수 없다. |
| `safe_recovery_semantics` | terminal boundary 전에는 helm 보정으로 목표 상태 회복이 가능하며, deviation은 기록·디브리프에 남는다. |
| `hint_and_debrief` | true/apparent wind와 heading/COG를 비교한 뒤 보정을 제안하고, 행동 전후 상태와 결과를 연결한다. |
| `retry_comparison` | heading/COG 궤적, 보정 순서, 체크포인트 결과, 경계 이벤트, 점수 원인. |
| `failure_or_boundary_acceptance` | 회복된 deviation의 통과 여부와 terminality는 `VR-L01-v0` 검증 전 가정이다. |

### L02 — 메인·지브 트림

| 필드 | 명세 |
|---|---|
| `lesson_id` | `L02` |
| `scenario_version` | `l02-scenario-v0-draft` |
| `validation_record_id` | `VR-L02-v0` |
| `initial_state` | steady-wind 합성 fixture, 선언된 main/jib 초기 trim, 침로 목표, `training-sloop-v1`. |
| `required_observations` | apparent-wind angle, 선언된 세일/trim feedback, main/jib sheet 상태, 속력 반응, 조타 안정성. |
| `permitted_actions` | main sheet, jib sheet, 침로 유지를 위한 helm, pause, reset. |
| `checkpoints` | 초기 trim 상태 식별 → 설명 가능한 main/jib 조정 → manifest의 stable-trim 상태 도달 → trim·속력·안정성 인과 설명. |
| `pass_semantics` | 관측과 의도적 trim 조정이 검증된 stable 상태에 도달하며 미해결 시뮬레이션 안전 이벤트가 없다. |
| `fail_semantics` | 설명 가능한 trim 반응 부재, 지속적인 불안정 상태, 또는 terminal boundary 통과. 최고 속도만으로 통과하지 않는다. |
| `safe_recovery_semantics` | 컨트롤을 manifest의 회복 가능 상태 쪽으로 되돌린 뒤 재트림할 수 있으며, 이전 불안정 상태는 기록된다. |
| `hint_and_debrief` | 숨은 정답 trim 값을 표시하지 않고, 어느 세일/컨트롤 상태가 반응을 만들었는지 설명한다. |
| `retry_comparison` | sheet 입력, apparent-wind 상태, 속력/안정성 궤적, 안전 이벤트, 인과 점수 변화. |
| `failure_or_boundary_acceptance` | 더 느리더라도 안전을 보존한 trim은 낮은 속도만으로 실패하지 않는다. trim 계수와 acceptance predicate는 `VR-L02-v0` 검증 대상이다. |

### L03 — 돌풍·파도·Reef 대응

| 필드 | 명세 |
|---|---|
| `lesson_id` | `L03` |
| `scenario_version` | `l03-scenario-v0-draft` |
| `validation_record_id` | `VR-L03-v0` |
| `initial_state` | 선언된 risk checkpoint 이전에 시작하는 결정론적 gust/wave episode, versioned pre-mitigation sail 상태, `training-sloop-v1`. |
| `required_observations` | gust/wave cue, apparent-wind, sail/reef 상태, 선언된 control/safety-state indicator. |
| `permitted_actions` | helm, 선언된 main/jib controls, 선언된 reef 또는 sail-reduction action, pause, reset. |
| `checkpoints` | 위험 episode 관측 → 설명 가능한 mitigation 선택 → sail reduction 및/또는 안전 우선 steering 수행 → 선언된 post-episode controlled state 도달. |
| `pass_semantics` | 시기 적절한 관측과 mitigation이 검증된 체크포인트를 충족한다. 보수적인 조기 mitigation은 통과 가능하다. |
| `fail_semantics` | 위험 무시, mitigation 생략, 선언된 terminal boundary 통과. 속도/진행은 보상할 수 없다. |
| `safe_recovery_semantics` | recoverable episode에서는 sail reduction과 steering으로 scenario-safe 상태에 복귀할 수 있다. validated terminal boundary 이후에는 시도가 종료된다. |
| `hint_and_debrief` | gust/wave 상태, sail configuration, control action, outcome을 연결하되 reef timing을 실제 안전 조언처럼 표현하지 않는다. |
| `retry_comparison` | 위험 관측 순서, reef/control 이벤트, 상태 궤적, boundary event, 안전 우선 점수 구성요소. |
| `failure_or_boundary_acceptance` | gust/wave/reef 경계, terminality, recovery predicate는 `VR-L03-v0`의 검증 전 가정이다. |

### L04 — 조류 보정

| 필드 | 명세 |
|---|---|
| `lesson_id` | `L04` |
| `scenario_version` | `l04-scenario-v0-draft` |
| `validation_record_id` | `VR-L04-v0` |
| `initial_state` | 합성 non-zero current `to` vector, 선언된 mark, steady-wind 보조 상태, `training-sloop-v1`. |
| `required_observations` | current direction/speed, heading/COG, STW/SOG, drift trail, mark와의 관계. |
| `permitted_actions` | helm, exercise state 유지에 필요한 선언된 sail controls, pause, reset. |
| `checkpoints` | heading/COG 및 STW/SOG 차이 식별 → 설명 가능한 보정 판단 → 보정 실행 → versioned mark-acceptance 상태 도달. |
| `pass_semantics` | 조류 해석과 보정을 보이며 mark-acceptance 상태에 도달하고 미해결 경계 이벤트가 없다. |
| `fail_semantics` | 조류를 고려하지 않음, 목표 미달, terminal boundary 통과. |
| `safe_recovery_semantics` | 시나리오가 miss를 recoverable로 표시한 경우 벡터 관계를 다시 관측하고 mark에 재접근할 수 있으며 miss는 기록된다. |
| `hint_and_debrief` | current `to` vector 합성과 drift 결과를 설명하며 실제 bearing을 처방하지 않는다. |
| `retry_comparison` | heading/COG·STW/SOG 궤적, 보정 입력, drift, mark 결과, boundary event, 점수 원인. |
| `failure_or_boundary_acceptance` | 더 느린 유효 보정은 통과 가능하다. vector/mark/boundary/mastery predicate는 `VR-L04-v0` 검증 대상이다. |

### L05 — 조석·수심·시정 판단

| 필드 | 명세 |
|---|---|
| `lesson_id` | `L05` |
| `scenario_version` | `l05-scenario-v0-draft` |
| `validation_record_id` | `VR-L05-v0` |
| `initial_state` | 합성 tide/depth/visibility timeline, decision gate, virtual shallow-water boundary, `training-sloop-v1` draft reference. |
| `required_observations` | 합성 tide state, scenario depth, depth datum, 선언된 draft/clearance 상태, visibility, route state. |
| `permitted_actions` | pass/wait/return 선택, 선언된 helm/sail controls, pause, reset. |
| `checkpoints` | 필수 환경·보트 상태 관측 → boundary 전 판단 → pass/wait/return 결과 실행 → simulation policy에 근거한 설명. |
| `pass_semantics` | 시나리오가 허용한 안전 우선 선택은 통과할 수 있다. transit·속력·진행 자체는 통과 조건이 아니다. |
| `fail_semantics` | 필수 관측 없이 진행하거나 선언된 terminal boundary 통과. 다른 점수로 상쇄할 수 없다. |
| `safe_recovery_semantics` | terminal boundary 전 wait 또는 return은 통과 가능하다. 이후 terminality는 검증 게이트를 따른다. |
| `hint_and_debrief` | tide/depth/draft/visibility 가정과 판단 결과를 보여주며 ‘실제 항법 조언이 아님’을 명시한다. |
| `retry_comparison` | 관측 완전성, 판단 시점/종류, 합성 clearance/visibility event, route trajectory, 점수 원인. |
| `failure_or_boundary_acceptance` | wait/return은 올바른 결과가 될 수 있다. clearance/visibility/decision/terminality 의미는 `VR-L05-v0` 검증 대상이다. |

## 4. PRD 추적성과 출시 상태

| PRD 항목 | 이 문서의 대응 |
|---|---|
| §7.2/§7.2.1 | L01–L05 콘텐츠 manifest와 필수 계약 필드 |
| §7.3 | 안전 비상쇄, 인과 점수, recovery 기록 |
| §8.0 | 좌표·단위·방향 contract 선언 |
| §8.3 | full replay identity·pause/reset·input lifecycle·비교 정책 |
| §10 | local-only replay/telemetry, local lifecycle와 P1 품질 게이트 참조 |
| §12.1 | `VR-L01-v0`~`VR-L05-v0` 도메인 검증 레코드 |
| §12.2 | browser/accessibility/pilot/release/privacy 승인 artifact 미승인 상태 |

### 출시 상태

모든 레슨의 초기 validation record disposition은 `assumption`이고 version binding은 draft다. 따라서 L01–L05는 현재 **문서화된 콘텐츠 초안이며 출시 불가**다. `validated` 전환에는 scenario/model/profile/contract/coordinate/determinism/comparison-policy의 concrete approved binding이 모두 필요하다. 이 중 하나라도 변경되면 해당 record의 승인을 재사용하지 않는다.
