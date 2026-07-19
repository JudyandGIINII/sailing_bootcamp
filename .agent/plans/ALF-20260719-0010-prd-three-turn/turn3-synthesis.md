# Turn 3 최종 합의 — PRD 강화 기준

## 참여 및 검증

- Alfred: 3회차 구조 검증 통과 (`PASS READY_FOR_HERMES_REVIEW`)
- Claude: 3회차 최종 조정 의견 수렴
- agent_robin: 3회차 최종 조정 의견 수렴

## 최종 판정

**REVISE → 아래 최소 패치를 반영한 뒤 Hermes가 독립 검증한다.**

## 합의된 P0 강화

1. Sloop-only MVP에 맞춰 보트 프로필 선택·비교 문구를 제거하고 `training-sloop-v1` 배정 흐름으로 통일한다.
2. L01–L05마다 initial state, required observations, permitted actions, checkpoints, pass/fail/safe-recovery 의미, hint/debrief, retry comparison, validation-record ID를 갖는 레슨 계약을 요구한다. 검증되지 않은 물리·안전 수치나 mastery 숫자는 넣지 않는다.
3. 안전 채점은 안전 위반 비상쇄, 원인 연결, 동일 위험 에피소드 중복 평가 방지, 회복 행동 설명을 규정한다. 즉시 실패/계속/회복 허용은 보편 hard-block이 아니라 레슨별 계약과 도메인 승인으로 정한다.
4. 좌표·단위·방향 규약은 필수 선언 필드로 만든다: 좌표/원점, 각도/회전, wind-from/current-to, 단위, 수심 기준, 벡터 합성, 계약 버전.
5. 결정론 계약은 동일 replay 식별자의 주요 상태·이벤트·채점 결과 재현, 입력 순서 식별, pause/reset 의미, 비교 대상·정책의 사전 승인을 요구한다. 구현 알고리즘과 수치 tolerance는 기술 검증 문서로 분리한다.
6. MVP의 프로필 카탈로그 요구는 Training Sloop에 필요한 버전형 최소 필드로 제한하고, 다중 선체/리그 비교는 post-MVP로 이동한다.

## 합의된 P1 출시 게이트

7. 도메인 검증 레지스터: 가정/근거, version, reviewer, date, disposition을 lesson-level로 기록하고 미승인 레슨은 출시하지 않는다.
8. replay/telemetry는 local-only 기본이며, 서버 전송은 별도의 사용자 제품 결정·동의·보존·삭제 정책 전까지 금지한다.
9. 지원 브라우저, 성능, 접근성, 파일럿, rollout/rollback은 구체값을 발명하지 않고 §12의 승인 artifact와 결정 게이트로 남긴다.

## Post-MVP 경계

- 한국 연안 맥락 시나리오는 기존의 정적·버전형·비항법 고지 요건을 유지하고, 구체 UI 형식(고정 배너/공유 카드)은 후속 콘텐츠 승인 시 정한다.
- Dinghy 및 기타 hull/rig 선택·비교 UI는 post-MVP다.

## 남은 명시적 사용자 결정

1. 물리·안전·채점 가정의 도메인 승인자와 반려 레슨의 처리 방식
2. 안전 위반별 세션 동작(즉시 실패/계속+보상 제한/회복 허용)
3. 브라우저·성능·접근성·파일럿·rollout/rollback의 승인 주체·수치·일정
4. 장기 서버 기반 코치 리뷰/분석 여부와 동의·보존·삭제 정책
5. 영종도·덕적도 콘텐츠의 명칭·단순화·출처·공개 승인 정책
