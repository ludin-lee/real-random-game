# 03. 하네스 엔지니어링

목표: **사람이든 AI 에이전트든, 이 레포를 고친 사람이 "망가뜨리지 않았다"는 것을 명령 한 줄로 증명**할 수 있게 한다.

```bash
npm run verify   # typecheck → unit → balance gate → build → e2e (모두 통과해야 머지)
```

## 1. 아키텍처: 순수 코어 + 얇은 셸
```
src/core/      순수 규칙 엔진 (DOM·시간·Math.random 금지, 시드 RNG만 사용)
  rng.ts         mulberry32, 상태 = uint32 하나 → 저장/재현 가능
  board.ts       배치·줄 판정
  shapes.ts      블록 39종 (ASCII 아트로 정의)
  generator.ts   공정한 트레이 생성
  game.ts        상태 머신: newGame / place / revive / hammer / shuffle → GameEvent[]
  levels.ts      절차적 모험 레벨, 데일리 시드
  bot.ts         휴리스틱 AI (밸런스 시뮬 + 인게임 힌트 공용)
  tuning.ts      모든 밸런스 상수
src/render/    Canvas 렌더러 (GameEvent → 연출)
src/ui/        DOM 화면 템플릿
src/services/  광고·결제·분석·햅틱·오디오 파사드 (목업 ↔ 실제 SDK 교체 가능)
src/meta/      세이브, 리모트 컨피그, i18n
```
**핵심 규칙**: 코어는 `GameEvent[]` 만 반환하고, 연출/사운드/저장은 셸이 이벤트를 보고 처리. 덕분에 코어는 Node에서 초당 수천 판 돌릴 수 있다.

`tests/architecture.test.ts` 가 이 규칙을 **기계적으로 강제**한다 (core에서 DOM/서비스 import·`Math.random` 사용 시 실패).

## 2. 테스트 피라미드
| 층 | 명령 | 무엇을 보장 | 시간 |
|---|---|---|---|
| 타입 | `npm run typecheck` | strict TS | ~2s |
| 단위 | `npm test` | 줄 판정, 점수식, 콤보 유예, 즉사 트레이 없음(300 랜덤 보드), 결정성, 세이브 왕복, 레벨 200개 유효성 | <1s |
| 밸런스 | `npm run sim -- --gate` | 봇 300판+ 결과가 목표 밴드 안 | ~15s |
| E2E | `npm run e2e` | 실제 빌드를 Pixel 7 뷰포트에서 실제 포인터 드래그로 플레이, 튜토리얼→클리어→게임오버→결과, 모험 클리어→다음 레벨, 새로고침 후 이어하기, 상점/설정 | ~20s |

## 3. 밸런스 시뮬레이터 (`sim/balance.ts`)
결정적 시드로 봇이 클래식 N판, 데일리 14일, 모험 1–100레벨×3회를 플레이하고 분포를 출력한다.

### Balance gates
| 지표 | 허용 밴드 | 현재(v1.0) |
|---|---|---|
| classic.moves p10 | 25–400 | 38 |
| classic.moves p50 | 60–1500 | 89 |
| adventure 1–10 승률 | ≥ 85% | 93% |
| adventure 11–25 승률 | ≥ 65% | 82% |
| adventure 26–50 승률 | 45–98% | 59% |
| adventure 51–100 승률 | 20–95% | 30% |
| daily 브론즈 달성률 | ≥ 50% | 86% |
| daily 골드 달성률 | 2–80% | 21% |

`tuning.ts` 나 `levels.ts` 의 숫자를 바꾸면 게이트가 즉시 "너무 쉬워짐/어려워짐"을 잡아낸다. 리모트 컨피그로 실험할 값도 먼저 시뮬에서 돌려본다:
```bash
npm run sim -- --games 2000
```

## 4. E2E 훅
`?e2e` 또는 `?debug` 쿼리(또는 dev 빌드)에서만 `window.__bloom` 이 노출된다:
- `app` — 레이아웃 좌표 조회(드래그 좌표 계산용)
- `autoMove()` — 봇 수를 **실제 이벤트 파이프라인**(연출·저장 포함)으로 실행
- `save()`, `events()` — 세이브/분석 이벤트 검증

E2E는 매 실행마다 `e2e/.results/*.png` 스크린샷을 남겨 시각 회귀를 사람이(혹은 에이전트가) 눈으로 확인할 수 있게 한다.

## 5. AI 에이전트 하네스
- `CLAUDE.md` : 에이전트용 작업 규칙(아키텍처 경계, 검증 명령, 밸런스 수정 절차).
- 피드백 루프가 전부 CLI + 결정적 → 에이전트가 수정→검증→스크린샷 확인을 스스로 반복 가능.
- 버그 리포트는 `seed` + 이동 기록만 있으면 `newGame({seed})` 로 정확히 재현.

## 6. CI (`.github/workflows/ci.yml`)
PR마다 `npm run verify` 전체 실행, E2E 스크린샷을 아티팩트로 업로드.
