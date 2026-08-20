# Total-points scoring — design

> 작성: `2026-08-20 KST`
> 대상 PRD 절: §7.3 점수 철학, FR-07
> 시작 지점: `main` = `0254372`

## 1. 무엇을 만드는가

PRD §7.3이 요구하는 다섯 구성요소 총점을 L04에서 실제로 계산한다. 지금
`ScoreProjection.total_points`는 타입이 리터럴 `0`으로 고정되어 있고, 어떤 경로에서도
0이 아닌 값이 나오지 않는다.

이번 사이클의 결과물은 **L04에서 0이 아닌 `total_points`**, 그리고 그 점수가 어떤
ledger 이벤트에서 나왔는지 추적 가능한 구성요소 분해다.

## 2. 확정된 결정

| 결정 | 내용 | 근거 |
|---|---|---|
| 점수의 성격 | **선언적 합성 점수.** 0이 아닌 값을 내되 `declared_synthetic_unvalidated` 상태와 경계 문구를 함께 낸다 | 폴라·조류·수심 상수가 전부 `disposition: assumption` |
| 범위 | **L04 파일럿.** 나머지 레슨은 구성요소를 `declared-unavailable`로 선언 | 폴라 모델을 L04로 먼저 검증했던 기존 패턴 |
| 관측 구성요소 | **이번 사이클 미적용 선언.** L04에는 관측 기록 자체가 없다 | 아래 §4 참조 |
| 안전 반영 방식 | **감점이 아니라 상한(cap).** | §7.3 "속도·점수·진행 보상이 안전 위반을 상쇄하지 않는다" |
| 저장 위치 | 세션 상태에 저장하지 않는다. `(raw, ledger)` 위의 순수 projection | 새 시뮬레이션 상태 금지 |

## 3. 왜 감점이 아니라 상한인가

이것이 이 설계에서 유일하게 자명하지 않은 선택이다.

감점은 **상쇄가 가능하다.** 다른 구성요소에서 충분히 벌면 danger 통과가 씻겨 나간다.
§7.3은 이를 명시적으로 금지한다. 상한은 상쇄가 불가능하다 — danger episode가 하나라도
기록되면 나머지 구성요소가 만점이어도 총점은 상한 아래로 잠긴다.

안전 회복 행동은 상한을 **복구하지 않는다.** 다만 현재 모델은 회복 자체를 기록하지
않으므로, 이번 draft에서는 계약이 이를 "미표현"으로 선언한다 — §6 참조.

## 4. 관측 구성요소를 미적용으로 두는 이유

L04 매니페스트는 `checkpoints: ['identify_declared_vector_difference', 'record_correction',
'reach_declared_mark_acceptance']`를 선언하지만, **이 이름들은 어디에서도 방출되지
않는다.** `src/content/l02-l05.ts:134` 바깥에는 참조가 없다. 실제로 기록되는 것은
helm correction, mark arrival, clearance crossing, accepted action 넷뿐이다.

따라서 관측 점수의 근거가 될 이벤트가 존재하지 않는다. 조작 데이터에서 "관측했을
것"을 추론하는 것은 하지 않는다 — 기록되지 않은 사용자 행동을 주장하는 것이기 때문이다.
L02·L03에는 acknowledgment 기록 관용구가 이미 있으므로, L04에 관측 확인 액션을 추가하는
것은 가능하지만 새 시뮬레이션 상태와 fixture 재생성을 수반하므로 **별도 사이클**로 남긴다.

## 5. 구성요소와 근거 이벤트 (L04)

| 구성요소 | 근거 (기존 ledger 이벤트) | L04 |
|---|---|---|
| 관측 observation | 없음 | `declared-unavailable` |
| 판단 judgment | `LESSON_CHECKPOINT` cause `declared helm correction recorded` | 채점 |
| 조작 안정성 control_stability | `ACTION_ACCEPTED` 중 `helm_port`/`helm_starboard` 순서열 | 채점 |
| 안전 safety | `ENVIRONMENT_EPISODE` clearance crossing + `SAFETY_BLOCKED` | 채점 |
| 목표 달성 goal | `LESSON_CHECKPOINT` cause `synthetic declared mark arrival recorded` | 채점 |

전부 **이미 기록되는** 이벤트다. 새로 방출할 이벤트는 없다.

## 6. 채점 계약 (선언값)

`src/scoring/score-contract.ts`에 상수로 선언한다. 모두 지어낸 교육용 값이며 실제 항해
평가 기준이 아니다.

```
SCORE_CONTRACT_VERSION = 'score-contract-v0-draft'

구성요소별 배점 (적용되는 것만)
  judgment          25
  control_stability 25
  safety            25
  goal              25
  observation       미적용 (분모에서 제외)

안전 상한 (points_possible 대비 비율)
  clear    상한 없음
  caution  0.70
  danger   0.40
  SAFETY_BLOCKED  0.00 + status 'blocked_by_safety_contract'
```

`points_possible`은 **적용되는 구성요소만** 합산한다. L04는 관측이 미적용이므로 100이
아니라 **100**이다. (25점짜리 구성요소 다섯 개 = 125, 관측 25를 뺀 값) 미적용을 0점으로 처리하면 "못했다"로 읽히므로 분모에서 뺀다.

### 구성요소별 산식 (전부 정수)

- **judgment** — 기록된 helm correction checkpoint 1개당 **10점**, 25에서 포화
  (3개 이상이면 25). 같은 tick·cause 중복은 하나로 센다.
- **control_stability** — 25에서 helm 방향 전환(reversal) 1회당 **5점** 차감, 하한 0
  (5회 이상이면 0). 과조타·진동을 불안정으로 본다.
- **safety** — clearance crossing 없으면 **25**, caution 기록 시 **12**, danger 기록 시
  **0**. 가장 심각한 기록 하나만 본다.
- **goal** — mark arrival 기록 시 **25**, 아니면 **0**.

### 반올림

모든 배점과 차감은 정수다. 상한 적용 결과만 분수가 될 수 있으므로
`Math.floor`로 정수화한다 (예: `0.70 × 100 = 70`). 부동소수 비교가 골든
픽스처에 들어가지 않도록 `total_points`는 항상 정수로 저장한다.

### safety 구성요소와 상한이 함께 있는 것은 의도적이다

safety는 구성요소 점수(25점)이면서 동시에 총점 상한으로도 작용한다. 이중 계상처럼
보이지만 역할이 다르다. 구성요소는 안전하게 유지한 것을 **보상**하고, 상한은 다른
구성요소가 안전 위반을 **상쇄하지 못하게** 막는다. 두 장치 모두 실제로 구속력이 있다:
danger 세션의 최대 획득 가능 점수는 75점이지만 상한은 40점이므로 상한이 더 강하게
작동한다.

### 안전 회복은 이번 draft에서 표현하지 않는다

§7.3은 채점 계약이 안전 회복 행동의 별도 설명을 **선언할 것**을 요구한다. 현재 모델은
회복을 기록하지 않는다 — `shouldRecordClearanceCrossing`은 심각도가 **올라갈 때만**
기록하므로, 덜 심각한 상태로 돌아오는 전이에 해당하는 이벤트가 존재하지 않는다.
따라서 계약은 회복을 "이 draft에서 미표현"으로 선언한다. 관측과 같은 이유이며,
기록되지 않은 것을 점수로 주장하지 않는다.

### 중복 평가 방지

§7.3의 "동일 원인·상태가 해소되기 전의 중복 평가 방지"는 **새로 만들지 않는다.**
`src/sim/depth-clearance.ts`의 `shouldRecordClearanceCrossing`이 이미 심각도가 올라갈
때만 기록하므로, 각 심각도는 세션당 한 번만 계상된다. 이 의미를 그대로 재사용한다.

## 7. 아키텍처

순수 모듈 둘 + 기존 projection 합성. 렌더러 사이클과 같은 형태다.

- `src/scoring/score-contract.ts` — 선언 상수와 타입만. 로직 없음.
- `src/scoring/components.ts` — `(raw, ledger) → ScoreComponent[]`. 순수.
- `src/scoring/projection.ts` — 기존 `projectScore`가 위 둘을 합성하고 상한을 적용.

두 새 모듈은 `Date.now`, `Math.random`, `window`, `document`, `fetch` 등을 쓰지 않는다.

### 타입 변경

```ts
export type ScoreComponentKey =
  | 'observation' | 'judgment' | 'control_stability' | 'safety' | 'goal';

export interface ScoreComponent {
  readonly key: ScoreComponentKey;
  readonly status: 'scored' | 'declared-unavailable';
  readonly points: number;
  readonly points_possible: number;
  readonly causal_event_ids: readonly string[];
}

export interface ScoreProjection {
  status: 'unavailable_pending_validation' | 'blocked_by_safety_contract'
        | 'draft_causal_checkpoint_recorded' | 'declared_synthetic_unvalidated';
  safety: 'clear' | 'blocked';
  total_points: number;              // 리터럴 0 → number
  causal_event_ids: readonly string[];
  components?: readonly ScoreComponent[];   // 선택 — L04에서만 채움
  points_possible?: number;                 // 선택 — L04에서만 채움
  safety_cap?: Readonly<{ level: 'caution' | 'danger'; ratio: number; causal_event_ids: readonly string[] }>;
}
```

**`components`·`points_possible`·`safety_cap`·`safety_recovery`는 선택 필드이며 L04
경로에서만 채운다.** 지난 사이클의 기록된 교훈을 그대로 적용한 것이다: 공유 객체에 값
있는 키를 더하면 모든 골든 픽스처의 `toEqual`이 깨진다.

## 8. 픽스처 영향 — 이번엔 변경된다

렌더러 사이클과 달리 **`tests/fixtures/l04-score-debrief-golden.json`은 반드시 바뀐다.**
이 파일들은 `score` 블록에 `total_points`를 담고 있고, 채점이 바로 그것을 바꾸는 작업이기
때문이다.

- 바뀌는 것: `l04-score-debrief-golden.json` 하나
- 바뀌면 안 되는 것: `l01-`, `l02-`, `l03-`, `l05-score-debrief-golden.json` 및 모든
  `*-raw-golden.json` — 선택 필드 설계가 이를 보장한다

각 태스크 종료 시 `git diff --name-only tests/fixtures/`는 **`l04-score-debrief-golden.json`
단 한 줄**이어야 한다. 다른 파일이 나오면 선택 필드 설계가 새는 것이므로 멈춘다.

## 9. 경계 문구

총점이 보이는 모든 곳에 다음 취지를 함께 낸다:

> 합성 교육용 점수이며 미검증입니다 — 실제 항해 실력·자격·안전 평가가 아닙니다.

`VR-POLAR-v0`가 `disposition: assumption`인 한 이 문구는 제거하지 않는다. 점수를
계산한다는 것이 그 값을 검증했다는 뜻은 아니다.

## 10. 접근성

총점과 구성요소 분해는 텍스트로 제공하며, 색만으로 안전 상한 적용 여부를 구분하지
않는다. 상한이 걸렸다는 사실은 문구로 명시한다.

## 11. 범위 밖

L01·L02·L03·L05·L06 채점, 관측 확인 액션 추가, 점수 기반 등급·합격 판정, 리더보드,
세션 간 비교, 실제 항해 평가 기준과의 대응.

## 12. 완료 기준

- L04 세션에서 `total_points`가 0이 아닌 값으로 나온다
- 각 구성요소가 자신의 `causal_event_ids`를 갖는다 (FR-07)
- danger episode가 기록된 세션은 다른 구성요소가 만점이어도 총점이 상한 아래로 잠긴다
- 나머지 레슨의 `total_points`는 0이고 구성요소는 `declared-unavailable`
- `git diff --name-only tests/fixtures/`가 `l04-score-debrief-golden.json` 하나만 출력
- `npm run typecheck`, `npm test`, `npm run build`, `npm run test:smoke` 전부 통과
