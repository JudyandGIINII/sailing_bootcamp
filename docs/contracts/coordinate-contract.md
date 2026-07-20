# Coordinate / Unit / Direction Contract v1 — Prototype Draft

> 상태: **기술 계약 초안**. 실제 해도·항법 datum·안전 수치를 표현하지 않는다.

## 목적

renderer, HUD, scenario, replay가 서로 다른 방향·단위 해석을 하는 것을 막는다. 모든 수역은 합성 평면이며, 이 계약은 `coordinate-contract-v1-draft`를 참조한다.

## canonical simulation convention

| 항목 | 선언 |
|---|---|
| 공간 | renderer-independent Cartesian plane |
| 원점 | scenario가 선언하는 `scenario_origin` |
| 축 | `+x = east`, `+y = north` |
| 거리 | canonical `meter` |
| 시간 | canonical `second` |
| 속력 | canonical `meter_per_second` |
| 각도 내부 표현 | radians, normalized to `[0, 2π)` |
| UI 표현 | degrees로 변환 가능하나 canonical state가 아님 |
| heading/course 0 | north, clockwise positive |
| wind | `from` direction을 명시적으로 저장 |
| current | `to` direction을 명시적으로 저장 |
| depth datum | scenario-declared **synthetic** datum; chart/harbor datum 아님 |
| 벡터 합성 | water-relative vessel velocity에 current `to` velocity를 더해 ground-relative velocity를 얻음 |
| rounding | simulation transition 내부에서 표시용 rounding 금지; replay comparison policy가 versioned comparison을 담당 |

## renderer adapter 규칙

PixiJS/Canvas의 화면축 변환, scale, camera transform은 `render` adapter에서만 수행한다. render transform은 canonical simulation state, event ledger, replay log, score calculation을 변경할 수 없다.

## required scenario declarations

모든 scenario는 contract version, origin, map bounds, synthetic scenario datum, unit labels, declared wave/wind/current semantics, permitted coordinate transforms를 가진다. P1B direction selector는 true north 기준 degree이며 wave/wind는 `from`, current는 `toward`다. P1B water-level datum 문자열은 정확히 `SYNTHETIC_SCENARIO_DATUM_V1`이며 chart·harbor·실제 tide datum을 뜻하지 않는다. 누락·unknown version·compatible하지 않은 convention은 load failure다.

P1B course geometry는 synthetic template identity의 일부다. `windward-return-v1`과 `triangle-v1`만 허용되며, origin `(0,0)`, bounds `x=-500..500`, `y=-250..1000` meter, template의 start/ordered marks/finish labels와 coordinates를 exact하게 보존한다. 이 값은 renderer, session physics, score, action authority와 결합되지 않는다.

## verification

- heading/COG, wind/course, drift HUD가 canonical convention과 일치하는지 contract tests
- current가 0일 때 ground-relative와 water-relative 결과가 declared fixture에서 일치하는지
- current가 있을 때 renderer를 제거하거나 cadence를 바꿔도 canonical state/replay가 달라지지 않는지
- 실제 지리/항법 datum 또는 검증되지 않은 safety claim이 fixture 또는 UI에 포함되지 않는지
