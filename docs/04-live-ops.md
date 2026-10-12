# 04. 운영 (Live Ops) & 수익화

## 수익 모델: 하이브리드 (IAA 70% : IAP 30% 목표)
### 광고 배치
| 위치 | 유형 | 규칙 |
|---|---|---|
| 게임오버 부활 | 리워드 | 1판 1회. 가장 높은 eCPM·opt-in 률 |
| 결과 화면 코인 2배 | 리워드 | 판마다 |
| 상점 무료 코인 | 리워드 | +50 코인 |
| 판 종료 후 | 전면 | **첫 4판 면제**, 3판마다, 최소 120초 간격, 광고 제거 구매자 제외 |

배너 광고는 v1에 넣지 않는다(보드 가림·체감 품질 하락 대비 수익 미미). 실험 후보로만 유지.

### IAP 상품 (`src/services/iap.ts`)
| ID | 가격(KRW) | 내용 |
|---|---|---|
| `starter_pack` | ₩4,900 | 광고 제거 + 1,000코인 + 망치/새 블록 5개 (1회 한정, 최고 가성비) |
| `remove_ads` | ₩3,900 | 전면 광고 제거 (리워드는 유지 — 유저가 원해서 보는 광고) |
| `coins_500` | ₩1,200 | |
| `coins_3000` | ₩5,900 | +20% 보너스 |

### SDK 연결 (출시 작업)
- 광고: AppLovin MAX 또는 AdMob(`@capacitor-community/admob`) → `setAdProvider()` 로 목업 교체.
- 결제: RevenueCat(`@revenuecat/purchases-capacitor`) → `setIapProvider()`. 영수증 검증·복원·환불 처리 위임.
- 분석: Firebase Analytics 또는 GameAnalytics → `setAnalyticsProvider()`.
- iOS: ATT 동의 팝업은 **두 번째 세션**에 노출 (첫 세션 이탈 방지).

## KPI 목표 (하이브리드 캐주얼 상위 25% 벤치마크)
| 지표 | 목표 |
|---|---|
| 튜토리얼 완료율 | ≥ 90% |
| D1 / D7 / D30 리텐션 | 45% / 18% / 7% |
| 평균 세션 길이 | ≥ 9분 |
| 일 평균 판수 | ≥ 6 |
| 리워드 광고 시청/DAU | ≥ 2.5 |
| ARPDAU | ≥ $0.08 |
| CPI(US, Android) | ≤ $0.40 → LTV/CPI ≥ 1.3 이면 UA 확대 |

## 이벤트 택소노미 (`src/services/analytics.ts`)
| 이벤트 | 파라미터 | 질문 |
|---|---|---|
| `app_open`, `session_start` | platform, n | 활성 사용자 |
| `tutorial_begin` / `tutorial_complete` | – | FTUE 퍼널 |
| `game_start` / `game_end` | mode, score, moves, lines, revives, sec | 판 길이·난이도 |
| `level_start` / `level_complete` / `level_fail` | level, stars, moves, revives | 레벨별 이탈 지점 |
| `daily_complete` | medal, streak | 데일리 참여 |
| `revive` | mode, source(ad/coins) | 부활 전환율 |
| `powerup_use` | kind, mode | 아이템 수요 |
| `ad_request` / `ad_show` / `ad_reward` | type, placement | 광고 퍼널 |
| `iap_attempt` / `iap_purchase` | product, price | 결제 전환 |
| `coins_earn` / `coins_spend` | source/sink, amount | 경제 인플레이션 |

**핵심 대시보드**: ① FTUE 퍼널 ② 레벨별 실패율 히트맵(> 40%인 레벨은 리모트 컨피그로 완화) ③ 코인 수입/지출 비율(1.0–1.3 유지) ④ 광고 placement별 eCPM×빈도.

## 리모트 컨피그 (`src/meta/remoteConfig.ts`)
`VITE_REMOTE_CONFIG_URL` 의 JSON을 앱 시작 시 비동기로 받아 **다음 실행부터** 적용(부팅 지연 0). 바꿀 수 있는 것:
- 밸런스 전부(`tuning`): 블록 가중치, 도움 확률, 콤보 유예, 점수
- 광고 빈도/면제 판수/쿨다운
- 아이템 가격, 보상량, `coinMultiplier`(이벤트), `eventBanner`(홈 배너 문구)

예: 주말 코인 2배 이벤트
```json
{ "coinMultiplier": 2, "eventBanner": "🌷 주말 꽃축제! 코인 2배" }
```
> 밸런스 값 변경은 반드시 먼저 `npm run sim -- --gate` 로 검증 후 배포.

## 라이브 이벤트 캘린더 (예시)
| 주기 | 이벤트 |
|---|---|
| 매일 | 오늘의 챌린지 (자동, 날짜 시드) |
| 매주 주말 | 코인 2배 |
| 월 1회 | 테마 주간(벚꽃/해바라기/단풍/눈꽃) — 배너 + 보상 상향 |
| 분기 | 신규 블록 스킨/정원 테마 (앱 업데이트) |

## A/B 테스트 백로그
1. 전면 광고 빈도 3판 vs 4판 (리텐션 vs ARPDAU)
2. 도움 블록 확률 0.3 vs 0.4 (세션 길이)
3. 스타터팩 노출 시점: 첫 실행 vs 3판 후
4. 부활 코인 가격 250 vs 200

## 고객 지원 / 품질 운영
- 버그 문의 시 설정 화면 버전 + 모드/레벨 확인. 모험 레벨은 번호만으로 배치 재현 가능, 데일리는 날짜로 재현 가능.
- 세이브는 매 수마다 로컬 저장(250ms 디바운스) + 백그라운드 진입 시 즉시 저장 → 강제 종료에도 진행 유실 없음.
- 세이브 스키마 변경 시 `hydrate()` 가 기본값을 병합하므로 구버전 세이브가 깨지지 않음.
- 크래시 모니터링: Firebase Crashlytics(네이티브) + `window.onerror` → 분석 이벤트 전송(출시 작업).

## 릴리즈 프로세스
1. `npm run verify` 통과 (CI)
2. `package.json` 버전 올림 → Android `versionCode/versionName`, iOS `CFBundleVersion` 동기화
3. `npm run cap:sync`
4. 내부 테스트 트랙(Play) / TestFlight 배포 → 스모크 체크리스트
5. 단계적 출시: 5% → 20% → 50% → 100% (크래시율 < 0.5%, ANR < 0.3% 확인하며)
