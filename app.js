/* =============================================================
   SmartTask — app.js
   Features: CRUD, priorities, categories, due dates, subtasks,
   drag & drop, search, filters, sort, dark/light theme,
   progress bar, confetti on completion, localStorage persistence,
   toast notifications, keyboard shortcuts
   ============================================================= */

'use strict';

/* ---- State ---- */
let tasks = [];
let editingId = null;
let activeFilter = 'all';
let activeCat = 'all';
let searchQuery = '';
let sortMode = 'created-desc';
let dragSrcIndex = null;

/* ---- DOM Refs ---- */
const taskList         = document.getElementById('task-list');
const emptyState       = document.getElementById('empty-state');
const searchInput      = document.getElementById('search-input');
const clearSearch      = document.getElementById('clear-search');
const addTaskToggle    = document.getElementById('add-task-toggle');
const addTaskForm      = document.getElementById('add-task-form');
const addChevron       = document.getElementById('add-chevron');
const btnAddTask       = document.getElementById('btn-add-task');
const taskTitle        = document.getElementById('task-title');
const taskNotes        = document.getElementById('task-notes');
const taskPriority     = document.getElementById('task-priority');
const taskCategory     = document.getElementById('task-category');
const taskDue          = document.getElementById('task-due');
const taskSubtasks     = document.getElementById('task-subtasks');
const filterTabs       = document.getElementById('filter-tabs');
const catStrip         = document.getElementById('category-strip');
const sortBtn          = document.getElementById('sort-btn');
const sortDropdown     = document.getElementById('sort-dropdown');
const themeBtn         = document.getElementById('theme-btn');
const clearDoneBtn     = document.getElementById('clear-done-btn');
const modalOverlay     = document.getElementById('modal-overlay');
const modalClose       = document.getElementById('modal-close');
const modalCancel      = document.getElementById('modal-cancel');
const modalSave        = document.getElementById('modal-save');
const editTitle        = document.getElementById('edit-title');
const editPriority     = document.getElementById('edit-priority');
const editCategory     = document.getElementById('edit-category');
const editDue          = document.getElementById('edit-due');
const editNotes        = document.getElementById('edit-notes');
const editSubtasks     = document.getElementById('edit-subtasks');
const progressFill     = document.getElementById('progress-fill');
const progressGlow     = document.getElementById('progress-glow');
const progressPercent  = document.getElementById('progress-percent');
const todayCount       = document.getElementById('today-count');
const doneCount        = document.getElementById('done-count');
const overdueCount     = document.getElementById('overdue-count');
const toastContainer   = document.getElementById('toast-container');
const confettiCanvas   = document.getElementById('confetti-canvas');

/* ---- Utility ---- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().slice(0, 10);
const isOverdue = (due) => due && due < today() ? true : false;
const isToday   = (due) => due === today();

function saveTasks() {
  localStorage.setItem('smarttask_v2', JSON.stringify(tasks));
}
function loadTasks() {
  try {
    const raw = localStorage.getItem('smarttask_v2');
    tasks = raw ? JSON.parse(raw) : [];
  } catch { tasks = []; }
}

/* ---- Toast ---- */
function showToast(msg, type = 'success', duration = 3000) {
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span>${msg}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

/* ---- Confetti ---- */
const confettiCtx = confettiCanvas.getContext('2d');
let confettiParticles = [];
let confettiRaf = null;

function resizeConfetti() {
  confettiCanvas.width  = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeConfetti);
resizeConfetti();

function launchConfetti() {
  clearConfetti();
  for (let i = 0; i < 140; i++) {
    confettiParticles.push({
      x: Math.random() * confettiCanvas.width,
      y: Math.random() * -confettiCanvas.height * 0.5,
      r: Math.random() * 8 + 4,
      d: Math.random() * 80 + 40,
      color: `hsl(${Math.random()*360},90%,65%)`,
      tilt: Math.random() * 10 - 5,
      tiltAlt: 0,
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 5 + 3,
      alpha: 1,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    });
  }
  drawConfetti();
  setTimeout(clearConfetti, 4000);
}

function drawConfetti() {
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  let alive = false;
  confettiParticles.forEach(p => {
    p.y  += p.vy;
    p.x  += p.vx;
    p.tiltAlt += 0.1;
    p.tilt = Math.sin(p.tiltAlt) * 12;
    p.alpha = Math.max(0, p.alpha - 0.008);
    if (p.y < confettiCanvas.height + 20) alive = true;
    confettiCtx.save();
    confettiCtx.globalAlpha = p.alpha;
    confettiCtx.fillStyle = p.color;
    confettiCtx.beginPath();
    if (p.shape === 'circle') {
      confettiCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    } else {
      confettiCtx.rect(p.x + p.tilt, p.y, p.r, p.r * 0.5);
    }
    confettiCtx.fill();
    confettiCtx.restore();
  });
  if (alive) confettiRaf = requestAnimationFrame(drawConfetti);
}

function clearConfetti() {
  if (confettiRaf) cancelAnimationFrame(confettiRaf);
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  confettiParticles = [];
}

/* ---- Theme ---- */
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  themeBtn.querySelector('i').className = t === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  localStorage.setItem('smarttask_theme', t);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}
themeBtn.addEventListener('click', toggleTheme);

/* ---- Add Task Toggle ---- */
addTaskToggle.addEventListener('click', () => {
  const open = addTaskForm.classList.toggle('open');
  addChevron.classList.toggle('open', open);
});

/* ---- Add Task ---- */
function addTask() {
  const title = taskTitle.value.trim();
  if (!title) { showToast('Please enter a task title!', 'warning'); taskTitle.focus(); return; }
  const subtaskTexts = taskSubtasks.value.split(',').map(s => s.trim()).filter(Boolean);
  const task = {
    id: uid(),
    title,
    notes: taskNotes.value.trim(),
    priority: taskPriority.value,
    category: taskCategory.value,
    due: taskDue.value,
    subtasks: subtaskTexts.map(text => ({ id: uid(), text, done: false })),
    completed: false,
    createdAt: Date.now(),
  };
  tasks.unshift(task);
  saveTasks();
  renderTasks();
  updateStats();
  resetForm();
  showToast(`Task "${title}" added!`, 'success');
  // animate scroll to top of list
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  taskTitle.value       = '';
  taskNotes.value       = '';
  taskSubtasks.value    = '';
  taskDue.value         = '';
  taskPriority.value    = 'medium';
  taskCategory.value    = 'personal';
}

btnAddTask.addEventListener('click', addTask);
taskTitle.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });

/* ---- Delete Task ---- */
function deleteTask(id) {
  const t = tasks.find(t => t.id === id);
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderTasks();
  updateStats();
  showToast(`Task "${t?.title}" deleted`, 'info');
}

/* ---- Toggle Complete ---- */
function toggleComplete(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveTasks();
  renderTasks();
  updateStats();
  if (task.completed) {
    showToast('🎉 Task completed!', 'success');
    const allDone = tasks.filter(t => !t.completed).length === 0 && tasks.length > 0;
    if (allDone) { launchConfetti(); showToast('🏆 All tasks done! Amazing!', 'success', 5000); }
    else launchConfetti();
  }
}

/* ---- Toggle Subtask ---- */
function toggleSubtask(taskId, subId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  const sub = task.subtasks.find(s => s.id === subId);
  if (sub) sub.done = !sub.done;
  saveTasks();
  renderTasks();
  updateStats();
}

/* ---- Edit Modal ---- */
function openEdit(id) {
  editingId = id;
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  editTitle.value    = task.title;
  editNotes.value    = task.notes;
  editPriority.value = task.priority;
  editCategory.value = task.category;
  editDue.value      = task.due;
  editSubtasks.value = task.subtasks.map(s => s.text).join(', ');
  modalOverlay.classList.add('open');
  setTimeout(() => editTitle.focus(), 100);
}
function closeModal() {
  modalOverlay.classList.remove('open');
  editingId = null;
}
function saveEdit() {
  if (!editingId) return;
  const task = tasks.find(t => t.id === editingId);
  if (!task) return;
  const newTitle = editTitle.value.trim();
  if (!newTitle) { showToast('Title cannot be empty!', 'warning'); return; }
  const subtaskTexts = editSubtasks.value.split(',').map(s => s.trim()).filter(Boolean);
  // preserve done status for existing subtasks
  const existingMap = Object.fromEntries(task.subtasks.map(s => [s.text, s.done]));
  task.title    = newTitle;
  task.notes    = editNotes.value.trim();
  task.priority = editPriority.value;
  task.category = editCategory.value;
  task.due      = editDue.value;
  task.subtasks = subtaskTexts.map(text => ({ id: uid(), text, done: existingMap[text] || false }));
  saveTasks();
  renderTasks();
  updateStats();
  closeModal();
  showToast('Task updated!', 'info');
}
modalClose.addEventListener('click', closeModal);
modalCancel.addEventListener('click', closeModal);
modalSave.addEventListener('click', saveEdit);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
editTitle.addEventListener('keydown', e => { if (e.key === 'Enter') saveEdit(); });

/* ---- Clear Completed ---- */
clearDoneBtn.addEventListener('click', () => {
  const count = tasks.filter(t => t.completed).length;
  if (!count) { showToast('No completed tasks to clear', 'info'); return; }
  tasks = tasks.filter(t => !t.completed);
  saveTasks();
  renderTasks();
  updateStats();
  showToast(`${count} completed task${count > 1 ? 's' : ''} cleared`, 'info');
});

/* ---- Search ---- */
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim().toLowerCase();
  clearSearch.classList.toggle('visible', searchQuery.length > 0);
  renderTasks();
});
clearSearch.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  clearSearch.classList.remove('visible');
  renderTasks();
  searchInput.focus();
});

/* ---- Filter Tabs ---- */
filterTabs.addEventListener('click', e => {
  const tab = e.target.closest('.filter-tab');
  if (!tab) return;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  activeFilter = tab.dataset.filter;
  renderTasks();
});

/* ---- Category Strip ---- */
catStrip.addEventListener('click', e => {
  const chip = e.target.closest('.cat-chip');
  if (!chip) return;
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  activeCat = chip.dataset.cat;
  renderTasks();
});

/* ---- Sort ---- */
sortBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  sortDropdown.classList.toggle('open');
});
sortDropdown.addEventListener('click', e => {
  const opt = e.target.closest('.sort-option');
  if (!opt) return;
  sortMode = opt.dataset.sort;
  sortDropdown.classList.remove('open');
  renderTasks();
  showToast('Sorted!', 'info', 1500);
});
document.addEventListener('click', () => sortDropdown.classList.remove('open'));

/* ---- Drag & Drop ---- */
function setupDrag(el, index) {
  el.setAttribute('draggable', 'true');
  el.addEventListener('dragstart', () => { dragSrcIndex = index; el.classList.add('dragging'); });
  el.addEventListener('dragend',   () => { el.classList.remove('dragging'); document.querySelectorAll('.task-item').forEach(i => i.classList.remove('drag-over')); });
  el.addEventListener('dragover',  e => { e.preventDefault(); el.classList.add('drag-over'); });
  el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
  el.addEventListener('drop', e => {
    e.preventDefault();
    el.classList.remove('drag-over');
    if (dragSrcIndex === null || dragSrcIndex === index) return;
    const visible = getFilteredSorted();
    const srcTask  = tasks.find(t => t.id === visible[dragSrcIndex].id);
    const destTask = tasks.find(t => t.id === visible[index].id);
    const si = tasks.indexOf(srcTask), di = tasks.indexOf(destTask);
    tasks.splice(si, 1); tasks.splice(di, 0, srcTask);
    saveTasks(); renderTasks(); updateStats();
  });
}

/* ---- Filter & Sort Logic ---- */
const PRIORITY_ORDER = { urgent:0, high:1, medium:2, low:3 };

function getFilteredSorted() {
  let result = [...tasks];
  // category filter
  if (activeCat !== 'all') result = result.filter(t => t.category === activeCat);
  // status filter
  const t = today();
  if (activeFilter === 'today')     result = result.filter(t => t.due === today());
  if (activeFilter === 'pending')   result = result.filter(t => !t.completed);
  if (activeFilter === 'completed') result = result.filter(t => t.completed);
  if (activeFilter === 'overdue')   result = result.filter(t => !t.completed && isOverdue(t.due));
  // search
  if (searchQuery) result = result.filter(t => t.title.toLowerCase().includes(searchQuery) || (t.notes && t.notes.toLowerCase().includes(searchQuery)));
  // sort
  result.sort((a, b) => {
    if (sortMode === 'created-desc') return b.createdAt - a.createdAt;
    if (sortMode === 'created-asc')  return a.createdAt - b.createdAt;
    if (sortMode === 'due-asc')      return (a.due || '9999') < (b.due || '9999') ? -1 : 1;
    if (sortMode === 'priority-desc') return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (sortMode === 'alpha-asc')    return a.title.localeCompare(b.title);
    return 0;
  });
  return result;
}

/* ---- Render ---- */
function renderTasks() {
  const filtered = getFilteredSorted();
  taskList.innerHTML = '';
  emptyState.classList.toggle('visible', filtered.length === 0);
  filtered.forEach((task, idx) => {
    const li = document.createElement('li');
    li.className = `task-item${task.completed ? ' completed' : ''}`;
    li.dataset.id = task.id;
    li.dataset.priority = task.priority;

    // Due date badge
    let dueBadge = '';
    if (task.due) {
      const cls = isOverdue(task.due) && !task.completed ? 'overdue-badge' : isToday(task.due) ? 'today-badge' : '';
      const label = isToday(task.due) ? '📅 Today' : isOverdue(task.due) && !task.completed ? `⚠️ ${task.due}` : `📅 ${task.due}`;
      dueBadge = `<span class="task-badge badge-due ${cls}">${label}</span>`;
    }

    // Subtasks HTML
    let subtasksHtml = '';
    if (task.subtasks && task.subtasks.length) {
      const items = task.subtasks.map(s =>
        `<div class="subtask-item${s.done?' done':''}" data-task="${task.id}" data-sub="${s.id}">
           <div class="subtask-check"></div>
           <span>${s.text}</span>
         </div>`
      ).join('');
      subtasksHtml = `<div class="subtask-list">${items}</div>`;
    }

    const catLabels = { personal:'👤 Personal', work:'💼 Work', study:'📚 Study', health:'❤️ Health', finance:'💰 Finance', shopping:'🛒 Shopping' };
    const prioLabels = { low:'🟢 Low', medium:'🟡 Medium', high:'🔴 High', urgent:'🚨 Urgent' };

    li.innerHTML = `
      <div class="task-check${task.completed?' checked':''}" data-id="${task.id}"></div>
      <div class="task-content">
        <div class="task-title-row">
          <div class="task-title">${escapeHtml(task.title)}</div>
        </div>
        ${task.notes ? `<div class="task-notes">${escapeHtml(task.notes)}</div>` : ''}
        <div class="task-meta">
          <span class="task-badge badge-priority-${task.priority}">${prioLabels[task.priority]}</span>
          <span class="task-badge badge-cat">${catLabels[task.category]}</span>
          ${dueBadge}
        </div>
        ${subtasksHtml}
      </div>
      <div class="task-actions">
        <button class="action-btn edit" data-id="${task.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="action-btn delete" data-id="${task.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;

    taskList.appendChild(li);
    setupDrag(li, idx);
  });

  // Event delegation
  taskList.querySelectorAll('.task-check').forEach(el => {
    el.addEventListener('click', () => toggleComplete(el.dataset.id));
  });
  taskList.querySelectorAll('.action-btn.edit').forEach(el => {
    el.addEventListener('click', () => openEdit(el.dataset.id));
  });
  taskList.querySelectorAll('.action-btn.delete').forEach(el => {
    el.addEventListener('click', () => deleteTask(el.dataset.id));
  });
  taskList.querySelectorAll('.subtask-item').forEach(el => {
    el.addEventListener('click', () => toggleSubtask(el.dataset.task, el.dataset.sub));
  });
}

/* ---- Stats & Progress ---- */
function updateStats() {
  const t = today();
  const total     = tasks.length;
  const done      = tasks.filter(x => x.completed).length;
  const todayT    = tasks.filter(x => x.due === t).length;
  const overdue   = tasks.filter(x => !x.completed && isOverdue(x.due)).length;
  const pct       = total === 0 ? 0 : Math.round((done / total) * 100);

  todayCount.textContent   = todayT;
  doneCount.textContent    = done;
  overdueCount.textContent = overdue;
  progressFill.style.width = pct + '%';
  progressPercent.textContent = pct + '%';
  progressGlow.style.opacity = pct > 0 && pct < 100 ? '1' : '0';
}

/* ---- EscapeHtml ---- */
function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ---- Keyboard shortcuts ---- */
document.addEventListener('keydown', e => {
  // Ctrl/Cmd + K = focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    searchInput.focus();
  }
  // Ctrl/Cmd + N = open add form
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    addTaskForm.classList.add('open');
    addChevron.classList.add('open');
    setTimeout(() => taskTitle.focus(), 100);
  }
});

/* ---- Init ---- */
function init() {
  // Theme
  const savedTheme = localStorage.getItem('smarttask_theme') || 'dark';
  applyTheme(savedTheme);
  // Open add-form at start if no tasks yet
  loadTasks();
  if (tasks.length === 0) {
    addTaskForm.classList.add('open');
    addChevron.classList.add('open');
    // Add a sample task for first-timers
    const sample = {
      id: uid(),
      title: '👋 Welcome to SmartTask! Click the checkbox to complete me.',
      notes: 'You can drag to reorder, edit, or delete tasks. Try adding your own!',
      priority: 'medium',
      category: 'personal',
      due: today(),
      subtasks: [
        { id: uid(), text: 'Explore filters & categories', done: false },
        { id: uid(), text: 'Toggle dark / light mode', done: false },
        { id: uid(), text: 'Add your first task', done: false },
      ],
      completed: false,
      createdAt: Date.now(),
    };
    tasks.push(sample);
    saveTasks();
  }
  renderTasks();
  updateStats();
}

init();
