# Handoff — world renderer

> 작성: `2026-08-17 KST`
> 대상: 다음 세션에서 이 작업을 이어받는 사람/에이전트
> 시작 지점: `main` = `e471c22` (origin/main과 동일, push 완료)

## 1. 한 줄 요약

시뮬레이션은 동작하지만 **화면에서 아무것도 움직이지 않는다.** 렌더러를 실제 상태에
연결하는 것이 다음 작업이다.

## 2. 바로 실행해서 확인하는 법

```bash
npm install
npm run dev          # http://localhost:5173
```

브라우저에서 Lesson 셀렉트를 **L04**로 바꾸고 `New Session` → 방향키를 눌러본다.

- **텍스트 HUD의 숫자는 실제로 바뀐다** — heading, COG, STW, SOG, drift가 계산된다
- **캔버스("Synthetic training water")는 정지해 있다** — 흰 막대가 고정 좌표에 그려지고
  움직이지 않는다

진입점은 셋이다: `/` (L01–L06 레슨 앱), `/scenario1-p4.html`, `/scenario1-p5.html`.

## 3. 왜 이 작업인가

`src/render/world-projection.ts`는 41줄짜리 장식용 스텁이다. `render()`가 갱신하는 것은
helm 색과 텍스트 두 줄뿐이고, **`position_m` / `heading_rad` / drift를 하나도 읽지
않는다.** 보트 글리프는 좌표 `(248, 74)`에 하드코딩되어 있다.

PRD §6.1은 "drift trail을 보여주는 HUD"를 MVP 포함 항목으로 명시하고 FR-04도 이를
요구하는데, 시각화가 전혀 없다.

**데이터는 전부 준비되어 있다.** ledger가 매 틱 위치를 기록한다(확인:
`polar_transition.next_state.position_m`). 새 상태 없이 **렌더러만의 작업**이다.

## 4. 읽어야 할 문서 (순서대로)

1. `docs/superpowers/specs/2026-08-17-world-renderer-design.md` — 설계와 확정 결정
2. `docs/superpowers/plans/2026-08-17-world-renderer.md` — 4개 태스크의 TDD 구현 계획
3. `docs/contracts/coordinate-contract.md` — 좌표 규약 (`+x = east`, `+y = north`)

## 5. 확정된 결정 (다시 논의하지 말 것)

| 결정 | 내용 |
|---|---|
| 시점 | **보트 추적** — 보트를 중앙 고정, 세계가 스크롤. 사용자가 전체 코스 시점 대신 선택함 |
| 마크 | 화면 밖이면 **가장자리 인디케이터 + 거리(m)**. 추적 시점의 약점 보완책 |
| 궤적 | **ledger에서 유도.** 세션 상태에 저장하지 않는다 |
| 구조 | 순수 모듈 2개(`camera.ts`, `session-view.ts`) + 얇은 Pixi 어댑터 |
| 표시 | heading과 COG를 **함께** 그린다 — 두 각도 차이가 학습 신호 |

## 6. 절대 어기면 안 되는 것

- **골든 픽스처가 하나도 바뀌면 안 된다.** 렌더러는 시뮬레이션 상태를 읽기만 한다.
  각 태스크 끝에 `git diff --name-only tests/fixtures/`가 빈 출력이어야 한다.
- **새 시뮬레이션 상태를 만들지 말 것.** `RawSimulationState`나 replay identity에 필드를
  추가하면 픽스처와 replay 계약이 다시 흔들린다. 이번 사이클에 그 문제로 여러 번
  막혔다.
- **경계 문구.** 모든 라벨과 텍스트 대체는 합성·미검증으로 읽혀야 한다. 실제 해도·측심·
  방위·항법 표시로 오인될 표현 금지. 이 저장소의 안전 태세 전체가 여기 걸려 있다.
- **접근성.** 캔버스는 `aria-hidden="true"` 유지 + 같은 정보를 텍스트로도 제공. 색만으로
  상태를 구분하지 말 것.

## 7. 현재 기준선

| 항목 | 값 |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | **32 files / 321 tests** |
| `npm run build` | PASS |
| `npm run test:smoke` | **23 / 23** |
| 순수성 경계 | PASS (`tests/contracts/sim-boundary.test.ts`, 2/2) |

## 8. 이번 사이클에서 배운 것 (반복하지 말 것)

이 저장소는 계약이 촘촘해서, 겉보기에 작은 변경이 예상 밖으로 번진다. 실제로 겪은 것들:

- **레슨의 `model_version`을 바꾸면 그 레슨의 replay bindings를 쓰는 모든 테스트가 조용히
  재해석된다.** L01은 78곳이라 이행을 포기했고, L04는 3곳이라 가능했다. **먼저 세어볼 것.**
- **replay identity의 키 집합은 여러 곳에 흩어져 있다** — `identityFieldsFor`,
  `isReplayV2Shape`의 키 집합들, `resolveReplayV2`의 레슨 분기. 한 곳만 고치면 해당
  레슨의 replay가 통째로 로드 불가가 된다(실제로 발생, `6a7457c`에서 수정).
- **`ledger.length` 기반 이벤트 ID는 다음 틱의 입력 ID와 충돌한다.** 전이 이벤트처럼
  namespace를 쓸 것(`polar-transition:${tick}` 형태).
- **`vitest`의 `toEqual`은 값이 있는 추가 키에서 실패한다.** 공유 객체에 필드를 더하면
  모든 골든 픽스처가 깨진다. 선택 필드로 두고 해당 경로에서만 채울 것.
- **문서가 조용히 거짓이 된다.** `PROJECT_STATUS.md`와 완료 매트릭스가 코드와 어긋난
  주장을 두 번 했다. 코드가 바뀌면 같은 커밋에서 문서도 고칠 것.
- **레지스터(`domain-validation-registry.yaml`)를 읽는 코드가 없어서 조용히 드리프트했다.**
  지금은 `tests/content/domain-validation-registry.test.ts`가 코드 상수와 대조한다.
  새 상수를 도입하면 그 테스트도 갱신할 것.

## 9. 이 작업 범위 밖 (계획에 없음)

파도·바람·조류 화살표, 수심 지형, 해안선, 위험구역, 카메라 확대·축소·팬, 애니메이션
보간, 실제 해도 요소 일체.

## 10. 이 작업 이후에 남는 것

- L02·L03·L05는 여전히 레거시 고정속도 모델 (L01은 이행하지 않기로 결정)
- PRD §8.1 파도·시정 모델 없음
- PRD §8.2 hull/rig 구성, 안전 임계값 없음
- PRD §7.3 5개 구성요소 점수 — `total_points`는 여전히 0
- 도메인 검증 없음 — `VR-POLAR-v0`는 `disposition: assumption`. 폴라 48개 값, 트림·reef
  계수, 조석·수심·흘수 상수 전부 지어낸 교육용 가정이다

## 11. 시작하는 법

```bash
git worktree add -b <your-branch> ../<worktree-dir> main
cd ../<worktree-dir> && npm install && npm test   # 32 files / 321 tests 확인
```

그 다음 `docs/superpowers/plans/2026-08-17-world-renderer.md`의 Task 1부터 순서대로.
계획은 subagent-driven 실행을 전제로 쓰였지만 직접 실행해도 된다.

**계획이 틀렸다고 판단되면 강행하지 말고 멈출 것.** 이번 사이클에서 구현자가 브리프
결함을 다섯 번 잡아냈고, 매번 멈춘 판단이 옳았다.
