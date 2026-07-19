# Determinism & Replay Contract v1 — Prototype Draft

> 상태: **기술 계약 초안**. 비교 대상·동일성 정책은 `comparison-policy-v1-draft`로 명시하며, 비교 tolerance와 실제 물리 계수는 implementation bootstrap의 versioned policy로 고정한다. 본문에서 항해 수치·임계값을 발명하지 않는다.

## replay identity

```text
scenario_version + seed + ordered_input_log + model_version + boat_profile_version + contract_version + coordinate_contract_version + determinism_contract_version + comparison_policy_version
```

위 문자열은 **유일한 canonical replay identity**다. PRD, lesson manifest, registry, load gate가 이 필드 중 일부만으로 replay 호환성을 판정해서는 안 된다.

여기서 `contract_version`은 lesson contract schema와 model-interface bundle의 버전이다. coordinate, determinism, comparison의 세부 정책은 각각 `coordinate_contract_version`, `determinism_contract_version`, `comparison_policy_version`에만 귀속하며, `contract_version`으로 대체하거나 중복 판정하지 않는다.

identity 중 하나라도 unknown, missing, incompatible이면 approximate replay를 하지 않고 `unsupported replay`로 보고한다. 구현은 payload나 기존 local record를 삭제·변형하지 않으며, 실행 결과를 표시하지 않는 stable reason code(예: `UNSUPPORTED_REPLAY_VERSION`)와 비민감 호환 불가 사유만 표시한다.

## state progression

1. simulation은 renderer와 분리된 fixed logical tick으로 진행한다. prototype bootstrap은 `tick_rate_hz`를 `determinism_contract_version`에 귀속된 단 하나의 versioned config 값으로 lock하고 golden replay fixture에 기록한다. `tick_rate_hz` 변경은 determinism contract compatibility를 변경한다.
2. input은 browser timestamp가 아니라 `logical_tick`과 tick 내 monotonic `sequence`로 저장한다.
3. 같은 tick의 input은 `sequence` 오름차순으로 처리한다. sequence 충돌은 contract violation이다.
4. RNG는 named, seeded, versioned algorithm을 사용하며 state transition 밖에서 소비하지 않는다. algorithm/seed/consumption policy는 model 또는 determinism version에 기록한다.
5. state update, environmental schedule, input application, event emission, scoring ledger 기록의 순서는 contract에 고정한다. 동시 event tie-break도 명시한다.

## input lifecycle policy

browser focus, visibility, key-repeat은 wall-clock 신호이며 canonical simulation input이 아니다. prototype v1의 policy는 다음과 같다.

1. focus loss 또는 document hidden을 받으면 scheduler cadence를 즉시 정지한다. 이후 logical tick을 추가로 진행해 pause 경계에 도달시키지 않으며, tick/RNG/state/event/score는 명시적 resume 전까지 전혀 진행하지 않는다.
2. pause 원인은 마지막으로 완료된 logical tick과 다음 monotonic sequence를 가진 versioned lifecycle record로 남긴다. renderer나 browser timestamp에서 state progression을 사후 추론하지 않는다.
3. resume은 명시적인 사용자 resume action 뒤에만 가능하다. focus 복귀만으로 자동 resume하지 않는다.
4. key-repeat은 manifest가 허용한 discrete logical action으로 정규화하고, browser repeat 횟수·간격은 authoritative하지 않다. unsupported/ambiguous repeat은 load 또는 input validation에서 거부한다.

## pause / reset / retry

- `pause`: tick, RNG, state, event, score가 전혀 진행하지 않는다.
- `reset`: 선언된 initial state와 seed로 새 attempt를 시작한다. 이전 attempt를 보존한다면 local metadata로 명시한다.
- `retry`: 같은 replay identity로 실행하며 비교 대상은 state/event/score/debrief canonical fields다.
- 속도 조절: scheduler cadence만 바꿀 수 있고 logical tick step/규칙/입력 순서를 바꿀 수 없다.

## local replay lifecycle

- replay/telemetry는 local browser storage만 사용하며 서버 전송·계정 연동·analytics SDK는 별도 승인 전 금지한다.
- 사용자는 local replay 목록을 확인하고 개별 record를 삭제할 수 있어야 한다. `reset`은 현재 attempt를 새로 시작할 뿐, 이전 attempt record를 암묵적으로 삭제하지 않는다.
- IndexedDB quota/corruption/unsupported schema 오류는 fail-closed 하며, 오류 처리 중 마지막으로 읽을 수 있던 record를 덮어쓰거나 compatibility를 추정하지 않는다.

## comparison policy

- prototype은 `comparison-policy-v1-draft`를 사용한다. 이 draft는 golden replay에서 비교할 canonical state trajectory, immutable event ledger, score components, debrief facts 및 equality/tolerance policy의 **구조**를 versioned하게 고정한다.
- 이 draft는 sailing safety threshold, polar, 실제 항법 판단을 승인하거나 주장하지 않는다. 그런 도메인 값은 validation registry와 승인된 model/lesson contract가 별도로 바인딩해야 한다.
- release 대상 `validated` record는 draft가 아닌 approved comparison policy version을 명시해야 한다.

## canonical outputs

golden replay는 versioned comparison policy가 선언한 canonical state trajectory, immutable causal events, score components, debrief facts를 비교한다. renderer pixels, browser timestamps, IndexedDB ordering은 canonical output이 아니다.

## verification

- 동일 identity/input → 동일 canonical outputs
- irregular render cadence / renderer absent / multi-render-per-tick → 동일 canonical outputs
- pause non-progression, reset restoration, input sequence tie-break, seeded RNG consumption
- focus-loss/visibility pause, explicit resume, key-repeat normalization이 renderer cadence와 무관한지
- `src/sim`의 `Date.now`, `performance.now`, `Math.random`, DOM/Pixi/storage/network import 금지 static boundary check
- unknown schema/version은 load/replay 거부
- unsupported replay에서 stable reason code, no canonical output, local payload preservation
- golden replay fixture 갱신은 contract/version review를 요구
