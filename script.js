const today = new Date();
const storageKey = 'focus-gtd-data-v1';
const defaultData = {
  events: [
    { id: 'e1', date: isoDate(new Date(today.getFullYear(), today.getMonth(), 5)), time: '09:30', title: '月度目标复盘', type: 'important' },
    { id: 'e2', date: isoDate(new Date(today.getFullYear(), today.getMonth(), 8)), time: '14:00', title: '产品周会', type: 'work' },
    { id: 'e3', date: isoDate(new Date(today.getFullYear(), today.getMonth(), 12)), time: '11:00', title: '午餐 · 林晓', type: 'personal' },
    { id: 'e4', date: isoDate(new Date(today.getFullYear(), today.getMonth(), 16)), time: '10:00', title: '季度规划工作坊', type: 'work' },
    { id: 'e5', date: isoDate(new Date(today.getFullYear(), today.getMonth(), 21)), time: '16:30', title: '提交项目总结', type: 'important' },
    { id: 'e6', date: isoDate(new Date(today.getFullYear(), today.getMonth(), 26)), time: '18:30', title: '看展 · 当代艺术馆', type: 'personal' }
  ],
  tasks: [
    { id: 't1', title: '完成 Q3 产品路线图', note: '整合销售与用户反馈', due: isoDate(new Date(today.getFullYear(), today.getMonth(), 14)), quadrant: 'in-progress', done: false },
    { id: 't2', title: '整理客户访谈记录', note: '归档到研究资料库', due: isoDate(new Date(today.getFullYear(), today.getMonth(), 16)), quadrant: 'in-progress', done: false },
    { id: 't3', title: '更新品牌视觉规范', note: '等待设计团队第一版', due: isoDate(new Date(today.getFullYear(), today.getMonth(), 18)), quadrant: 'assigned', done: false },
    { id: 't4', title: '准备年度预算初稿', note: '已分配给财务团队', due: isoDate(new Date(today.getFullYear(), today.getMonth(), 22)), quadrant: 'assigned', done: false },
    { id: 't5', title: '供应商合同盖章', note: '等待法务确认条款', due: isoDate(new Date(today.getFullYear(), today.getMonth(), 12)), quadrant: 'waiting', done: false },
    { id: 't6', title: '回复合作方报价', note: '周五前给出反馈', due: isoDate(new Date(today.getFullYear(), today.getMonth(), 13)), quadrant: 'waiting', done: false },
    { id: 't7', title: '规划团队团建活动', note: '明确预算和参与人数', due: isoDate(new Date(today.getFullYear(), today.getMonth(), 28)), quadrant: 'unassigned', done: false },
    { id: 't8', title: '阅读《高效能人士》', note: '每晚 20 分钟', due: '', quadrant: 'unassigned', done: false }
  ],
  parkTasks: []
};
let data = loadData();
let currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let modalMode = 'event';
let editingId = null;
let deleteTarget = null;
let dragPayload = null;
let activeTaskBoard = 'board';
let modalTaskBoard = 'board';

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function normalizeTaskCollection(tasks) {
  if (!Array.isArray(tasks)) return [];
  return tasks.map((task, index) => ({ ...task, sortOrder: Number.isFinite(task.sortOrder) ? task.sortOrder : index * 1000 }));
}
function normalizeData(value) {
  const source = value && typeof value === 'object' ? value : defaultData;
  return {
    events: Array.isArray(source.events) ? source.events : structuredClone(defaultData.events),
    tasks: normalizeTaskCollection(source.tasks || defaultData.tasks),
    parkTasks: normalizeTaskCollection(source.parkTasks)
  };
}
function loadData() { try { return normalizeData(JSON.parse(localStorage.getItem(storageKey))); } catch { return normalizeData(defaultData); } }
function saveData() {
  localStorage.setItem(storageKey, JSON.stringify(data));
  window.cloudStore?.schedulePush(data);
}
function formatMonth(date) { return `${date.getFullYear()}年${date.getMonth() + 1}月`; }
function formatToday(date) { return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`; }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function initIcons() { if (window.lucide) lucide.createIcons(); }

function renderCalendar() {
  document.getElementById('monthLabel').textContent = formatMonth(currentMonth);
  const grid = document.getElementById('calendarGrid');
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const mondayIndex = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const prevDays = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0).getDate();
  const totalCells = Math.ceil((mondayIndex + daysInMonth) / 7) * 7;
  const todayIso = isoDate(today);
  const cells = [];
  for (let index = 0; index < totalCells; index += 1) {
    const dayOffset = index - mondayIndex + 1;
    let dateObj; let inMonth = true;
    if (dayOffset < 1) { dateObj = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, prevDays + dayOffset); inMonth = false; }
    else if (dayOffset > daysInMonth) { dateObj = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, dayOffset - daysInMonth); inMonth = false; }
    else dateObj = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayOffset);
    const date = isoDate(dateObj);
    const events = data.events.filter(event => event.date === date).sort((a, b) => a.time.localeCompare(b.time));
    const classes = ['day-cell']; if (!inMonth) classes.push('other-month'); if (date === todayIso) classes.push('today');
    const eventHtml = events.length ? `<div class="event-list">${events.map(event => `<div class="event-card ${event.type === 'personal' ? 'personal' : event.type === 'important' ? 'important' : ''}" draggable="true" data-event-id="${event.id}" title="拖动调整日期"><div class="event-main"><div class="event-time">${escapeHtml(event.time || '全天')}</div><div class="event-title">${escapeHtml(event.title)}</div></div><div class="card-actions"><button class="mini-action edit-event" type="button" title="编辑行程"><i data-lucide="pencil"></i></button><button class="mini-action delete delete-event" type="button" title="删除行程"><i data-lucide="trash-2"></i></button></div></div>`).join('')}</div>` : (inMonth ? '<div class="empty-day">点击新增行程</div>' : '');
    cells.push(`<div class="${classes.join(' ')}" data-date="${date}"><div class="day-number"><span>${dateObj.getDate()}</span>${date === todayIso ? '<span class="today-badge">今天</span>' : ''}</div>${eventHtml}</div>`);
  }
  grid.innerHTML = cells.join('');
  grid.querySelectorAll('.event-card').forEach(card => card.addEventListener('dragstart', onEventDragStart));
  grid.querySelectorAll('.edit-event').forEach(button => button.addEventListener('click', editEvent));
  grid.querySelectorAll('.delete-event').forEach(button => button.addEventListener('click', requestEventDelete));
  grid.querySelectorAll('.day-cell').forEach(cell => { cell.addEventListener('dragover', onCalendarDragOver); cell.addEventListener('dragleave', onCalendarDragLeave); cell.addEventListener('drop', onCalendarDrop); cell.addEventListener('dblclick', () => openModal('event', cell.dataset.date)); });
  document.getElementById('calendarCount').textContent = data.events.length;
  initIcons();
}

function onEventDragStart(event) { dragPayload = { kind: 'event', id: event.currentTarget.dataset.eventId }; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', dragPayload.id); }
function onCalendarDragOver(event) { if (!dragPayload || dragPayload.kind !== 'event') return; event.preventDefault(); event.currentTarget.classList.add('drop-target'); }
function onCalendarDragLeave(event) { event.currentTarget.classList.remove('drop-target'); }
function onCalendarDrop(event) { event.preventDefault(); const cell = event.currentTarget; cell.classList.remove('drop-target'); if (!dragPayload || dragPayload.kind !== 'event') return; const item = data.events.find(entry => entry.id === dragPayload.id); if (item && item.date !== cell.dataset.date) { item.date = cell.dataset.date; saveData(); renderCalendar(); toast('行程日期已调整'); } dragPayload = null; }

const quadrants = [
  { id: 'in-progress', title: '进行中任务', subtitle: '现在就行动', cls: 'quad-in-progress' },
  { id: 'waiting', title: '等待中任务', subtitle: '等待外部反馈', cls: 'quad-waiting' },
  { id: 'assigned', title: '分配中任务', subtitle: '交给合适的人', cls: 'quad-assigned' },
  { id: 'unassigned', title: '待分配任务', subtitle: '下一步要做什么？', cls: 'quad-unassigned' }
];
const taskBoards = {
  board: { key: 'tasks', title: '任务安排', eyebrow: 'TASKS / WEEKLY REVIEW', caption: '清晰分辨下一步，让每件事都有归处。', taskLabel: '任务' },
  park: { key: 'parkTasks', title: '园区任务', eyebrow: 'PARK / PROJECT WORK', caption: '为园区项目安排下一步，并保持不同项目的任务独立。', taskLabel: '园区任务' }
};
function getTaskCollection(board = activeTaskBoard) { return data[taskBoards[board].key]; }
function sortTasks(tasks) { return [...tasks].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)); }
function nextSortOrder(tasks, quadrant) { const values = tasks.filter(task => task.quadrant === quadrant).map(task => task.sortOrder); return values.length ? Math.max(...values) + 1000 : 1000; }
function updateBoardUi() {
  const meta = taskBoards[activeTaskBoard];
  document.getElementById('boardEyebrow').textContent = meta.eyebrow;
  document.getElementById('boardHeading').textContent = meta.title;
  document.getElementById('boardCaption').textContent = meta.caption;
  document.getElementById('addTaskButton').innerHTML = `<i data-lucide="plus"></i>新增${meta.taskLabel}`;
}
function renderBoard() {
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const taskCollection = getTaskCollection();
  const root = document.getElementById('quadrants');
  root.innerHTML = quadrants.map(quad => {
    const tasks = sortTasks(taskCollection.filter(task => task.quadrant === quad.id && (!search || `${task.title} ${task.note}`.toLowerCase().includes(search))));
    return `<section class="quadrant ${quad.cls}" data-quadrant="${quad.id}"><div class="quadrant-header"><div><div class="quad-title-wrap"><i class="quad-accent"></i><span class="quad-title">${quad.title}</span><span class="quad-count">${tasks.length} 项</span></div><div class="quad-subtitle">${quad.subtitle}</div></div><button class="icon-button subtle quad-add" type="button" title="在此象限新增任务" data-quad="${quad.id}"><i data-lucide="plus"></i></button></div><div class="task-list" data-quadrant="${quad.id}">${tasks.length ? tasks.map(renderTask).join('') : '<div class="task-empty">拖动任务到这里</div>'}</div></section>`;
  }).join('');
  root.querySelectorAll('.task-card').forEach(card => { card.addEventListener('dragstart', onTaskDragStart); card.addEventListener('dragend', onTaskDragEnd); });
  root.querySelectorAll('.task-list').forEach(list => { list.addEventListener('dragover', onTaskDragOver); list.addEventListener('dragleave', onTaskDragLeave); list.addEventListener('drop', onTaskDrop); });
  root.querySelectorAll('.task-check').forEach(button => button.addEventListener('click', toggleTask));
  root.querySelectorAll('.edit-task').forEach(button => button.addEventListener('click', editTask));
  root.querySelectorAll('.delete-task').forEach(button => button.addEventListener('click', requestTaskDelete));
  root.querySelectorAll('.quad-add').forEach(button => button.addEventListener('click', () => openModal('task', '', button.dataset.quad)));
  updateStats(); initIcons();
}
function renderTask(task) { const due = task.due ? task.due.slice(5).replace('-', '/') : '无截止'; const overdue = task.due && task.due < isoDate(today) && !task.done; return `<article class="task-card ${task.done ? 'done' : ''}" draggable="true" data-task-id="${task.id}"><button class="task-check" type="button" title="标记完成"><i data-lucide="check"></i></button><div><div class="task-name">${escapeHtml(task.title)}</div>${task.note ? `<div class="task-note">${escapeHtml(task.note)}</div>` : ''}</div><div class="task-side"><span class="task-due ${overdue ? 'overdue' : ''}">${due}</span><div class="card-actions"><button class="mini-action edit-task" type="button" title="编辑任务"><i data-lucide="pencil"></i></button><button class="mini-action delete delete-task" type="button" title="删除任务"><i data-lucide="trash-2"></i></button></div></div></article>`; }
function onTaskDragStart(event) { dragPayload = { kind: 'task', id: event.currentTarget.dataset.taskId, board: activeTaskBoard }; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', dragPayload.id); event.currentTarget.classList.add('dragging'); }
function clearTaskDropIndicators() { document.querySelectorAll('.task-list.drop-target').forEach(list => list.classList.remove('drop-target')); document.querySelectorAll('.task-card.drop-before, .task-card.drop-after').forEach(card => card.classList.remove('drop-before', 'drop-after')); }
function onTaskDragEnd(event) { event.currentTarget.classList.remove('dragging'); clearTaskDropIndicators(); dragPayload = null; }
function onTaskDragOver(event) {
  if (!dragPayload || dragPayload.kind !== 'task' || dragPayload.board !== activeTaskBoard) return;
  event.preventDefault();
  const list = event.currentTarget;
  clearTaskDropIndicators();
  list.classList.add('drop-target');
  const card = event.target.closest('.task-card');
  if (card && card.parentElement === list && card.dataset.taskId !== dragPayload.id) {
    const rect = card.getBoundingClientRect();
    card.classList.add(event.clientY > rect.top + rect.height / 2 ? 'drop-after' : 'drop-before');
  }
}
function onTaskDragLeave(event) { if (!event.currentTarget.contains(event.relatedTarget)) clearTaskDropIndicators(); }
function onTaskDrop(event) {
  event.preventDefault();
  const list = event.currentTarget;
  if (!dragPayload || dragPayload.kind !== 'task' || dragPayload.board !== activeTaskBoard) return;
  const tasks = getTaskCollection();
  const task = tasks.find(entry => entry.id === dragPayload.id);
  const targetCard = event.target.closest('.task-card');
  const destination = list.dataset.quadrant;
  if (!task) return;
  const movedAcrossQuadrant = task.quadrant !== destination;
  const orderedDestination = sortTasks(tasks.filter(entry => entry.quadrant === destination && entry.id !== task.id));
  let insertionIndex = orderedDestination.length;
  if (targetCard && targetCard.parentElement === list) {
    const targetIndex = orderedDestination.findIndex(entry => entry.id === targetCard.dataset.taskId);
    if (targetIndex >= 0) {
      const rect = targetCard.getBoundingClientRect();
      insertionIndex = targetIndex + (event.clientY > rect.top + rect.height / 2 ? 1 : 0);
    }
  }
  task.quadrant = destination;
  orderedDestination.splice(insertionIndex, 0, task);
  orderedDestination.forEach((entry, index) => { entry.sortOrder = (index + 1) * 1000; });
  saveData();
  clearTaskDropIndicators();
  renderBoard();
  toast(movedAcrossQuadrant ? '任务象限已更新' : '任务顺序已更新');
  dragPayload = null;
}
function toggleTask(event) { const id = event.currentTarget.closest('.task-card').dataset.taskId; const task = getTaskCollection().find(entry => entry.id === id); if (task) { task.done = !task.done; saveData(); renderBoard(); toast(task.done ? '已完成，做得好' : '已恢复为进行中'); } }
function updateStats() {
  const tasks = getTaskCollection();
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  document.getElementById('totalTaskCount').textContent = total;
  document.getElementById('activeTaskCount').textContent = tasks.filter(t => t.quadrant === 'in-progress' && !t.done).length;
  document.getElementById('waitingTaskCount').textContent = tasks.filter(t => t.quadrant === 'waiting').length;
  document.getElementById('doneCount').textContent = done;
  document.getElementById('boardCount').textContent = data.tasks.filter(t => !t.done).length;
  document.getElementById('parkCount').textContent = data.parkTasks.filter(t => !t.done).length;
}

function openModal(mode, date = '', quadrant = 'unassigned', itemId = null) {
  modalMode = mode;
  editingId = itemId;
  modalTaskBoard = activeTaskBoard;
  const item = itemId ? (mode === 'event' ? data.events : getTaskCollection(modalTaskBoard)).find(entry => entry.id === itemId) : null;
  const isEditing = Boolean(item);
  document.getElementById('modalBackdrop').classList.remove('hidden');
  document.getElementById('modalTitle').textContent = `${isEditing ? '编辑' : '新增'}${mode === 'event' ? '行程' : taskBoards[modalTaskBoard].taskLabel}`;
  document.getElementById('captureSubmitLabel').textContent = isEditing ? '保存修改' : '保存';
  document.getElementById('captureDate').value = item ? (mode === 'event' ? item.date : item.due) : (date || isoDate(today));
  document.getElementById('captureTitle').value = item?.title || '';
  document.getElementById('captureNote').value = item?.note || '';
  document.getElementById('captureTypeLabel').classList.toggle('hidden', mode !== 'event');
  document.getElementById('captureQuadrantLabel').classList.toggle('hidden', mode !== 'task');
  document.getElementById('captureTimeLabel').classList.toggle('hidden', mode !== 'event');
  document.getElementById('captureType').value = item?.type || 'work';
  document.getElementById('captureQuadrant').value = item?.quadrant || quadrant;
  document.getElementById('captureTime').value = item?.time || '09:00';
  setTimeout(() => document.getElementById('captureTitle').focus(), 60);
}
function closeModal() { document.getElementById('modalBackdrop').classList.add('hidden'); editingId = null; }
function handleCapture(event) {
  event.preventDefault();
  const title = document.getElementById('captureTitle').value.trim();
  if (!title) return;
  if (modalMode === 'event') {
    const values = { date: document.getElementById('captureDate').value, time: document.getElementById('captureTime').value || '全天', title, note: document.getElementById('captureNote').value.trim(), type: document.getElementById('captureType').value };
    const item = editingId ? data.events.find(entry => entry.id === editingId) : null;
    if (item) Object.assign(item, values); else data.events.push({ id: `e-${Date.now()}`, ...values });
    saveData(); closeModal(); renderCalendar(); toast(item ? '行程已更新' : '行程已添加');
  } else {
    const values = { title, note: document.getElementById('captureNote').value.trim(), due: document.getElementById('captureDate').value, quadrant: document.getElementById('captureQuadrant').value };
    const tasks = getTaskCollection(modalTaskBoard);
    const item = editingId ? tasks.find(entry => entry.id === editingId) : null;
    if (item) {
      if (item.quadrant !== values.quadrant) item.sortOrder = nextSortOrder(tasks, values.quadrant);
      Object.assign(item, values);
    } else tasks.push({ id: `${modalTaskBoard === 'park' ? 'p' : 't'}-${Date.now()}`, ...values, done: false, sortOrder: nextSortOrder(tasks, values.quadrant) });
    saveData(); closeModal(); renderBoard(); toast(item ? '任务已更新' : '任务已添加');
  }
}
function editEvent(event) { event.stopPropagation(); const id = event.currentTarget.closest('.event-card').dataset.eventId; openModal('event', '', 'unassigned', id); }
function editTask(event) { event.stopPropagation(); const id = event.currentTarget.closest('.task-card').dataset.taskId; openModal('task', '', 'unassigned', id); }
function requestEventDelete(event) { event.stopPropagation(); const id = event.currentTarget.closest('.event-card').dataset.eventId; openDeleteConfirm('event', id); }
function requestTaskDelete(event) { event.stopPropagation(); const id = event.currentTarget.closest('.task-card').dataset.taskId; openDeleteConfirm('task', id, activeTaskBoard); }
function openDeleteConfirm(kind, id, board = activeTaskBoard) {
  deleteTarget = { kind, id, board };
  const item = (kind === 'event' ? data.events : getTaskCollection(board)).find(entry => entry.id === id);
  document.getElementById('confirmMessage').textContent = `“${item?.title || '该项目'}”删除后将无法恢复。`;
  document.getElementById('confirmBackdrop').classList.remove('hidden');
}
function closeDeleteConfirm() { document.getElementById('confirmBackdrop').classList.add('hidden'); deleteTarget = null; }
function confirmDeletion() {
  if (!deleteTarget) return;
  const { kind, id, board } = deleteTarget;
  if (kind === 'event') data.events = data.events.filter(entry => entry.id !== id); else data[taskBoards[board].key] = getTaskCollection(board).filter(entry => entry.id !== id);
  saveData(); closeDeleteConfirm();
  if (kind === 'event') renderCalendar(); else renderBoard();
  toast(kind === 'event' ? '行程已删除' : '任务已删除');
}
function toast(message) { const node = document.getElementById('toast'); node.textContent = message; node.classList.add('show'); clearTimeout(window.__toastTimer); window.__toastTimer = setTimeout(() => node.classList.remove('show'), 2200); }
function switchView(view) {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view));
  document.getElementById('calendarView').classList.toggle('hidden', view !== 'calendar');
  document.getElementById('boardView').classList.toggle('hidden', view === 'calendar');
  if (view === 'calendar') {
    document.getElementById('pageTitle').textContent = '行程安排';
    return;
  }
  activeTaskBoard = view;
  document.getElementById('pageTitle').textContent = taskBoards[view].title;
  updateBoardUi();
  renderBoard();
}

document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => switchView(item.dataset.view)));
document.getElementById('prevMonth').addEventListener('click', () => { currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1); renderCalendar(); });
document.getElementById('nextMonth').addEventListener('click', () => { currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1); renderCalendar(); });
document.getElementById('todayButton').addEventListener('click', () => { currentMonth = new Date(today.getFullYear(), today.getMonth(), 1); switchView('calendar'); renderCalendar(); });
document.getElementById('addScheduleButton').addEventListener('click', () => openModal('event'));
document.getElementById('addTaskButton').addEventListener('click', () => openModal('task'));
document.getElementById('closeModal').addEventListener('click', closeModal); document.getElementById('cancelModal').addEventListener('click', closeModal);
document.getElementById('modalBackdrop').addEventListener('click', event => { if (event.target.id === 'modalBackdrop') closeModal(); });
document.getElementById('cancelDelete').addEventListener('click', closeDeleteConfirm);
document.getElementById('confirmDelete').addEventListener('click', confirmDeletion);
document.getElementById('confirmBackdrop').addEventListener('click', event => { if (event.target.id === 'confirmBackdrop') closeDeleteConfirm(); });
document.getElementById('captureForm').addEventListener('submit', handleCapture);
document.getElementById('searchInput').addEventListener('input', renderBoard);
document.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.getElementById('searchInput').focus(); } if (event.key === 'Escape') { closeModal(); closeDeleteConfirm(); } });
document.getElementById('todayLabel').textContent = formatToday(today);
renderCalendar(); updateBoardUi(); renderBoard(); initIcons();
window.cloudStore?.init({
  getData: () => data,
  applyData: cloudData => {
    data = normalizeData(cloudData);
    localStorage.setItem(storageKey, JSON.stringify(data));
    renderCalendar();
    renderBoard();
  }
});
