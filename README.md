# Sailing Bootcamp — Training Sloop Simulator

브라우저에서 동작하는 입문 교육용 세일링 시뮬레이터의 제품·기술·검증 설계 저장소입니다.

> **현재 상태: 개인·로컬 사용 전용 G1 self-review가 완료된 assumption-only prototype입니다.** 사용자 승인 통합 후 shared `main`과 `origin/main`은 `782707954c8ed711395c0ee5572de3be9f9fd256` (`7827079`)로 fast-forward되었으며, L03→L04→L02→L05 feature lineage와 그 문서 reconciliation은 integrated/pushed 상태입니다. Chromium만 현재 검증된 prototype baseline입니다. public distribution, certification, deployment, release는 비활성 범위이며 실제 항해·안전·항법 권위를 주장하지 않습니다.

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
| 코치/강사 검토·controlled apply 체계 | deferred — future public-distribution-only documents |
| 기술 옵션·구현 계획 | 완료 — 개인용 prototype 범위 |
| 코드 bootstrap / AP-0E G0 L01–L05 prototype | integrated/pushed on `main`/`origin/main` at `7827079` — assumption-only prototype scope complete |
| G1 personal-use self-review | 완료 — owner limitation acknowledgement; registry promotion 없음 |
| Public distribution / certification / release | 비활성·범위 밖 — 별도 제품 결정이 있어야 재개 |

## 권고 기술 방향

Strict TypeScript + Vite + PixiJS world projection + DOM/CSS HUD/debrief + Vitest + Playwright + IndexedDB.

결정론적 simulation core는 renderer/DOM/storage/network와 분리하며, PixiJS는 canonical simulation state를 변경하지 않는 projection adapter로만 사용합니다. replay 호환성은 scenario·seed·ordered input·model/profile/contract·coordinate/determinism/comparison-policy version을 모두 포함하는 full identity로 판정하며, 호환되지 않는 record는 근사 재생하지 않고 local 원본을 보존한 채 거부합니다.

## 주요 문서

- [PRD](prd.md)
- [현재 진행상황](docs/PROJECT_STATUS.md)
- [기본 구현 handoff](docs/HANDOFF.md)
- [다음 개인용 prototype handoff](docs/HANDOFF_NEXT_SESSION_PERSONAL_PROTOTYPE_2026-07-19.md)
- [개인용 G1 self-review record](docs/content/personal-use-g1-self-review-record-v1.md)
- [deferred external-review packet](docs/content/sailing-coach-domain-review-packet-v1.md)
- [MVP 구현 계획](docs/architecture/mvp-technical-plan.md)
- [기술 옵션 비교](docs/architecture/technical-options.md)
- [L01–L05 콘텐츠 명세](docs/content/mandatory-lessons-l01-l05.md)
- [도메인 검증 레지스트리](docs/content/domain-validation-registry.yaml)
- [Prototype / release gate](docs/quality/prototype-and-release-gates.md)
- [DEVLOG](docs/DEVLOG.md)
- [프로젝트 Kanban 스냅샷](docs/KANBAN.md)
- [구현 감사 및 승인-의존 후속 계획](docs/plans/2026-07-19-prototype-audit-and-next-steps.md)

## 현재 권한 게이트

AP-0A–AP-0E prototype 구현은 완료되었다. 이후 개인용 prototype 작업에는 대상·파일·검증 범위를 명시한 사용자 직접 승인만 필요하다. external reviewer, qualification, authority, controlled apply, G1/G2/G3, P1, public-release evidence는 archived non-operational materials이며 진행 gate가 아니다. semantic learning behavior는 assumption-only이고 registry promotion은 없으며, non-navigation·local-only 경계는 계속 적용된다.

향후 코드 변경은 명시된 사용자 승인 뒤에만 Orca worktree에서 Codex를 primary builder로 수행하며, Claude는 read-only architecture/diff review, Hermes는 독립 QA를 수행한다. 자세한 규칙은 [AGENTS.md](AGENTS.md)를 따른다.
