# Training Sloop MVP — 기술 옵션 비교 및 권고

> 상태: **Draft v0.1 · 구현 전 기술 권고**
> 입력: [`prd.md`](../../prd.md), [`browser-mvp-technology-sources.md`](../research/browser-mvp-technology-sources.md)

## 결론

MVP의 권고 조합은 **Strict TypeScript + Vite + PixiJS + DOM/CSS HUD + Vitest + Playwright + IndexedDB**다.

이 선택은 PixiJS가 ‘게임 엔진’이 아니라 **world rendering projection**만 맡게 하여, 결정론·replay·안전 점수·디브리프의 권위를 framework loop에서 분리한다. 실제 package version은 bootstrap 직전 호환성 확인 후 lockfile로 고정한다.

## 후보 비교

| 후보 | 장점 | 핵심 위험 | 판정 |
|---|---|---|---|
| Phaser + 외부 simulation core | 2D game scene/input/camera 편의, WebGL/Canvas | Scene loop/input/내장 physics가 authoritative simulation state를 침범할 위험 | 사용 가능하나 MVP의 core isolation 규율이 더 필요 |
| **PixiJS + 독립 application controller** | 렌더링/scene graph에 집중, core와 render loop 분리 명확 | camera/input/lifecycle을 application layer가 직접 설계 | **권고** |
| Native Canvas 2D + DOM | 최소 의존성, 완전한 loop 통제 | renderer/camera/assets/diagnostics를 모두 직접 구현 | fallback; MVP 효율 낮음 |

## 채택 아키텍처

```text
content/contracts
       ↓
deterministic simulation → immutable event ledger → scoring/debrief facts
       ↓                          ↓
application controller ← replay/session controller
       ↓
PixiJS world projection | DOM/CSS HUD/debrief | IndexedDB local storage
```

### 비협상 경계

1. `sim`은 pure TypeScript state transition만 가진다. DOM, PixiJS, storage, network, wall-clock, unseeded randomness를 import하지 않는다.
2. `contracts`는 scenario/profile/lesson/coordinate/determinism/comparison/replay schema와 version compatibility를 검증한다.
3. `render`는 immutable snapshot을 그리기만 한다. 좌표축 변환은 render adapter 안에서만 한다.
4. `scoring/debrief`는 renderer state가 아닌 event ledger와 declared model state만 소비한다.
5. `storage`는 local-only replay adapter다. 저장 실패는 active lesson을 종료하지 않고 명시적인 `not saved` 상태로 만든다.
6. MVP에 backend, account, analytics SDK, live marine-data client, framework-owned physics는 넣지 않는다.

## prototype / release 분리

| 상태 | 조건 | 결과 |
|---|---|---|
| Load eligible | schema/version/profile/action/lesson contract가 완전·호환 | lesson load 허용 |
| Prototype eligible | validation record가 versioned assumption으로 연결되고 UI가 unvalidated label을 표시 | 개발·내부 prototype 허용. 출시 불가 |
| Release eligible | 모든 대상 record가 `validated`이고 P1 browser/accessibility/pilot/operations/privacy artifact도 승인 | release check 통과 후보 |

`assumption`, `partially_validated`, `rejected`, stale/missing record는 release를 막는다. 이 상태가 labeled prototype 제작까지 자동으로 막지는 않는다.

## 구현 시작 전 확인 항목

- Vite/PixiJS/Vitest/Playwright/TypeScript의 현재 호환 버전과 license를 확인하고 lockfile 고정
- coordinate/determinism/replay contract v1을 승인 가능한 기술 문서로 확정
- strict typecheck, unit, contract, golden replay, e2e, release-check 명령을 정의
- 프로젝트 Git/worktree/Orca bootstrap은 사용자 구현 승인 후에만 실행
