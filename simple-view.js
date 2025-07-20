// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyCJ30GJNqiXs4H6XbYP4GOOl_aK1cRRz4g",
  authDomain: "ssqd-vehicle-reservation.firebaseapp.com",
  projectId: "ssqd-vehicle-reservation",
  storageBucket: "ssqd-vehicle-reservation.firebasestorage.app",
  messagingSenderId: "470908499239",
  appId: "1:470908499239:web:cd0dd706c3dab6d5172502"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 시간 포맷팅 함수
function formatTime(date) {
  try {
    if (!date || isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    return '';
  }
}

// 날짜 비교를 위한 함수
function isSameDate(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

// 예약 데이터를 HTML로 변환
function createReservationHTML(reservation, showDetails = true) {
  const startDate = new Date(reservation.start);
  const endDate = new Date(reservation.end);
  
  let timeText = '';
  if (reservation.allDay) {
    timeText = '종일';
  } else {
    const startTime = formatTime(startDate);
    const endTime = formatTime(endDate);
    timeText = `${startTime}~${endTime}`;
  }
  
  let infoText = '';
  if (showDetails) {
    // 오늘: 시간/이름/소속/목적지/이용목적
    infoText = `${reservation.name} (${reservation.department}) - ${reservation.destination} - ${reservation.purpose}`;
  } else {
    // 내일: 시간/소속/목적지
    infoText = `${reservation.department} - ${reservation.destination}`;
  }
  
  return `
    <div class="reservation-item">
      <div class="time-badge">${timeText}</div>
      <div class="info-text">${infoText}</div>
    </div>
  `;
}

// 특정 날짜의 예약을 로드하고 표시
async function loadReservationsForDate(targetDate, containerId, showDetails = true) {
  const container = document.getElementById(containerId);
  
  try {
    const snapshot = await db.collection('reservations').get();
    const reservations = [];
    
    snapshot.forEach(doc => {
      const reservation = doc.data();
      const reservationDate = new Date(reservation.start);
      
      if (isSameDate(reservationDate, targetDate)) {
        reservations.push(reservation);
      }
    });
    
    // 시간순으로 정렬
    reservations.sort((a, b) => new Date(a.start) - new Date(b.start));
    
    if (reservations.length === 0) {
      container.innerHTML = '<div class="no-reservation">예약이 없습니다</div>';
    } else {
      const html = reservations.map(reservation => 
        createReservationHTML(reservation, showDetails)
      ).join('');
      container.innerHTML = html;
    }
    
  } catch (error) {
    console.error('예약 로드 오류:', error);
    container.innerHTML = '<div class="no-reservation">데이터 로드 중 오류가 발생했습니다</div>';
  }
}

// 오늘과 내일 예약 로드
async function loadReservations() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // 오늘 예약 로드 (상세 정보 포함)
  await loadReservationsForDate(today, 'todayContent', true);
  
  // 내일 예약 로드 (간단 정보만)
  await loadReservationsForDate(tomorrow, 'tomorrowContent', false);
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
  // 초기 로드
  loadReservations();
  
  // 30초마다 자동 새로고침
  setInterval(loadReservations, 30000);
});

// 새로고침 버튼 애니메이션
function animateRefreshButton() {
  const refreshBtn = document.querySelector('.refresh-btn');
  refreshBtn.style.transform = 'rotate(360deg)';
  setTimeout(() => {
    refreshBtn.style.transform = 'rotate(0deg)';
  }, 500);
}

// 새로고침 버튼 클릭 시 애니메이션 추가
document.querySelector('.refresh-btn').addEventListener('click', function() {
  animateRefreshButton();
}); 