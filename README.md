# Sailing Bootcamp — Training Sloop Simulator

브라우저에서 동작하는 입문 교육용 세일링 시뮬레이터의 제품·기술·검증 설계 저장소입니다.

> **현재 상태: AP-0A foundation이 isolated Orca worktree에서 검증되었고 checkpoint/integration 대기 중입니다.** shared `main`에는 아직 앱 소스·패키지 manifest·dependency·테스트 런타임이 없으며, release는 계속 차단됩니다.

## MVP 한 줄 정의

학습자가 합성 가상 수역에서 `training-sloop-v1`을 조작하며 바람·조류·파도·조석·시정 변화에 대한 관측 → 판단 → 행동 → 결과를 결정론적으로 반복 훈련하는 데스크톱 우선 브라우저 시뮬레이터입니다.

## 확정 MVP 범위

- 브라우저 기반, 데스크톱 우선
- 입문 교육 수강생
- 가상 훈련 수역 1개
- 단일 플레이 가능 프로필: `training-sloop-v1`
- 필수 레슨: L01 상대풍/침로, L02 메인·지브 트림, L03 돌풍·파도·reef, L04 조류 보정, L05 조석·수심·시정
- local-only replay/telemetry
- 실제 항해·안전·항법·자격/인증 도구가 아님

## 현재 단계

| 단계 | 상태 |
|---|---|
| 제품 결정·PRD | 완료 — Draft v0.3 |
| L01–L05 콘텐츠 계약 | 완료 — 도메인 검증 전 초안 |
| 코치/강사 검토·controlled apply 체계 | 완료 — 문서/양식만 존재 |
| 기술 옵션·구현 계획 | 완료 — 구현 전 권고 |
| 코드 bootstrap / AP-0A contracts | isolated worktree에서 검증됨 — shared `main` 통합·AP-0B 미승인 |
| 도메인 검증·P1·release | **차단됨** |

## 권고 기술 방향

Strict TypeScript + Vite + PixiJS world projection + DOM/CSS HUD/debrief + Vitest + Playwright + IndexedDB.

결정론적 simulation core는 renderer/DOM/storage/network와 분리하며, PixiJS는 canonical simulation state를 변경하지 않는 projection adapter로만 사용합니다. replay 호환성은 scenario·seed·ordered input·model/profile/contract·coordinate/determinism/comparison-policy version을 모두 포함하는 full identity로 판정하며, 호환되지 않는 record는 근사 재생하지 않고 local 원본을 보존한 채 거부합니다.

## 주요 문서

- [PRD](prd.md)
- [현재 진행상황](docs/PROJECT_STATUS.md)
- [다음 구현 handoff](docs/HANDOFF.md)
- [MVP 구현 계획](docs/architecture/mvp-technical-plan.md)
- [기술 옵션 비교](docs/architecture/technical-options.md)
- [L01–L05 콘텐츠 명세](docs/content/mandatory-lessons-l01-l05.md)
- [도메인 검증 레지스트리](docs/content/domain-validation-registry.yaml)
- [Prototype / release gate](docs/quality/prototype-and-release-gates.md)
- [DEVLOG](docs/DEVLOG.md)
- [프로젝트 Kanban 스냅샷](docs/KANBAN.md)

## 구현 시작 전 게이트

코드 bootstrap, dependency install, Git worktree 생성은 사용자 명시 **AP-0 구현 승인** 뒤에만 진행합니다. 승인 scope는 AP-0A(bootstrap+contract tests), AP-0B(L01까지), AP-0C(L05/resilience/release evidence까지) 중 하나를 지정하며, 생략 시 AP-0A만 허용합니다. 각 task는 독립 evidence 검증 뒤에만 진행됩니다. 구현 prototype은 가능하더라도 현재 모든 validation record가 `assumption`이므로 제품 release는 불가합니다.

구현이 승인되면 Orca worktree에서 Codex CLI를 primary builder로 사용하고, Claude는 read-only architecture/diff review, Hermes는 독립 QA를 수행합니다. 자세한 규칙은 [AGENTS.md](AGENTS.md)를 따릅니다.
