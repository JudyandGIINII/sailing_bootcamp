# Determinism & Replay Contract v1 — Prototype Draft

> 상태: **기술 계약 초안**. 비교 tolerance와 실제 물리 계수는 implementation bootstrap에서 versioned policy로 고정하며, 본문에서 발명하지 않는다.

## replay identity

```text
scenario_version + seed + ordered_input_log + model_version + boat_profile_version + contract_version + coordinate_contract_version + determinism_contract_version + comparison_policy_version
```

identity 중 하나라도 unknown, missing, incompatible이면 approximate replay를 하지 않고 `unsupported replay`로 보고한다.

## state progression

1. simulation은 renderer와 분리된 fixed logical tick으로 진행한다. prototype bootstrap은 `tick_rate_hz`를 단 하나의 versioned config 값으로 lock하고 golden replay fixture에 기록한다.
2. input은 browser timestamp가 아니라 `logical_tick`과 tick 내 monotonic `sequence`로 저장한다.
3. 같은 tick의 input은 `sequence` 오름차순으로 처리한다. sequence 충돌은 contract violation이다.
4. RNG는 named, seeded, versioned algorithm을 사용하며 state transition 밖에서 소비하지 않는다. algorithm/seed/consumption policy는 model 또는 determinism version에 기록한다.
5. state update, environmental schedule, input application, event emission, scoring ledger 기록의 순서는 contract에 고정한다. 동시 event tie-break도 명시한다.

## pause / reset / retry

- `pause`: tick, RNG, state, event, score가 전혀 진행하지 않는다.
- `reset`: 선언된 initial state와 seed로 새 attempt를 시작한다. 이전 attempt를 보존한다면 local metadata로 명시한다.
- `retry`: 같은 replay identity로 실행하며 비교 대상은 state/event/score/debrief canonical fields다.
- 속도 조절: scheduler cadence만 바꿀 수 있고 logical tick step/규칙/입력 순서를 바꿀 수 없다.

## canonical outputs

golden replay는 versioned comparison policy가 선언한 canonical state trajectory, immutable causal events, score components, debrief facts를 비교한다. renderer pixels, browser timestamps, IndexedDB ordering은 canonical output이 아니다.

## verification

- 동일 identity/input → 동일 canonical outputs
- irregular render cadence / renderer absent / multi-render-per-tick → 동일 canonical outputs
- pause non-progression, reset restoration, input sequence tie-break, seeded RNG consumption
- unknown schema/version은 load/replay 거부
- golden replay fixture 갱신은 contract/version review를 요구
