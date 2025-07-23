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
let repeatType = null;
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
  if (!date || isNaN(date.getTime())) {
    return '';
  }
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
  const endGroup = document.getElementById('end-group');
  allDayCheckbox.addEventListener('change', function() {
    if (this.checked) {
      startInput.type = 'date';
      if (endGroup) {
        endGroup.style.display = 'none';
        endInput.value = '';
        endInput.required = false;
        endInput.disabled = true;
      }
      // datetime-local에서 date로 바꿀 때, 로컬 타임존 기준 yyyy-mm-dd 추출
      let dateStr;
      if (startInput.value && startInput.value.length >= 10) {
        dateStr = startInput.value.slice(0, 10);
      } else {
        const today = new Date();
        dateStr = formatDate(today);
      }
      startInput.value = dateStr;
    } else {
      startInput.type = 'datetime-local';
      if (endGroup) {
        endGroup.style.display = '';
        endInput.value = '';
        endInput.required = true;
        endInput.disabled = false;
      }
      if (window._lastEventObj) {
        const utcStart = new Date(window._lastEventObj.start);
        const kstDate = toKST(utcStart);
        const dateStr = formatDate(kstDate); // yyyy-mm-dd
        startInput.value = dateStr + 'T00:00';
        endInput.value = dateStr + 'T23:59';
      } else {
        const today = new Date();
        const dateStr = formatDate(today);
        startInput.value = dateStr + 'T00:00';
        endInput.value = dateStr + 'T23:59';
      }
    }
  });
}

  // 반복 예약 체크박스 이벤트
  function setupRepeatCheckbox() {
    if (!repeatCheckbox || !repeatOptions || !repeatType) return;
    
    repeatCheckbox.addEventListener('change', function() {
      const repeatEndDateElement = document.getElementById('repeatEndDate');
      
      if (this.checked) {
        repeatOptions.style.display = 'block';
        // 반복 종료일을 required로 설정
        if (repeatEndDateElement) {
          repeatEndDateElement.required = true;
        }
        // 반복 종료일 기본값 설정 (예약 종료일 + 1개월)
        if (repeatEndDateElement && endInput && endInput.value) {
          const endDate = new Date(endInput.value);
          const defaultRepeatEnd = new Date(endDate);
          defaultRepeatEnd.setMonth(defaultRepeatEnd.getMonth() + 1);
          repeatEndDateElement.value = defaultRepeatEnd.toISOString().split('T')[0];
        }
      } else {
        repeatOptions.style.display = 'none';
        // 반복 종료일을 required 해제
        if (repeatEndDateElement) {
          repeatEndDateElement.required = false;
          repeatEndDateElement.value = '';
        }
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
      if (!isNaN(startDate.getTime())) {
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        endInput.value = formatDate(endDate);
      }
    } else {
      // 일반 예약: 시작 시간 + 1시간을 종료 시간으로 설정
      const startTime = new Date(this.value);
      if (!isNaN(startTime.getTime())) {
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
        endInput.value = endTime.toISOString().slice(0, 16);
      }
    }
  });
}

// 반복 예약 생성
async function createRepeatReservations(start, end, repeatEndDate, name, department, destination, purpose, allDay, repeatType) {
  const reservations = [];
  const startDate = new Date(start);
  const endDate = new Date(end);
  
  // 반복 그룹 ID 생성 (고유한 식별자)
  const repeatGroupId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  
  // 반복 타입별 검증 및 로직
  switch (repeatType) {
    case 'daily':
      // 매일 반복: 시작일과 종료일이 같아야 함
      if (startDate.toDateString() !== endDate.toDateString()) {
        alert('매일 반복 예약의 경우 시작일과 종료일이 같아야 합니다.');
        return false;
      }
      
      // 매일 반복 예약 생성 (반복 종료일까지)
      let currentDate = new Date(startDate);
      const dailyEndDate = new Date(repeatEndDate); // 반복 종료일 사용
      
              while (currentDate <= dailyEndDate) {
        const dayStart = new Date(currentDate);
        const dayEnd = new Date(currentDate);
        
        // 종일 예약이 아닌 경우 원래 시간 유지
        if (!allDay) {
          dayStart.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0);
          dayEnd.setHours(endDate.getHours(), endDate.getMinutes(), 0, 0);
        }
        
        reservations.push({
          start: dayStart.toISOString(),
          end: dayEnd.toISOString(),
          name,
          department,
          destination,
          purpose,
          email: currentUser.email,
          allDay,
          isRepeat: true,
          repeatGroup: repeatGroupId,
          repeatType: repeatType
        });
        
        // 다음 날로 이동
        currentDate.setDate(currentDate.getDate() + 1);
      }
      break;
      
    case 'weekly':
      // 매주 반복: 시작일의 요일을 기준으로 매주 같은 요일에 반복
      const startDayOfWeek = startDate.getDay(); // 0=일요일, 1=월요일, ...
      const durationDays = Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));
      
      // 예약 기간이 6일을 초과하면 안됨 (다음 주 같은 요일을 초과하면 안됨)
      if (durationDays > 6) {
        alert('매주 반복 예약의 경우 예약 기간이 6일을 초과할 수 없습니다.');
        return false;
      }
      
      let currentWeekStart = new Date(startDate);
      const weeklyEndDate = new Date(repeatEndDate); // 반복 종료일 사용
      
              while (currentWeekStart <= weeklyEndDate) {
        // 해당 주의 시작일 (같은 요일)
        const weekStart = new Date(currentWeekStart);
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekStart.getDate() + durationDays);
        
        // 종일 예약이 아닌 경우 원래 시간 유지
        if (!allDay) {
          weekStart.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0);
          weekEnd.setHours(endDate.getHours(), endDate.getMinutes(), 0, 0);
        }
        
        reservations.push({
          start: weekStart.toISOString(),
          end: weekEnd.toISOString(),
          name,
          department,
          destination,
          purpose,
          email: currentUser.email,
          allDay,
          isRepeat: true,
          repeatGroup: repeatGroupId,
          repeatType: repeatType
        });
        
        // 다음 주로 이동 (7일 후)
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
      }
      break;
      
    case 'yearly':
      // 매년 반복: 시작일과 종료일을 그대로 유지하며 매년 반복
      let currentYearStart = new Date(startDate);
      const yearlyEndDate = new Date(repeatEndDate); // 반복 종료일 사용
      
              while (currentYearStart <= yearlyEndDate) {
        const yearStart = new Date(currentYearStart);
        const yearEnd = new Date(currentYearStart);
        yearEnd.setDate(yearStart.getDate() + Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000)));
        
        reservations.push({
          start: yearStart.toISOString(),
          end: yearEnd.toISOString(),
          name,
          department,
          destination,
          purpose,
          email: currentUser.email,
          allDay,
          isRepeat: true,
          repeatGroup: repeatGroupId,
          repeatType: repeatType
        });
        
        // 다음 해로 이동
        currentYearStart.setFullYear(currentYearStart.getFullYear() + 1);
      }
      break;
  }
  
  // 중복 체크 (더 정확한 겹침 검사)
  const snapshot = await db.collection('reservations').get();
  const conflicts = [];
  
  for (const reservation of reservations) {
    const reservationStart = new Date(reservation.start);
    const reservationEnd = new Date(reservation.end);
    
    const hasConflict = snapshot.docs.some(doc => {
      const r = doc.data();
      const existingStart = new Date(r.start);
      const existingEnd = new Date(r.end);
      
      // 시간 겹침 검사 (시작일이 다른 예약의 종료일보다 이전이고, 종료일이 다른 예약의 시작일보다 이후)
      const timeOverlap = reservationStart < existingEnd && reservationEnd > existingStart;
      
      // 종일 예약과 시간 예약은 겹치지 않음
      const allDayConflict = allDay === !!r.allDay;
      
      return timeOverlap && allDayConflict;
    });
    
    if (hasConflict) {
      const conflictDate = new Date(reservation.start);
      const dateStr = conflictDate.toLocaleDateString('ko-KR');
      const timeStr = allDay ? '종일' : `${formatTime(conflictDate)} ~ ${formatTime(reservationEnd)}`;
      conflicts.push(`${dateStr} ${timeStr}`);
    }
  }
  
  if (conflicts.length > 0) {
    const conflictMessage = `다음 일정과 겹치는 예약이 존재합니다:\n\n${conflicts.join('\n')}\n\n예약을 취소하시겠습니까?`;
    if (!confirm(conflictMessage)) {
      return false;
    }
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
  // DOM 요소가 준비되지 않았으면 리턴
  const calendarElement = document.getElementById('calendar');
  if (!calendarElement) {
    console.warn('Calendar element not found');
    return;
  }
  
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
          destination: r.destination,
          isRepeat: r.isRepeat || false,
          repeatType: r.repeatType || null,
          repeatGroup: r.repeatGroup || null
        }
      });
    });
    
    if (!calendar) {
      try {
        calendar = new FullCalendar.Calendar(calendarElement, {
          initialView: 'dayGridMonth',
          locale: 'ko',
          headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
          },
        events,
        eventContent: function(arg) {
          try {
            // 안전한 시간 포맷팅
            let startTime = '';
            let endTime = '';
            
            if (arg.event.start && typeof arg.event.start.getTime === 'function') {
              startTime = formatTime(arg.event.start);
            }
            
            if (arg.event.end && typeof arg.event.end.getTime === 'function') {
              endTime = formatTime(arg.event.end);
            }
            
            const name = arg.event.extendedProps?.name || '알 수 없음';
            const destination = arg.event.extendedProps?.destination || '';
            const alldayClass = arg.event.allDay ? 'fc-allday' : 'fc-timed';
            
            return {
              html: `<div class='fc-event-custom ${alldayClass}'>
                <div style='font-size:0.85em; color:#1976d2;'>${arg.event.allDay ? '종일' : startTime + (endTime ? `~${endTime}` : '')}</div>
                <div style='font-weight:bold; font-size:1em; color:#222;'>${name}${destination ? ` (${destination})` : ''}</div>
              </div>`
            };
          } catch (error) {
            console.warn('Event content rendering error:', error);
            return {
              html: `<div class='fc-event-custom fc-timed'>
                <div style='font-size:0.85em; color:#1976d2;'>시간 정보 없음</div>
                <div style='font-weight:bold; font-size:1em;'>예약 정보</div>
              </div>`
            };
          }
        },
        eventClick: function(info) {
          const isOwner = info.event.extendedProps.email === currentUser.email;
          const isAdminUser = isAdmin(currentUser);
          
          let msg = `<b>예약자:</b> ${info.event.extendedProps.name}<br>
<b>소속:</b> ${info.event.extendedProps.department || '미지정'}<br>
<b>목적지:</b> ${info.event.extendedProps.destination}`;
          
          // 반복 예약 정보 추가
          if (info.event.extendedProps.isRepeat) {
            const repeatTypeText = {
              'daily': '매일',
              'weekly': '매주',
              'yearly': '매년'
            }[info.event.extendedProps.repeatType] || '반복';
            msg += `<br><b>반복:</b> ${repeatTypeText} 예약`;
          }
          
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
      } catch (error) {
        console.error('Calendar initialization error:', error);
        // 캘린더 초기화 실패 시 기본 이벤트만 표시
        calendar = null;
      }
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
        // 반복 예약인지 확인
        if (eventObj.extendedProps.isRepeat) {
          showDeleteRepeatModal(eventObj, modalInstance);
        } else {
          // 단일 예약 삭제
          if (confirm('정말 삭제하시겠습니까?')) {
            await db.collection('reservations').doc(eventObj.id).delete();
            modalInstance.hide();
            loadReservations();
          }
        }
      };
    }
  }, 100);
  // 알림 메시지 시간 표시 보정
  if (eventObj && eventObj.start && eventObj.end) {
    const startKST = toKST(new Date(eventObj.start));
    const endKST = toKST(new Date(eventObj.end));
    const dateStr = startKST.toLocaleDateString('ko-KR');
    const timeStr = eventObj.allDay ? '종일' : `${startKST.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})} ~ ${endKST.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}`;
    // html 메시지 내 시간 부분을 위 값으로 대체(필요시)
  }
}

// UTC→KST 변환 (simple-view.js와 동일하게)
function toKST(date) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
}
// KST→UTC 변환 (simple-view.js와 동일하게)
function toUTC(date) {
  return new Date(date.getTime() - 9 * 60 * 60 * 1000);
}
// KST 날짜를 UTC ISO로 변환 (종일 예약용)
function allDayKSTtoUTCISO(dateStr) {
  // dateStr: yyyy-mm-dd
  const startKST = new Date(dateStr + 'T00:00:00+09:00');
  const endKST = new Date(dateStr + 'T23:59:59+09:00');
  return {
    start: toUTC(startKST).toISOString(),
    end: toUTC(endKST).toISOString()
  };
}

// datetime-local 입력값을 KST로 해석하는 함수
function parseKSTDateTime(inputValue) {
  // inputValue: "2025-07-24T08:00"
  return new Date(inputValue + ':00+09:00');
}

// 수정 폼에 데이터 채우기
function populateEditForm(eventObj) {
  if (!allDayCheckbox || !startInput || !endInput) return;
  window._lastEventObj = eventObj; // 현재 수정 중 예약의 원본 저장
  const isAllDay = eventObj.allDay;
  const endGroup = document.getElementById('end-group');
  allDayCheckbox.checked = isAllDay;
  const utcStart = new Date(eventObj.start);
  const utcEnd = new Date(eventObj.end);
  if (isAllDay) {
    startInput.type = 'date';
    if (endGroup) {
      endGroup.style.display = 'none';
      endInput.value = '';
    }
    // UTC→KST 변환 후 yyyy-mm-dd로 변환
    const startDateKST = toKST(utcStart);
    startInput.value = formatDate(startDateKST);
  } else {
    startInput.type = 'datetime-local';
    if (endGroup) {
      endGroup.style.display = '';
      endInput.value = '';
    }
    const startDateKST = toKST(utcStart);
    const endDateKST = toKST(utcEnd);
    startInput.value = startDateKST.toISOString().slice(0, 16);
    endInput.value = endDateKST.toISOString().slice(0, 16);
  }
  
  // 나머지 필드 설정
  document.getElementById('name').value = eventObj.extendedProps.name;
  document.getElementById('department').value = eventObj.extendedProps.department || '';
  document.getElementById('destination').value = eventObj.extendedProps.destination;
  document.getElementById('purpose').value = eventObj.extendedProps.purpose;
  
  editEventId = eventObj.id;
  document.querySelector('#reservationForm button[type="submit"]').textContent = '수정하기';
  
  // 반복 예약 정보 표시 (수정 모드에서도 확인 가능)
  if (eventObj.extendedProps.isRepeat) {
    if (repeatOptions) repeatOptions.style.display = 'block';
    if (repeatCheckbox) repeatCheckbox.checked = true;
    if (repeatType) repeatType.value = eventObj.extendedProps.repeatType || 'weekly';
    
    // 반복 종료일 설정 (기존 반복 그룹의 마지막 예약 날짜를 찾아서 설정)
    const repeatEndDateElement = document.getElementById('repeatEndDate');
    if (repeatEndDateElement && eventObj.extendedProps.repeatGroup) {
      // 같은 반복 그룹의 모든 예약을 조회하여 가장 늦은 날짜를 반복 종료일로 설정
      db.collection('reservations')
        .where('repeatGroup', '==', eventObj.extendedProps.repeatGroup)
        .get()
        .then(snapshot => {
          let latestDate = new Date(eventObj.start);
          snapshot.forEach(doc => {
            const reservation = doc.data();
            const reservationDate = new Date(reservation.end);
            if (reservationDate > latestDate) {
              latestDate = reservationDate;
            }
          });
          repeatEndDateElement.value = latestDate.toISOString().split('T')[0];
        })
        .catch(error => {
          console.error('반복 종료일 조회 오류:', error);
          // 오류 시 기본값 설정
          const endDate = new Date(eventObj.end);
          const defaultRepeatEnd = new Date(endDate);
          defaultRepeatEnd.setMonth(defaultRepeatEnd.getMonth() + 1);
          repeatEndDateElement.value = defaultRepeatEnd.toISOString().split('T')[0];
        });
    } else if (repeatEndDateElement) {
      // repeatGroup이 없는 경우 기본값 설정
      const endDate = new Date(eventObj.end);
      const defaultRepeatEnd = new Date(endDate);
      defaultRepeatEnd.setMonth(defaultRepeatEnd.getMonth() + 1);
      repeatEndDateElement.value = defaultRepeatEnd.toISOString().split('T')[0];
    }
  } else {
    // 수정 모드에서는 반복 예약 옵션 숨기기
    if (repeatOptions) repeatOptions.style.display = 'none';
    if (repeatCheckbox) repeatCheckbox.checked = false;
  }
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

// 반복 예약 삭제 모달 표시
function showDeleteRepeatModal(eventObj, originalModalInstance) {
  let deleteModal = document.getElementById('deleteRepeatModal');
  if (!deleteModal) {
    deleteModal = document.createElement('div');
    deleteModal.id = 'deleteRepeatModal';
    deleteModal.innerHTML = `
      <div class="modal fade" tabindex="-1" id="deleteRepeatModalInner">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">반복 예약 삭제</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="alert alert-info">
                <i class="bi bi-info-circle"></i>
                <strong>${eventObj.extendedProps.name}</strong>님의 반복 예약을 삭제하시겠습니까?
              </div>
              <div class="d-grid gap-3">
                <button type="button" class="btn btn-outline-warning btn-lg" id="deleteThisEvent">
                  <i class="bi bi-calendar-x me-2"></i>
                  <div><strong>해당 일정만 삭제</strong></div>
                  <small class="text-muted">선택한 날짜의 예약만 삭제됩니다</small>
                </button>
                <button type="button" class="btn btn-outline-danger btn-lg" id="deleteFutureEvents">
                  <i class="bi bi-calendar-minus me-2"></i>
                  <div><strong>이후 일정 모두 삭제</strong></div>
                  <small class="text-muted">선택한 날짜부터 미래의 모든 반복 예약이 삭제됩니다</small>
                </button>
                <button type="button" class="btn btn-danger btn-lg" id="deleteAllEvents">
                  <i class="bi bi-calendar-dash me-2"></i>
                  <div><strong>전체 반복 예약 삭제</strong></div>
                  <small class="text-muted">이 반복 예약의 모든 일정이 삭제됩니다</small>
                </button>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">취소</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(deleteModal);
  }
  
  const deleteModalInstance = new bootstrap.Modal(document.getElementById('deleteRepeatModalInner'));
  deleteModalInstance.show();
  
  // 원본 모달 숨기기
  originalModalInstance.hide();
  
  // 삭제 버튼 이벤트 연결
  setTimeout(() => {
    const deleteThisBtn = document.getElementById('deleteThisEvent');
    const deleteFutureBtn = document.getElementById('deleteFutureEvents');
    const deleteAllBtn = document.getElementById('deleteAllEvents');
    
    if (deleteThisBtn) {
      deleteThisBtn.onclick = async () => {
        await deleteRepeatEvent(eventObj, 'this');
        deleteModalInstance.hide();
        loadReservations();
      };
    }
    
    if (deleteFutureBtn) {
      deleteFutureBtn.onclick = async () => {
        await deleteRepeatEvent(eventObj, 'future');
        deleteModalInstance.hide();
        loadReservations();
      };
    }
    
    if (deleteAllBtn) {
      deleteAllBtn.onclick = async () => {
        await deleteRepeatEvent(eventObj, 'all');
        deleteModalInstance.hide();
        loadReservations();
      };
    }
  }, 100);
}

// 반복 예약 삭제 처리
async function deleteRepeatEvent(eventObj, deleteType) {
  try {
    const eventDate = new Date(eventObj.start);
    const repeatGroup = eventObj.extendedProps.repeatGroup;
    
    if (!repeatGroup) {
      // repeatGroup이 없으면 해당 예약만 삭제
      await db.collection('reservations').doc(eventObj.id).delete();
      return;
    }
    
    // 같은 반복 그룹의 모든 예약 조회
    const snapshot = await db.collection('reservations')
      .where('repeatGroup', '==', repeatGroup)
      .get();
    
    const batch = db.batch();
    
    snapshot.forEach(doc => {
      const reservation = doc.data();
      const reservationDate = new Date(reservation.start);
      
      let shouldDelete = false;
      
      switch (deleteType) {
        case 'this':
          // 해당 일정만 삭제
          shouldDelete = doc.id === eventObj.id;
          break;
        case 'future':
          // 이후 일정 삭제 (해당 날짜 포함)
          shouldDelete = reservationDate >= eventDate;
          break;
        case 'all':
          // 모든 일정 삭제
          shouldDelete = true;
          break;
      }
      
      if (shouldDelete) {
        batch.delete(doc.ref);
      }
    });
    
    await batch.commit();
    
    // 삭제 완료 메시지
    const deleteTypeText = {
      'this': '해당 일정',
      'future': '이후 일정',
      'all': '모든 일정'
    }[deleteType];
    
    alert(`${deleteTypeText}이 성공적으로 삭제되었습니다.`);
    
  } catch (error) {
    console.error('Delete repeat event error:', error);
    alert('삭제 중 오류가 발생했습니다.');
  }
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
    
    // DOM이 준비된 후 캘린더 로드
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        loadReservations();
      });
    } else {
      loadReservations();
    }
    
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
  repeatType = document.getElementById('repeatType');
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
  
  // 반복 종료일 필드 초기화 (required 해제)
  const repeatEndDateElement = document.getElementById('repeatEndDate');
  if (repeatEndDateElement) {
    repeatEndDateElement.required = false;
  }
  
  // 통계 탭 클릭 이벤트
  statsTab.addEventListener('click', function() {
    updateStatistics();
  });
  
  // 기본 시간 설정
  setDefaultStartTime();
  
  // 예약 폼 제출 이벤트
  reservationForm.addEventListener('submit', async function(e) {
    if (allDayCheckbox && allDayCheckbox.checked) {
      endInput.required = false;
      endInput.disabled = true;
    } else {
      endInput.required = true;
      endInput.disabled = false;
    }
    e.preventDefault();
    const allDay = allDayCheckbox.checked;
    let startUTC, endUTC;
    if (allDay) {
      const startKST = new Date(startInput.value + 'T00:00:00+09:00');
      const endKST = new Date(startInput.value + 'T23:59:59+09:00');
      startUTC = toUTC(startKST).toISOString();
      endUTC = toUTC(endKST).toISOString();
    } else {
      // 일반 예약: 입력값을 KST로 해석 후 UTC로 변환하여 저장
      const startKST = parseKSTDateTime(startInput.value);
      const endKST = parseKSTDateTime(endInput.value);
      startUTC = toUTC(startKST).toISOString();
      endUTC = toUTC(endKST).toISOString();
    }
    
    const name = document.getElementById('name').value;
    const department = document.getElementById('department').value;
    const destination = document.getElementById('destination').value;
    const purpose = document.getElementById('purpose').value;
    const isRepeat = repeatCheckbox.checked;
    const repeatTypeValue = repeatType.value;

    // 필수 입력값 검증
    if (!startUTC || !endUTC || !name || !department || !destination || !purpose) {
      alert('모든 필드를 입력해주세요.');
      return;
    }
    
    // 날짜/시간 유효성 검증 (KST 기준)
    const startDate = new Date(startInput.value); // KST 기준
    const endDate = new Date(endInput.value);
    const now = new Date();
    const todayKST = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0); // 로컬 타임존 오늘 00:00
    if (startDate < todayKST) {
      alert('과거 날짜는 예약할 수 없습니다.');
      return;
    }
    
    // 시작일과 종료일 검증 (종일 예약은 시작일과 종료일이 같을 수 있음)
    if (allDayCheckbox.checked) {
      // 종일 예약: 시작일이 종료일보다 늦으면 안됨
      if (startDate > endDate) {
        alert('종일 예약의 종료일은 시작일보다 늦거나 같아야 합니다.');
        return;
      }
    } else {
      // 일반 예약: 시작일이 종료일보다 늦으면 안됨
      if (startDate >= endDate) {
        alert('종료일은 시작일보다 늦어야 합니다.');
        return;
      }
    }
    
    // 반복 예약 추가 검증
    if (isRepeat) {
      if (repeatTypeValue === 'daily') {
        // 매일 반복: 시작일과 종료일이 같아야 함
        if (startDate.toDateString() !== endDate.toDateString()) {
          alert('매일 반복 예약의 경우 시작일과 종료일이 같아야 합니다.');
          return;
        }
      } else if (repeatTypeValue === 'weekly') {
        // 매주 반복: 예약 기간이 6일을 초과하면 안됨
        const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
        if (durationDays > 6) {
          alert('매주 반복 예약의 경우 예약 기간이 6일을 초과할 수 없습니다.');
          return;
        }
      }
    }
    
    // 일반 예약의 경우 시간 간격 검증 (최소 30분)
    if (!allDayCheckbox.checked) {
      const timeDiff = endDate.getTime() - startDate.getTime();
      const minDuration = 30 * 60 * 1000;
      if (timeDiff < minDuration) {
        alert('예약 시간은 최소 30분 이상이어야 합니다.');
        return;
      }
    }

    try {
      if (editEventId) {
        // 수정 - 기존 예약 정보 조회
        const existingReservation = await db.collection('reservations').doc(editEventId).get();
        const existingData = existingReservation.data();
        
        if (existingData.isRepeat && isRepeat) {
          // 반복 예약 수정: 기존 반복 그룹 삭제 후 새로 생성
          const repeatEndDate = document.getElementById('repeatEndDate').value;
          if (!repeatEndDate) {
            alert('반복 종료일을 입력해주세요.');
            return;
          }
          
          const repeatEndDateTime = new Date(repeatEndDate);
          const startDate = new Date(startUTC);
          if (repeatEndDateTime < startDate) {
            alert('반복 종료일은 예약 시작일보다 늦어야 합니다.');
            return;
          }
          
          // 기존 반복 그룹 삭제
          if (existingData.repeatGroup) {
            const snapshot = await db.collection('reservations')
              .where('repeatGroup', '==', existingData.repeatGroup)
              .get();
            
            const batch = db.batch();
            snapshot.forEach(doc => {
              batch.delete(doc.ref);
            });
            await batch.commit();
          }
          
          // 새로운 반복 예약 생성
          const success = await createRepeatReservations(startUTC, endUTC, repeatEndDate, name, department, destination, purpose, allDayCheckbox.checked, repeatTypeValue);
          if (!success) return;
          
          // 수정 성공 메시지
          const modifiedStartDate = new Date(startUTC);
          const modifiedEndDate = new Date(endUTC);
          const repeatTypeText = {
            'daily': '매일',
            'weekly': '매주',
            'yearly': '매년'
          }[repeatTypeValue] || repeatTypeValue;
          
          alert(`반복 예약이 성공적으로 수정되었습니다!\n\n📅 ${modifiedStartDate.toLocaleDateString('ko-KR')} ~ ${modifiedEndDate.toLocaleDateString('ko-KR')}\n🔄 ${repeatTypeText} 반복\n👤 ${name}\n🏢 ${department}\n📍 ${destination}`);
        } else if (existingData.isRepeat && !isRepeat) {
          // 반복 예약을 단일 예약으로 변경: 기존 반복 그룹 삭제 후 단일 예약 생성
          if (existingData.repeatGroup) {
            const snapshot = await db.collection('reservations')
              .where('repeatGroup', '==', existingData.repeatGroup)
              .get();
            
            const batch = db.batch();
            snapshot.forEach(doc => {
              batch.delete(doc.ref);
            });
            await batch.commit();
          }
          
          // 새로운 단일 예약 생성
          await db.collection('reservations').add({
            start: startUTC, end: endUTC, name, department, destination, purpose, email: currentUser.email, allDay: allDayCheckbox.checked
          });
          
          // 수정 성공 메시지
          const modifiedStartDate = new Date(startUTC);
          const modifiedEndDate = new Date(endUTC);
          const dateStr = modifiedStartDate.toLocaleDateString('ko-KR');
          const timeStr = allDayCheckbox.checked ? '종일' : `${modifiedStartDate.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})} ~ ${modifiedEndDate.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}`;
          alert(`예약이 성공적으로 수정되었습니다!\n\n📅 ${dateStr}\n⏰ ${timeStr}\n👤 ${name}\n🏢 ${department}\n📍 ${destination}`);
        } else {
          // 단일 예약 수정 또는 단일 예약을 반복 예약으로 변경
          if (isRepeat) {
            // 단일 예약을 반복 예약으로 변경
            const repeatEndDate = document.getElementById('repeatEndDate').value;
            if (!repeatEndDate) {
              alert('반복 종료일을 입력해주세요.');
              return;
            }
            
            const repeatEndDateTime = new Date(repeatEndDate);
            const startDate = new Date(startUTC);
            if (repeatEndDateTime < startDate) {
              alert('반복 종료일은 예약 시작일보다 늦어야 합니다.');
              return;
            }
            
            // 기존 단일 예약 삭제
            await db.collection('reservations').doc(editEventId).delete();
            
            // 새로운 반복 예약 생성
            const success = await createRepeatReservations(startUTC, endUTC, repeatEndDate, name, department, destination, purpose, allDayCheckbox.checked, repeatTypeValue);
            if (!success) return;
            
            // 수정 성공 메시지
            const modifiedStartDate = new Date(startUTC);
            const modifiedEndDate = new Date(endUTC);
            const repeatTypeText = {
              'daily': '매일',
              'weekly': '매주',
              'yearly': '매년'
            }[repeatTypeValue] || repeatTypeValue;
            
            alert(`반복 예약이 성공적으로 생성되었습니다!\n\n📅 ${modifiedStartDate.toLocaleDateString('ko-KR')} ~ ${modifiedEndDate.toLocaleDateString('ko-KR')}\n🔄 ${repeatTypeText} 반복\n👤 ${name}\n🏢 ${department}\n📍 ${destination}`);
          } else {
            // 단일 예약 수정
            await db.collection('reservations').doc(editEventId).update({
              start: startUTC, end: endUTC, name, department, destination, purpose, email: currentUser.email, allDay: allDayCheckbox.checked
            });
            
            // 수정 성공 메시지
            const modifiedStartDate = new Date(startUTC);
            const modifiedEndDate = new Date(endUTC);
            const dateStr = modifiedStartDate.toLocaleDateString('ko-KR');
            const timeStr = allDayCheckbox.checked ? '종일' : `${modifiedStartDate.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})} ~ ${modifiedEndDate.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}`;
            alert(`예약이 성공적으로 수정되었습니다!\n\n📅 ${dateStr}\n⏰ ${timeStr}\n👤 ${name}\n🏢 ${department}\n📍 ${destination}`);
          }
        }
        
        editEventId = null;
        document.querySelector('#reservationForm button[type="submit"]').textContent = '예약하기';
        
        // 수정 성공 메시지
        const modifiedStartDate = new Date(startUTC);
        const modifiedEndDate = new Date(endUTC);
        const dateStr = modifiedStartDate.toLocaleDateString('ko-KR');
        const timeStr = allDayCheckbox.checked ? '종일' : `${modifiedStartDate.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})} ~ ${modifiedEndDate.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}`;
        alert(`예약이 성공적으로 수정되었습니다!\n\n📅 ${dateStr}\n⏰ ${timeStr}\n👤 ${name}\n🏢 ${department}\n📍 ${destination}`);
      } else {
        // 신규 예약
        if (isRepeat) {
          // 반복 종료일 검증
          const repeatEndDate = document.getElementById('repeatEndDate').value;
          if (!repeatEndDate) {
            alert('반복 종료일을 입력해주세요.');
            return;
          }
          
          const repeatEndDateTime = new Date(repeatEndDate);
          if (repeatEndDateTime < startDate) {
            alert('반복 종료일은 예약 시작일보다 늦어야 합니다.');
            return;
          }
          
          // 반복 예약 생성
          const success = await createRepeatReservations(startUTC, endUTC, repeatEndDate, name, department, destination, purpose, allDayCheckbox.checked, repeatTypeValue);
          if (!success) return;
          
          // 반복 예약 성공 메시지
          const repeatStartDate = new Date(startUTC);
          const repeatEndDateForMessage = new Date(endUTC);
          const repeatTypeText = {
            'daily': '매일',
            'weekly': '매주',
            'yearly': '매년'
          }[repeatTypeValue] || repeatTypeValue;
          
          alert(`반복 예약이 성공적으로 생성되었습니다!\n\n📅 ${repeatStartDate.toLocaleDateString('ko-KR')} ~ ${repeatEndDateForMessage.toLocaleDateString('ko-KR')}\n🔄 ${repeatTypeText} 반복\n👤 ${name}\n🏢 ${department}\n📍 ${destination}`);
        } else {
          // 단일 예약 생성
          // 중복 체크 (더 정확한 겹침 검사)
          const snapshot = await db.collection('reservations').get();
          const conflicts = [];
          
          const reservationStart = new Date(startUTC);
          const reservationEnd = new Date(endUTC);
          
          snapshot.docs.forEach(doc => {
            const r = doc.data();
            const existingStart = new Date(r.start);
            const existingEnd = new Date(r.end);
            
            // 시간 겹침 검사
            const timeOverlap = reservationStart < existingEnd && reservationEnd > existingStart;
            
            // 종일 예약과 시간 예약은 겹치지 않음
            const allDayConflict = allDayCheckbox.checked === !!r.allDay;
            
            if (timeOverlap && allDayConflict) {
              const conflictDate = new Date(r.start);
              const dateStr = conflictDate.toLocaleDateString('ko-KR');
              const timeStr = r.allDay ? '종일' : `${formatTime(existingStart)} ~ ${formatTime(existingEnd)}`;
              const conflictInfo = `${dateStr} ${timeStr} (${r.name}님)`;
              conflicts.push(conflictInfo);
            }
          });
          
          if (conflicts.length > 0) {
            const conflictMessage = `다음 일정과 겹치는 예약이 존재합니다:\n\n${conflicts.join('\n')}\n\n예약을 취소하시겠습니까?`;
            if (!confirm(conflictMessage)) {
              return;
            }
          }
          
          await db.collection('reservations').add({
            start: startUTC, end: endUTC, name, department, destination, purpose, email: currentUser.email, allDay: allDayCheckbox.checked
          });
          
          // 단일 예약 성공 메시지
          const singleStartDate = new Date(startUTC);
          const singleEndDate = new Date(endUTC);
          const dateStr = singleStartDate.toLocaleDateString('ko-KR');
          const timeStr = allDayCheckbox.checked ? '종일' : `${singleStartDate.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})} ~ ${singleEndDate.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}`;
          alert(`예약이 성공적으로 등록되었습니다!\n\n📅 ${dateStr}\n⏰ ${timeStr}\n👤 ${name}\n🏢 ${department}\n📍 ${destination}`);
        }
      }
      
      // 폼 리셋
      this.reset();
      repeatOptions.style.display = 'none';
      repeatCheckbox.checked = false;
      allDayCheckbox.checked = false;
      document.getElementById('department').value = '';
      document.getElementById('repeatEndDate').value = '';
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