# Sailing Coach / Instructor 도메인 검토 패킷 v1

> **Current status (2026-07-19):** **DEFERRED — future public-distribution-only.** The active product is personal/local synthetic use and uses `personal-use-g1-self-review-record-v1.md` for limitation acknowledgement. This packet has not been submitted, completed, or used to validate any claim.

> **상태:** 검토 요청용 초안. 이 문서는 제품 출시, 실제 항해, 안전 판단, 자격/인증 또는 계약 변경을 승인하지 않는다.
> **대상:** 합성 가상 수역의 `training-sloop-v1` · 필수 레슨 L01–L05
> **패킷 ID:** `SCDRP-20260719-v1`

## 1. 목적과 사용 경계

이 패킷은 초대된 자격 있는 세일링 코치/강사가 L01–L05의 **시뮬레이션 가정**을 claim 단위로 평가할 수 있게 하는 문서다. 실제 항해의 안전 수치·항로·운항 조언을 요청하거나 만들지 않는다.

검토자는 첨부 YAML template에 자신의 자격 선언과 claim별 findings를 입력한다. 제출 자체는 다음 어느 것도 하지 않는다.

- canonical registry의 disposition 변경
- scenario/model/profile/coordinate/determinism/scoring/boundary contract 변경
- P1 browser/accessibility/pilot/privacy/release gate 통과
- 제품 출시 승인 또는 실제 안전 권위 부여

## 2. 고정 대상 스냅샷

검토는 아래 파일의 **동일 바이트 스냅샷**에만 유효하다. source digest, record ID, claim text, coverage, version binding 중 하나라도 달라지면 제출은 stale이며 재검토가 필요하다.

| 소스 | 버전/상태 | SHA-256 |
|---|---|---|
| `prd.md` | Draft v0.3 | `fb4c5f9b9ea51ef7c2233a7d9f3657b1c5d0a87d2a62e435d5d4c52931a3314a` |
| `docs/content/mandatory-lessons-l01-l05.md` | Draft v0.1 · 도메인 검증 전 | `0660c87b904aa41e5788aa5ce6a5b0ef86728bd01f83bce6de5a8f38a0af2b56` |
| `docs/content/domain-validation-registry.yaml` | schema 1 · registry `0-draft` · unapproved | `ca0bc9eba69b0bdc39728e2be5ad799c71bb33dae6ad43a68bb08c113915e330` |

현재 registry의 `VR-L01-v0`~`VR-L05-v0` disposition은 모두 `assumption`이며 출시 차단 상태다.

## 3. 검토자 선언 — 기술 검토와 분리

제출자는 필요한 최소 정보만 작성한다. 우편 주소, 전화번호, 정부 식별번호, 자격증 이미지, 무관한 이력은 수집하지 않는다.

필수 선언 항목:

1. 실명, 전문 역할, 검토 자격의 근거와 본 검토에 관련된 경험 범위
2. 이해상충 선언 및 검토의 한계
3. 이 문서가 가상 교육 시뮬레이션 검토용이며 실제 항법/안전/자격 판단을 제공하지 않음을 확인
4. submission 최종 attestation의 동일 서명명과 signed timestamp

프로젝트 측의 후속 별도 gate는 검토자 자격을 수락할 책임 주체와 기준을 정해야 한다. 이 패킷은 그 권한을 추정하지 않는다.

## 4. outcome 정의

| `review_outcome` | 의미 | registry 적용 가능성 |
|---|---|---|
| `validated` | 모든 coverage 항목을 수락하고, 근거/전문 판단·한계를 추적 가능하게 기록 | 별도 권한이 있고 모든 version binding이 구체적일 때만 후보 |
| `partially_validated` | 수락·미해결·거부 범위를 분리해 기록 | 별도 권한의 controlled apply 후보 |
| `rejected` | 부적절하거나 모순되는 claim 범위와 근거를 기록 | 별도 권한의 controlled apply 후보 |
| `needs_evidence` | 누락된 근거/fixture/정의가 있어 판단 보류 | registry enum이 아니며 `assumption` 유지 |

`validated`는 제품 출시, P1 gate 통과, 실제 항해 권위가 아니다. 특히 현재 `model_version`, `contract_version`, `coordinate_contract_version`, `determinism_contract_version`의 `TBD` binding은 후속 구체화 전 `validated` 적용을 막는다.

## 5. 공통 검토 규칙

- coverage 항목 **각각**에 finding을 작성한다. 일부만 검토했다면 `partially_validated` 또는 `needs_evidence`를 사용한다.
- evidence reference에는 종류(`cited_source`, `reviewer_professional_judgment`, `project_artifact`), 제목/설명, origin, 버전/날짜, locator, relevance, limitation을 남긴다.
- 숫자·안전 임계값·폴라·흘수·성능값을 새로 제시할 필요는 없으며, 근거가 부족하면 `needs_evidence`를 선택한다.
- 요청할 변경은 **clarification 또는 future revision request**로만 적는다. 이 제출로 canonical contract를 편집하지 않는다.
- `reviewed_claim_snapshot`, `reviewed_coverage_snapshot`, 모든 version field는 registry 원문과 문자 그대로 일치해야 한다.

## 6. 레슨별 review card

### VR-L01-v0 — L01 상대풍과 침로

- **Claim:** Relative-wind/course fixture, course-maintenance semantics, recoverable deviation, boundary predicate, score and retry comparison semantics for training-sloop-v1.
- **Coverage:** true/apparent-wind relationship; heading/COG/course objective semantics; helm correction and recoverable deviation; course boundary and score/retry semantics.
- **검토 초점:** 관측→보정→디브리프 인과, 회복 가능한 deviation과 terminal boundary의 명확한 구분, 속도가 통과를 대신하지 않는지.

### VR-L02-v0 — L02 메인·지브 트림

- **Claim:** Representative main/jib configuration, trim response, polar effect, stable-trim, recovery, score and retry comparison semantics for training-sloop-v1.
- **Coverage:** main and jib trim feedback; polar and stability assumptions; recoverable unstable state; speed non-offsettable safety invariant.
- **검토 초점:** 숨은 단일 정답 trim을 강제하지 않는지, 안전 보존 trim이 낮은 속도로 불이익을 받지 않는지.

### VR-L03-v0 — L03 돌풍·파도·Reef 대응

- **Claim:** Gust/wave episode effects, reef or sail-reduction meaning, terminal/recoverable boundary, safety-first score and retry semantics for training-sloop-v1.
- **Coverage:** gust and wave cues; reef timing/effect assumptions; simulated safety recovery and terminality; conservative mitigation pass eligibility.
- **검토 초점:** 실제 reef timing 지침으로 보이지 않는지, 보수적 조기 mitigation이 통과 가능하며 위험을 무시한 속도/진행이 상쇄되지 않는지.

### VR-L04-v0 — L04 조류 보정

- **Claim:** Current-to vector composition, heading/COG and STW/SOG divergence, drift, mark acceptance, recovery, score and retry comparison semantics.
- **Coverage:** current-to direction convention; vector composition and drift; mark acceptance and recoverable miss; slower valid correction acceptance.
- **검토 초점:** 방향 convention이 혼동되지 않는지, mark 목표가 실제 bearing 처방이 아닌 합성 시나리오의 판단 과제인지.

### VR-L05-v0 — L05 조석·수심·시정 판단

- **Claim:** Synthetic tide/depth/visibility timeline, depth datum, draft and clearance, pass/wait/return policy, terminality, score and retry comparison semantics.
- **Coverage:** synthetic tide and depth datum; draft and clearance assumptions; visibility and route state; pass/wait/return and terminality semantics.
- **검토 초점:** wait/return이 통과 가능한 안전 우선 결과인지, 실제 항로·수심·조석 판단으로 오해될 표현이 없는지.

## 7. controlled apply / reject 절차

검토 제출은 별도 보관물이다. registry에 반영하려면 **명시적 사용자/운영 권한**과 다음 전제조건이 모두 필요하다.

1. qualification declaration과 final attestation의 실명·signed timestamp가 일치한다.
2. 제출의 세 canonical source digest가 현재 파일과 정확히 일치한다.
3. claim, coverage, lesson ID, 모든 version binding이 동일하다. `TBD`/`null`은 불완전 binding이다.
4. outcome에 맞는 rationale·evidence·limitation·coverage finding이 완전하다.
5. 변경 전 signed submission을 provenance로 보관한다.

허용되는 registry 변경 후보 필드는 `reviewer`, `review_date`, `disposition`, `source_or_evidence_gap_reason`뿐이다. scenario/model/profile/coordinate/determinism/lesson/scoring/boundary contract는 이 절차에서 변경하지 않는다.

| 제출 상태 | 결과 |
|---|---|
| unsigned, unnamed, incomplete, stale, digest mismatch | registry 변경 없음; `assumption` 유지 |
| `needs_evidence` | registry 변경 없음; 근거 요청 보관 |
| `partially_validated` 또는 `rejected` | 별도 승인 후에만 해당 disposition 적용 후보 |
| `validated` + 구체 binding 모두 존재 | 별도 승인 후에만 `validated` 적용 후보. P1 gate와 제품 출시 승인은 여전히 별도 |

## 8. 제출 전 체크리스트

- [ ] YAML 안의 source digests가 §2와 일치한다.
- [ ] `VR-L01-v0`~`VR-L05-v0`가 정확히 한 번씩, registry 순서대로 존재한다.
- [ ] 모든 coverage 항목에 명시적 finding이 있다.
- [ ] reviewer declaration과 final attestation의 이름/서명이 일치한다.
- [ ] `needs_evidence`가 registry disposition으로 쓰이지 않았다.
- [ ] 새로운 sailing 수치·실제 항법 조언·출시 승인을 주장하지 않았다.
- [ ] submission은 registry를 직접 수정하지 않는다.

## 9. 패킷 한계

이 패킷은 reviewer를 찾거나 연락하지 않으며, 특정인에게 자격을 부여하거나 대표하지 않는다. reviewer qualification acceptance, registry controlled apply, P1 품질 gate, 제품 release는 별개 절차다.
