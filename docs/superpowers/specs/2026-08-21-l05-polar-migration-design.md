# L05 polar migration and scoring — design

> 작성: `2026-08-21 KST`
> 대상 PRD 절: §8.1 조석 행, §8.2 폴라, §7.3 점수, FR-04, FR-05
> 시작 지점: `main` = `b34219b`

## 1. 무엇을 만드는가

L05를 레거시 고정속도 모델(`training-sloop-model-v0-draft`)에서 폴라 모델
(`polar-kinematics-v5`)로 이행하고, 이미 만들어둔 채점 계약을 L05까지 확장한다.

결과물은 두 가지다. **L05의 수심·여유 관측이 선언적 미가용에서 실제 계산값으로 바뀌고**,
**L05가 0점이 아닌 총점을 갖는다.**

## 2. 왜 L05가 다음인가

이행 비용을 실측했다. `ReplayBindings` 참조 수:

| 레슨 | 참조 수 | 판단 |
|---|---|---|
| **L05** | **3** | 가장 저렴 |
| L03 | 11 | 중간 |
| L02 | 16 | 중간 |
| L01 | 89 | 이행 포기된 이유가 확인됨 |

비용이 가장 낮으면서 주제도 가장 잘 맞는다. L05 매니페스트는 이미
`synthetic_tide_state`와 `synthetic_depth_datum`을 선언하고 있고 `scenario_depth`는
`declared_unavailable`로 비어 있다. L05는 조석·수심 판단 레슨인데 정작 수심이 없다.
폴라 모델은 under-keel clearance를 이미 계산한다.

## 3. 확정된 결정

| 결정 | 내용 |
|---|---|
| 범위 | **이행 + 채점.** 결정(pass/wait/return)은 기록 전용으로 유지 |
| 판단 구성요소 | **L05는 decision checkpoint에서 채점.** helm correction이 아니다 |
| 목표 구성요소 | **미적용 선언.** L05에는 마크가 없다 |
| 관측 구성요소 | **미적용 선언.** 여전히 관측을 기록하는 것이 없다 |
| 결정의 결과 | 이번 사이클에서는 시뮬레이션에 영향을 주지 않는다 |

## 4. 판단 구성요소를 결정 기록에서 뽑는 이유

이것이 이 사이클에서 가장 의미 있는 부분이다.

L04에서 판단은 helm correction 체크포인트로 근사했다. 그것은 사실 **조작 입력**이며,
판단이라는 이름을 빌려 쓴 것에 가깝다. L05는 다르다. `synthetic pass/wait/return
decision recorded` 체크포인트는 사용자가 내린 **실제 판단 기록**이다.

따라서 L05의 판단 점수는 decision checkpoint를 센다. 같은 구성요소가 레슨마다 다른
증거를 읽는 것은 회피가 아니라 정확성이다 — 각 레슨이 실제로 기록하는 것을 읽는다.

## 5. 목표 구성요소를 미적용으로 두는 이유

L05 매니페스트의 `pass_semantics`는 "declared conservative pass, wait, or return may be
accepted; **transit is not mastery**"라고 말한다. 즉 통과 자체가 목표가 아니다. 단일
"목표 달성" 이벤트가 존재하지 않으므로 지어내지 않는다. L06과 같은 이유(마크 없음)다.

## 6. 이행 대상 (5곳 + 바인딩)

| 위치 | 변경 |
|---|---|
| `l05Manifest.model_version` | `common` 상속(레거시) → `POLAR_KINEMATICS_MODEL_VERSION` |
| `l05ReplayBindings` | `polar_kinematics_environment: polarKinematicsEnvironmentV1` 추가 (L04와 동일) |
| `polarProfile()` `src/sim/session.ts:318` | `l05-` 허용 |
| `polarLessonTag()` `src/sim/session.ts:405` | `l05-` → `'L05'`, 반환 타입 확장 |
| `createSession` L05 분기 `src/sim/session.ts:253` | L04 분기처럼 폴라 상태 초기화. **`decision_state: 'undecided'`와 `synthetic_environment`는 유지** |

### replay identity는 자동으로 따라온다

`identityFieldsFor`는 레슨 목록이 아니라 `model_version === POLAR_KINEMATICS_MODEL_VERSION`
으로 분기한다(`src/contracts/replay.ts:180`). 따라서 매니페스트가 폴라 모델을 선언하는
순간 identity 필드 집합이 자동으로 폴라 집합이 된다. **L04 이행 때 replay를 통째로
망가뜨렸던 흩어진 키 집합 문제가 이번에는 해당되지 않는다.** 다만 `resolveReplayV2`와
`isReplayV2Shape` 경로는 테스트로 확인한다.

## 7. 관측 상태 변화

| 관측 | 이전 | 이후 | 근거 |
|---|---|---|---|
| `scenario_depth` | `declared_unavailable` | `declared_synthetic` | 폴라 환경의 `seabed_depth_m` |
| `declared_clearance` | `declared_unavailable` | `declared_synthetic` | `deriveSyntheticClearanceM` |
| `synthetic_tide_state` | `declared_synthetic` | 그대로 | 이미 선언됨 |
| `visibility` | `declared_unavailable` | **그대로** | 모델 없음 |
| `route_state` | `declared_unavailable` | **그대로** | 모델 없음 |

계산되지 않는 것을 선언하지 않는다. 시정·경로는 PRD §8.1 모델이 없으므로 그대로 둔다.

## 8. 채점 구조 일반화

`computeL04Components`는 한 레슨에 고정되어 있다. 두 번째 레슨이 생기므로 일반화한다.

- `score-contract.ts`에 레슨별 적용 구성요소와 판단 증거 종류를 선언하는 표를 둔다.
- `components.ts`는 `computeComponents(raw, ledger)`로 바꾸고 `raw.lesson_id`로 분기한다.
- 거의 같은 함수를 하나 더 만드는 것보다 낫고, 나중에 L06을 붙일 때 표에 한 줄이면 된다.

### L05 구성요소

| 구성요소 | L05 | 근거 |
|---|---|---|
| 관측 observation | 미적용 | 관측 기록 없음 |
| 판단 judgment | 채점 | `LESSON_CHECKPOINT` cause `synthetic ... decision recorded` |
| 조작 안정성 control_stability | 채점 | `ACTION_ACCEPTED` helm 순서열 |
| 안전 safety | 채점 | clearance crossing |
| 목표 goal | 미적용 | 마크 없음 |

`points_possible` = **75** (25 × 3).

## 9. 픽스처 영향 — 이번엔 두 개가 바뀐다

지난 사이클과 달리 한 파일로 가둘 수 없다. L05의 raw 상태 형태 자체가 바뀌기 때문이다.

**반드시 바뀌는 것:**
- `tests/fixtures/l05-raw-golden.json` — `identity.model_version`이 바뀌고
  `identity.polar_kinematics_environment`가 추가되며, `expected.raw`가 폴라 상태 필드를
  얻고 `expected.ledger`가 `POLAR_KINEMATIC_TRANSITION`을 얻는다
- `tests/fixtures/l05-score-debrief-golden.json` — 점수가 0에서 바뀌고
  `debrief_fact_kinds`에 `synthetic_transition`이 추가된다

**바뀌면 안 되는 것:** `l01-`, `l02-`, `l03-`, `l04-` 로 시작하는 모든 픽스처.
다른 파일이 나오면 이행이 새는 것이므로 멈춘다.

`l05-raw-golden.json`의 `identity.polar_kinematics_environment`는 `l04-raw-golden.json`의
것을 그대로 따른다 — `current_epoch_ms: 0`(정준 값, 조류 0)을 포함한 15개 필드.

## 10. 경계 문구

L05의 수심·여유가 실제 계산값이 되어도 **여전히 합성이며 미검증이다.** `VR-L05-v0`와
`VR-POLAR-v0`는 `disposition: assumption`이다. 수심·흘수·조석 상수는 지어낸 교육용
값이며 실제 측심·해도·항법 정보가 아니다. 계산한다는 것이 검증했다는 뜻이 아니다.

L05의 결정 기록은 실제 항해 판단 권고가 아니며, 점수는 실제 항해 실력 평가가 아니다.

## 11. 범위 밖

- 결정(pass/wait/return)이 시뮬레이션에 영향을 주게 만드는 것 — 별도 사이클
- L02·L03 이행, L01 이행(89곳, 포기 유지)
- L06 채점 확장 — 표에 한 줄이면 되지만 이번 범위 아님
- 시정·경로 모델 (PRD §8.1)
- 관측 확인 액션 추가
- 도메인 검증 승격

## 12. 완료 기준

- L05 세션이 실제 계산된 heading/COG/STW/SOG/drift와 under-keel clearance를 갖는다
- L05의 `scenario_depth`와 `declared_clearance`가 `declared_synthetic`으로 표시된다
- L05가 0이 아닌 `total_points`를 75점 만점 기준으로 낸다
- L05 판단 점수가 decision checkpoint에서 나오고 그 이벤트 id를 가리킨다
- L05 replay가 저장·복원 왕복을 통과한다
- `git diff --name-only tests/fixtures/`가 `l05-` 두 파일만 출력한다
- `npm run typecheck`, `npm test`, `npm run build`, `npm run test:smoke` 전부 통과
