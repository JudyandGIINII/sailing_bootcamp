alfred_response:
  schema_version: 1
  task_id: ALF-20260719-0050-prd-three-turn-turn3
  plan_version: 1
  status: READY_FOR_HERMES_REVIEW
  planning_mode: LIGHT
  ambiguity_score: 0.0
  confidence: high
  risk_level: low
  user_approval_required: false
  ouroboros_used: false
  evidence_complete: true
  critical_open_questions: []

final_disposition: REVISE

concrete_corrections:
  1. §8.3의 fixed timestep, RNG 소비 순서, state-update order, tie-break는 PRD의 제품 요구가 아니라 후속 기술 계약으로 분리한다. PRD에는 동일 replay 식별자의 관측 가능한 결정론, 버전 관리, 비교 정책 승인만 규정하며 provisional tolerance는 허용하지 않는다.
  2. §7.2의 `same-seed mastery`는 정의되지 않아 검증할 수 없으므로 동일 조건 재도전 비교로 대체한다. 레슨별 물리·안전 임계값과 통과 기준은 도메인 검증 레지스터 승인 전까지 규범값으로 기재하지 않고, adversarial case는 PRD 필드가 아닌 검증 항목으로 둔다.
  3. §7.3의 보편적 `hard-block`은 D1–D6/C1에서 확정되지 않은 사용자 경험 결정이다. 확정된 불변식은 “안전 위반을 속도·점수·진행 보상이 상쇄하지 못함”으로 제한하고, 즉시 실패·계속 진행·회복 허용 여부는 레슨별 계약과 도메인 승인 대상으로 둔다.
  4. MVP의 프로필 선택·비교 표현과 광범위한 카탈로그 요구를 제거한다. `training-sloop-v1` 배정 흐름만 남기고 FR-10/FR-12 및 관련 수용 기준의 다중 hull/rig 비교는 Post-MVP로 이동한다. `migration-free` 보장은 근거가 없으므로 버전 호환 확장 목표로 낮춘다.
  5. P1 release matrix는 미정 수치나 준수 수준을 PRD 요구처럼 암시하지 않도록 §12의 출시 전 결정 게이트로 둔다. local-only replay는 MVP 개인정보 경계로 명시하되, 한국 맥락 콘텐츠의 고지는 결과 중심 요구로 유지하고 `fixed banner` 같은 미승인 UI 처방은 추가하지 않는다.

ordered_prd_patch_outline:
  1. "§3.2: ‘보트 프로필 선택’ JTBD 행을 MVP 사용자 흐름에서 제거하고 §5.3 Post-MVP 프로필 선택·비교 항목으로 이동한다."
  2. "§6.3: 기존 정적·버전형 콘텐츠, 출처·단순화·비항법 고지 요구를 유지하고 별도 고정 배너나 공유 UI 형식은 규정하지 않는다."
  3. "§7.1: ‘선택한 보트 프로필’을 ‘배정된 training-sloop-v1’으로 바꾸고, 디브리프의 ‘보트 프로필 차이’ 및 재도전의 profile 선택 의미를 제거한다."
  4. "§7.2: L01–L05에 initial state, required observations, permitted actions, checkpoints, pass/fail/safe-recovery semantics, hint/debrief, retry-comparison, validation-record ID를 추가한다. 승인되지 않은 수치 임계값과 mastery 기준은 넣지 않는다."
  5. "§7.3: 안전 위반 비상쇄, 원인 연결, 동일 위험 에피소드의 중복 평가 방지, 안전 회복 행동의 별도 설명을 규정한다. hard-block 여부는 레슨 계약으로 위임한다."
  6. "§8.0 신설: 좌표 프레임·원점, 각도와 회전 방향, wind-from/current-to 의미, 단위, 수심 기준, 벡터 합성 규칙, 계약 버전을 필수 선언 필드로 둔다. 실제 항법 datum 또는 검증되지 않은 물리값을 주장하지 않는다."
  7. "§8.3 신설: 동일 scenario/seed/input-log/model/profile version의 주요 상태·이벤트·채점 결과 재현, tick 또는 이에 준하는 입력 순서 식별, pause 비진행, reset 초기상태 복원, 비교 대상·정책의 사전 승인을 요구한다. 구현 알고리즘과 수치 tolerance는 기술 검증 문서로 분리한다."
  8. "§9: FR-01/08을 새 결정론 계약에 연결하고, FR-10은 training-sloop-v1에 필요한 버전형 최소 필드로 축소한다. FR-12는 프로필 간 비교 대신 해당 Sloop의 환경·조작·결과 인과 설명으로 바꾸며 다중 프로필 비교 요구는 Post-MVP로 이동한다."
  9. "§10: 광범위한 카탈로그 및 프로필 비교 수용 기준을 MVP에서 제거한다. domain-validation record가 없는 레슨은 출시 불가로 표시하고, replay는 기본 local-only이며 외부 전송이 없음을 검증 대상으로 추가한다."
  10. "§12: 도메인 승인 권한, 레슨별 안전 실패 의미, 지원 브라우저·성능·접근성·파일럿 기준과 승인 주체, rollout/rollback 정책, 서버 기반 분석 여부, 한국 맥락 콘텐츠 게이트를 명시적 미결정 항목으로 기록한다."

remaining_explicit_user_decisions:
  - L01–L05의 물리·안전·채점 계약을 누가 어떤 근거로 승인하며, 미승인 또는 반려된 레슨을 어떻게 disposition할지
  - 안전 위반별로 즉시 실패, 계속 진행하되 보상 제한, 안전 회복 허용 중 어떤 세션 동작을 적용할지
  - 지원 브라우저, 성능 예산, 접근성 준수 수준, 파일럿 성공·중단 기준, 승인 주체, 일정 및 rollout/rollback 정책
  - 서버 기반 코치 리뷰·분석을 장기 로드맵에 둘지와, 포함할 경우 동의·보존·삭제 정책
  - 영종도·덕적도 Post-MVP 콘텐츠의 명칭, 단순화 수준, 출처 정책 및 공개 승인 주체
