# 📋 스타일가이드 생성기 (Next.js + Tailwind CSS)

**KRDS(한국형 디자인 시스템)** 색상이 적용된 UI 스타일 가이드 자동 생성 웹 앱

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38bdf8?logo=tailwindcss)

## ✨ 주요 기능

- 📁 **파일 업로드** - HTML, CSS, JS 파일 드래그앤드롭 지원
- 📦 **ZIP 파일 지원** - 압축 파일 자동 해제 및 분석
- 🖼️ **이미지 처리** - 이미지 파일 Base64 변환 및 경로 자동 매핑
- 📊 **자동 분석** - CSS 클래스, 컴포넌트, 색상 자동 추출
- 🎨 **KRDS 디자인** - 한국형 디자인 시스템 색상 적용
- ⚙️ **커스터마이징** - 포함할 섹션 및 옵션 선택 가능
- 👁️ **실시간 미리보기** - 생성된 스타일 가이드 즉시 확인

## 🚀 시작하기

### 1. 의존성 설치

```bash
cd styleguide-app
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

### 3. 프로덕션 빌드

```bash
npm run build
npm start
```

## 📁 프로젝트 구조

```
styleguide-app/
├── src/
│   ├── app/
│   │   ├── globals.css      # 전역 스타일 및 Tailwind
│   │   ├── layout.tsx       # 루트 레이아웃
│   │   └── page.tsx         # 메인 페이지
│   ├── lib/
│   │   ├── analyzer.ts      # 파일 분석 로직
│   │   ├── builder.ts       # 스타일가이드 HTML 생성
│   │   └── imageStore.ts    # 이미지 경로 변환
│   └── types/
│       └── index.ts         # TypeScript 타입 정의
├── tailwind.config.ts       # Tailwind 설정 (KRDS 색상)
├── next.config.js           # Next.js 설정
├── package.json
└── README.md
```

## 🎨 KRDS 색상 시스템

Tailwind CSS에 KRDS 색상이 확장되어 있습니다:

```typescript
// tailwind.config.ts
colors: {
  krds: {
    primary: '#246BEB',
    'primary-dark': '#1A4FAD',
    'primary-light': '#E8F1FD',
    secondary: '#4A5568',
    success: '#2E7D32',
    danger: '#D32F2F',
    warning: '#ED6C02',
    info: '#0288D1',
  }
}
```

사용 예시:
```jsx
<button className="bg-krds-primary hover:bg-krds-primary-dark text-white">
  버튼
</button>
```

## 🎯 사용 방법

1. **파일 업로드**
   - 분석할 HTML, CSS, JS 파일을 드래그앤드롭
   - 또는 ZIP 파일로 압축하여 업로드

2. **설정 구성**
   - 포함할 섹션 선택 (버튼, 폼, 테이블 등)
   - 프로젝트 이름 및 버전 입력
   - 코드 블록, 목차 등 옵션 설정

3. **스타일 가이드 생성**
   - "스타일 가이드 생성하기" 버튼 클릭
   - 미리보기로 결과 확인
   - HTML 파일로 다운로드

## 📋 지원 컴포넌트

- ✅ 버튼 (Button)
- ✅ 폼 요소 (Form)
- ✅ 테이블 (Table)
- ✅ 박스/카드 (Box/Card)
- ✅ 리스트 (List)
- ✅ 네비게이션 (Navigation)
- ✅ 탭 (Tab)
- ✅ 페이지네이션 (Pagination)
- ✅ 모달/팝업 (Modal)
- ✅ 배지 (Badge)
- ✅ 아코디언 (Accordion)
- ✅ 아이콘 (Icon)
- ✅ 컬러 팔레트 (Color)
- ✅ 타이포그래피 (Typography)

## 🔧 기술 스택

- **Next.js 14** - React 프레임워크
- **TypeScript** - 타입 안정성
- **Tailwind CSS** - 유틸리티 기반 CSS
- **JSZip** - ZIP 파일 처리
- **Lucide React** - 아이콘

## 📄 라이선스

MIT License

---

Made with ❤️ for Korean Design System
