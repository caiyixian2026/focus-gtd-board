const today = new Date();
const storageKey = 'focus-gtd-data-v1';
const sidebarStorageKey = 'focus-gtd-sidebar-collapsed';
const taskStatusLabels = { 'in-progress': '进行中', waiting: '等待中', completed: '已完成' };
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
  parkTasks: [],
  projectBoards: [
    { id: 'board', name: '任务安排', columns: BoardModel.createDefaultColumns() },
    { id: 'park', name: '园区任务', columns: BoardModel.createDefaultColumns() }
  ],
  projectTasks: {},
  chatPractice: { completedDates: [], angles: {}, streak: 0 }
};
let data = loadData();
let currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let modalMode = 'event';
let editingId = null;
let deleteTarget = null;
let dragPayload = null;
let activeTaskBoard = 'board';
let modalTaskBoard = 'board';
let editingProjectId = null;
let editingColumns = null;
let editingColumnTasks = null;
let deletingColumnId = null;
let selectedChatTopic = null;
let hotNewsItems = [];
let selectedHotNewsIndex = 0;
let focusedColumnId = null;

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function normalizeTaskCollection(tasks) {
  if (!Array.isArray(tasks)) return [];
  return tasks.map((task, index) => {
    const recurrence = task.recurrence === 'monthly' ? 'monthly' : 'none';
    const status = taskStatusLabels[task.status] ? task.status : null;
    const done = Boolean(task.done) || status === 'completed';
    const dueDay = Number(String(task.due || '').slice(-2));
    return {
      ...task,
      done,
      status: done ? 'completed' : status,
      recurrence,
      recurrenceDay: recurrence === 'monthly' && Number.isInteger(task.recurrenceDay) ? task.recurrenceDay : (recurrence === 'monthly' && dueDay >= 1 && dueDay <= 31 ? dueDay : null),
      sortOrder: Number.isFinite(task.sortOrder) ? task.sortOrder : index * 1000
    };
  });
}
function normalizeData(value) {
  const source = value && typeof value === 'object' ? value : defaultData;
  const rawBoards = Array.isArray(source.projectBoards) && source.projectBoards.length ? source.projectBoards : structuredClone(defaultData.projectBoards);
  let tasks = normalizeTaskCollection(source.tasks || defaultData.tasks);
  let parkTasks = normalizeTaskCollection(source.parkTasks);
  const projectTasks = source.projectTasks && typeof source.projectTasks === 'object' ? Object.fromEntries(Object.entries(source.projectTasks).map(([id, taskItems]) => [id, normalizeTaskCollection(taskItems)])) : {};
  const projectBoards = rawBoards.map(rawBoard => {
    const id = String(rawBoard.id);
    const collection = id === 'board' ? tasks : id === 'park' ? parkTasks : (projectTasks[id] || []);
    const normalized = BoardModel.normalizeColumns(rawBoard.columns, collection);
    if (id === 'board') tasks = normalized.tasks;
    else if (id === 'park') parkTasks = normalized.tasks;
    else projectTasks[id] = normalized.tasks;
    return {
      id,
      name: String(rawBoard.name || '未命名项目').trim() || '未命名项目',
      columns: normalized.columns
    };
  });
  const chatPractice = source.chatPractice && typeof source.chatPractice === 'object' ? source.chatPractice : structuredClone(defaultData.chatPractice);
  return {
    events: Array.isArray(source.events) ? source.events : structuredClone(defaultData.events),
    tasks,
    parkTasks,
    projectBoards,
    projectTasks,
    chatPractice: {
      completedDates: Array.isArray(chatPractice.completedDates) ? chatPractice.completedDates : [],
      angles: chatPractice.angles && typeof chatPractice.angles === 'object' ? chatPractice.angles : {},
      streak: Number.isFinite(chatPractice.streak) ? chatPractice.streak : 0
    }
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

function getProjectBoard(boardId = activeTaskBoard) { return data.projectBoards.find(board => board.id === boardId) || data.projectBoards[0]; }
function getBoardColumns(boardId = activeTaskBoard) { return getProjectBoard(boardId)?.columns || []; }
function getTaskCollection(boardId = activeTaskBoard) {
  if (boardId === 'board') return data.tasks;
  if (boardId === 'park') return data.parkTasks;
  if (!Array.isArray(data.projectTasks[boardId])) data.projectTasks[boardId] = [];
  return data.projectTasks[boardId];
}
function setTaskCollection(boardId, tasks) {
  if (boardId === 'board') data.tasks = tasks;
  else if (boardId === 'park') data.parkTasks = tasks;
  else data.projectTasks[boardId] = tasks;
}
function renderProjectNav() {
  const root = document.getElementById('projectNav');
  if (!root) return;
  const boardViewActive = document.getElementById('calendarView')?.classList.contains('hidden');
  root.innerHTML = data.projectBoards.map(board => {
    const count = getTaskCollection(board.id).filter(task => !task.done).length;
    const icon = board.id === 'park' ? 'building-2' : board.id === 'board' ? 'layout-dashboard' : 'folder-kanban';
    return `<div class="project-nav-item"><button class="nav-item ${boardViewActive && activeTaskBoard === board.id ? 'active' : ''}" data-view="project" data-project-id="${escapeHtml(board.id)}" type="button"><i data-lucide="${icon}"></i><span>${escapeHtml(board.name)}</span><span class="nav-count">${count}</span></button><button class="nav-rename" data-project-id="${escapeHtml(board.id)}" type="button" title="重命名项目"><i data-lucide="pencil"></i></button></div>`;
  }).join('');
  root.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => switchView('project', button.dataset.projectId)));
  root.querySelectorAll('.nav-rename').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); openProjectModal(button.dataset.projectId); }));
  initIcons();
}
function sortTasks(tasks) { return [...tasks].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)); }
function nextSortOrder(tasks, quadrant) { const values = tasks.filter(task => task.quadrant === quadrant).map(task => task.sortOrder); return values.length ? Math.max(...values) + 1000 : 1000; }
function getTaskStatus(task) {
  if (task.done) return 'completed';
  if (task.status === 'in-progress' || task.status === 'waiting') return task.status;
  const columnTitle = getBoardColumns().find(column => column.id === task.quadrant)?.title || '';
  return /等待|待反馈|待回复/.test(columnTitle) ? 'waiting' : 'in-progress';
}
function updateBoardUi() {
  const board = getProjectBoard();
  document.getElementById('boardEyebrow').textContent = board.id === 'board' ? 'TASKS / PROJECT BOARD' : board.id === 'park' ? 'PARK / PROJECT WORK' : 'PROJECT / TASK BOARD';
  document.getElementById('boardHeading').textContent = board.name;
  document.getElementById('boardCaption').textContent = board.id === 'board' ? '清晰分辨下一步，让每件事都有归处。' : `为${board.name}安排下一步，并保持项目任务独立。`;
  document.getElementById('addTaskButton').innerHTML = '<i data-lucide="plus"></i>新增任务';
}
function renderBoard() {
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const taskCollection = getTaskCollection();
  const columns = getBoardColumns();
  const root = document.getElementById('quadrants');
  root.innerHTML = columns.map(column => {
    const tasks = sortTasks(taskCollection.filter(task => task.quadrant === column.id && (!search || `${task.title} ${task.note || ''}`.toLowerCase().includes(search))));
    return `<section class="quadrant" data-quadrant="${escapeHtml(column.id)}" style="--column-color:${escapeHtml(column.color)}"><div class="quadrant-header"><button class="column-drag-handle" draggable="true" data-column-id="${escapeHtml(column.id)}" type="button" title="拖动调整栏目顺序"><i data-lucide="grip-vertical"></i></button><div class="column-heading"><div class="quad-title-wrap"><i class="quad-accent"></i><span class="quad-title">${escapeHtml(column.title)}</span><span class="quad-count">${tasks.length} 项</span></div><div class="quad-subtitle">${escapeHtml(column.subtitle)}</div></div><button class="icon-button subtle quad-add" type="button" title="在此栏目新增任务" data-quad="${escapeHtml(column.id)}"><i data-lucide="plus"></i></button></div><div class="task-list" data-quadrant="${escapeHtml(column.id)}">${tasks.length ? tasks.map(renderTask).join('') : '<div class="task-empty">拖动任务到这里</div>'}</div></section>`;
  }).join('') + `<button class="add-column-card" type="button" ${columns.length >= BoardModel.MAX_COLUMNS ? 'disabled' : ''}><i data-lucide="plus"></i><span>${columns.length >= BoardModel.MAX_COLUMNS ? '已达到 12 个栏目' : '新增栏目'}</span></button>`;
  root.querySelectorAll('.task-card').forEach(card => { card.addEventListener('dragstart', onTaskDragStart); card.addEventListener('dragend', onTaskDragEnd); });
  root.querySelectorAll('.task-list').forEach(list => { list.addEventListener('dragover', onTaskDragOver); list.addEventListener('dragleave', onTaskDragLeave); list.addEventListener('drop', onTaskDrop); });
  root.querySelectorAll('.task-check').forEach(button => button.addEventListener('click', toggleTask));
  root.querySelectorAll('.edit-task').forEach(button => button.addEventListener('click', editTask));
  root.querySelectorAll('.delete-task').forEach(button => button.addEventListener('click', requestTaskDelete));
  root.querySelectorAll('.quad-add').forEach(button => button.addEventListener('click', () => openModal('task', '', button.dataset.quad)));
  root.querySelectorAll('.column-drag-handle').forEach(handle => { handle.addEventListener('dragstart', onColumnDragStart); handle.addEventListener('dragend', onColumnDragEnd); });
  root.querySelectorAll('.quadrant').forEach(column => { column.addEventListener('dragover', onColumnDragOver); column.addEventListener('dragleave', onColumnDragLeave); column.addEventListener('drop', onColumnDrop); });
  root.querySelector('.add-column-card')?.addEventListener('click', openColumnsModal);
  updateStats(); renderProjectNav(); initIcons();
}
function renderTask(task) { const due = task.due ? task.due.slice(5).replace('-', '/') : '无截止'; const overdue = task.due && task.due < isoDate(today) && !task.done; const status = getTaskStatus(task); return `<article class="task-card ${task.done ? 'done' : ''}" draggable="true" data-task-id="${task.id}"><button class="task-check" type="button" title="标记完成"><i data-lucide="check"></i></button><div><div class="task-name">${escapeHtml(task.title)}</div>${task.note ? `<div class="task-note">${escapeHtml(task.note)}</div>` : ''}<div class="task-labels"><span class="task-status status-${status}">${taskStatusLabels[status]}</span>${task.recurrence === 'monthly' ? '<span class="task-recurrence"><i data-lucide="repeat-2"></i>每月重复</span>' : ''}</div></div><div class="task-side"><span class="task-due ${overdue ? 'overdue' : ''}">${due}</span><div class="card-actions"><button class="mini-action edit-task" type="button" title="编辑任务"><i data-lucide="pencil"></i></button><button class="mini-action delete delete-task" type="button" title="删除任务"><i data-lucide="trash-2"></i></button></div></div></article>`; }
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
  task.updatedAt = new Date().toISOString();
  orderedDestination.splice(insertionIndex, 0, task);
  orderedDestination.forEach((entry, index) => { entry.sortOrder = (index + 1) * 1000; });
  saveData();
  clearTaskDropIndicators();
  renderBoard();
  toast(movedAcrossQuadrant ? '任务栏目已更新' : '任务顺序已更新');
  dragPayload = null;
}
function clearColumnDropIndicators() { document.querySelectorAll('.quadrant.column-drop-before, .quadrant.column-drop-after').forEach(column => column.classList.remove('column-drop-before', 'column-drop-after')); }
function onColumnDragStart(event) {
  dragPayload = { kind: 'column', id: event.currentTarget.dataset.columnId, board: activeTaskBoard };
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', dragPayload.id);
  event.currentTarget.closest('.quadrant')?.classList.add('column-dragging');
}
function onColumnDragEnd(event) { event.currentTarget.closest('.quadrant')?.classList.remove('column-dragging'); clearColumnDropIndicators(); dragPayload = null; }
function onColumnDragOver(event) {
  if (!dragPayload || dragPayload.kind !== 'column' || dragPayload.board !== activeTaskBoard || dragPayload.id === event.currentTarget.dataset.quadrant) return;
  event.preventDefault();
  clearColumnDropIndicators();
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.classList.add(event.clientX > rect.left + rect.width / 2 ? 'column-drop-after' : 'column-drop-before');
}
function onColumnDragLeave(event) { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.classList.remove('column-drop-before', 'column-drop-after'); }
function onColumnDrop(event) {
  if (!dragPayload || dragPayload.kind !== 'column' || dragPayload.board !== activeTaskBoard) return;
  event.preventDefault();
  const targetId = event.currentTarget.dataset.quadrant;
  if (targetId === dragPayload.id) return;
  const rect = event.currentTarget.getBoundingClientRect();
  getProjectBoard().columns = BoardModel.moveColumn(getBoardColumns(), dragPayload.id, targetId, event.clientX > rect.left + rect.width / 2 ? 'after' : 'before');
  saveData(); clearColumnDropIndicators(); dragPayload = null; renderBoard(); toast('栏目顺序已更新');
}
function toggleTask(event) {
  const id = event.currentTarget.closest('.task-card').dataset.taskId;
  const task = getTaskCollection().find(entry => entry.id === id);
  if (!task) return;
  const previousStatus = getTaskStatus(task);
  task.done = !task.done;
  task.updatedAt = new Date().toISOString();
  task.completedAt = task.done ? task.updatedAt : null;
  if (task.done) {
    task.statusBeforeCompletion = previousStatus === 'completed' ? 'in-progress' : previousStatus;
    task.status = 'completed';
  } else {
    task.status = task.statusBeforeCompletion === 'waiting' ? 'waiting' : 'in-progress';
    task.statusBeforeCompletion = null;
  }
  let nextTaskCreated = false;
  if (task.done && task.recurrence === 'monthly' && task.due) {
    const nextDue = nextMonthlyDueDate(task);
    const tasks = getTaskCollection();
    const alreadyCreated = tasks.some(entry => entry.recurrenceParentId === task.id && entry.due === nextDue);
    if (nextDue && !alreadyCreated) {
      tasks.push({
        id: `${activeTaskBoard === 'board' ? 't' : 'p'}-${Date.now()}`,
        title: task.title,
        note: task.note || '',
        due: nextDue,
        quadrant: task.quadrant,
        recurrence: 'monthly',
        recurrenceDay: task.recurrenceDay,
        recurrenceParentId: task.id,
        done: false,
        createdAt: task.updatedAt,
        updatedAt: task.updatedAt,
        sortOrder: nextSortOrder(tasks, task.quadrant)
      });
      nextTaskCreated = true;
    }
  }
  saveData();
  renderBoard();
  toast(task.done ? (nextTaskCreated ? '已完成，已生成下月任务' : '已完成，做得好') : '已恢复为进行中');
}
function nextMonthlyDueDate(task) {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(task.due || '');
  if (!matched) return '';
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const dueDay = Number(matched[3]);
  const preferredDay = Number.isInteger(task.recurrenceDay) && task.recurrenceDay >= 1 && task.recurrenceDay <= 31 ? task.recurrenceDay : dueDay;
  const nextMonthStart = new Date(year, month, 1);
  const nextYear = nextMonthStart.getFullYear();
  const nextMonthIndex = nextMonthStart.getMonth();
  const lastDay = new Date(nextYear, nextMonthIndex + 1, 0).getDate();
  return isoDate(new Date(nextYear, nextMonthIndex, Math.min(preferredDay, lastDay)));
}
function updateStats() {
  const tasks = getTaskCollection();
  const columns = getBoardColumns();
  if (!columns.some(column => column.id === focusedColumnId)) focusedColumnId = null;
  document.getElementById('boardColumnStats').innerHTML = columns.map(column => {
    const count = tasks.filter(task => task.quadrant === column.id).length;
    return `<button class="column-summary-button ${focusedColumnId === column.id ? 'active' : ''}" type="button" data-column-id="${escapeHtml(column.id)}" style="--column-color:${escapeHtml(column.color)}" title="查看${escapeHtml(column.title)}"><i class="column-summary-dot"></i><span>${escapeHtml(column.title)}</span><b>${count}</b></button>`;
  }).join('');
  document.querySelectorAll('.column-summary-button').forEach(button => button.addEventListener('click', () => focusBoardColumn(button.dataset.columnId)));
  renderProjectNav();
}
function focusBoardColumn(columnId) {
  const board = document.getElementById('quadrants');
  const column = board.querySelector(`.quadrant[data-quadrant="${CSS.escape(columnId)}"]`);
  if (!column) return;
  focusedColumnId = columnId;
  board.scrollTo({ left: Math.max(0, column.offsetLeft - 2), behavior: 'smooth' });
  updateStats();
}
function setSidebarCollapsed(collapsed) {
  const shell = document.querySelector('.app-shell');
  const toggle = document.getElementById('sidebarToggle');
  shell.classList.toggle('sidebar-collapsed', collapsed);
  toggle.setAttribute('aria-pressed', String(collapsed));
  toggle.setAttribute('title', collapsed ? '展开左侧看板' : '收起左侧看板');
  toggle.setAttribute('aria-label', collapsed ? '展开左侧看板' : '收起左侧看板');
  toggle.innerHTML = `<i data-lucide="${collapsed ? 'panel-left-open' : 'panel-left-close'}"></i>`;
  localStorage.setItem(sidebarStorageKey, String(collapsed));
  initIcons();
}

function renderTaskColumnOptions(selectedId) {
  const select = document.getElementById('captureQuadrant');
  const columns = getBoardColumns(modalTaskBoard);
  select.innerHTML = columns.map(column => `<option value="${escapeHtml(column.id)}">${escapeHtml(column.title)}</option>`).join('');
  select.value = columns.some(column => column.id === selectedId) ? selectedId : columns[0]?.id || '';
}
function openModal(mode, date = '', quadrant = '', itemId = null) {
  modalMode = mode;
  editingId = itemId;
  modalTaskBoard = activeTaskBoard;
  const item = itemId ? (mode === 'event' ? data.events : getTaskCollection(modalTaskBoard)).find(entry => entry.id === itemId) : null;
  const isEditing = Boolean(item);
  document.getElementById('modalBackdrop').classList.remove('hidden');
  document.getElementById('modalTitle').textContent = `${isEditing ? '编辑' : '新增'}${mode === 'event' ? '行程' : '任务'}`;
  document.getElementById('captureSubmitLabel').textContent = isEditing ? '保存修改' : '保存';
  document.getElementById('captureDate').value = item ? (mode === 'event' ? item.date : item.due) : (date || isoDate(today));
  document.getElementById('captureTitle').value = item?.title || '';
  document.getElementById('captureNote').value = item?.note || '';
  document.getElementById('captureTypeLabel').classList.toggle('hidden', mode !== 'event');
  document.getElementById('captureQuadrantLabel').classList.toggle('hidden', mode !== 'task');
  document.getElementById('captureTimeLabel').classList.toggle('hidden', mode !== 'event');
  document.getElementById('captureTaskStatusLabel').classList.toggle('hidden', mode !== 'task');
  document.getElementById('captureRecurrenceLabel').classList.toggle('hidden', mode !== 'task');
  document.getElementById('captureType').value = item?.type || 'work';
  if (mode === 'task') {
    renderTaskColumnOptions(item?.quadrant || quadrant);
    document.getElementById('captureMonthlyRecurrence').checked = item?.recurrence === 'monthly';
    document.getElementById('captureTaskStatus').value = item ? getTaskStatus(item) : 'in-progress';
  }
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
    const values = { title, note: document.getElementById('captureNote').value.trim(), due: document.getElementById('captureDate').value, quadrant: document.getElementById('captureQuadrant').value, recurrence: document.getElementById('captureMonthlyRecurrence').checked ? 'monthly' : 'none', status: document.getElementById('captureTaskStatus').value };
    const tasks = getTaskCollection(modalTaskBoard);
    const item = editingId ? tasks.find(entry => entry.id === editingId) : null;
    const savedAt = new Date().toISOString();
    if (item) {
      if (item.quadrant !== values.quadrant) item.sortOrder = nextSortOrder(tasks, values.quadrant);
      const recurrenceDay = values.recurrence === 'monthly' ? (item.due === values.due && Number.isInteger(item.recurrenceDay) ? item.recurrenceDay : Number(values.due.slice(-2))) : null;
      const done = values.status === 'completed';
      Object.assign(item, values, { recurrenceDay, done, completedAt: done ? (item.completedAt || savedAt) : null, updatedAt: savedAt });
    } else {
      const done = values.status === 'completed';
      tasks.push({ id: `${modalTaskBoard === 'board' ? 't' : 'p'}-${Date.now()}`, ...values, recurrenceDay: values.recurrence === 'monthly' ? Number(values.due.slice(-2)) : null, done, completedAt: done ? savedAt : null, createdAt: savedAt, updatedAt: savedAt, sortOrder: nextSortOrder(tasks, values.quadrant) });
    }
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
  if (kind === 'event') data.events = data.events.filter(entry => entry.id !== id); else setTaskCollection(board, getTaskCollection(board).filter(entry => entry.id !== id));
  saveData(); closeDeleteConfirm();
  if (kind === 'event') renderCalendar(); else renderBoard();
  toast(kind === 'event' ? '行程已删除' : '任务已删除');
}
function openProjectModal(projectId = null) {
  editingProjectId = projectId;
  const board = projectId ? getProjectBoard(projectId) : null;
  document.getElementById('projectModalTitle').textContent = board ? '重命名项目' : '新建项目任务看板';
  document.getElementById('saveProjectLabel').textContent = board ? '保存名称' : '创建看板';
  document.getElementById('projectName').value = board?.name || '';
  document.getElementById('projectBackdrop').classList.remove('hidden');
  setTimeout(() => document.getElementById('projectName').focus(), 60);
}
function closeProjectModal() { document.getElementById('projectBackdrop').classList.add('hidden'); editingProjectId = null; }
function handleProjectForm(event) {
  event.preventDefault();
  const name = document.getElementById('projectName').value.trim();
  if (!name) return;
  const board = editingProjectId ? getProjectBoard(editingProjectId) : null;
  if (board) {
    board.name = name;
    saveData();
    closeProjectModal();
    if (activeTaskBoard === board.id) { updateBoardUi(); renderBoard(); }
    else renderProjectNav();
    toast('项目名称已更新');
    return;
  }
  const id = `project-${Date.now()}`;
  data.projectBoards.push({ id, name, columns: BoardModel.createDefaultColumns() });
  data.projectTasks[id] = [];
  saveData();
  closeProjectModal();
  switchView('project', id);
  toast('项目任务看板已创建');
}

function syncColumnEditorInputs() {
  if (!editingColumns) return;
  document.querySelectorAll('.column-editor-row').forEach(row => {
    const column = editingColumns.find(item => item.id === row.dataset.columnId);
    if (!column) return;
    column.title = row.querySelector('.column-title-input').value;
    column.subtitle = row.querySelector('.column-subtitle-input').value;
    column.color = row.querySelector('.column-color-input').value;
  });
}
function renderColumnEditor() {
  const root = document.getElementById('columnEditorList');
  const colors = ['#ef6b57', '#d69a2d', '#2f918c', '#3b82c4', '#7867c6', '#64748b'];
  root.innerHTML = editingColumns.map((column, index) => `<div class="column-editor-row" data-column-id="${escapeHtml(column.id)}" style="--editor-color:${escapeHtml(column.color)}"><div class="column-editor-order"><span>${String(index + 1).padStart(2, '0')}</span><div><button class="mini-action move-column-up" type="button" title="向前移动" ${index === 0 ? 'disabled' : ''}><i data-lucide="arrow-up"></i></button><button class="mini-action move-column-down" type="button" title="向后移动" ${index === editingColumns.length - 1 ? 'disabled' : ''}><i data-lucide="arrow-down"></i></button></div></div><div class="column-editor-fields"><label>栏目名称<input class="column-title-input" maxlength="24" value="${escapeHtml(column.title)}" /></label><label>栏目说明<input class="column-subtitle-input" maxlength="50" value="${escapeHtml(column.subtitle)}" placeholder="例如：等待外部反馈" /></label></div><div class="column-color-control"><span>颜色</span><div class="color-row"><input class="column-color-input" type="color" value="${escapeHtml(column.color)}" title="自定义颜色" />${colors.map(color => `<button class="color-swatch ${color === column.color ? 'active' : ''}" type="button" data-color="${color}" style="--swatch:${color}" title="选择颜色"></button>`).join('')}</div></div><button class="icon-button subtle delete-column-button" type="button" title="删除栏目" ${editingColumns.length <= 1 ? 'disabled' : ''}><i data-lucide="trash-2"></i></button></div>`).join('');
  document.getElementById('columnLimitHint').textContent = `${editingColumns.length} / ${BoardModel.MAX_COLUMNS}`;
  document.getElementById('addColumnButton').disabled = editingColumns.length >= BoardModel.MAX_COLUMNS;
  root.querySelectorAll('.column-title-input, .column-subtitle-input').forEach(input => input.addEventListener('input', syncColumnEditorInputs));
  root.querySelectorAll('.column-color-input').forEach(input => input.addEventListener('input', event => { syncColumnEditorInputs(); event.currentTarget.closest('.column-editor-row').style.setProperty('--editor-color', event.currentTarget.value); }));
  root.querySelectorAll('.color-swatch').forEach(button => button.addEventListener('click', event => {
    const row = event.currentTarget.closest('.column-editor-row');
    row.querySelector('.column-color-input').value = event.currentTarget.dataset.color;
    syncColumnEditorInputs(); renderColumnEditor();
  }));
  root.querySelectorAll('.move-column-up, .move-column-down').forEach(button => button.addEventListener('click', event => {
    syncColumnEditorInputs();
    const row = event.currentTarget.closest('.column-editor-row');
    const currentIndex = editingColumns.findIndex(column => column.id === row.dataset.columnId);
    const targetIndex = currentIndex + (event.currentTarget.classList.contains('move-column-up') ? -1 : 1);
    if (targetIndex < 0 || targetIndex >= editingColumns.length) return;
    const [column] = editingColumns.splice(currentIndex, 1); editingColumns.splice(targetIndex, 0, column); renderColumnEditor();
  }));
  root.querySelectorAll('.delete-column-button').forEach(button => button.addEventListener('click', event => { syncColumnEditorInputs(); requestColumnDelete(event.currentTarget.closest('.column-editor-row').dataset.columnId); }));
  initIcons();
}
function openColumnsModal() {
  editingColumns = getBoardColumns().map(column => ({ ...column }));
  editingColumnTasks = getTaskCollection().map(task => ({ ...task }));
  document.getElementById('columnsModalTitle').textContent = `管理“${getProjectBoard().name}”栏目`;
  document.getElementById('columnsBackdrop').classList.remove('hidden');
  renderColumnEditor();
}
function closeColumnsModal() {
  document.getElementById('columnsBackdrop').classList.add('hidden');
  editingColumns = null; editingColumnTasks = null; deletingColumnId = null;
}
function addColumn() {
  syncColumnEditorInputs();
  try { editingColumns.push(BoardModel.createColumn(editingColumns)); renderColumnEditor(); }
  catch (error) { toast(error.message); }
}
function saveColumns() {
  syncColumnEditorInputs();
  try {
    const normalized = BoardModel.normalizeColumns(editingColumns, editingColumnTasks);
    getProjectBoard().columns = normalized.columns;
    setTaskCollection(activeTaskBoard, normalized.tasks);
    saveData(); closeColumnsModal(); renderBoard(); toast('栏目设置已保存');
  } catch (error) { toast(error.message || '栏目保存失败'); }
}
function requestColumnDelete(columnId) {
  if (editingColumns.length <= 1) return toast('每个页面至少保留一个栏目');
  deletingColumnId = columnId;
  const column = editingColumns.find(item => item.id === columnId);
  const taskCount = editingColumnTasks.filter(task => task.quadrant === columnId).length;
  document.getElementById('columnDeleteMessage').textContent = taskCount ? `“${column.title}”中有 ${taskCount} 项任务，请先选择迁移到哪个栏目。` : `“${column.title}”删除后将无法恢复。`;
  const label = document.getElementById('columnMigrationLabel');
  label.classList.toggle('hidden', taskCount === 0);
  document.getElementById('columnMigrationTarget').innerHTML = editingColumns.filter(item => item.id !== columnId).map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)}</option>`).join('');
  document.getElementById('columnDeleteBackdrop').classList.remove('hidden');
  initIcons();
}
function closeColumnDelete() { document.getElementById('columnDeleteBackdrop').classList.add('hidden'); deletingColumnId = null; }
function confirmColumnDelete() {
  if (!deletingColumnId) return;
  const hasTasks = editingColumnTasks.some(task => task.quadrant === deletingColumnId);
  const targetId = hasTasks ? document.getElementById('columnMigrationTarget').value : null;
  try {
    const result = BoardModel.removeColumn(editingColumns, editingColumnTasks, deletingColumnId, targetId);
    editingColumns = result.columns; editingColumnTasks = result.tasks;
    closeColumnDelete(); renderColumnEditor(); toast(hasTasks ? '栏目已删除，任务将在保存后迁移' : '栏目已删除');
  } catch (error) { toast(error.message); }
}

const chatTopics = [
  {
    category: '科技趋势', freshness: '近期趋势', title: 'AI 正从“会回答”走向“能协作”',
    summary: '越来越多团队开始把 AI 放进资料整理、会议准备、客户跟进等日常流程。真正的变化不只是多了一个工具，而是人和工具之间的分工正在被重新安排。',
    why: '它既有科技感，又和每个人的工作体验有关；即使对方没有使用 AI，也能从“观察阶段”聊起。', source: '内置趋势素材 · 适合长期练习',
    openTitle: '用一个不带结论的问题开场', open: '最近不少团队开始把 AI 放进日常工作流程里，你们那边已经在用了吗？',
    follow: '如果对方说“在用”：主要先用在哪个环节？如果说“还没用”：目前是在观察什么？',
    share: '我最近接触下来，发现工具本身反而不难，难的是团队能不能形成稳定的使用习惯。',
    bridge: '这也让我想到，我们以后协作时，资料准备和反馈节奏可能都需要重新设计。',
    questions: ['你觉得它现在真正省时间的地方是什么？', '团队里谁最先开始使用，大家的接受度一样吗？', '你更担心工具能力，还是担心工作方式被打乱？']
  },
  {
    category: '商业与消费', freshness: '近期趋势', title: '人们越来越在意“值不值得”，而不只是“贵不贵”',
    summary: '从餐饮、旅行到日常用品，消费者会更仔细地比较体验、耐用性和情绪价值。价格仍然重要，但“买完之后是否觉得值得”正在成为新的判断标准。',
    why: '这个话题贴近日常，不需要专业背景；从消费体验出发，也很容易聊到行业和客户决策。', source: '内置趋势素材 · 适合长期练习',
    openTitle: '从一个具体体验切入', open: '最近你有没有买过什么东西，价格不一定最低，但买完觉得特别值？',
    follow: '是什么让你觉得值？是品质、方便、服务，还是当时的心情？',
    share: '我发现自己现在做消费选择时，会更在意它能不能减少后续的麻烦，而不是只看当下便不便宜。',
    bridge: '这和我们做产品或服务很像，客户最后记住的往往是整个过程是否省心。',
    questions: ['你最近最愿意为哪一种体验多付一点钱？', '你会先看评价，还是更相信自己的第一次体验？', '这种变化对你所在的行业有影响吗？']
  },
  {
    category: '城市与生活方式', freshness: '城市观察', title: '“附近生活”正在重新变得有吸引力',
    summary: '很多人开始重新发现住处周边的咖啡店、公园、菜市场和小型活动。比起一次性打卡，人们更看重日常可抵达、能反复使用的空间。',
    why: '它轻松、低风险，而且能从城市聊到个人习惯，再自然了解对方的生活节奏。', source: '内置趋势素材 · 适合长期练习',
    openTitle: '从对方熟悉的地方开始', open: '你平时会专门去住处或办公室附近探索吗？最近有没有发现一个值得反复去的地方？',
    follow: '你喜欢那里是因为氛围、方便，还是因为认识了那里的人？',
    share: '我最近会刻意给自己留一点“走远一点但不赶时间”的空档，反而更容易发现城市里有意思的小地方。',
    bridge: '其实客户和团队也一样，长期关系很多时候来自高频、低负担的接触。',
    questions: ['你理想中的下班后两小时是什么样？', '你觉得一个地方让人愿意反复去，最重要的因素是什么？', '出差时你也会保留这种附近探索的习惯吗？']
  },
  {
    category: '文化与内容', freshness: '文化话题', title: '大家开始从“看过什么”聊到“被什么留下”',
    summary: '书、电影、展览和播客越来越像是个人表达的一部分。比起罗列最近看过的内容，人们更愿意分享某个作品为什么在当下击中了自己。',
    why: '文化话题能让对话从事实自然进入感受和价值判断，但仍然保持足够安全和开放。', source: '内置趋势素材 · 适合长期练习',
    openTitle: '不要问片单，问留下来的部分', open: '你最近有没有看过什么，结束之后还会时不时想起来？',
    follow: '是哪个细节或观点让你记住了？它和你最近的状态有关系吗？',
    share: '我最近更容易被那些没有急着给答案的作品吸引，因为它会留一点空间让人自己想。',
    bridge: '和客户沟通其实也类似，先理解对方真正关心什么，往往比马上给答案更重要。',
    questions: ['你更喜欢被故事打动，还是被一个新观点启发？', '你会把喜欢的内容推荐给别人吗？', '最近有没有一件内容改变了你看待工作的方式？']
  },
  {
    category: '行业动态', freshness: '行业观察', title: '很多行业都在从“增长优先”转向“效率优先”',
    summary: '在不确定的环境里，企业会更关注流程是否清晰、资源是否被有效使用，以及投入能否形成可复用的能力。效率不只是降本，也包括减少反复沟通和决策损耗。',
    why: '这是一个适合商务场合的共同背景，但可以先从个人工作感受聊起，避免一上来就像在做行业访谈。', source: '内置趋势素材 · 适合长期练习',
    openTitle: '从工作中的小变化问起', open: '你最近有没有感觉到，团队比以前更在意“怎么做得更省力”？',
    follow: '最明显的变化发生在哪个环节？是流程、人员协作，还是决策方式？',
    share: '我发现很多效率问题并不是缺工具，而是大家对“做到什么程度算完成”没有共识。',
    bridge: '所以我们之后如果一起推进项目，可能需要先把判断标准和反馈节奏说清楚。',
    questions: ['你们最近最想消除哪一种重复劳动？', '效率和体验之间，你觉得哪里最难平衡？', '有没有一个小改动，带来了比预期更大的效果？']
  }
];

function chatTopicIndex() {
  const dayNumber = Math.floor(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() / 86400000);
  return ((dayNumber % chatTopics.length) + chatTopics.length) % chatTopics.length;
}
function chatDateKey() { return isoDate(today); }
function chatStreakCount() {
  const completed = new Set(data.chatPractice?.completedDates || []);
  let count = 0; const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  while (completed.has(isoDate(cursor))) { count += 1; cursor.setDate(cursor.getDate() - 1); }
  return count;
}
function renderChatView(topicOverride = selectedChatTopic) {
  const topic = topicOverride || chatTopics[chatTopicIndex()];
  const dateKey = chatDateKey();
  document.getElementById('chatDateLabel').textContent = formatToday(today);
  document.getElementById('hotspotCategory').textContent = topic.category;
  document.getElementById('hotspotFreshness').textContent = topic.freshness;
  document.getElementById('hotspotTitle').textContent = topic.title;
  document.getElementById('hotspotSummary').textContent = topic.summary;
  document.getElementById('hotspotWhy').textContent = topic.why;
  document.getElementById('hotspotSource').textContent = topic.source;
  document.getElementById('chatOpenTitle').textContent = topic.openTitle;
  document.getElementById('chatOpenText').textContent = topic.open;
  document.getElementById('chatFollowText').textContent = topic.follow;
  document.getElementById('chatShareText').textContent = topic.share;
  document.getElementById('chatBridgeText').textContent = topic.bridge;
  document.getElementById('chatQuestions').innerHTML = topic.questions.map(question => `<div class="question-item"><i data-lucide="corner-down-right"></i><span>${escapeHtml(question)}</span></div>`).join('');
  document.getElementById('chatPracticeDone').checked = Boolean(data.chatPractice?.completedDates?.includes(dateKey));
  document.getElementById('chatStreakCount').textContent = chatStreakCount();
  document.getElementById('chatPracticeCount').textContent = document.getElementById('chatPracticeDone').checked ? '1/1' : '0/1';
  document.getElementById('chatAngleInput').value = data.chatPractice?.angles?.[dateKey] || '';
  initIcons();
}

const fallbackHotNews = [
  { category: '科技与 AI', title: 'AI 产品开始从聊天工具走向工作流协作', summary: '多家科技公司近期把 AI 代理、资料处理和团队协作放在同一套产品里，企业关注点从“能不能用”转向“能不能稳定落地”。', source: '备用素材', url: '' },
  { category: '商业趋势', title: '企业更重视效率与可复用能力', summary: '在预算和周期更谨慎的环境里，企业开始优先投入能减少重复沟通、沉淀流程和提升交付稳定性的能力。', source: '备用素材', url: '' },
  { category: '消费与生活', title: '消费者更愿意为省心和体验感付费', summary: '近期消费讨论中，“是否值得”越来越包含服务、便利和情绪体验，而不只是价格高低。', source: '备用素材', url: '' },
  { category: '文化与城市', title: '图书馆、博物馆和科技馆成为城市新会客厅', summary: '公共文化空间正在兼具阅读、社交、展览和文旅功能，成为暑期城市生活中新的热门目的地。', source: '备用素材', url: '' },
  { category: '行业动态', title: '内容行业继续讨论 AI 创作的边界与规则', summary: '影视、音乐和短视频平台都在尝试建立 AI 内容标识与版权保护机制，创作者和平台的分工正在变化。', source: '备用素材', url: '' }
];
const hotNewsFeeds = [
  { url: 'https://www.chinanews.com.cn/rss/scroll-news.xml', source: '中新网即时', category: '行业动态' },
  { url: 'https://www.chinanews.com.cn/rss/finance.xml', source: '中新网财经', category: '商业趋势' }
];
function normalizeNewsTitle(value) { return String(value || '').replace(/\s+-\s+[^-]+$/, '').replace(/\s+/g, ' ').trim(); }
function normalizeNewsSummary(value, title) {
  const summary = String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  if (summary.length > 18) return `${summary.slice(0, 112).replace(/[，。；、：,.;: ]+$/, '')}。`;
  return `围绕“${title}”的一条近期动态，适合先从事实和实际影响聊起。`;
}
function newsCategory(title, index) {
  const text = title.toLowerCase();
  if (/ai|人工智能|芯片|模型|科技|软件|机器人/.test(text)) return '科技与 AI';
  if (/电影|音乐|展览|博物馆|文化|艺术/.test(text)) return '文化与内容';
  if (/消费|旅游|城市|生活|餐饮/.test(text)) return '生活与城市';
  return index % 2 ? '商业趋势' : '行业动态';
}
async function fetchHotNews() {
  const status = document.getElementById('hotNewsStatus');
  status.textContent = '正在刷新实时动态';
  try {
    const responses = await Promise.all(hotNewsFeeds.map(feed => fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`)));
    const payloads = await Promise.all(responses.map(response => response.ok ? response.json() : null));
    const feedItems = payloads.map((payload, feedIndex) => Array.isArray(payload?.items) ? payload.items.map(item => ({ ...item, feed: hotNewsFeeds[feedIndex] })) : []);
    const merged = [];
    for (let offset = 0; offset < 10; offset += 1) feedItems.forEach(items => { if (items[offset]) merged.push(items[offset]); });
    const seen = new Set();
    hotNewsItems = merged.filter(item => {
      const title = normalizeNewsTitle(item.title);
      if (!title || seen.has(title)) return false;
      seen.add(title); return true;
    }).slice(0, 5).map((item, index) => {
      const title = normalizeNewsTitle(item.title);
      return {
        category: item.feed?.category || newsCategory(title, index),
        title,
        summary: normalizeNewsSummary(item.description, title),
        source: item.feed?.source || '国内媒体 RSS',
        url: window.NewsUtils?.normalizeNewsUrl ? window.NewsUtils.normalizeNewsUrl(item.link) : item.link || ''
      };
    });
    if (!hotNewsItems.length) throw new Error('empty feed');
    status.textContent = '已更新 · 实时 RSS';
  } catch {
    hotNewsItems = fallbackHotNews;
    status.textContent = '暂时使用备用素材';
  }
  selectedHotNewsIndex = 0;
  renderHotNews();
}
function domesticSearchUrl(title, platform) {
  if (window.NewsUtils?.buildDomesticSearchUrl) return window.NewsUtils.buildDomesticSearchUrl(title, platform);
  const query = encodeURIComponent(String(title || '').trim());
  return platform === 'weibo' ? `https://s.weibo.com/weibo?q=${query}` : `https://www.baidu.com/s?wd=${query}`;
}
function newsSourceHtml(item, detail = false) {
  if (item.url) return `<a class="${detail ? 'detail-source-link' : 'news-source-link'}" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.source || '查看来源')}</a>`;
  return `<span>${escapeHtml(item.source || '来源暂缺')}</span>`;
}
function renderHotNews() {
  document.getElementById('hotNewsDateLabel').textContent = formatToday(today);
  document.getElementById('hotNewsListCount').textContent = `${hotNewsItems.length} 条`;
  const root = document.getElementById('hotNewsList');
  root.innerHTML = hotNewsItems.map((item, index) => `<article class="news-item ${index === selectedHotNewsIndex ? 'selected' : ''}" data-news-index="${index}" tabindex="0"><div class="news-number">0${index + 1}</div><div class="news-item-main"><div class="news-item-meta"><span class="news-category">${escapeHtml(item.category)}</span><span class="news-time">今日动态</span></div><h2>${escapeHtml(item.title)}</h2><p class="news-item-summary">${escapeHtml(item.summary)}</p><div class="news-source">${newsSourceHtml(item)}</div></div><button class="secondary-button news-use-button" type="button" data-news-index="${index}"><i data-lucide="message-square-plus"></i>转为聊天素材</button></article>`).join('');
  root.querySelectorAll('.news-item').forEach(item => { item.addEventListener('click', () => selectHotNewsPreview(Number(item.dataset.newsIndex))); item.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectHotNewsPreview(Number(item.dataset.newsIndex)); } }); });
  root.querySelectorAll('.news-source-link').forEach(link => link.addEventListener('click', event => event.stopPropagation()));
  root.querySelectorAll('.news-use-button').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); selectHotNews(Number(button.dataset.newsIndex)); }));
  renderHotNewsDetail();
  initIcons();
}
function renderHotNewsDetail() {
  const detail = document.getElementById('hotNewsDetail');
  const item = hotNewsItems[selectedHotNewsIndex];
  if (!item) { detail.innerHTML = '<div class="detail-empty"><i data-lucide="mouse-pointer-click"></i><h2>选择一条热点</h2><p>右侧会显示 1 分钟内可以读完的速读内容。</p></div>'; initIcons(); return; }
  const facts = [`分类：${item.category}`, `来源：${item.source || '公开动态'}`, '时间：今日动态'];
  const why = item.category === '生活与城市' || item.category === '文化与内容' ? '它贴近日常体验，适合从个人感受和城市观察切入。' : '它连接科技、商业或行业变化，适合从实际影响和工作体验切入。';
  const sourceAction = item.url ? `<a class="secondary-button" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer"><i data-lucide="external-link"></i>查看原文</a>` : `<a class="secondary-button" href="${domesticSearchUrl(item.title, 'baidu')}" target="_blank" rel="noopener noreferrer"><i data-lucide="search"></i>百度搜索</a><a class="secondary-button" href="${domesticSearchUrl(item.title, 'weibo')}" target="_blank" rel="noopener noreferrer"><i data-lucide="message-circle"></i>微博查看</a>`;
  detail.innerHTML = `<div class="detail-topline"><span class="detail-category">${escapeHtml(item.category)}</span><span class="detail-time">速读 · 约 1 分钟</span></div><h2>${escapeHtml(item.title)}</h2><p class="detail-summary">${escapeHtml(item.summary)}</p><div class="detail-blocks"><div class="detail-block full"><div class="detail-block-label">30 SECOND READ</div><p>${escapeHtml(item.summary)} 先记住一个核心：这不是只停留在新闻标题里的变化，它可能会影响人们的选择、协作或生活方式。</p></div><div class="detail-block"><div class="detail-block-label">KEY FACTS</div><ul class="detail-facts">${facts.map(fact => `<li>${escapeHtml(fact)}</li>`).join('')}</ul></div><div class="detail-block"><div class="detail-block-label">WHY IT MATTERS</div><p>${escapeHtml(why)}</p></div><div class="detail-block full"><div class="detail-block-label">MEMORY LINE</div><p>记住：${escapeHtml(item.title)}，先聊实际变化，再聊个人判断。</p></div></div><div class="detail-actions"><button class="primary-button" id="detailConvertNews" type="button"><i data-lucide="message-square-plus"></i>转为聊天素材</button>${sourceAction}<span class="detail-source">来源：${newsSourceHtml(item, true)}</span></div>`;
  document.getElementById('detailConvertNews').addEventListener('click', () => selectHotNews(selectedHotNewsIndex));
  initIcons();
}
function selectHotNewsPreview(index) { if (!hotNewsItems[index]) return; selectedHotNewsIndex = index; renderHotNews(); }
function topicFromNews(item) {
  return {
    category: item.category, freshness: '今日热点', title: item.title,
    summary: item.summary, why: '这条动态可以先作为共同背景，再从对方的实际体验、判断和工作影响展开。', source: `${item.source}${item.url ? ' · 可查看原文' : ''}`,
    openTitle: '用一个不带结论的问题开场', open: `最近看到一个动态：“${item.title}”。你有关注到这件事吗？`,
    follow: '如果对方了解：你觉得它最实际的影响是什么？如果不了解：你最近有没有遇到过类似的变化？',
    share: '我看到这件事时，第一反应不是追热点，而是想它会不会改变大家做选择和协作的方式。',
    bridge: '这也让我想到我们自己的工作，可能需要提前观察这个变化会不会影响客户、流程或合作节奏。',
    questions: ['你觉得这条动态离我们的工作近吗？', '你更关注它带来的机会，还是需要注意的风险？', '如果这个趋势继续发展，你最想先验证什么？']
  };
}
function selectHotNews(index) {
  const item = hotNewsItems[index];
  if (!item) return;
  selectedChatTopic = topicFromNews(item);
  switchView('chat');
  toast('已转换为聊天素材');
}
function linkImportElements() {
  return {
    backdrop: document.getElementById('importHotNewsBackdrop'), input: document.getElementById('newsLinkInput'), message: document.getElementById('linkParseMessage'), preview: document.getElementById('linkParsePreview'), manual: document.getElementById('manualNewsForm'), title: document.getElementById('parsedNewsTitle'), summary: document.getElementById('parsedNewsSummary'), source: document.getElementById('parsedNewsSource'), manualTitle: document.getElementById('manualNewsTitle'), manualSummary: document.getElementById('manualNewsSummary'), parseButton: document.getElementById('parseNewsButton'), parseLabel: document.getElementById('parseNewsButtonLabel'), manualButton: document.getElementById('manualNewsConvertButton')
  };
}
function resetLinkImportModal() {
  const e = linkImportElements();
  e.input.value = ''; e.message.textContent = ''; e.message.className = 'link-parse-message'; e.preview.classList.add('hidden'); e.manual.classList.add('hidden'); e.manualButton.classList.add('hidden'); e.parseButton.classList.remove('hidden'); e.parseButton.disabled = false; e.parseButton.type = 'submit'; e.parseButton.onclick = null; e.parseLabel.textContent = '解析链接';
}
function openLinkImport() { resetLinkImportModal(); linkImportElements().backdrop.classList.remove('hidden'); setTimeout(() => linkImportElements().input.focus(), 60); }
function closeLinkImport() { linkImportElements().backdrop.classList.add('hidden'); }
function setLinkMessage(text, tone = '') { const e = linkImportElements(); e.message.textContent = text; e.message.className = `link-parse-message ${tone}`.trim(); }
function showManualNewsFallback(reason) { const e = linkImportElements(); e.preview.classList.add('hidden'); e.manual.classList.remove('hidden'); e.manualButton.classList.remove('hidden'); e.parseButton.classList.add('hidden'); setLinkMessage(`${reason}。你可以补充标题和摘要继续转换。`, 'error'); }
function convertImportedNews(item) { selectedChatTopic = topicFromNews({ category: '链接导入', freshness: '链接导入', title: item.title, summary: item.summary, source: item.source || '公开网页', url: item.url || '' }); closeLinkImport(); switchView('chat'); toast('链接已转换为聊天素材'); }
function parseReaderText(text, url) {
  const lines = String(text || '').split(/\r?\n/).map(line => (window.NewsUtils?.cleanNewsSummary ? window.NewsUtils.cleanNewsSummary(line, 500) : line.trim())).filter(Boolean);
  const title = lines.find(line => line.length > 3 && !line.startsWith('URL:') && !line.startsWith('Title:')) || '';
  const summary = lines.filter(line => line !== title && line.length > 20).slice(0, 3).join(' ');
  if (title.length < 3 || summary.length < 10) throw new Error('没有提取到足够的标题或摘要');
  return { title, summary: summary.slice(0, 900), source: (() => { try { return new URL(url).hostname; } catch { return '公开网页'; } })(), url };
}
function showParsedNewsPreview(item) {
  const e = linkImportElements();
  e.title.textContent = item.title; e.summary.textContent = item.summary; e.source.textContent = `${item.source || '公开网页'}${item.publishedAt ? ` · ${item.publishedAt.slice(0, 10)}` : ''}`; e.preview.classList.remove('hidden'); e.manual.classList.add('hidden'); e.manualButton.classList.add('hidden'); e.parseButton.classList.remove('hidden'); e.parseButton.disabled = false; e.parseLabel.textContent = '转为聊天素材'; e.parseButton.type = 'button'; e.parseButton.onclick = () => convertImportedNews(item); setLinkMessage('已提取网页标题和摘要，请确认后转换。', 'success');
}
async function parseWithReaderFallback(url) { const response = await fetch(`https://r.jina.ai/${url}`, { headers: { Accept: 'text/plain' } }); if (!response.ok) throw new Error('网页暂时无法读取'); return parseReaderText(await response.text(), url); }
async function parseNewsLink(event) {
  event.preventDefault();
  const e = linkImportElements(); const value = e.input.value.trim();
  const isSafe = window.NewsUtils?.isSafePublicUrl ? window.NewsUtils.isSafePublicUrl(value) : /^https?:\/\//i.test(value);
  if (!isSafe) { setLinkMessage('链接格式不正确，请输入公开的 http 或 https 网页链接。', 'error'); return; }
  e.parseButton.disabled = true; e.parseLabel.textContent = '解析中…'; e.manual.classList.add('hidden'); e.manualButton.classList.add('hidden'); setLinkMessage('正在读取网页内容…');
  try {
    const endpoint = window.SUPABASE_CONFIG?.newsParserFunctionUrl;
    if (!endpoint) throw new Error('解析服务尚未配置');
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: value }) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || '网页暂时无法读取');
    const item = { ...result.data, category: '链接导入' }; e.title.textContent = item.title; e.summary.textContent = item.summary; e.source.textContent = `${item.source || '公开网页'}${item.publishedAt ? ` · ${item.publishedAt.slice(0, 10)}` : ''}`; e.preview.classList.remove('hidden'); e.manual.classList.add('hidden'); e.manualButton.classList.add('hidden'); e.parseButton.classList.remove('hidden'); e.parseButton.disabled = false; e.parseLabel.textContent = '转为聊天素材'; e.parseButton.type = 'button'; e.parseButton.onclick = () => convertImportedNews(item); setLinkMessage('已提取网页标题和摘要，请确认后转换。', 'success');
  } catch (error) {
    try { const fallbackItem = await parseWithReaderFallback(value); showParsedNewsPreview(fallbackItem); return; }
    catch { e.parseButton.disabled = false; e.parseLabel.textContent = '重新解析'; e.parseButton.type = 'submit'; showManualNewsFallback(error.message || '网页暂时无法读取'); }
  }
}
function convertManualNews() { const e = linkImportElements(); const title = e.manualTitle.value.trim(); const summary = e.manualSummary.value.trim(); if (title.length < 3 || summary.length < 10) { setLinkMessage('标题至少 3 个字，摘要或正文要点至少 10 个字。', 'error'); return; } convertImportedNews({ title, summary, source: '手动补充', url: e.input.value.trim() }); }
function markChatPractice(event) {
  const dateKey = chatDateKey();
  const dates = new Set(data.chatPractice.completedDates || []);
  if (event.currentTarget.checked) dates.add(dateKey); else dates.delete(dateKey);
  data.chatPractice.completedDates = [...dates].sort();
  saveData(); renderChatView(); toast(event.currentTarget.checked ? '今日练习已完成' : '已取消今日完成');
}
function saveChatAngle() {
  const dateKey = chatDateKey();
  data.chatPractice.angles[dateKey] = document.getElementById('chatAngleInput').value.trim();
  saveData(); document.getElementById('chatSavedHint').textContent = '已保存 · 只保存在本设备'; toast('你的角度已保存');
}
function copyChatLine(event) {
  const text = document.getElementById(event.currentTarget.dataset.copyTarget)?.textContent || '';
  navigator.clipboard?.writeText(text).then(() => toast('开场句已复制')).catch(() => toast('复制失败，请手动选择'));
}
function toast(message) { const node = document.getElementById('toast'); node.textContent = message; node.classList.add('show'); clearTimeout(window.__toastTimer); window.__toastTimer = setTimeout(() => node.classList.remove('show'), 2200); }
function switchView(view, projectId = activeTaskBoard) {
  document.getElementById('calendarView').classList.toggle('hidden', view !== 'calendar');
  document.getElementById('boardView').classList.toggle('hidden', view !== 'project');
  document.getElementById('chatView').classList.toggle('hidden', view !== 'chat');
  document.getElementById('hotNewsView').classList.toggle('hidden', view !== 'hot-news');
  document.getElementById('calendarNavButton').classList.toggle('active', view === 'calendar');
  document.getElementById('chatNavButton').classList.toggle('active', view === 'chat');
  if (view === 'hot-news') {
    document.getElementById('pageTitle').textContent = '今日热点';
    renderHotNews();
    renderProjectNav();
    return;
  }
  if (view === 'chat') {
    document.getElementById('pageTitle').textContent = '聊天素材';
    renderChatView();
    renderProjectNav();
    return;
  }
  if (view === 'calendar') {
    document.getElementById('pageTitle').textContent = '行程安排';
    renderProjectNav();
    return;
  }
  const previousBoard = activeTaskBoard;
  activeTaskBoard = getProjectBoard(projectId).id;
  document.getElementById('pageTitle').textContent = getProjectBoard(activeTaskBoard).name;
  updateBoardUi();
  renderBoard();
  if (previousBoard !== activeTaskBoard) document.getElementById('quadrants').scrollLeft = 0;
}

document.getElementById('calendarNavButton').addEventListener('click', () => switchView('calendar'));
document.getElementById('sidebarToggle').addEventListener('click', () => {
  setSidebarCollapsed(!document.querySelector('.app-shell').classList.contains('sidebar-collapsed'));
});
document.getElementById('chatNavButton').addEventListener('click', () => { selectedChatTopic = null; switchView('chat'); });
document.getElementById('hotNewsButton').addEventListener('click', () => switchView('hot-news'));
document.getElementById('refreshHotNewsButton').addEventListener('click', fetchHotNews);
document.getElementById('importHotNewsButton').addEventListener('click', openLinkImport);
document.getElementById('closeLinkImport').addEventListener('click', closeLinkImport);
document.getElementById('cancelLinkImport').addEventListener('click', closeLinkImport);
document.getElementById('importHotNewsBackdrop').addEventListener('click', event => { if (event.target.id === 'importHotNewsBackdrop') closeLinkImport(); });
document.getElementById('linkParseForm').addEventListener('submit', parseNewsLink);
document.getElementById('manualNewsConvertButton').addEventListener('click', convertManualNews);
document.getElementById('addProjectButton').addEventListener('click', () => openProjectModal());
document.getElementById('prevMonth').addEventListener('click', () => { currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1); renderCalendar(); });
document.getElementById('nextMonth').addEventListener('click', () => { currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1); renderCalendar(); });
document.getElementById('todayButton').addEventListener('click', () => { currentMonth = new Date(today.getFullYear(), today.getMonth(), 1); switchView('calendar'); renderCalendar(); });
document.getElementById('addScheduleButton').addEventListener('click', () => openModal('event'));
document.getElementById('addTaskButton').addEventListener('click', () => openModal('task'));
document.getElementById('manageColumnsButton').addEventListener('click', openColumnsModal);
document.getElementById('closeModal').addEventListener('click', closeModal); document.getElementById('cancelModal').addEventListener('click', closeModal);
document.getElementById('modalBackdrop').addEventListener('click', event => { if (event.target.id === 'modalBackdrop') closeModal(); });
document.getElementById('closeProjectModal').addEventListener('click', closeProjectModal); document.getElementById('cancelProjectModal').addEventListener('click', closeProjectModal);
document.getElementById('projectBackdrop').addEventListener('click', event => { if (event.target.id === 'projectBackdrop') closeProjectModal(); });
document.getElementById('cancelDelete').addEventListener('click', closeDeleteConfirm);
document.getElementById('confirmDelete').addEventListener('click', confirmDeletion);
document.getElementById('confirmBackdrop').addEventListener('click', event => { if (event.target.id === 'confirmBackdrop') closeDeleteConfirm(); });
document.getElementById('captureForm').addEventListener('submit', handleCapture);
document.getElementById('projectForm').addEventListener('submit', handleProjectForm);
document.getElementById('closeColumnsModal').addEventListener('click', closeColumnsModal); document.getElementById('cancelColumnsModal').addEventListener('click', closeColumnsModal);
document.getElementById('columnsBackdrop').addEventListener('click', event => { if (event.target.id === 'columnsBackdrop') closeColumnsModal(); });
document.getElementById('addColumnButton').addEventListener('click', addColumn);
document.getElementById('saveColumnsButton').addEventListener('click', saveColumns);
document.getElementById('cancelColumnDelete').addEventListener('click', closeColumnDelete);
document.getElementById('confirmColumnDelete').addEventListener('click', confirmColumnDelete);
document.getElementById('columnDeleteBackdrop').addEventListener('click', event => { if (event.target.id === 'columnDeleteBackdrop') closeColumnDelete(); });
document.getElementById('chatPracticeDone').addEventListener('change', markChatPractice);
document.getElementById('saveChatAngleButton').addEventListener('click', saveChatAngle);
document.querySelectorAll('.copy-chat-line').forEach(button => button.addEventListener('click', copyChatLine));
document.getElementById('searchInput').addEventListener('input', renderBoard);
document.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.getElementById('searchInput').focus(); } if (event.key === 'Escape') { closeModal(); closeDeleteConfirm(); closeProjectModal(); closeColumnsModal(); closeColumnDelete(); closeLinkImport(); } });
document.getElementById('todayLabel').textContent = formatToday(today);
setSidebarCollapsed(localStorage.getItem(sidebarStorageKey) === 'true');
renderCalendar(); updateBoardUi(); renderBoard(); renderChatView(); renderHotNews(); initIcons();
fetchHotNews();
window.cloudStore?.init({
  getData: () => data,
  applyData: cloudData => {
    data = normalizeData(cloudData);
    localStorage.setItem(storageKey, JSON.stringify(data));
    renderCalendar();
    renderBoard();
    renderChatView();
  }
});
