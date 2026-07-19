# Archived External Qualification & Controlled Apply Runbook v1

> **Current status (2026-07-19):** **ARCHIVED / NON-OPERATIONAL.** This runbook is never required for personal/local prototype work, cannot block or automatically resume it, and has not been completed. It creates no reviewer credential, authority, validation, registry disposition, or release state.

> **상태:** 절차 초안. 이 문서는 reviewer를 찾거나 연락하지 않으며, reviewer/authority를 수락·지정하지 않고, registry·계약·P1·release 상태를 변경하지 않는다.

## 1. 목적과 범위

이 runbook은 미래에 완성된 도메인 검토 submission을 **fail-closed**로 수락·반려·보류하고, 별도의 명시 권한이 있을 때만 제한된 registry 변경을 준비하는 절차다.

범위는 L01–L05의 `VR-L01-v0`~`VR-L05-v0` registry record에 한정한다. 실제 항법·안전·자격 판단, 시나리오/모델/점수 설계, P1 품질 gate, 제품 release는 범위 밖이다.

## 2. 역할과 상태를 분리한다

| 개념 | 의미 | 이 runbook이 만드는 결과 |
|---|---|---|
| submitter declaration | 검토자가 자기 자격·한계·이해상충을 제출 양식에 기입 | 프로젝트의 자격 수락이 아님 |
| qualification decision | 명시적으로 확인된 authority가 특정 submission의 검토자 자격을 수락/반려/보류 | authority scope reference와 서명된 decision reference가 있을 때만 기록 가능 |
| evidence-review outcome | `validated`, `partially_validated`, `rejected`, `needs_evidence` | registry disposition과 별개 |
| registry disposition | `assumption`, `partially_validated`, `validated`, `rejected` | 별도 controlled apply 승인 때만 변경 후보 |
| P1 gate | browser/accessibility/pilot/privacy/release 품질 gate | registry validation과 독립 |
| release approval | 제품 출시 승인 | 이 runbook으로 만들 수 없음 |

`declaration_accepted`는 submitter가 자신의 선언을 수락했다는 뜻일 뿐, project/authority가 reviewer를 수락했다는 뜻이 아니다.

## 3. qualification decision 정책

### 3.1 기록할 수 있는 outcome

- `accepted`: authority가 **특정 submission + 특정 packet snapshot**에 한해 reviewer qualification을 수락.
- `rejected`: authority가 이 submission에 대한 qualification을 수락하지 않음.
- `deferred`: 정보·authority scope·한계가 불충분해 판단을 보류.

`accepted`도 실제 항법, 안전, 자격/인증, P1, release, scenario/model/scoring contract에 대한 권한을 부여하지 않는다.

### 3.2 qualification acceptance의 필수 증거

다음이 모두 존재해야 한다.

1. authority identity와 authority-scope reference
2. 대상 submission path와 SHA-256
3. 대상 review packet ID/version 및 SHA-256
4. decision outcome, rationale, decision timestamp
5. authority의 signed decision reference와 SHA-256

하나라도 없으면 qualification outcome은 `pending`이며 apply request는 진행할 수 없다.

## 4. submission 수락 전 검증

### 4.1 submission-wide 확인

- 제출 YAML이 parse되고 `submission_status=completed`이다.
- submission path·SHA-256이 고정돼 있다.
- 세 canonical source digest가 현재 파일과 일치한다.
- qualification declaration과 final attestation의 reviewer name·signature name·signed timestamp가 일치한다.
- final attestation은 L01–L05 다섯 record를 모두 포함한다.
- 모든 coverage finding, rationale, evidence/limitation 또는 명시적 evidence gap이 completeness rule을 충족한다.
- `needs_evidence`는 review outcome으로만 존재하며 registry disposition으로 제시되지 않는다.

### 4.2 record별 확인

각 record는 현재 registry와 문자 그대로 다음을 일치시킨다.

- `validation_record_id`, `lesson_id`, claim, coverage 순서
- `scenario_version`, `model_version`, `boat_profile_version`, `contract_version`
- `coordinate_contract_version`, `determinism_contract_version`

**concrete binding**은 null/빈값/`TBD`가 아니고 current registry와 정확히 일치하는 값이다. binding이 불완전하면 해당 record는 `assumption`을 유지하며, 별도 binding-completion workflow와 새 review가 필요하다.

## 5. fail-closed decision matrix

| 조건 | 결과 |
|---|---|
| authority 또는 authority scope 없음, qualification이 `rejected`/`deferred` | qualification acceptance 없음; apply request 진행 금지 |
| submission path/digest 없음·stale·mismatch 또는 source snapshot 변경 | 반려/보류; registry 변경 없음; `assumption` 유지 |
| signature/attestation/identity/five-record coverage/evidence가 불완전 | 반려/보류; registry 변경 없음; `assumption` 유지 |
| binding이 null·빈값·`TBD`·stale·mismatch | 해당 record `assumption` 유지; apply 금지 |
| outcome이 `needs_evidence` | `assumption` 유지; evidence request만 보관 |
| outcome이 `validated`/`partially_validated`/`rejected`이며 모든 integrity·completeness·binding gate 통과 | apply **후보**. 아직 registry 변경 없음 |
| delta에 allowlist 밖 field 존재 | 전체 apply request 반려; 부분 적용 없음 |
| authority approval 없음, frozen request/expected registry digest에 묶이지 않음, 혹은 pre-apply digest 변경 | abort; registry 변경 없음 |
| 승인된 apply 후 diff가 allowlist를 초과 | 즉시 rollback; audit 실패 기록; P1/release 미변경 |

## 6. controlled apply 절차

### 6.1 준비

1. 완료 submission을 별도 provenance artifact로 보관한다.
2. apply request를 새로 만들고, submission path/digest·current registry digest·qualification decision evidence를 연결한다.
3. 모든 gate 평가와 record eligibility를 기록한다. 기본값은 `false`/`pending`/`preserve_assumption`이다.
4. request digest를 동결한다. 이 시점 이후 request 내용 변경은 새 request와 새 digest가 필요하다.

### 6.2 별도 권한 승인

명시적으로 식별된 authority는 frozen apply request digest와 expected pre-apply registry digest를 함께 참조해야 한다. apply request 자체는 승인 문서가 아니다.

### 6.3 실행 직전 재검사

1. registry SHA-256을 즉시 다시 계산한다.
2. expected digest와 일치하지 않으면 abort한다.
3. registry 원본 bytes와 digest를 rollback artifact로 보존한다.
4. 요청된 모든 delta가 아래 allowlist 안에 있는지 확인한다.

```text
reviewer
review_date
disposition
source_or_evidence_gap_reason
```

`source_or_evidence_gap_reason`에는 provenance/evidence rationale만 기록한다. scenario, model, profile, lesson, coordinate, determinism, scoring, boundary, PRD, lesson-contract의 새 규범을 이 필드에 숨겨 넣을 수 없다.

### 6.4 원자적 적용 및 사후 검증

- 승인된 allowlisted delta만 한 번에 적용한다.
- post-apply YAML parse, before/after field report, exact diff allowlist 검증, post-apply digest를 기록한다.
- allowlist를 벗어난 변경이나 검증 실패가 있으면 저장한 원본 bytes로 rollback한다.
- 성공해도 P1 gate와 release 상태는 바뀌지 않는다.

## 7. 감사·보존 규칙

보관해야 할 artifact:

- frozen submission과 SHA-256
- qualification decision reference와 SHA-256
- frozen apply request와 SHA-256
- authority approval reference와 SHA-256
- pre/post registry digest, before/after field report, actual diff
- rollback reference 또는 no-op/rejected/aborted 결과

실제 reviewer/authority 정보와 서명 artifact는 필요한 최소 범위만 수집하고, 별도 보존·접근 정책이 승인되기 전까지 불필요한 개인정보를 늘리지 않는다.

## 8. rollback

- 문서 초안 문제: 이 runbook과 apply-request template만 제거한다.
- 미래 authorized apply 문제: 보존된 pre-apply registry bytes를 복원하고, 원인·diff·rollback digest를 audit에 기록한다.

## 9. 금지 사항

이 절차는 reviewer 선정·연락, qualification acceptance의 자동화, registry disposition의 자동 변경, P1/release 승인, 제품 코드 배포, 실제 항법 조언 생성을 하지 않는다.
