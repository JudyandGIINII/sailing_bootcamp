# Turn 2 종합 — 최소 Robust Delta 합의

## P0: 구현 전제 (세 검토자 공통 동의)

1. **§8.0 좌표·단위·방향 규약 신설**: 평면 좌표/원점, 각도 0°·회전 방향, wind `from`/current `to`, 거리·속력·시간 단위, 수심 datum, 벡터 합성 순서, 계약 version을 정의한다. 구체 datum/값은 검증 전 가정이다.
2. **§8.3 결정론 계약 신설**: fixed timestep, tick-indexed input log, RNG seed/consumption, state-update order, tie-break, pause/reset snapshot, replay comparison fields/tolerance policy를 정의한다. 구체 tolerance는 검증 레지스터 승인 전 provisional이다.
3. **§7.2 레슨 계약 스키마**: L01–L05 각각 initial state, required observation, permitted actions, checkpoints, pass/fail/safe recovery, hint/debrief, same-seed mastery, adversarial acceptance case를 선언한다. 세일링 임계값은 assumption/validation gate로 남긴다.
4. **§7.3 안전 우선 채점 실행 규칙**: severity, hard-block, speed 대비 precedence, duplicate suppression, recovery credit, cause-linked debrief를 정의한다.
5. **Sloop-only 일관성**: MVP 흐름은 ‘선택한 프로필’이 아니라 ‘배정된 `training-sloop-v1`’을 사용한다. profile comparison/selection은 post-MVP로 이동한다.
6. **FR-10 범위 축소 명시**: MVP 구현은 Sloop에 필요한 최소 profile fields만 요구하며, future hull/rig 확장은 migration-free extension objective로 제한한다.

## P1: 출시 게이트

7. **도메인 검증 레지스터**: 모든 물리·안전·채점·mastery 가정에 source/assumption, version, reviewer, date, disposition을 기록하고, 미승인 항목이 있는 레슨은 출시 대상에서 제외한다.
8. **브라우저·접근성·파일럿·롤백 release matrix**: 수치(FPS/latency), 지원 브라우저, WCAG 수준, pilot metrics, owner, stop condition, rollback/compatibility는 별도 승인 artifact에서 확정한다. 현재 숫자나 준수 수준을 발명하지 않는다.
9. **Replay/telemetry privacy boundary**: 기본은 local-only, 서버 전송은 별도 제품 결정/동의/보존/삭제 정책 전까지 금지.

## Post-MVP

10. 영종도/덕적도 정적 시나리오는 고정 배너·공유 라벨을 갖는 별도 Korea-context release gate 후에만 공개한다.
11. Dinghy와 다른 hull/rig 선택·비교 UI는 post-MVP 카탈로그 확장이다.

## 남은 사용자 결정 후보

- 서버 기반 코치 리뷰/분석을 장기 로드맵에 둘지(현재 제안: local-only default)
- support matrix, performance, accessibility, pilot gate의 구체 수치·승인 주체·일정

## Turn 3 질문

세 검토자는 위 P0/P1/Post-MVP delta가 충분히 robust한지, PRD에 바로 넣을 문구가 범위를 넓히거나 검증되지 않은 사실을 암시하지 않는지 마지막으로 검토한다. 최종 응답은 accept/reject와 최대 5개 수정만 제시한다.
