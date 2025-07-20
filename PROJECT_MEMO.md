# 공용차량 예약 시스템 - 프로젝트 메모

## 📋 프로젝트 개요

**프로젝트명**: 공용차량 예약 시스템  
**GitHub**: https://github.com/AirIncheon/vehicle-reservation-app  
**배포 URL**: https://airincheon.github.io/vehicle-reservation-app/  
**간단 보기 URL**: https://airincheon.github.io/vehicle-reservation-app/simple-view.html  

## 🛠 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Firebase (Firestore, Authentication)
- **UI Framework**: Bootstrap 5
- **Calendar**: FullCalendar.js
- **Icons**: Bootstrap Icons
- **배포**: GitHub Pages

## 🔧 Firebase 설정

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyCJ30GJNqiXs4H6XbYP4GOOl_aK1cRRz4g",
  authDomain: "ssqd-vehicle-reservation.firebaseapp.com",
  projectId: "ssqd-vehicle-reservation",
  storageBucket: "ssqd-vehicle-reservation.firebasestorage.app",
  messagingSenderId: "470908499239",
  appId: "1:470908499239:web:cd0dd706c3dab6d5172502"
};
```

## 👥 사용자 관리

- **관리자 이메일**: safety7033@gmail.com
- **인증 방식**: Google 로그인
- **권한**: 관리자/일반 사용자 구분

## 📁 파일 구조

```
vehicle-reservation-app/
├── index.html              # 메인 예약 페이지
├── app.js                  # 메인 JavaScript 로직
├── simple-view.html        # 간단 보기 페이지
├── simple-view.js          # 간단 보기 JavaScript
└── PROJECT_MEMO.md         # 이 파일
```

## 🚗 예약 시스템 기능

### 기본 예약 기능
- **일반 예약**: 시작/종료 시간 설정 (최소 30분)
- **종일 예약**: 날짜만 설정
- **필수 정보**: 이름, 소속, 목적지, 이용목적
- **소속 옵션**: 안전예방, 안전심사, 안전조사, 안전보건, 항공보안, 기타

### 반복 예약 기능
- **매일 반복**: 시작일과 종료일이 같아야 함
- **매주 반복**: 시작일의 요일 기준, 최대 6일 기간
- **매년 반복**: 동일한 날짜 매년 반복
- **반복 종료일**: 별도 설정 가능

### 검증 및 제한사항
- **과거 날짜 예약 방지**
- **겹치는 일정 검사** (종일/시간 예약 구분)
- **시간 간격 최소 30분**
- **반복 예약 최대 100개**

## 🗓 캘린더 기능

### FullCalendar 설정
- **뷰**: 월간/주간 전환
- **로케일**: 한국어 (ko)
- **이벤트 표시**: 시간, 이름, 목적지
- **종일 이벤트**: 별도 스타일링

### 이벤트 관리
- **수정**: 클릭 시 폼에 정보 로드
- **삭제**: 반복 예약은 삭제 옵션 선택
- **권한**: 본인 예약 또는 관리자만 수정/삭제

## 🔄 반복 예약 삭제 옵션

1. **해당 일정만 삭제**: 선택한 날짜의 예약만 삭제
2. **이후 일정 모두 삭제**: 선택한 날짜부터 미래의 모든 반복 예약 삭제
3. **전체 반복 예약 삭제**: 이 반복 예약의 모든 일정 삭제

## 📊 통계 기능

- **총 예약 수**
- **이번 년도/달/오늘 예약 수**
- **사용자별 예약 현황**
- **소속별 예약 현황**
- **목적지별 예약 현황**

## 📱 간단 보기 페이지

### 특징
- **오늘/내일 예약만 표시**
- **컴팩트한 디자인** (최대 너비 500px)
- **자동 새로고침** (30초마다)
- **흰색 배경** (호환성 고려)

### 정보 표시
- **오늘**: 시간/이름/소속/목적지/이용목적
- **내일**: 시간/소속/목적지
- **종일 예약**: "종일" 표시, 시간 생략

## 🎨 UI/UX 특징

### 메인 페이지
- **반응형 디자인**
- **Bootstrap 5 컴포넌트**
- **그라데이션 배경**
- **모달 기반 상호작용**

### 간단 보기 페이지
- **미니멀 디자인**
- **고정 너비** (500px)
- **중앙 정렬**
- **파란색 강조색** (#1976d2)

## 🔒 보안 및 데이터 관리

### Firebase 보안 규칙
- **인증된 사용자만 접근**
- **본인 예약만 수정/삭제**
- **관리자는 모든 예약 관리 가능**

### 데이터 구조
```javascript
{
  start: "2025-07-21T09:00:00.000Z",
  end: "2025-07-21T17:00:00.000Z",
  name: "사용자명",
  department: "소속",
  destination: "목적지",
  purpose: "이용목적",
  email: "user@example.com",
  allDay: false,
  isRepeat: true,
  repeatType: "weekly",
  repeatGroup: "unique_id"
}
```

## 🐛 주요 수정 이력

### 반복 예약 로직 개선
- 매일 반복: 시작일=종료일 강제
- 매주 반복: 6일 제한, 요일 기준
- 반복 종료일 별도 입력 필드 추가

### 변수 스코프 충돌 해결
- startDate/endDate 변수명 충돌 수정
- 각 상황별 고유 변수명 사용

### 캐시 방지
- autocomplete="off" 속성 추가
- 폼 리셋 시 완전한 초기화

## 📝 개발 시 주의사항

### JavaScript
- **DOM 로드 완료 후 초기화** 필수
- **Firebase 비동기 처리** 주의
- **날짜 객체 복사** 시 new Date() 사용
- **변수 스코프** 충돌 주의

### CSS
- **Bootstrap 클래스** 우선 사용
- **반응형 디자인** 고려
- **브라우저 호환성** 확인

### 데이터베이스
- **배치 작업** 사용 권장
- **인덱스** 설정 확인
- **보안 규칙** 정기 점검

## 🚀 배포 및 유지보수

### 배포 과정
```bash
git add .
git commit -m "커밋 메시지"
git push origin main
# GitHub Pages 자동 배포
```

### 모니터링
- **Firebase 콘솔** 정기 확인
- **GitHub Pages** 배포 상태 확인
- **사용자 피드백** 수집

## 📞 연락처 및 참고사항

- **관리자**: safety7033@gmail.com
- **프로젝트 소유자**: mark4mission@gmail.com
- **최종 업데이트**: 2025년 1월

---

**이 메모는 프로젝트의 모든 핵심 정보를 포함하고 있으며, 새로운 대화에서 이어서 개발할 때 참고하세요.** 