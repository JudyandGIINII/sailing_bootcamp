# Prototype and Release Gate Model

## 목적

prototype을 만들 수 있는 조건과 제품을 release할 수 있는 조건을 분리한다. 도메인 검증 레지스트리와 P1 gate를 무시하거나 release claim을 앞당기지 않는다.

## gate definitions

### 1. Load gate

scenario, lesson, profile, coordinate, determinism, comparison, replay schema가 존재하고 호환되어야 한다. MVP profile은 `training-sloop-v1` 하나이며 L01–L05에서 허용되지 않은 action은 시작 전 비활성화/차단된다.

### 2. Prototype gate

`assumption` 기반 scenario도 다음을 만족하면 labeled prototype으로 실행 가능하다.

- `validation_record_id`가 versioned lesson/model assumptions에 연결됨
- 화면과 debrief에 simulation-only / unvalidated / non-navigation notice가 존재함
- local-only replay/telemetry 경계가 유지됨
- release mode로 표시·배포·주장하지 않음

### 3. Release gate

다음 중 하나라도 불충족이면 release-check는 fail해야 한다.

- 대상 lesson validation record가 `validated`가 아님
- record가 missing/stale/rejected/partially_validated/assumption
- browser/accessibility/pilot/operations/replay-compatibility/privacy 승인 artifact가 없음
- explicit release authority 또는 approval evidence가 없음

release mode에 force override는 없다. `validated` registry 상태도 P1 gate와 release approval을 대신하지 않는다.

## automated evidence targets

| gate | machine-checkable evidence |
|---|---|
| load | version/schema/profile/action compatibility report |
| prototype | unvalidated label presence, registry linkage, local-only network/storage checks |
| release | validation disposition report, P1 artifact manifest, approval references, no override assertion |

## implementation boundary

이 문서는 실제 reviewer acceptance, registry controlled apply, P1 approval, release를 수행하지 않는다. 그 절차는 `docs/content/sailing-coach-domain-review-qualification-controlled-apply-runbook-v1.md`를 따른다.
