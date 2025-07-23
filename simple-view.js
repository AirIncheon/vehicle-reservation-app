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

// 날짜를 YYYY-MM-DD 형식으로 변환
function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

// 시간을 HH:MM 형식으로 변환
function formatTime(date) {
  return date.toTimeString().slice(0, 5);
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
  const startTime = new Date(reservation.start);
  const endTime = new Date(reservation.end);
  
  const timeRange = `${formatTime(startTime)} - ${formatTime(endTime)}`;
  const purpose = reservation.purpose || reservation.title || '목적 미정';
  const user = reservation.name || reservation.userName || reservation.userEmail || '사용자 미정';
  const destination = reservation.destination || '';
  
  // 목적지가 있으면 표시
  const displayText = destination ? `${purpose} (${user} - ${destination})` : `${purpose} (${user})`;
  
  return `
    <div class="reservation-item">
      <span class="time-badge">${timeRange}</span>
      <span class="info-text">${displayText}</span>
    </div>
  `;
}

// KST 기준 오늘/내일 00:00~23:59를 UTC로 변환하는 함수 추가
function getKSTDateRange(offsetDay = 0) {
  const now = new Date();
  // KST 기준 날짜로 맞춤
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() + offsetDay);
  // KST → UTC 변환
  const startUTC = new Date(now.getTime() - 9 * 60 * 60 * 1000);
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000 - 1);
  return {
    start: startUTC.toISOString(),
    end: endUTC.toISOString()
  };
}

// 예약 데이터 로딩
async function loadReservations() {
  try {
    // KST 기준 오늘/내일 범위 UTC로 변환
    const todayRange = getKSTDateRange(0);
    const tomorrowRange = getKSTDateRange(1);

    // 오늘 예약 조회 (KST 기준)
    const todaySnapshot = await db.collection('reservations')
      .where('start', '>=', todayRange.start)
      .where('start', '<=', todayRange.end)
      .get();

    // 내일 예약 조회 (KST 기준)
    const tomorrowSnapshot = await db.collection('reservations')
      .where('start', '>=', tomorrowRange.start)
      .where('start', '<=', tomorrowRange.end)
      .get();
    
    // 오늘 예약 데이터 처리
    const todayReservations = [];
    todaySnapshot.forEach(doc => {
      const data = doc.data();
      todayReservations.push({
        id: doc.id,
        ...data
      });
    });
    
    // 내일 예약 데이터 처리
    const tomorrowReservations = [];
    tomorrowSnapshot.forEach(doc => {
      const data = doc.data();
      tomorrowReservations.push({
        id: doc.id,
        ...data
      });
    });
    
    // 데이터 정렬
    const sortedTodayReservations = sortReservationsByTime(todayReservations);
    const sortedTomorrowReservations = sortReservationsByTime(tomorrowReservations);
    
    // HTML 업데이트
    updateReservationDisplay('todayContent', sortedTodayReservations);
    updateReservationDisplay('tomorrowContent', sortedTomorrowReservations);
    
    // 마지막 업데이트 시간 업데이트
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