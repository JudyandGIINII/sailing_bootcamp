# Hermes QA — Browser MVP 기술 옵션 및 구현 계획

- Alfred 기술 계획 구조 검증: `PASS READY_FOR_HERMES_REVIEW`
- 범위: 조사·기술 계약·구현 계획 문서화만 수행. source tree, dependency manifest, dependency installation, Git/worktree, build/test/deploy는 만들거나 실행하지 않음.

## 권고

- Strict TypeScript + Vite + PixiJS renderer projection + DOM/CSS HUD/debrief
- Vitest contract/simulation/golden replay tests + Playwright keyboard/browser evidence
- IndexedDB local-only replay adapter
- deterministic core는 renderer/DOM/storage/network/wall-clock과 분리

## 검증 결과

```text
ARTIFACTS_EXIST=OK
RECOMMENDED_STACK=OK
CORE_RENDERER_ISOLATION=OK
COORDINATE_CONTRACT=OK
REPLAY_CONTRACT=OK
GATE_SEPARATION=OK
IMPLEMENTATION_SEQUENCE=OK
PRD_TRACE_LINKS=OK
NO_LINE_PREFIX_ARTIFACT=OK
NO_SOURCE_BOOTSTRAP=OK
```

## 판정

**PLAN_ACCEPTED — 구현 전 기술 계획과 contract 초안이 준비됐다.**

구현 전 AP-0은 사용자 명시 승인이다. 이 승인은 code/dependency/worktree bootstrap만 허용할 수 있으며, 현재 `assumption` 도메인 검증 레코드 및 P1 artifacts로 인해 release는 계속 차단된다.
