// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyCJ30GJNqiXs4H6XbYP4GOOl_aK1cRRz4g",
  authDomain: "ssqd-vehicle-reservation.firebaseapp.com",
  projectId: "ssqd-vehicle-reservation",
  storageBucket: "ssqd-vehicle-reservation.firebasestorage.app",
  messagingSenderId: "470908499239",
  appId: "1:470908499239:web:cd0dd706c3dab6d5172502"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 전역 변수
let autoRefreshInterval = null;

// UTC→KST 변환 (app.js와 동일하게)
function toKST(date) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
}
// KST→UTC 변환 (app.js와 동일하게)
function toUTC(date) {
  return new Date(date.getTime() - 9 * 60 * 60 * 1000);
}
// KST 날짜를 YYYY-MM-DD로 반환
function formatKSTDate(date) {
  const kst = toKST(date);
  return kst.toISOString().slice(0, 10);
}
// 시간을 HH:MM 형식으로 변환 (KST)
function formatKSTTime(date) {
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// 예약 데이터를 시간순으로 정렬
function sortReservationsByTime(reservations) {
  return reservations.sort((a, b) => {
    const timeA = new Date(a.start);
    const timeB = new Date(b.start);
    return timeA - timeB;
  });
}

// 예약 항목 HTML 생성
function createReservationHTML(reservation) {
  if (reservation.allDay) {
    const purpose = reservation.purpose || reservation.title || '목적 미정';
    const user = reservation.name || reservation.userName || reservation.userEmail || '사용자 미정';
    const destination = reservation.destination || '';
    const displayText = destination ? `${purpose} (${user} - ${destination})` : `${purpose} (${user})`;
    return `
      <div class="reservation-item">
        <span class="time-badge">종일</span>
        <span class="info-text">${displayText}</span>
      </div>
    `;
  } else {
    // Firestore에서 읽은 시간은 타임존 없는 KST 문자열이므로 +09:00을 붙여서 KST로 해석
    const startTime = new Date(reservation.start + '+09:00');
    const endTime = new Date(reservation.end + '+09:00');
    let timeRange;
    if (endTime <= startTime) {
      timeRange = `${formatKSTTime(startTime)} ~ 익일 ${formatKSTTime(endTime)}`;
    } else {
      timeRange = `${formatKSTTime(startTime)} ~ ${formatKSTTime(endTime)}`;
    }
    const purpose = reservation.purpose || reservation.title || '목적 미정';
    const user = reservation.name || reservation.userName || reservation.userEmail || '사용자 미정';
    const destination = reservation.destination || '';
    const displayText = destination ? `${purpose} (${user} - ${destination})` : `${purpose} (${user})`;
    return `
      <div class="reservation-item">
        <span class="time-badge">${timeRange}</span>
        <span class="info-text">${displayText}</span>
      </div>
    `;
  }
}

// KST 기준 오늘/내일 00:00~23:59를 반환 (UTC 변환 없이)
function getKSTDateRange(offsetDay = 0) {
  const now = new Date();
  // 현재 KST로 변환
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kstNow.setHours(0, 0, 0, 0);
  kstNow.setDate(kstNow.getDate() + offsetDay);
  const startKST = new Date(kstNow);
  const endKST = new Date(kstNow);
  endKST.setHours(23, 59, 59, 999);
  return {
    start: startKST,
    end: endKST
  };
}

// 예약 데이터 로딩
async function loadReservations() {
  try {
    const todayRange = getKSTDateRange(0);
    const tomorrowRange = getKSTDateRange(1);
    const snapshot = await db.collection('reservations').get();
    const todayReservations = [];
    const tomorrowReservations = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const startUTC = new Date(data.start);
      const endUTC = new Date(data.end);
      if (data.allDay) {
        // allDay 예약: 오늘/내일 KST 범위와 겹치는지 체크
        if (startUTC <= todayRange.end && endUTC >= todayRange.start) {
          todayReservations.push({ id: doc.id, ...data });
        }
        if (startUTC <= tomorrowRange.end && endUTC >= tomorrowRange.start) {
          tomorrowReservations.push({ id: doc.id, ...data });
        }
      } else {
        // 일반 예약: 시작이 오늘/내일 KST 범위 내에 있는지 체크
        if (startUTC >= todayRange.start && startUTC <= todayRange.end) {
          todayReservations.push({ id: doc.id, ...data });
        }
        if (startUTC >= tomorrowRange.start && startUTC <= tomorrowRange.end) {
          tomorrowReservations.push({ id: doc.id, ...data });
        }
      }
    });
    const sortedTodayReservations = sortReservationsByTime(todayReservations);
    const sortedTomorrowReservations = sortReservationsByTime(tomorrowReservations);
    updateReservationDisplay('todayContent', sortedTodayReservations);
    updateReservationDisplay('tomorrowContent', sortedTomorrowReservations);
    updateTimestamp();
  } catch (error) {
    console.error('예약 데이터 로딩 오류:', error);
    document.getElementById('todayContent').innerHTML = '<div class="no-reservation">데이터 로딩 중 오류가 발생했습니다.</div>';
    document.getElementById('tomorrowContent').innerHTML = '<div class="no-reservation">데이터 로딩 중 오류가 발생했습니다.</div>';
  }
}

// 예약 표시 업데이트
function updateReservationDisplay(elementId, reservations) {
  const element = document.getElementById(elementId);
  
  if (reservations.length === 0) {
    element.innerHTML = '<div class="no-reservation">예약된 차량이 없습니다.</div>';
  } else {
    const html = reservations.map(reservation => createReservationHTML(reservation)).join('');
    element.innerHTML = html;
  }
}

// 마지막 업데이트 시간 업데이트
function updateTimestamp() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  document.getElementById('lastUpdate').textContent = `마지막 업데이트: ${timeString}`;
}

// 자동 새로고침 시작
function startAutoRefresh() {
  // 기존 인터벌이 있다면 제거
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }
  
  // 30초마다 자동 새로고침
  autoRefreshInterval = setInterval(() => {
    loadReservations();
  }, 30000);
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
  // 초기 데이터 로딩
  loadReservations();
  
  // 자동 새로고침 시작
  startAutoRefresh();
  
  // 페이지 포커스 시 데이터 새로고침
  window.addEventListener('focus', function() {
    loadReservations();
  });
});

// 페이지 언로드 시 인터벌 정리
window.addEventListener('beforeunload', function() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }
}); 