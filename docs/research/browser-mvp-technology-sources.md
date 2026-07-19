# 브라우저 세일링 MVP — 기술 선택 조사 근거

> 조사일: 2026-07-19 KST
> 범위: 브라우저 기반 2D Training Sloop 교육 시뮬레이터의 렌더링·빌드·테스트 후보. 실제 항해 물리나 안전 수치의 근거가 아니다.

| 후보 | 공식 문서 | 직접 확인한 내용 | 설계 시사점 |
|---|---|---|---|
| Phaser | https://docs.phaser.io/phaser/getting-started/what-is-phaser | Phaser는 WebGL/Canvas 렌더링을 제공하는 HTML5 2D 웹 게임 프레임워크이며 JavaScript/TypeScript 개발을 지원한다고 설명한다. | Scene/input/camera 편의성이 높다. 단, framework loop/physics가 교육 시뮬레이션의 authoritative state가 되지 않게 분리해야 한다. |
| PixiJS | https://pixijs.com/8.x/guides/getting-started/quick-start | PixiJS v8 문서는 scene graph, render loop, ticker, renderer, graphics/text/interaction 등의 렌더링 구성요소를 제공한다. | renderer만 담당시키고 application/simulation loop를 독립시키기에 적합하다. 입력·카메라·게임 상태는 직접 설계해야 한다. |
| Vite | https://vite.dev/guide/ | Vite 문서는 native ES modules와 HMR을 활용하는 현대 웹 프로젝트용 build tool 및 typed plugin/JS API를 설명한다. | TypeScript 브라우저 앱의 빠른 local development/build base로 적합하다. |
| Vitest | https://vitest.dev/guide/ | Vitest는 Vite 기반의 차세대 테스트 프레임워크라고 설명하며 browser mode·coverage·test projects 등을 문서화한다. | pure sim/contract/replay 회귀 테스트를 Vite toolchain 안에서 실행하는 후보다. |
| Playwright | https://playwright.dev/docs/intro | Playwright Test는 runner/assertions/isolation/parallelization을 묶은 E2E framework이고 Chromium/WebKit/Firefox를 지원한다고 설명한다. | keyboard-only flow, HUD/debrief, local-only network, cross-engine browser 증거 수집에 적합하다. |

## 조사 한계

- 이 문서는 2026-07-19에 확인한 공식 문서 설명을 요약한 것이다.
- npm package version, license compatibility, current browser matrix, bundle size, API compatibility는 구현 bootstrap 직전에 lockfile 후보로 다시 확인해야 한다.
- Phaser/PixiJS 중 어느 것을 채택해도 deterministic simulation, replay, score/debrief causality는 renderer/framework 외부의 TypeScript core가 authoritative source여야 한다.
