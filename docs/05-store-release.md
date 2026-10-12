# 05. 스토어 출시 가이드

## 빌드
```bash
npm ci
npm run verify          # 전체 검증
npm run cap:android     # Android Studio 열림 → Build > Generate Signed Bundle (AAB)
npx cap add ios         # macOS 최초 1회 (CocoaPods 필요)
npm run cap:ios         # Xcode 열림 → Product > Archive
```
- 패키지명/번들 ID: `com.bloomblocks.puzzle` (`capacitor.config.ts`)
- 세로 고정: Android `screenOrientation="portrait"` 적용됨 / iOS는 Xcode에서 Portrait만 체크
- 아이콘·스플래시: `public/icon.svg` → 1024px PNG 후 `npx @capacitor/assets generate`

## 스토어 등록 정보
### 한국어
- **앱 이름**: 블룸 블록 - 꽃피는 블록 퍼즐
- **짧은 설명(80자)**: 블록을 채우면 꽃이 피어나요! 머리가 맑아지는 힐링 블록 퍼즐 🌸
- **설명**:
  > 블록을 끌어다 놓고, 가로·세로 줄을 가득 채워보세요. 줄이 사라질 때마다 꽃잎이 흩날려요!
  >
  > 🌸 클래식 — 끝없이 즐기는 최고 점수 도전
  > 🌿 정원 모험 — 꽃봉오리를 피워 레벨을 깨는 퍼즐 여행
  > 🌻 오늘의 챌린지 — 전 세계가 같은 블록으로 겨루는 매일의 도전
  >
  > ✔ 와이파이 없이 오프라인 플레이  ✔ 시간 제한 없음  ✔ 한 판 3분, 언제 어디서나
  > ✔ 콤보·올 클리어로 터지는 시원한 손맛  ✔ 차분한 음악과 부드러운 진동
- **키워드(iOS 100자)**: 블록,퍼즐,블록퍼즐,블럭,힐링,두뇌,오프라인,무료게임,테트리스,1010,브레인,큐브,꽃

### English
- **Name**: Bloom Blocks: Block Puzzle
- **Subtitle**: Relaxing blossom brain game
- **Short description**: Fill the lines, watch flowers bloom! A calm, juicy block puzzle 🌸
- **Keywords**: block,puzzle,blast,brain,offline,relaxing,classic,wood,cube,1010,game,free,flower

## 등급 / 정책
- 연령: 전체이용가 / 4+ / PEGI 3. 폭력·도박 요소 없음(가챠 없음 → 확률 공개 의무 없음).
- 광고 포함 / 인앱 구매 포함 표시.
- 개인정보: 광고 ID(IDFA/GAID), 분석 이벤트, 크래시 로그 수집 → Play **데이터 보안** 섹션 및 App Store **개인정보 라벨** 작성. iOS ATT 필요.
- 어린이 대상 앱으로 등록하지 않음(Families 정책 회피, 광고 네트워크 제약 방지).
- 개인정보 처리방침 URL 필수 (GitHub Pages 등에 게시).

## 출시 전 체크리스트
- [ ] 목업 광고/결제/분석 → 실제 SDK 교체, 테스트 광고 단위로 검증 후 실 단위
- [ ] IAP 상품 ID 4종 콘솔 등록 (`starter_pack`, `remove_ads`, `coins_500`, `coins_3000`)
- [ ] 결제 복원 버튼 동작 (iOS 심사 필수)
- [ ] 저사양 Android(RAM 2GB)에서 60fps 근접 확인
- [ ] 노치/다이내믹 아일랜드/제스처 바 safe-area 확인
- [ ] 뒤로가기 버튼: 시트 닫기 → 일시정지 → 앱 종료
- [ ] 백그라운드 → 복귀 시 이어하기, 강제 종료 후 이어하기
- [ ] 비행기 모드 플레이
- [ ] 스크린샷 5장 × (6.7", 6.5", 5.5", Android 폰, 7"/10" 태블릿)
- [ ] 소프트 런칭: 필리핀·캐나다 2주 → KPI(D1 ≥ 40%) 확인 후 글로벌
