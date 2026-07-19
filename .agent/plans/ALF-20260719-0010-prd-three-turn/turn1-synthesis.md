# Turn 1 종합 — Alfred · Claude · agent_robin

## 공통 합의 (반영 후보)

1. **결정론적 모델 계약이 불충분하다** — 고정 timestep, 입력 tick, 난수/연산 순서, 업데이트 순서, event tie-break, reset semantics, replay 비교 출력과 허용오차가 필요하다. (Alfred, Claude, Robin)
2. **단위·좌표·방향 규약이 필요하다** — 좌표계, angle zero/rotation, wind `from` 대 current `to`, speed/distance/depth datum, vector composition order를 명시해야 한다. (Alfred, Claude, Robin)
3. **L01–L05에 레슨 계약이 필요하다** — initial state, required observation, permitted actions, checkpoints, pass/fail/safe recovery, hint/debrief, same-seed mastery를 각 레슨에 명시해야 한다. (Alfred, Claude, Robin)
4. **안전 우선 채점이 실행 규칙이어야 한다** — event severity, hard-block, speed 우선순위, duplicate-event, recovery credit, debrief cause 및 adversarial acceptance cases가 필요하다. (Alfred, Claude, Robin)
5. **도메인 검증 게이트가 release blocker여야 한다** — lesson-level claim/threshold register와 reviewer disposition을 두고, 검증되지 않은 값은 simulation-specific assumption으로 표시한다. (Alfred, Claude, Robin)
6. **브라우저 품질·접근성·파일럿·롤아웃이 측정 가능해야 한다** — release matrix, keyboard-only completion, visible focus, non-color status, reduced motion, performance/input latency budget, pilot metrics/owner/stop condition, version rollback이 필요하다. (Alfred, Claude, Robin)
7. **로컬 replay/telemetry 보존과 데이터 최소화 경계를 명시해야 한다.** (Alfred, Claude)

## 보완이 필요한 충돌/주의점

- 현 시점에 reef 시점, 안전 임계값, 폴라 수치, 수심 datum, 수치 허용오차, mastery threshold를 사실처럼 고정하면 안 된다. PRD에는 **초기값을 발명하지 않고**, versioned assumption·domain-validation gate·fixture source policy로 남긴다.
- Browser FPS, latency, WCAG conformance는 release target이 필요하지만 지원 브라우저/하드웨어·정확한 예산이 아직 미결정이다. PRD는 ‘출시 전에 정해야 하는 값’을 gate로 명확히 하며, 임의 숫자를 확정 사실로 쓰지 않는다.
- Robin은 한국 연안 맥락 시나리오의 고정 배너/공유 카드 라벨을 요구했다. 이는 MVP 외 콘텐츠이므로 MVP 구현 요구가 아니라 **후속 Korea-context scenario release gate**로 넣는다.
- Alfred/Claude는 현재 PRD의 ‘profile selection/comparison’ 잔존 문구가 Sloop-only MVP와 충돌한다고 지적했다. MVP에서는 assigned Training Sloop로 바꾸고, comparison은 post-MVP로 이동한다.

## Turn 2 질문

위 후보 중 어떤 변경을 P0/P1/Post-MVP로 분류할지, 어떤 문구를 규범적(normative) PRD 계약으로 확정할지, 그리고 사용자의 확정 범위(D1–D6/C1)를 깨지 않는 최소 robust delta가 무엇인지 합의한다.
