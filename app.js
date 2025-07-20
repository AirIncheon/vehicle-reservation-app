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

// 로그인/로그아웃 UI 처리
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const reservationForm = document.getElementById('reservationForm');

loginBtn.onclick = () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider);
};
logoutBtn.onclick = () => auth.signOut();

auth.onAuthStateChanged(user => {
  currentUser = user;
  const userInfo = document.getElementById('user-info');
  const logoutBtn = document.getElementById('logout-btn');
  if (user) {
    userInfo.innerText = user.email;
    userInfo.style.display = '';
    logoutBtn.style.display = '';
    document.getElementById('login-btn').style.display = 'none';
    document.getElementById('reservationForm').style.display = '';
    loadReservations();
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
        extendedProps: { purpose: r.purpose, email: r.email }
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
          let msg = `<b>예약자:</b> ${info.event.title}<br>
<b>목적:</b> ${info.event.extendedProps.purpose}`;
          let actionHtml = '';
          if (isOwner) {
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
        // 폼에 값 채우기
        document.getElementById('start').value = eventObj.startStr.slice(0,16);
        document.getElementById('end').value = eventObj.endStr.slice(0,16);
        document.getElementById('name').value = eventObj.title.split(' (')[0];
        document.getElementById('destination').value = eventObj.title.split('(')[1]?.replace(')','') || '';
        document.getElementById('purpose').value = eventObj.extendedProps.purpose;
        document.getElementById('allDay').checked = eventObj.allDay;
        editEventId = eventObj.id;
        document.querySelector('#reservationForm button[type="submit"]').textContent = '수정하기';
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

document.addEventListener('DOMContentLoaded', function() {
  updateDatalist('name-list', 'names');
  updateDatalist('destination-list', 'destinations');
  updateDatalist('purpose-list', 'purposes');
  setDefaultStartTime();
});

// 종일예약 체크 시 input type 변경
const allDayCheckbox = document.getElementById('allDay');
const startInput = document.getElementById('start');
const endInput = document.getElementById('end');

allDayCheckbox.addEventListener('change', function() {
  if (this.checked) {
    startInput.type = 'date';
    endInput.type = 'date';
    // 시작일의 날짜만 추출
    const startDate = new Date(startInput.value);
    // 종료일은 시작일 + 1일
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1);
    startInput.value = startDate.toISOString().slice(0,10);
    endInput.value = endDate.toISOString().slice(0,10);
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
  if (allDayCheckbox.checked) {
    const startDate = new Date(startInput.value);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1);
    endInput.value = endDate.toISOString().slice(0,10);
  }
});

// 예약 폼 제출 처리 (중복 체크 포함)
document.getElementById('reservationForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const start = document.getElementById('start').value;
  const end = document.getElementById('end').value;
  const name = document.getElementById('name').value;
  const destination = document.getElementById('destination').value;
  const purpose = document.getElementById('purpose').value;
  const allDay = document.getElementById('allDay').checked;

  try {
    // 중복 체크 (수정 모드일 때는 자기 자신 제외)
    const snapshot = await db.collection('reservations').get();
    const hasConflict = snapshot.docs.some(doc => {
      if (editEventId && doc.id === editEventId) return false;
      const r = doc.data();
      return (start < r.end && end > r.start && (allDay === !!r.allDay));
    });
    if (hasConflict) {
      alert('이미 해당 시간에 예약이 존재합니다!');
      return;
    }

    // 입력값 저장
    saveToLocalStorage('names', name);
    saveToLocalStorage('destinations', destination);
    saveToLocalStorage('purposes', purpose);

    if (editEventId) {
      // 수정
      await db.collection('reservations').doc(editEventId).update({
        start, end, name, destination, purpose, email: currentUser.email, allDay
      });
      editEventId = null;
      document.querySelector('#reservationForm button[type="submit"]').textContent = '예약하기';
    } else {
      // 신규 예약
      await db.collection('reservations').add({
        start, end, name, destination, purpose, email: currentUser.email, allDay
      });
    }
    this.reset();
    loadReservations();
    updateDatalist('name-list', 'names');
    updateDatalist('destination-list', 'destinations');
    updateDatalist('purpose-list', 'purposes');
  } catch (error) {
    console.error('예약 등록 오류:', error);
    alert('예약 등록 중 오류가 발생했습니다: ' + error.message);
  }
}); 