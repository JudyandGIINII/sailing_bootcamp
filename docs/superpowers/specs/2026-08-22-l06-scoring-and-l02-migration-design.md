# L06 scoring and L02 polar migration — design

> 작성: `2026-08-22 KST`
> 대상 PRD 절: §7.3 점수, §8.2 트림 보정 계수, FR-03, FR-04
> 시작 지점: `main` = `0e78b69`

## 1. 무엇을 만드는가

두 가지다. 크기가 매우 다르므로 분리해서 읽어야 한다.

- **L06 채점** — `LESSON_SCORE_PROFILES`에 한 줄. 이미 폴라 모델이므로 이행이 없다.
- **L02 폴라 이행** — 트림이 실제로 속력에 영향을 주게 만든다. 지금 L02에서 트림을
  조작하면 문자 그대로 아무 일도 일어나지 않는다.

## 2. 확정된 결정

| 결정 | 내용 |
|---|---|
| L02 트림 의미 | **실제 속력에 반영.** acknowledgment 기록은 유지 |
| L02 매니페스트 문구 | `pass_semantics`를 고쳐야 한다 — 아래 §5 |
| L02 identity | 기존 strict 계약 **유지** + 폴라 환경 추가 (`polarL02V2Keys`) |
| L02 채점 | **이번 범위 밖** — 아래 §8 |
| L06 목표·관측 구성요소 | 미적용 선언 (마크 없음, 관측 기록 없음) |

## 3. L02는 L05와 다르다 — 비용을 다시 실측했다

지난 사이클의 교훈대로 `ReplayBindings` 참조 수로 추정하지 않고 세 파일의 레슨 분기를
전부 세었다.

| 항목 | L05 (완료) | L02 (이번) |
|---|---|---|
| strict Replay V2 변형 | **없음** — base `v2Keys`로 떨어짐 | **있음** — `l02V2Keys` + `hasStrictL02ReplayV2TerminalAuthority` |
| identity 전용 필드 | 없음 | `l02_synthetic_trim_profile`, `l02_terminal_logical_tick`, `l02_terminal_paused` |
| 필요한 새 key set | 없음 (기존 `polarLessonV2Keys` 재사용) | **`polarL02V2Keys` 신설** |
| 선언 의미 변경 | 없음 | **`pass_semantics` 변경 필요** |

L05가 저렴했던 이유는 바인딩 참조가 3개여서가 아니라 **strict 변형이 없어서**다. 이것이
이 저장소에서 이행 비용을 결정하는 진짜 변수다.

### 선례는 이미 있다

`polarL01V2Keys = [...v2Keys, POLAR_REPLAY_IDENTITY_FIELD, L01_TERMINAL_TICK, L01_TERMINAL_PAUSED]`
— L01은 폴라 환경과 자신의 terminal 필드를 **함께** 갖는 변형이 이미 정의되어 있다.
L02도 같은 모양을 따르며, 여기에 트림 프로필이 하나 더 붙는다.

## 4. 트림 배선은 공짜다 (핵심 발견)

`src/sim/session.ts:712`는 트림 액션을 **`isPolarRaw(raw)`로 게이트하며 lesson id로
게이트하지 않는다.**

```ts
if (isPolarRaw(raw) && (action === 'main_trim' || action === 'jib_trim' || action === 'reef')) {
```

따라서 L02가 폴라 상태를 갖는 순간 트림이 `sail_trim`에 반영되고
`sailCorrectionFactor`를 통해 폴라 속력에 자동으로 들어간다. **이 함수는 한 줄도
바뀌지 않는다.**

그리고 line 721의 acknowledgment 리듀서는 `raw.lesson_id === 'L02'`로 따로 게이트되므로
그대로 계속 동작한다. 즉 "트림이 실제로 작동하면서 acknowledgment 기록도 유지"가
추가 배선 없이 성립한다.

## 5. L02의 선언 의미를 반드시 고쳐야 한다

현재 `l02Manifest.pass_semantics`:

> "Synthetic control-input acknowledgment only; **no performance or safety metric is asserted**."

이행 후 이 문장은 **거짓이 된다.** `MIN_TRIM_EFFICIENCY = 0.55`이므로 잘못 맞춘 세일은
선언된 속력의 45%를 잃는다. 그것은 명백히 performance 영향이다.

새 문구는 트림이 선언된 합성 속력에 영향을 준다는 것을 말하되, 그것이 실제 세일 성능·
안전 주장이 아님을 유지해야 한다. 계산한다는 것이 검증했다는 뜻이 아니다.

**문서가 조용히 거짓이 되는 것**은 이 저장소가 이미 세 번 겪은 실패다. 코드가 바뀌면
같은 커밋에서 선언도 고친다.

## 6. 관측 상태 변화 (L02)

| 관측 | 이전 | 이후 | 근거 |
|---|---|---|---|
| `apparent_wind_angle` | `declared_unavailable` | `declared_synthetic` | 폴라 관측이 계산 |
| `declared_speed_response` | `declared_unavailable` | `declared_synthetic` | 트림이 STW에 영향 |
| `declared_trim_feedback` | `declared_synthetic` | 그대로 | acknowledgment 유지 |
| `main_sheet` | `declared_unavailable` | `declared_synthetic` | `sail_trim.main_trim` |
| `jib_sheet` | `declared_unavailable` | `declared_synthetic` | `sail_trim.jib_trim` |

**주의:** L05 사이클의 6번째 결함이 바로 이 지점에서 나왔다. L02를 폴라 렌더 분기에
넣으면 `declared_synthetic`인 관측이 **전부** 그 분기에 걸린다. 위 5개 모두 이름을
말하고 실제 판독이 아님을 부정하는 문구를 가져야 하며, 하나라도 분기에서 누락되면
"Synthetic computed observation unavailable."로 렌더된다.

## 7. L06 채점

`LESSON_SCORE_PROFILES`에 한 줄. 기계는 L05 사이클에서 이미 표 기반으로 바뀌었다.

| 구성요소 | L06 | 근거 |
|---|---|---|
| 관측 | 미적용 | 관측 기록 없음 |
| 판단 | 채점 (`helm_correction`) | 결정 기록이 없으므로 L04와 같은 근사 |
| 조작 안정성 | 채점 | helm 순서열 |
| 안전 | 채점 | clearance crossing |
| 목표 | 미적용 | 마크 없음 |

`points_possible` = **75**. L05와 같은 모양이지만 판단 증거는 helm correction이다 —
L06은 결정을 기록하지 않으므로 L05 같은 "진짜 판단" 증거가 없다.

## 8. L02 채점을 이번 범위에서 빼는 이유

기계는 준비되어 있으므로 한 줄이면 되지만, **판단 증거를 무엇으로 볼지가 열린 질문**이다.
L02는 `main/jib synthetic trim causality recorded` 체크포인트를 기록하는데, 그것이
판단인지 조작인지는 L05의 decision 기록만큼 자명하지 않다. L05에서 그 질문에 제대로
답했기 때문에 판단 구성요소가 의미를 가졌다. 같은 주의를 기울일 별도 사이클로 남긴다.

## 9. 픽스처 영향

**반드시 바뀌는 것:** `l02-raw-golden.json`, `l02-score-debrief-golden.json`
(raw 상태 형태가 바뀌고 `POLAR_KINEMATIC_TRANSITION`이 추가된다)

**바뀌면 안 되는 것:** `l01-`, `l03-`, `l04-`, `l05-` 전부. L06 채점은 픽스처를 갖지
않으므로 L06 때문에 바뀌는 파일은 없어야 한다.

## 10. 경계 문구

L02의 트림이 실제로 속력을 바꿔도 **여전히 합성이며 미검증이다.** `VR-L02-v0`와
`VR-POLAR-v0`는 `disposition: assumption`이고, 트림 계수 `MIN_TRIM_EFFICIENCY = 0.55`와
`REEF_SPEED_FACTOR = 0.75`는 지어낸 교육용 상수다. 실제 세일 트림 성능·안전 권고가
아니다.

## 11. 범위 밖

L02 채점, L03 이행(11 참조 + strict 변형), L01 이행(89, 포기 유지), 결정 실동작화,
파도·시정 모델, 렌더러 확장, 도메인 검증 승격.

## 12. 완료 기준

- L06이 0이 아닌 총점을 75점 만점으로 낸다
- L02 세션이 폴라 상태를 갖고 트림 조작이 STW를 실제로 바꾼다
- L02의 acknowledgment 기록이 이행 후에도 그대로 동작한다
- L02 replay가 저장·복원 왕복을 통과한다 (**테스트로 증명할 것** — 지난 사이클에서
  이 항목을 약속만 하고 테스트하지 않아 결함 두 개를 놓쳤다)
- L02의 `pass_semantics`가 더 이상 "no performance metric"이라고 말하지 않는다
- `declared_synthetic`인 L02 관측 5개 전부가 전용 문구로 렌더된다
- `git diff --name-only tests/fixtures/`가 `l02-` 두 파일만 출력한다
- `npm run typecheck`, `npm test`, `npm run build`, `npm run test:smoke` 전부 통과
