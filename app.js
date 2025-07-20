// Firebase 설정 (마크님 설정값 반영)
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

let currentUser = null;
let calendar = null;
let editEventId = null;
const ADMIN_EMAIL = 'safety7033@gmail.com';

// Firebase 연결 상태 확인 함수
function checkFirebaseConnection() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Firebase 연결 시간 초과'));
    }, 5000);
    
    db.collection('reservations').limit(1).get()
      .then(() => {
        clearTimeout(timeout);
        resolve(true);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

// 관리자 권한 확인 함수
function isAdmin(user) {
  return user && user.email === ADMIN_EMAIL;
}



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

// datalist 업데이트 함수
function updateDatalist(id, key) {
  const datalist = document.getElementById(id);
  const items = JSON.parse(localStorage.getItem(key) || '[]');
  datalist.innerHTML = items.map(item => `<option value="${item}">`).join('');
}

function saveToLocalStorage(key, value) {
  let items = JSON.parse(localStorage.getItem(key) || '[]');
  if (!items.includes(value)) {
    items.push(value);
    localStorage.setItem(key, JSON.stringify(items));
  }
}

// 시간 포맷 함수 (24시간제 HH:mm)
function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return ''; // 유효하지 않은 날짜 처리
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
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
        extendedProps: { purpose: r.purpose, email: r.email, department: r.department }
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
          const title = arg.event.title;
          // 이름과 목적지 분리
          const name = title.split(' (')[0];
          const destination = title.split('(')[1]?.replace(')','') || '';
          const alldayClass = arg.event.allDay ? 'fc-allday' : 'fc-timed';
          // 종일예약이면 '종일' 표시, 아니면 일시 표시 (흐린 하늘색 배경)
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
          let msg = `<b>예약자:</b> ${info.event.title}<br>
<b>소속:</b> ${info.event.extendedProps.department || '미지정'}<br>
<b>목적:</b> ${info.event.extendedProps.purpose}`;
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
          // dayCellClick과 동일하게 동작 (FullCalendar v6는 dateClick 사용)
          // 입력란에 날짜 자동 세팅
          const allDayCheckbox = document.getElementById('allDay');
          const startInput = document.getElementById('start');
          const endInput = document.getElementById('end');
          if (allDayCheckbox.checked) {
            // 종일 예약: date 타입
            startInput.type = 'date';
            endInput.type = 'date';
            startInput.value = info.dateStr;
            const startDate = new Date(info.dateStr);
            const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1);
            endInput.value = endDate.toISOString().slice(0,10);
            endInput.disabled = true;
          } else {
            // 시간 예약: datetime-local 타입
            startInput.type = 'datetime-local';
            endInput.type = 'datetime-local';
            startInput.value = info.dateStr + 'T09:00';
            const startDate = new Date(info.dateStr + 'T09:00');
            const endDate = new Date(startDate.getTime() + 60*60*1000);
            endInput.value = endDate.toISOString().slice(0,16);
            endInput.disabled = false;
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
    
    // 통계 업데이트 (통계 탭이 활성화되어 있을 때만)
    const statsTab = document.getElementById('stats-tab');
    if (statsTab.classList.contains('active')) {
      updateStatistics();
    }
  });
}

// 모달 표시 함수
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
  // 모달 내용 생성 로직 개선
  let bodyHtml = html;
  if (eventObj && eventObj.allDay) {
    // 종일 예약: 시작/종료 표시하지 않음
    bodyHtml = html;
  } else if (eventObj) {
    // 일반 예약: 시작/종료 정보 추가
    let start = formatTime(eventObj.start);
    let end = formatTime(eventObj.end);
    
    // 시작 시간 추가
    bodyHtml = bodyHtml.replace(/(<b>목적:<\/b>.*?<br>)/, `$1<b>시작:</b> ${start}<br>`);
    
    // 종료 시간이 유효할 때만 종료 라인 추가
    if (end && end !== '' && end !== 'Invalid Date') {
      bodyHtml = bodyHtml.replace(/(<b>시작:<\/b>.*?<br>)/, `$1<b>종료:</b> ${end}<br>`);
    }
  }
  
  document.getElementById('eventModalBody').innerHTML = bodyHtml;
  const modalInstance = new bootstrap.Modal(document.getElementById('eventModalInner'));
  modalInstance.show();

  // 수정/삭제 버튼 이벤트 연결
  setTimeout(() => {
    const editBtn = document.getElementById('editEventBtn');
    const deleteBtn = document.getElementById('deleteEventBtn');
    if (editBtn) {
      editBtn.onclick = () => {
        modalInstance.hide();
        
        // 종일 예약인지 확인
        const isAllDay = eventObj.allDay;
        const allDayCheckbox = document.getElementById('allDay');
        const startInput = document.getElementById('start');
        const endInput = document.getElementById('end');
        
        // 종일 예약 체크박스 설정
        allDayCheckbox.checked = isAllDay;
        
        if (isAllDay) {
          // 종일 예약: date 타입으로 설정
          startInput.type = 'date';
          endInput.type = 'date';
          
          // 시작일 설정
          const startDate = new Date(eventObj.start);
          startInput.value = startDate.toISOString().slice(0, 10);
          
          // 종료일 설정 (종일 예약은 다음날까지)
          const endDate = new Date(eventObj.end);
          endInput.value = endDate.toISOString().slice(0, 10);
          endInput.disabled = true;
        } else {
          // 일반 예약: datetime-local 타입으로 설정
          startInput.type = 'datetime-local';
          endInput.type = 'datetime-local';
          
          // 시작 시간 설정 (startStr 대신 start 사용)
          const startDate = new Date(eventObj.start);
          startInput.value = startDate.toISOString().slice(0, 16);
          
          // 종료 시간 설정 (endStr 대신 end 사용)
          const endDate = new Date(eventObj.end);
          endInput.value = endDate.toISOString().slice(0, 16);
          endInput.disabled = false;
        }
        
        // 나머지 필드 설정
        document.getElementById('name').value = eventObj.title.split(' (')[0];
        document.getElementById('department').value = eventObj.extendedProps.department || '';
        document.getElementById('destination').value = eventObj.title.split('(')[1]?.replace(')','') || '';
        document.getElementById('purpose').value = eventObj.extendedProps.purpose;
        editEventId = eventObj.id;
        document.querySelector('#reservationForm button[type="submit"]').textContent = '수정하기';
        
        // 수정 모드에서는 반복 예약 옵션 숨기기
        document.getElementById('repeatOptions').style.display = 'none';
        document.getElementById('repeatEndDate').style.display = 'none';
        document.getElementById('repeatReservation').checked = false;
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

// 예약 시작 기본값 설정 함수
function setDefaultStartTime() {
  const now = new Date();
  const startInput = document.getElementById('start');
  const endInput = document.getElementById('end');
  let startDate;
  if (now.getHours() < 12) {
    // 오전: 오늘 현재시간
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
  } else {
    // 오후: 익일 오전 9시
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
  }
  startInput.value = startDate.toISOString().slice(0,16);
  // 기본적으로 1시간 뒤로 종료
  const endDate = new Date(startDate.getTime() + 60*60*1000);
  endInput.value = endDate.toISOString().slice(0,16);
}

// 반복 예약 생성 함수
async function createRepeatReservations(start, end, name, department, destination, purpose, allDay, repeatType, repeatEndDate) {
  // 입력값 검증
  if (!start || !end || !name || !department || !destination || !purpose || !repeatEndDate) {
    alert('모든 필드를 입력해주세요.');
    return false;
  }
  
  // 종료일 검증
  const endDate = new Date(repeatEndDate);
  if (isNaN(endDate.getTime())) {
    alert('유효하지 않은 반복 종료일입니다.');
    return false;
  }
  
  const startDate = new Date(start);
  if (endDate <= startDate) {
    alert('반복 종료일은 시작일보다 늦어야 합니다.');
    return false;
  }
  
  const reservations = [];
  let currentStart = new Date(start);
  let currentEnd = new Date(end);
  
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
    repeatGroup: Date.now() // 반복 그룹 식별자
  });
  
  // 반복 예약 생성 (최대 100개로 제한)
  let repeatCount = 0;
  const maxRepeats = 100;
  
  while (repeatCount < maxRepeats) {
    // 다음 날짜 계산 (새로운 Date 객체 생성)
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
      case 'biweekly':
        nextStart.setDate(nextStart.getDate() + 14);
        nextEnd.setDate(nextEnd.getDate() + 14);
        break;
      case 'monthly':
        nextStart.setMonth(nextStart.getMonth() + 1);
        nextEnd.setMonth(nextEnd.getMonth() + 1);
        break;
      case 'yearly':
        nextStart.setFullYear(nextStart.getFullYear() + 1);
        nextEnd.setFullYear(nextEnd.getFullYear() + 1);
        break;
    }
    
    // 종료일을 넘으면 중단
    if (nextStart > endDate) {
      break;
    }
    
    // 예약 추가
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
      repeatGroup: Date.now() // 반복 그룹 식별자
    });
    
    repeatCount++;
    
    // 다음 반복을 위해 현재 날짜 업데이트
    currentStart = nextStart;
    currentEnd = nextEnd;
  }
  
  // 최대 개수 도달 시 경고
  if (repeatCount >= maxRepeats) {
    alert(`반복 예약이 최대 개수(${maxRepeats}개)에 도달했습니다.`);
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
      
      // 시간 겹침 체크 (Date 객체 비교)
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

// 통계 계산 및 표시 함수
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

// 알림 표시 함수
function showNotification(title, message) {
  const toast = document.getElementById('notificationToast');
  const notificationTime = document.getElementById('notificationTime');
  const notificationBody = document.getElementById('notificationBody');
  
  notificationTime.textContent = new Date().toLocaleTimeString('ko-KR');
  notificationBody.innerHTML = `<strong>${title}</strong><br>${message}`;
  
  const toastInstance = new bootstrap.Toast(toast);
  toastInstance.show();
}

// 예약 알림 체크 함수
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
        
        // 내일 예약이 있고, 내 예약이거나 관리자인 경우
        if (reservationDateStr === tomorrowStr && 
            (reservation.email === currentUser.email || isAdmin(currentUser))) {
          const time = formatTime(reservation.start);
          const isAllDay = reservation.allDay ? '종일' : time;
          notifications.push({
            title: `${reservation.name}님의 예약`,
            message: `내일 ${isAllDay} - ${reservation.destination} (${reservation.purpose})`
          });
        }
      } catch (error) {
        // 날짜 파싱 오류 시 무시
        return;
      }
    });
    
    // 알림 표시
    notifications.forEach(notification => {
      setTimeout(() => {
        showNotification(notification.title, notification.message);
      }, 1000);
    });
  });
}

document.addEventListener('DOMContentLoaded', function() {
  // 로그인/로그아웃 UI 처리
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  
  loginBtn.onclick = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider);
  };
  logoutBtn.onclick = () => auth.signOut();
  
  updateDatalist('name-list', 'names');
  updateDatalist('destination-list', 'destinations');
  updateDatalist('purpose-list', 'purposes');
  setDefaultStartTime();
  
  // 통계 탭 클릭 이벤트
  document.getElementById('stats-tab').addEventListener('click', function() {
    updateStatistics();
  });
  
  // 반복 예약 관련 요소들
  const repeatCheckbox = document.getElementById('repeatReservation');
  const repeatOptions = document.getElementById('repeatOptions');
  const repeatEndDate = document.getElementById('repeatEndDate');
  const repeatEnd = document.getElementById('repeatEnd');
  
  // 반복 예약 체크박스 이벤트
  repeatCheckbox.addEventListener('change', function() {
    if (this.checked) {
      repeatOptions.style.display = 'block';
      repeatEndDate.style.display = 'block';
      // 기본 종료일을 3개월 후로 설정
      const defaultEndDate = new Date();
      defaultEndDate.setMonth(defaultEndDate.getMonth() + 3);
      repeatEnd.value = defaultEndDate.toISOString().slice(0, 10);
    } else {
      repeatOptions.style.display = 'none';
      repeatEndDate.style.display = 'none';
    }
  });
  
  // 종일예약 체크 시 input type 변경
  const allDayCheckbox = document.getElementById('allDay');
  const startInput = document.getElementById('start');
  const endInput = document.getElementById('end');
  
  allDayCheckbox.addEventListener('change', function() {
    if (this.checked) {
      startInput.type = 'date';
      endInput.type = 'date';
      
      // 현재 날짜를 기본값으로 설정
      const today = new Date();
      const startDate = startInput.value ? new Date(startInput.value) : today;
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1);
      
      startInput.value = startDate.toISOString().slice(0, 10);
      endInput.value = endDate.toISOString().slice(0, 10);
      endInput.disabled = true;
    } else {
      startInput.type = 'datetime-local';
      endInput.type = 'datetime-local';
      endInput.disabled = false;
      // 기존 값 복원(없으면 현재시간)
      setDefaultStartTime();
    }
  });
  
  startInput.addEventListener('change', function() {
    const allDayCheckbox = document.getElementById('allDay');
    if (allDayCheckbox && allDayCheckbox.checked) {
      try {
        const startDate = new Date(startInput.value);
        if (!isNaN(startDate.getTime())) {
          const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1);
          endInput.value = endDate.toISOString().slice(0, 10);
        }
      } catch (error) {
        console.error('종일 예약 날짜 처리 오류:', error);
        // 오류 발생 시 현재 날짜로 설정
        const today = new Date();
        const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        startInput.value = today.toISOString().slice(0, 10);
        endInput.value = tomorrow.toISOString().slice(0, 10);
      }
    }
  });
  
  // 예약 폼 제출 처리 (중복 체크 포함)
  document.getElementById('reservationForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const start = document.getElementById('start').value;
    const end = document.getElementById('end').value;
    const name = document.getElementById('name').value;
    const department = document.getElementById('department').value;
    const destination = document.getElementById('destination').value;
    const purpose = document.getElementById('purpose').value;
    const allDay = document.getElementById('allDay').checked;
    const isRepeat = document.getElementById('repeatReservation').checked;
    const repeatType = document.getElementById('repeatType').value;
    const repeatEnd = document.getElementById('repeatEnd').value;

    // 필수 입력값 검증
    if (!start || !end || !name || !department || !destination || !purpose) {
      alert('모든 필드를 입력해주세요.');
      return;
    }
    
    // 반복 예약인 경우 종료일 검증
    if (isRepeat && !repeatEnd) {
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
    
    // 시작일이 종료일보다 늦은 경우
    if (startDate >= endDate) {
      alert('종료일은 시작일보다 늦어야 합니다.');
      return;
    }
    
    // 과거 날짜 예약 방지 (오늘 이전 날짜)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startDate < today) {
      alert('과거 날짜는 예약할 수 없습니다.');
      return;
    }
    
    // 종일 예약이 아닌 경우 시간 간격 검증 (최소 30분)
    if (!allDay) {
      const timeDiff = endDate.getTime() - startDate.getTime();
      const minDuration = 30 * 60 * 1000; // 30분
      if (timeDiff < minDuration) {
        alert('예약 시간은 최소 30분 이상이어야 합니다.');
        return;
      }
    }

    try {
      // Firebase 연결 상태 확인
      await checkFirebaseConnection();
      
      // 입력값 저장
      saveToLocalStorage('names', name);
      saveToLocalStorage('destinations', destination);
      saveToLocalStorage('purposes', purpose);

      if (editEventId) {
        // 수정 (반복 예약은 수정 불가)
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
          const success = await createRepeatReservations(start, end, name, department, destination, purpose, allDay, repeatType, repeatEnd);
          if (!success) return;
          
          // 반복 예약 성공 메시지
          const startDate = new Date(start);
          const endDate = new Date(repeatEnd);
          const repeatTypeText = {
            'daily': '매일',
            'weekly': '매주',
            'biweekly': '격주',
            'monthly': '매월',
            'yearly': '매년'
          }[repeatType] || repeatType;
          
          alert(`반복 예약이 성공적으로 생성되었습니다!\n\n📅 ${startDate.toLocaleDateString('ko-KR')} ~ ${endDate.toLocaleDateString('ko-KR')}\n🔄 ${repeatTypeText} 반복\n👤 ${name}\n🏢 ${department}\n📍 ${destination}`);
        } else {
          // 단일 예약 생성
          // 중복 체크 (수정 모드일 때는 자기 자신 제외)
          const snapshot = await db.collection('reservations').get();
          const hasConflict = snapshot.docs.some(doc => {
            if (editEventId && doc.id === editEventId) return false;
            const r = doc.data();
            const reservationStart = new Date(start);
            const reservationEnd = new Date(end);
            const existingStart = new Date(r.start);
            const existingEnd = new Date(r.end);
            
            // 시간 겹침 체크
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
      
      // 폼 리셋 및 UI 상태 초기화 (최적화된 버전)
      this.reset();
      
      // DOM 요소들을 한 번에 가져와서 처리
      const repeatOptions = document.getElementById('repeatOptions');
      const repeatEndDate = document.getElementById('repeatEndDate');
      const repeatReservation = document.getElementById('repeatReservation');
      const allDayCheckbox = document.getElementById('allDay');
      const departmentField = document.getElementById('department');
      const startInput = document.getElementById('start');
      const endInput = document.getElementById('end');
      const submitButton = document.querySelector('#reservationForm button[type="submit"]');
      
      // 반복 예약 관련 UI 초기화
      repeatOptions.style.display = 'none';
      repeatEndDate.style.display = 'none';
      repeatReservation.checked = false;
      
      // 종일 예약 체크박스 초기화
      allDayCheckbox.checked = false;
      
      // 소속 필드 리셋
      departmentField.value = '';
      
      // input type을 datetime-local로 복원
      startInput.type = 'datetime-local';
      endInput.type = 'datetime-local';
      endInput.disabled = false;
      
      // 버튼 텍스트 복원
      submitButton.textContent = '예약하기';
      
      // 기본 시간 설정
      setDefaultStartTime();
      
      // 예약 목록 새로고침
      loadReservations();
      
      // datalist 업데이트
      updateDatalist('name-list', 'names');
      updateDatalist('destination-list', 'destinations');
      updateDatalist('purpose-list', 'purposes');
    } catch (error) {
      console.error('예약 등록 오류:', error);
      
      // 사용자 친화적인 오류 메시지
      let errorMessage = '예약 등록 중 오류가 발생했습니다.';
      
      if (error.code === 'permission-denied') {
        errorMessage = '권한이 없습니다. 다시 로그인해주세요.';
      } else if (error.code === 'unavailable') {
        errorMessage = '네트워크 연결을 확인해주세요.';
      } else if (error.code === 'deadline-exceeded') {
        errorMessage = '요청 시간이 초과되었습니다. 다시 시도해주세요.';
      } else if (error.message) {
        errorMessage += ' ' + error.message;
      }
      
      alert(errorMessage);
    }
  });
}); 