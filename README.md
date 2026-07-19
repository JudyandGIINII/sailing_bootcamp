# Sailing Bootcamp — Training Sloop Simulator

브라우저에서 동작하는 입문 교육용 세일링 시뮬레이터의 제품·기술·검증 설계 저장소입니다.

> **현재 상태: AP-0E G0 prototype hardening이 shared `main`에 검증·통합·push되었고, L01–L05 assumption-only prototype scope는 완료 상태입니다.** Chromium만 현재 검증된 prototype baseline이며, domain validation·P1·release는 계속 차단됩니다.

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
| 코드 bootstrap / AP-0E G0 L01–L05 prototype | integrated/pushed — assumption-only prototype scope complete |
| G1 domain review | L01 preparation packet version-controlled; reviewer/evidence/authority input 대기 |
| 도메인 검증·P1·release | **차단됨** |

## 권고 기술 방향

Strict TypeScript + Vite + PixiJS world projection + DOM/CSS HUD/debrief + Vitest + Playwright + IndexedDB.

결정론적 simulation core는 renderer/DOM/storage/network와 분리하며, PixiJS는 canonical simulation state를 변경하지 않는 projection adapter로만 사용합니다. replay 호환성은 scenario·seed·ordered input·model/profile/contract·coordinate/determinism/comparison-policy version을 모두 포함하는 full identity로 판정하며, 호환되지 않는 record는 근사 재생하지 않고 local 원본을 보존한 채 거부합니다.

## 주요 문서

- [PRD](prd.md)
- [현재 진행상황](docs/PROJECT_STATUS.md)
- [기본 구현 handoff](docs/HANDOFF.md)
- [G1 L01 domain-review handoff](docs/HANDOFF_NEXT_SESSION_G1_L01_2026-07-19.md)
- [MVP 구현 계획](docs/architecture/mvp-technical-plan.md)
- [기술 옵션 비교](docs/architecture/technical-options.md)
- [L01–L05 콘텐츠 명세](docs/content/mandatory-lessons-l01-l05.md)
- [도메인 검증 레지스트리](docs/content/domain-validation-registry.yaml)
- [Prototype / release gate](docs/quality/prototype-and-release-gates.md)
- [DEVLOG](docs/DEVLOG.md)
- [프로젝트 Kanban 스냅샷](docs/KANBAN.md)
- [구현 감사 및 승인-의존 후속 계획](docs/plans/2026-07-19-prototype-audit-and-next-steps.md)

## 현재 권한 게이트

AP-0A–AP-0E prototype 구현은 완료되었지만, semantic learning behavior·registry promotion·P1·release는 별도 gate다. 현재 모든 validation record가 `assumption`이고 version binding은 draft이므로 제품 release는 불가하다. G1은 qualified reviewer, source/evidence, qualification decision, controlled-apply authority를 각각 요구하며, 준비 packet이나 테스트 통과만으로 이를 대체할 수 없다.

향후 코드 변경은 명시된 사용자 승인 뒤에만 Orca worktree에서 Codex를 primary builder로 수행하며, Claude는 read-only architecture/diff review, Hermes는 독립 QA를 수행한다. 자세한 규칙은 [AGENTS.md](AGENTS.md)를 따른다.
