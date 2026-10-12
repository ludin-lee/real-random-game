# 🌸 Bloom Blocks (블룸 블록)

> 블록을 채우면 꽃이 피는, 힐링 블록 퍼즐. iOS / Android 출시용.

8×8 보드에 블록을 끌어다 놓고 가로·세로 줄을 채워 지우는 검증된 장르(블록 블라스트류)에
**꽃 정원 연출**, **정원 모험(레벨) 모드**, **오늘의 챌린지(전 세계 동일 시드)** 를 더했습니다.

| 클래식 | 정원 모험 | 오늘의 챌린지 |
|---|---|---|
| 무한 최고점 도전, 콤보·올클리어 | 꽃봉오리를 피우는 목표형 레벨, 무한·결정적 생성 | 날짜 시드, 메달 3단계, 연속 출석 |

## 빠른 시작
```bash
npm install
npm run dev            # http://localhost:5173  (모바일 기기로 같은 Wi-Fi에서 접속 가능)
npm run verify         # 전체 검증: 타입 → 단위 → 밸런스 게이트 → 빌드 → E2E
npm run sim            # 봇 시뮬레이션 밸런스 리포트
npm run cap:android    # Android Studio로 네이티브 빌드
```

## 문서
| 문서 | 내용 |
|---|---|
| [01 기획서](docs/01-game-design.md) | 시장 근거, 핵심 루프, 규칙, 모드, 경제, 온보딩, 로드맵 |
| [02 아트 & UX](docs/02-art-ux.md) | 아트 디렉션, 팔레트, 레이아웃, 조작감 체크리스트 |
| [03 하네스 엔지니어링](docs/03-harness-engineering.md) | 아키텍처, 테스트 피라미드, 밸런스 시뮬·게이트, E2E, CI, AI 에이전트 하네스 |
| [04 운영 & 수익화](docs/04-live-ops.md) | 광고/IAP 설계, KPI, 이벤트 택소노미, 리모트 컨피그, 라이브 이벤트, 릴리즈 |
| [05 스토어 출시](docs/05-store-release.md) | 빌드, 스토어 문구(KO/EN), ASO, 정책, 체크리스트 |

## 구조
```
src/core      순수 게임 규칙 (시드 RNG, 상태 머신, 생성기, 레벨, 봇)
src/render    Canvas 렌더러 + 절차적 스프라이트/파티클
src/ui        DOM 화면 (홈, HUD, 시트)
src/services  광고·결제·분석·햅틱·오디오(WebAudio 합성) 파사드
src/meta      세이브, 리모트 컨피그, i18n
sim/          밸런스 시뮬레이터
tests/        단위 + 아키텍처 테스트
e2e/          Playwright 스모크 (스크린샷 생성)
android/      Capacitor Android 프로젝트
```

에셋 파일 0개 — 그래픽과 사운드 모두 코드로 생성됩니다 (JS+CSS gzip ≈ 27KB).
