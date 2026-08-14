# 폴라 기반 보트 모델과 조류 벡터 합성 — 설계

> 상태: **설계 승인됨 (구현 전)**
> 작성일: `2026-08-15 KST`
> 대상 PRD 절: §8.1(바람·조류), §8.2(보트 모델), FR-04
> 경계: 이 문서의 모든 수치는 **합성 교육용 가정**이며 실제 항해·안전·항법 값이 아니다.

## 1. 목적

현재 L01 모델은 선속이 고정 `forward_speed_mps: 2`이고
(`src/contracts/l01-synthetic-environment.ts:31`), 조류는 코어에 결합되어 있지 않다
(`src/contracts/scenario.ts:180` — `current_physical_coupling: 'NOT_MODELED_BY_CURRENT_CORE'`).

이 때문에 PRD가 요구하는 다음이 성립하지 않는다.

- §8.2 — `(apparent wind angle, wind speed) → target boat speed` 폴라
- §8.1 조류 행 — SOG/COG, drift trail
- FR-04 — STW/SOG와 heading/COG의 분리

이 설계는 위 세 가지를 닫는다. 나머지 §8.1/§8.2 항목은 범위 밖이다(§8 참조).

## 2. 확정된 설계 결정

| ID | 결정 | 근거 |
|---|---|---|
| D-1 | 레거시 L01–L05 트랙(`src/sim`)에 구현한다 | PRD §8.1/§8.2가 가리키는 트랙이며 상대풍·좌표 계약·ledger가 이미 존재 |
| D-2 | 폴라 입력의 순환은 **직전 tick의 상대풍 벡터**로 끊는다 | 단방향 계산으로 exact 결정론과 골든 exact-equality 유지 |
| D-3 | 기존 모델을 교체하지 않고 **새 model_version을 병행 추가**한다 | 저장소의 기존 additive 패턴(P4·P5)과 일치, 구 replay fail-closed 회피 |
| D-4 | 폴라는 **격자 테이블 + 이중선형 보간**으로 표현한다 | 폴라를 데이터로 분리해 §12.1 검증 레지스터 대상으로 추적 가능 |
| D-5 | 상대풍은 **대지속도** 기준으로 계산한다(`TW − groundVel`) | 공기가 지면 좌표계에 있다는 규약과 일관. 조류가 성능에도 인과적으로 작용 |

### 기각한 대안

- **해석적 폴라 수식** — PRD §8.3의 *"구현 알고리즘과 수치 tolerance는 PRD 본문에서
  발명하지 않는다"*와 충돌하고 검증 레지스터에 올릴 단위가 불명확하다.
- **고정점 반복 수렴** — 수렴 tolerance가 필요해 exact-equality 골든 비교 및 결정론
  계약과 정면 충돌한다.
- **보간 없는 최근접 조회** — 선속이 계단형으로 튀어 "침로에 따른 속도 변화 체감"이라는
  L01 학습 목표를 훼손한다.
- **모델 제자리 교체(v1 → v2)** — 골든 10종 전면 재생성과 저장 replay 전량 거부를 유발한다.

## 3. 모듈 구성

기존 `l01-synthetic-environment.ts`(계약 + 동결 데이터 + 가드) ↔
`l01-synthetic-model.ts`(순수 전이) 쌍의 패턴을 그대로 따른다.

### 신규

| 파일 | 역할 |
|---|---|
| `src/contracts/polar-profile.ts` | 폴라 격자 타입·동결 데이터·가드. `polar_id`, `polar_version`, `validation_record_id: 'VR-POLAR-v0'`, `validation_disposition: 'assumption'` |
| `src/sim/polar.ts` | `lookupTargetSpeedMps(profile, awaRad, twsMps)` — 순수 이중선형 보간 |
| `src/contracts/polar-kinematics-environment.ts` | 새 모델 환경 계약. `forward_speed_mps` → `polar_profile_id`, `current_to_rad`·`current_speed_mps` 추가 |
| `src/sim/polar-kinematics-model.ts` | 새 전이 함수 `transitionPolarKinematicState` |

### 수정

- `src/sim/l01-observation.ts` — STW/SOG/COG/drift 관측 프로젝터 **추가**(기존
  `projectL01SyntheticObservations`는 불변)
- `src/content/l01.ts`, `src/content/l02-l05.ts` — **L01과 L04** manifest의 `model_version`을
  새 모델로 이행하고 해당 `required_observations`의 `declared_unavailable`을 실제 값으로 전환

**L02는 이행하지 않는다.** L02의 학습 목표는 "wind angle에 맞춘 sheet 조절로 안정 선속
확보"인데, 이 설계의 폴라는 `(AWA, TWS)`만 입력으로 받고 트림 상태를 받지 않는다. 따라서
트림을 조절해도 선속이 변하지 않아 L02는 이 작업으로 이득을 얻지 못한다. PRD §8.2의
*"트림, reef, 파도, 안전 상태는 명시적 보정 계수로 기본값을 조정한다"*에 해당하는 **트림
보정 계수는 이번 범위 밖**이며(§8 참조), L02는 그 작업에서 이행한다.

### 삭제

없음. `src/sim/l01-synthetic-model.ts`와 그 직접 단위 테스트
(`tests/unit/l01-synthetic-model.test.ts`)를 회귀 스위트로 **유지**한다.
저장된 구 replay는 계속 v1 모델로 검증되므로 fail-closed 거부가 발생하지 않는다.
골든 픽스처는 L01·L04 4종만 재생성되고 나머지 6종은 불변이다(§9 참조).

## 4. 폴라 격자

```
AWA 축: 0°, 30°, 45°, 60°, 90°, 120°, 150°, 180°   (8점)
TWS 축: 0, 2, 4, 6, 8, 10 m/s                       (6점)
값:     target STW (m/s), 48개 상수
```

- AWA는 좌우 대칭이므로 `[0, π]`로 접어 조회한다. 부호는 침로 계산에만 사용한다.
- 격자 범위 밖 입력은 클램프한다.
- 보간 결과는 기존 `canonicalizeL01Number`(6자리, `canonical_precision_version:
  'l01-precision-v1'`)로 정규화해 결정론을 보장한다.
- 48개 값은 교육용 합성 가정이며 `VR-POLAR-v0` / `disposition: assumption`으로 등록한다.
  도메인 검토자는 코드 변경 없이 숫자만 교체할 수 있다.

## 5. tick 알고리즘

```
transitionPolarKinematicState(profile, priorState, controls):

 1. controls 검증                          (기존 validatedControls 재사용)
 2. heading(N)   = normalize(heading(N-1) + helm turn)
 3. AWA          = angle(priorState.apparent_wind_from_rad, heading(N))
 4. stw(N)       = lookupTargetSpeedMps(polar, |AWA|, true_wind_speed_mps)
 5. waterVel(N)  = directionVector(heading(N), stw(N))
 6. currentTo    = directionVector(current_to_rad, current_speed_mps)
 7. groundVel(N) = composeGroundRelativeVelocity(waterVel, currentTo)
 8. displacement = groundVel × logical_step_seconds
 9. position(N)  = position(N-1) + displacement
10. apparentWind(N) = trueWindFlowTo − groundVel     → nextState에 저장
```

**3단계가 설계의 핵심이다.** `heading(N)`(현재 tick)과 `apparent_wind(N-1)`(직전 tick)을
조합하므로 `speed(N)`에 대한 의존이 없다. 순환이 끊기면서도 조타 반응성은 즉시 유지된다.
즉 1-tick lag은 상대풍 **벡터**에만 적용되고 침로에는 적용되지 않는다.

7단계는 `src/sim/vector.ts:11`의 기존 `composeGroundRelativeVelocity`를 배선한다.
이 함수는 현재 테스트에서만 호출되고 세션에는 연결되어 있지 않다.

### 선언 규약

- **상대풍 기준계**: `TW − groundVel` (D-5). 계약에 명시 선언하고 `assumption`으로 표기한다.
- **초기 조건**: tick 0에는 직전 상대풍이 없으므로 보트 속도를 0으로 두고 시작한다
  (초기 상대풍 = 진풍). 결정론적 초기 조건으로 선언한다.

## 6. 관측 투영 (FR-04)

```
stw         = |waterVel|
sog         = |groundVel|
cog         = direction(groundVel)
drift_angle = normalize(cog − heading)
```

drift trail은 별도 자료구조를 만들지 않는다. `position_m`이 tick마다 ledger에 기록되므로
궤적은 렌더러가 ledger를 읽어 그린다.

## 7. 에러 처리

| 상황 | 처리 |
|---|---|
| 비유한 입력 | `TypeError` throw (기존 관례) |
| 격자 범위 밖 AWA/TWS | 클램프 |
| 프로필 가드 실패 | assert throw (기존 `assertL01SyntheticEnvironmentV1` 관례) |
| **대지속도 0** | COG/drift를 `'declared-unavailable'`로 반환 — **throw 하지 않음** |

마지막 행은 필수다. 폴라는 AWA≈0에서 속도 0을 반환하므로 "맞바람으로 정지"가 정상 상태가
된다. 그러나 현재 `src/sim/l01-observation.ts:25-27`은 변위가 0이면 `TypeError`를 던진다.

이는 **신규 프로젝터에서만** 처리한다. 기존 `projectL01SyntheticObservations`는 구 모델
전용으로 남으므로 throw 동작을 그대로 유지하며(회귀 픽스처가 이에 의존), 신규 프로젝터가
기존 sentinel 패턴(`session.raw.cog !== 'declared-unavailable'`, `src/main.ts:283`)을
재사용해 크래시 대신 관측 불가로 표현한다.

## 8. 범위 경계

### 이 작업이 닫는 것

- §8.1 바람 행 — `(AWA, TWS) → 선속`이 실제로 계산된다
- §8.1 조류 행 — SOG/COG 및 drift 인과 연결
- §8.2 폴라 항목
- FR-04 전체

### 닫지 않는 것

- §8.1 조석·파도·시정 — 미구현 유지
- §8.2 **보정 계수** — 트림·reef·파도·안전 상태에 따른 선속 보정은 범위 밖.
  이것이 없으므로 **L02(트림)와 L03(reef)은 이번 작업의 수혜 대상이 아니다**
- §8.2 나머지 — 흘수(draft), 안전 임계값, hull/rig 구성은 범위 밖
- §7.3 5개 구성요소 점수 — `total_points`는 0으로 유지(별도 작업)
- L05 통과/대기/회항 — 기록 라벨로 유지
- **도메인 검증 주장 없음** — `validation_disposition`은 `assumption` 유지,
  UI의 synthetic·non-navigation 라벨 유지

이 작업 후에도 PRD §8.1/§8.2는 완전히 충족되지 않는다. L04(조류 보정)는 실제로 동작하게
되지만 L05(조석·수심)는 선언만 남는다.

## 9. 테스트 전략

FR-04의 수용 기준이 그대로 테스트가 된다.

| 테스트 파일 | 검증 |
|---|---|
| `tests/unit/polar.test.ts` | 격자 꼭짓점 exact 일치, 중점 보간값, 좌우 대칭(±AWA 동일), 범위 밖 클램프, 비유한 입력 throw |
| `tests/unit/polar-kinematics-model.test.ts` | 조류=0 → `sog === stw` 且 `cog === heading`; 조류≠0 → `groundVel === waterVel + currentTo` |
| 〃 | AWA≈0 정지 → COG/drift가 `'declared-unavailable'`, throw 없음 |
| 〃 | 동일 입력 반복 재생 → 궤적·ledger 완전 일치 |
| `tests/fixtures/` | **L01·L04 픽스처 4종 재생성** (새 model_version 반영) |
| 〃 | **L02·L03·L05 픽스처 6종은 불변** |
| `tests/unit/l01-synthetic-model.test.ts` | **변경 없이 통과** — 구 모델의 진짜 회귀 증거 |

**골든 픽스처에 대한 정정.** L01·L04 manifest의 `model_version`이 바뀌면 해당 픽스처가
담고 있는 replay identity도 함께 바뀐다. identity가 manifest와 일치해야
`resolveLessonPolicy`가 동작하므로, **L01·L04 픽스처 4종은 재생성이 불가피하다.**
따라서 "기존 골든 10종 불변"은 성립하지 않으며, 정확히는 6종 불변 / 4종 재생성이다.

구 모델(`transitionL01SyntheticState`)의 회귀 증거는 픽스처가 아니라
`tests/unit/l01-synthetic-model.test.ts`가 담당한다. 이 테스트는 lesson manifest를 거치지
않고 전이 함수를 직접 호출하므로 manifest 이행의 영향을 받지 않는다.

`tests/contracts/sim-boundary.test.ts`가 이미 `src/sim` 전체를 순수성 스캔하므로
신규 파일 2개(`polar.ts`, `polar-kinematics-model.ts`)는 자동 커버된다.

### 검증 명령

```
npm run typecheck
npm test
npm run build
```

기준선: 현재 `main`에서 typecheck PASS, 22 files / 232 tests PASS.

## 10. 구현 단계에서 확정할 항목

- **폴라 48개 값**: 구체 수치는 구현 시 확정한다. 값은 합성 가정이며 어떤 실제 선형의
  성능도 주장하지 않는다. 단조성 제약만 미리 고정한다 — TWS가 증가하면 target STW는
  감소하지 않고, AWA 0°에서는 모든 TWS에 대해 0이다.
- **`VR-POLAR-v0` 등록**: 이 작업에 포함한다. `docs/content/domain-validation-registry.yaml`에
  `disposition: assumption`으로 폴라 레코드를 추가하며, 별도 후속 작업으로 미루지 않는다.
