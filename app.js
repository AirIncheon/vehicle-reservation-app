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
const auth = firebase.auth();
const db = firebase.firestore();

// 전역 변수
let currentUser = null;
let calendar = null;
let editEventId = null;
const ADMIN_EMAIL = 'safety7033@gmail.com';

// DOM 요소들
let allDayCheckbox = null;
let repeatCheckbox = null;
let repeatOptions = null;
let repeatEndDate = null;
let repeatType = null;
let repeatEnd = null;
let startInput = null;
let endInput = null;
let reservationForm = null;
let loginBtn = null;
let logoutBtn = null;
let statsTab = null;

// 관리자 권한 확인
function isAdmin(user) {
  return user && user.email === ADMIN_EMAIL;
}

// 시간을 10분 단위로 반올림
function roundToNearest10Minutes(date) {
  const minutes = date.getMinutes();
  const roundedMinutes = Math.round(minutes / 10) * 10;
  date.setMinutes(roundedMinutes);
  date.setSeconds(0);
  date.setMilliseconds(0);
  return date;
}

// 날짜를 YYYY-MM-DD 형식으로 변환
function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

// 시간을 HH:mm 형식으로 변환
function formatTime(date) {
  return date.toLocaleTimeString('ko-KR', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false 
  });
}

// 기본 시작 시간 설정 (현재 시간을 10분 단위로 반올림)
function setDefaultStartTime() {
  if (!startInput || !endInput) return;
  
  const now = new Date();
  const roundedNow = roundToNearest10Minutes(new Date(now));
  
  // 오전 9시 이전이면 오전 9시로, 오후 6시 이후면 다음날 오전 9시로 설정
  let startTime;
  if (roundedNow.getHours() < 9) {
    startTime = new Date(roundedNow);
    startTime.setHours(9, 0, 0, 0);
  } else if (roundedNow.getHours() >= 18) {
    startTime = new Date(roundedNow);
    startTime.setDate(startTime.getDate() + 1);
    startTime.setHours(9, 0, 0, 0);
  } else {
    startTime = roundedNow;
  }
  
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1시간 후
  
  startInput.value = startTime.toISOString().slice(0, 16);
  endInput.value = endTime.toISOString().slice(0, 16);
}

// 종일 예약 체크박스 이벤트
function setupAllDayCheckbox() {
  if (!allDayCheckbox || !startInput || !endInput) return;
  
  allDayCheckbox.addEventListener('change', function() {
    if (this.checked) {
      // 종일 예약: date 타입으로 변경
      startInput.type = 'date';
      endInput.type = 'date';
      
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      startInput.value = formatDate(today);
      endInput.value = formatDate(tomorrow);
    } else {
      // 일반 예약: datetime-local 타입으로 변경
      startInput.type = 'datetime-local';
      endInput.type = 'datetime-local';
      setDefaultStartTime();
    }
  });
}

// 반복 예약 체크박스 이벤트
function setupRepeatCheckbox() {
  if (!repeatCheckbox || !repeatOptions || !repeatEndDate || !repeatType || !repeatEnd) return;
  
  repeatCheckbox.addEventListener('change', function() {
    if (this.checked) {
      repeatOptions.style.display = 'block';
      repeatEndDate.style.display = 'block';
      
      // 기본 종료일 설정
      const today = new Date();
      const defaultEndDate = new Date(today);
      
      switch (repeatType.value) {
        case 'daily':
          defaultEndDate.setDate(today.getDate() + 6); // 6일 뒤
          break;
        case 'weekly':
          defaultEndDate.setDate(today.getDate() + 28); // 4주 뒤
          break;
        case 'yearly':
          defaultEndDate.setFullYear(today.getFullYear() + 1); // 1년 뒤
          break;
        default:
          defaultEndDate.setDate(today.getDate() + 28); // 기본값
      }
      
      repeatEnd.value = formatDate(defaultEndDate);
    } else {
      repeatOptions.style.display = 'none';
      repeatEndDate.style.display = 'none';
    }
  });
  
  // 반복 타입 변경 시 종료일 업데이트
  repeatType.addEventListener('change', function() {
    if (repeatCheckbox.checked) {
      const today = new Date();
      const defaultEndDate = new Date(today);
      
      switch (this.value) {
        case 'daily':
          defaultEndDate.setDate(today.getDate() + 6);
          break;
        case 'weekly':
          defaultEndDate.setDate(today.getDate() + 28);
          break;
        case 'yearly':
          defaultEndDate.setFullYear(today.getFullYear() + 1);
          break;
        default:
          defaultEndDate.setDate(today.getDate() + 28);
      }
      
      repeatEnd.value = formatDate(defaultEndDate);
    }
  });
}

// 시작 시간 변경 시 종료 시간 자동 조정
function setupStartTimeChange() {
  if (!startInput || !endInput) return;
  
  startInput.addEventListener('change', function() {
    if (allDayCheckbox && allDayCheckbox.checked) {
      // 종일 예약: 시작일 다음날을 종료일로 설정
      const startDate = new Date(this.value);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      endInput.value = formatDate(endDate);
    } else {
      // 일반 예약: 시작 시간 + 1시간을 종료 시간으로 설정
      const startTime = new Date(this.value);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      endInput.value = endTime.toISOString().slice(0, 16);
    }
  });
}

// 반복 예약 생성
async function createRepeatReservations(start, end, name, department, destination, purpose, allDay, repeatType, repeatEndDate) {
  const reservations = [];
  let currentStart = new Date(start);
  let currentEnd = new Date(end);
  const endDate = new Date(repeatEndDate);
  
  // 첫 번째 예약 추가
  reservations.push({
    start: currentStart.toISOString(),
    end: currentEnd.toISOString(),
    name,
    department,
    destination,
    purpose,
    email: currentUser.email,
    allDay,
    isRepeat: true,
    repeatGroup: Date.now()
  });
  
  // 반복 예약 생성 (최대 100개)
  let repeatCount = 0;
  const maxRepeats = 100;
  
  while (repeatCount < maxRepeats) {
    let nextStart = new Date(currentStart);
    let nextEnd = new Date(currentEnd);
    
    switch (repeatType) {
      case 'daily':
        nextStart.setDate(nextStart.getDate() + 1);
        nextEnd.setDate(nextEnd.getDate() + 1);
        break;
      case 'weekly':
        nextStart.setDate(nextStart.getDate() + 7);
        nextEnd.setDate(nextEnd.getDate() + 7);
        break;
      case 'yearly':
        nextStart.setFullYear(nextStart.getFullYear() + 1);
        nextEnd.setFullYear(nextEnd.getFullYear() + 1);
        break;
    }
    
    if (nextStart > endDate) break;
    
    reservations.push({
      start: nextStart.toISOString(),
      end: nextEnd.toISOString(),
      name,
      department,
      destination,
      purpose,
      email: currentUser.email,
      allDay,
      isRepeat: true,
      repeatGroup: Date.now()
    });
    
    repeatCount++;
    currentStart = nextStart;
    currentEnd = nextEnd;
  }
  
  // 중복 체크
  const snapshot = await db.collection('reservations').get();
  const conflicts = [];
  
  for (const reservation of reservations) {
    const hasConflict = snapshot.docs.some(doc => {
      const r = doc.data();
      const reservationStart = new Date(reservation.start);
      const reservationEnd = new Date(reservation.end);
      const existingStart = new Date(r.start);
      const existingEnd = new Date(r.end);
      
      return (reservationStart < existingEnd && reservationEnd > existingStart && (allDay === !!r.allDay));
    });
    
    if (hasConflict) {
      conflicts.push(new Date(reservation.start).toLocaleDateString('ko-KR'));
    }
  }
  
  if (conflicts.length > 0) {
    alert(`다음 날짜에 이미 예약이 존재합니다:\n${conflicts.join('\n')}`);
    return false;
  }
  
  // 모든 예약 저장
  const batch = db.batch();
  for (const reservation of reservations) {
    const docRef = db.collection('reservations').doc();
    batch.set(docRef, reservation);
  }
  await batch.commit();
  
  return true;
}

// 캘린더 초기화 및 예약 불러오기
function loadReservations() {
  db.collection('reservations').get().then(snapshot => {
    const events = [];
    snapshot.forEach(doc => {
      const r = doc.data();
      events.push({
        id: doc.id,
        title: `${r.name} (${r.destination})`,
        start: r.start,
        end: r.end,
        allDay: r.allDay || false,
        extendedProps: { 
          purpose: r.purpose, 
          email: r.email, 
          department: r.department,
          name: r.name,
          destination: r.destination
        }
      });
    });
    
    if (!calendar) {
      calendar = new FullCalendar.Calendar(document.getElementById('calendar'), {
        initialView: 'dayGridMonth',
        locale: 'ko',
        headerToolbar: {
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek'
        },
        events,
        eventContent: function(arg) {
          const start = formatTime(arg.event.start);
          const end = formatTime(arg.event.end);
          const name = arg.event.extendedProps.name;
          const destination = arg.event.extendedProps.destination;
          const alldayClass = arg.event.allDay ? 'fc-allday' : 'fc-timed';
          
          return {
            html: `<div class='fc-event-custom ${alldayClass}'>
              <div style='font-size:0.85em; color:#1976d2;'>${arg.event.allDay ? '종일' : start + (end ? `~${end}` : '')}</div>
              <div style='font-weight:bold; font-size:1em;'>${name}${destination ? ` (${destination})` : ''}</div>
            </div>`
          };
        },
        eventClick: function(info) {
          const isOwner = info.event.extendedProps.email === currentUser.email;
          const isAdminUser = isAdmin(currentUser);
          
          let msg = `<b>예약자:</b> ${info.event.extendedProps.name}<br>
<b>소속:</b> ${info.event.extendedProps.department || '미지정'}<br>
<b>목적지:</b> ${info.event.extendedProps.destination}`;
          
          let actionHtml = '';
          if (isOwner || isAdminUser) {
            actionHtml = `<div class='d-flex gap-2 justify-content-end mt-3'>
              <button class='btn btn-outline-primary btn-sm' id='editEventBtn' title='수정'><i class='bi bi-pencil-square'></i></button>
              <button class='btn btn-outline-danger btn-sm' id='deleteEventBtn' title='삭제'><i class='bi bi-trash'></i></button>
            </div>`;
          }
          
          showEventModal(msg + actionHtml, info.event);
        },
        dateClick: function(info) {
          if (!allDayCheckbox || !startInput || !endInput) return;
          
          if (allDayCheckbox.checked) {
            // 종일 예약: date 타입
            startInput.type = 'date';
            endInput.type = 'date';
            startInput.value = info.dateStr;
            const startDate = new Date(info.dateStr);
            const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1);
            endInput.value = formatDate(endDate);
          } else {
            // 일반 예약: datetime-local 타입
            startInput.type = 'datetime-local';
            endInput.type = 'datetime-local';
            const startTime = new Date(info.dateStr + 'T09:00');
            const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
            startInput.value = startTime.toISOString().slice(0, 16);
            endInput.value = endTime.toISOString().slice(0, 16);
          }
          
          // 클릭한 셀에 애니메이션 효과
          const cell = document.querySelector(`.fc-day[data-date='${info.dateStr}']`);
          if (cell) {
            cell.classList.add('fc-cell-animate');
            setTimeout(() => cell.classList.remove('fc-cell-animate'), 600);
          }
        }
      });
      calendar.render();
    } else {
      calendar.removeAllEvents();
      events.forEach(e => calendar.addEvent(e));
    }
    
    // 통계 업데이트
    if (statsTab && statsTab.classList.contains('active')) {
      updateStatistics();
    }
  });
}

// 모달 표시
function showEventModal(html, eventObj) {
  let modal = document.getElementById('eventModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'eventModal';
    modal.innerHTML = `
      <div class="modal fade" tabindex="-1" id="eventModalInner">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">예약 상세 정보</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="eventModalBody"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  document.getElementById('eventModalBody').innerHTML = html;
  const modalInstance = new bootstrap.Modal(document.getElementById('eventModalInner'));
  modalInstance.show();

  // 수정/삭제 버튼 이벤트 연결
  setTimeout(() => {
    const editBtn = document.getElementById('editEventBtn');
    const deleteBtn = document.getElementById('deleteEventBtn');
    
    if (editBtn) {
      editBtn.onclick = () => {
        modalInstance.hide();
        populateEditForm(eventObj);
      };
    }
    
    if (deleteBtn) {
      deleteBtn.onclick = async () => {
        if (confirm('정말 삭제하시겠습니까?')) {
          await db.collection('reservations').doc(eventObj.id).delete();
          modalInstance.hide();
          loadReservations();
        }
      };
    }
  }, 100);
}

// 수정 폼에 데이터 채우기
function populateEditForm(eventObj) {
  if (!allDayCheckbox || !startInput || !endInput) return;
  
  const isAllDay = eventObj.allDay;
  
  // 종일 예약 체크박스 설정
  allDayCheckbox.checked = isAllDay;
  
  if (isAllDay) {
    // 종일 예약: date 타입
    startInput.type = 'date';
    endInput.type = 'date';
    
    const startDate = new Date(eventObj.start);
    const endDate = new Date(eventObj.end);
    
    startInput.value = formatDate(startDate);
    endInput.value = formatDate(endDate);
  } else {
    // 일반 예약: datetime-local 타입
    startInput.type = 'datetime-local';
    endInput.type = 'datetime-local';
    
    const startDate = new Date(eventObj.start);
    const endDate = new Date(eventObj.end);
    
    startInput.value = startDate.toISOString().slice(0, 16);
    endInput.value = endDate.toISOString().slice(0, 16);
  }
  
  // 나머지 필드 설정
  document.getElementById('name').value = eventObj.extendedProps.name;
  document.getElementById('department').value = eventObj.extendedProps.department || '';
  document.getElementById('destination').value = eventObj.extendedProps.destination;
  document.getElementById('purpose').value = eventObj.extendedProps.purpose;
  
  editEventId = eventObj.id;
  document.querySelector('#reservationForm button[type="submit"]').textContent = '수정하기';
  
  // 수정 모드에서는 반복 예약 옵션 숨기기
  if (repeatOptions) repeatOptions.style.display = 'none';
  if (repeatEndDate) repeatEndDate.style.display = 'none';
  if (repeatCheckbox) repeatCheckbox.checked = false;
}

// 통계 업데이트
function updateStatistics() {
  db.collection('reservations').get().then(snapshot => {
    const reservations = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      reservations.push(data);
    });
    
    // 총 예약 수
    document.getElementById('totalReservations').textContent = reservations.length;
    
    // 현재 날짜 기준
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDate = now.getDate();
    
    // 이번 년도 예약 수
    const yearlyReservations = reservations.filter(r => {
      try {
        const reservationDate = new Date(r.start);
        return !isNaN(reservationDate.getTime()) && reservationDate.getFullYear() === currentYear;
      } catch (error) {
        return false;
      }
    });
    document.getElementById('yearlyReservations').textContent = yearlyReservations.length;
    
    // 이번 달 예약 수
    const monthlyReservations = yearlyReservations.filter(r => {
      try {
        const reservationDate = new Date(r.start);
        return !isNaN(reservationDate.getTime()) && reservationDate.getMonth() === currentMonth;
      } catch (error) {
        return false;
      }
    });
    document.getElementById('monthlyReservations').textContent = monthlyReservations.length;
    
    // 오늘 예약 수
    const todayReservations = monthlyReservations.filter(r => {
      try {
        const reservationDate = new Date(r.start);
        return !isNaN(reservationDate.getTime()) && reservationDate.getDate() === currentDate;
      } catch (error) {
        return false;
      }
    });
    document.getElementById('todayReservations').textContent = todayReservations.length;
    
    // 사용자별 통계
    const userStats = {};
    reservations.forEach(r => {
      const email = r.email || '알 수 없음';
      userStats[email] = (userStats[email] || 0) + 1;
    });
    
    let userStatsHtml = '<div class="row g-2">';
    Object.entries(userStats).forEach(([email, count]) => {
      userStatsHtml += `
        <div class="col-md-6">
          <div class="d-flex justify-content-between align-items-center p-2 border rounded">
            <span class="text-truncate">${email}</span>
            <span class="badge bg-primary">${count}</span>
          </div>
        </div>
      `;
    });
    userStatsHtml += '</div>';
    document.getElementById('userStats').innerHTML = userStatsHtml;
    
    // 소속별 통계
    const departmentStats = {};
    reservations.forEach(r => {
      const department = r.department || '미지정';
      departmentStats[department] = (departmentStats[department] || 0) + 1;
    });
    
    let departmentStatsHtml = '<div class="row g-2">';
    Object.entries(departmentStats).forEach(([department, count]) => {
      departmentStatsHtml += `
        <div class="col-md-6">
          <div class="d-flex justify-content-between align-items-center p-2 border rounded">
            <span class="text-truncate">${department}</span>
            <span class="badge bg-info">${count}</span>
          </div>
        </div>
      `;
    });
    departmentStatsHtml += '</div>';
    document.getElementById('departmentStats').innerHTML = departmentStatsHtml;
    
    // 목적지별 통계
    const destinationStats = {};
    reservations.forEach(r => {
      const destination = r.destination || '알 수 없음';
      destinationStats[destination] = (destinationStats[destination] || 0) + 1;
    });
    
    let destinationStatsHtml = '<div class="row g-2">';
    Object.entries(destinationStats).forEach(([destination, count]) => {
      destinationStatsHtml += `
        <div class="col-md-6">
          <div class="d-flex justify-content-between align-items-center p-2 border rounded">
            <span class="text-truncate">${destination}</span>
            <span class="badge bg-success">${count}</span>
          </div>
        </div>
      `;
    });
    destinationStatsHtml += '</div>';
    document.getElementById('destinationStats').innerHTML = destinationStatsHtml;
  });
}

// 알림 표시
function showNotification(title, message) {
  const toast = document.getElementById('notificationToast');
  const notificationTime = document.getElementById('notificationTime');
  const notificationBody = document.getElementById('notificationBody');
  
  notificationTime.textContent = new Date().toLocaleTimeString('ko-KR');
  notificationBody.innerHTML = `<strong>${title}</strong><br>${message}`;
  
  const toastInstance = new bootstrap.Toast(toast);
  toastInstance.show();
}

// 예약 알림 체크
function checkReservationNotifications() {
  if (!currentUser) return;
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  db.collection('reservations').get().then(snapshot => {
    const notifications = [];
    
    snapshot.forEach(doc => {
      const reservation = doc.data();
      try {
        const reservationDate = new Date(reservation.start);
        if (isNaN(reservationDate.getTime())) return;
        
        const reservationDateStr = reservationDate.toISOString().split('T')[0];
        
        if (reservationDateStr === tomorrowStr && 
            (reservation.email === currentUser.email || isAdmin(currentUser))) {
          const time = formatTime(reservation.start);
          const isAllDay = reservation.allDay ? '종일' : time;
          notifications.push({
            title: `${reservation.name}님의 예약`,
            message: `내일 ${isAllDay} - ${reservation.destination}`
          });
        }
      } catch (error) {
        return;
      }
    });
    
    notifications.forEach(notification => {
      setTimeout(() => {
        showNotification(notification.title, notification.message);
      }, 1000);
    });
  });
}

// 인증 상태 변경 감지
auth.onAuthStateChanged(user => {
  currentUser = user;
  const userInfo = document.getElementById('user-info');
  const logoutBtn = document.getElementById('logout-btn');
  
  if (user) {
    const isAdminUser = isAdmin(user);
    userInfo.innerText = user.email + (isAdminUser ? ' (관리자)' : '');
    userInfo.style.display = '';
    logoutBtn.style.display = '';
    document.getElementById('login-btn').style.display = 'none';
    document.getElementById('reservationForm').style.display = '';
    loadReservations();
    
    // 로그인 후 알림 체크
    setTimeout(() => {
      checkReservationNotifications();
    }, 2000);
  } else {
    userInfo.innerText = '';
    userInfo.style.display = 'none';
    logoutBtn.style.display = 'none';
    document.getElementById('login-btn').style.display = '';
    document.getElementById('reservationForm').style.display = 'none';
    if (calendar) calendar.removeAllEvents();
  }
});

// DOM 로드 완료 시 초기화
document.addEventListener('DOMContentLoaded', function() {
  // DOM 요소 초기화
  allDayCheckbox = document.getElementById('allDay');
  repeatCheckbox = document.getElementById('repeatReservation');
  repeatOptions = document.getElementById('repeatOptions');
  repeatEndDate = document.getElementById('repeatEndDate');
  repeatType = document.getElementById('repeatType');
  repeatEnd = document.getElementById('repeatEnd');
  startInput = document.getElementById('start');
  endInput = document.getElementById('end');
  reservationForm = document.getElementById('reservationForm');
  loginBtn = document.getElementById('login-btn');
  logoutBtn = document.getElementById('logout-btn');
  statsTab = document.getElementById('stats-tab');
  
  // 로그인/로그아웃 이벤트
  loginBtn.onclick = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider);
  };
  logoutBtn.onclick = () => auth.signOut();
  
  // 체크박스 이벤트 설정
  setupAllDayCheckbox();
  setupRepeatCheckbox();
  setupStartTimeChange();
  
  // 통계 탭 클릭 이벤트
  statsTab.addEventListener('click', function() {
    updateStatistics();
  });
  
  // 기본 시간 설정
  setDefaultStartTime();
  
  // 예약 폼 제출 이벤트
  reservationForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const start = startInput.value;
    const end = endInput.value;
    const name = document.getElementById('name').value;
    const department = document.getElementById('department').value;
    const destination = document.getElementById('destination').value;
    const purpose = document.getElementById('purpose').value;
    const allDay = allDayCheckbox.checked;
    const isRepeat = repeatCheckbox.checked;
    const repeatTypeValue = repeatType.value;
    const repeatEndValue = repeatEnd.value;

    // 필수 입력값 검증
    if (!start || !end || !name || !department || !destination || !purpose) {
      alert('모든 필드를 입력해주세요.');
      return;
    }
    
    // 반복 예약인 경우 종료일 검증
    if (isRepeat && !repeatEndValue) {
      alert('반복 종료일을 입력해주세요.');
      return;
    }
    
    // 날짜/시간 유효성 검증
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      alert('유효하지 않은 날짜/시간입니다.');
      return;
    }
    
    if (startDate >= endDate) {
      alert('종료일은 시작일보다 늦어야 합니다.');
      return;
    }
    
    // 과거 날짜 예약 방지
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startDate < today) {
      alert('과거 날짜는 예약할 수 없습니다.');
      return;
    }
    
    // 일반 예약의 경우 시간 간격 검증 (최소 30분)
    if (!allDay) {
      const timeDiff = endDate.getTime() - startDate.getTime();
      const minDuration = 30 * 60 * 1000;
      if (timeDiff < minDuration) {
        alert('예약 시간은 최소 30분 이상이어야 합니다.');
        return;
      }
    }

    try {
      if (editEventId) {
        // 수정
        await db.collection('reservations').doc(editEventId).update({
          start, end, name, department, destination, purpose, email: currentUser.email, allDay
        });
        editEventId = null;
        document.querySelector('#reservationForm button[type="submit"]').textContent = '예약하기';
        
        // 수정 성공 메시지
        const startDate = new Date(start);
        const endDate = new Date(end);
        const dateStr = startDate.toLocaleDateString('ko-KR');
        const timeStr = allDay ? '종일' : `${startDate.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})} ~ ${endDate.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}`;
        alert(`예약이 성공적으로 수정되었습니다!\n\n📅 ${dateStr}\n⏰ ${timeStr}\n👤 ${name}\n🏢 ${department}\n📍 ${destination}`);
      } else {
        // 신규 예약
        if (isRepeat) {
          // 반복 예약 생성
          const success = await createRepeatReservations(start, end, name, department, destination, purpose, allDay, repeatTypeValue, repeatEndValue);
          if (!success) return;
          
          // 반복 예약 성공 메시지
          const startDate = new Date(start);
          const endDate = new Date(repeatEndValue);
          const repeatTypeText = {
            'daily': '매일',
            'weekly': '매주',
            'yearly': '매년'
          }[repeatTypeValue] || repeatTypeValue;
          
          alert(`반복 예약이 성공적으로 생성되었습니다!\n\n📅 ${startDate.toLocaleDateString('ko-KR')} ~ ${endDate.toLocaleDateString('ko-KR')}\n🔄 ${repeatTypeText} 반복\n👤 ${name}\n🏢 ${department}\n📍 ${destination}`);
        } else {
          // 단일 예약 생성
          // 중복 체크
          const snapshot = await db.collection('reservations').get();
          const hasConflict = snapshot.docs.some(doc => {
            const r = doc.data();
            const reservationStart = new Date(start);
            const reservationEnd = new Date(end);
            const existingStart = new Date(r.start);
            const existingEnd = new Date(r.end);
            
            return (reservationStart < existingEnd && reservationEnd > existingStart && (allDay === !!r.allDay));
          });
          
          if (hasConflict) {
            alert('이미 해당 시간에 예약이 존재합니다!');
            return;
          }
          
          await db.collection('reservations').add({
            start, end, name, department, destination, purpose, email: currentUser.email, allDay
          });
          
          // 단일 예약 성공 메시지
          const startDate = new Date(start);
          const endDate = new Date(end);
          const dateStr = startDate.toLocaleDateString('ko-KR');
          const timeStr = allDay ? '종일' : `${startDate.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})} ~ ${endDate.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}`;
          alert(`예약이 성공적으로 등록되었습니다!\n\n📅 ${dateStr}\n⏰ ${timeStr}\n👤 ${name}\n🏢 ${department}\n📍 ${destination}`);
        }
      }
      
      // 폼 리셋
      this.reset();
      repeatOptions.style.display = 'none';
      repeatEndDate.style.display = 'none';
      repeatCheckbox.checked = false;
      allDayCheckbox.checked = false;
      document.getElementById('department').value = '';
      startInput.type = 'datetime-local';
      endInput.type = 'datetime-local';
      endInput.disabled = false;
      setDefaultStartTime();
      loadReservations();
      
    } catch (error) {
      console.error('예약 등록 오류:', error);
      let errorMessage = '예약 등록 중 오류가 발생했습니다.';
      
      if (error.code === 'permission-denied') {
        errorMessage = '권한이 없습니다. 다시 로그인해주세요.';
      } else if (error.code === 'unavailable') {
        errorMessage = '네트워크 연결을 확인해주세요.';
      } else if (error.message) {
        errorMessage += ' ' + error.message;
      }
      
      alert(errorMessage);
    }
  });
}); 