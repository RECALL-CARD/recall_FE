# Recall Card · React Frontend

기존 Recall Card의 N1 단어장 및 한자 데이터를 사용한 React + TypeScript + Vite 프론트엔드 프로토타입입니다.

## 기술 스택

- React
- TypeScript
- Vite
- lucide-react
- LocalStorage (백엔드 연결 전 임시 저장소)

## 실행

```bash
npm install
npm run dev
```

브라우저에서 Vite가 출력하는 주소를 엽니다. 기본 주소는 `http://localhost:5173`입니다.

## 빌드

```bash
npm run build
npm run preview
```

## 포함된 화면과 기능

- 홈 대시보드 및 학습 현황
- N1 DAY 01~20 라이브러리
- 카드 목록 검색
- 카드 추가
- 카드 앞/뒷면 학습
- 알고 있음 / 다시 보기 분류
- 학습 타이머
- 즐겨찾기
- 사용자 지정 카드 모음
- 한자 음훈독 검색 및 상세 예시
- 단어장별 진행률 통계
- JSON 백업 및 복원
- 브라우저 음성 합성 발음 재생

## 데이터

`src/data/default-library.json`과 `src/data/kanji.json`은 기존에 제공된 Recall Card HTML에 포함된 기본 데이터를 추출한 파일입니다.

- 폴더 4개
- 단어장 20개
- 카드 2,026개
- 한자 46개
- 한자 예시 184개

카드 ID, 단어, 읽는 법, 뜻, 출처 페이지 등의 원본 기본 데이터는 그대로 유지했습니다.

## API 연결 준비

`src/services/apiClient.ts`에는 Spring Boot API 연결용 공통 fetch 클라이언트를 분리해 두었습니다. 현재 화면은 아직 이 API를 호출하지 않고 로컬 저장소를 사용합니다. 백엔드 개발 시 이 서비스 계층을 연결하면 됩니다. 개발 서버의 `/api` 요청은 `http://localhost:8080`으로 프록시되도록 설정했습니다.

`.env.example`의 `VITE_API_BASE_URL`로 API Prefix를 변경할 수 있습니다.

## 저장 방식 및 주의사항

현재 버전은 백엔드 연결 전 UI와 학습 흐름을 확인하기 위해 LocalStorage에 변경 사항을 저장합니다. 데이터는 현재 브라우저에만 저장되며 다른 기기와 동기화되지 않습니다.

브라우저 저장소를 비우거나 다른 브라우저에서 사용하기 전에 상단의 `백업` 기능으로 JSON을 내려받으세요.

기존 구버전 HTML의 LocalStorage 데이터와 자동으로 연결되지는 않습니다. 기존 앱의 JSON 백업은 이 프로토타입의 JSON 백업과 형식이 다르므로, Spring Boot 백엔드 작업 단계에서 별도의 v7 마이그레이션 기능을 연결해야 합니다.

## 다음 연결 단계

- React 화면에서 사용하는 저장소 계층을 Spring Boot API 어댑터로 교체
- 카카오 로그인 및 인증 상태 연결
- 사용자별 MySQL 데이터 조회 및 저장
- Swagger/OpenAPI 계약에 맞춘 API 연동
