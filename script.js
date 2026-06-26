

(function(){
"use strict";


const STORAGE_KEY = "cadence_study_planner_v1";

const SUBJECT_COLORS = ["#5EEAD4","#8B7CF6","#FF7A6B","#F4C76B","#60A5FA","#F472B6","#34D399","#FB923C"];
const GRADE_POINTS = {"A":4.0,"A-":3.7,"B+":3.3,"B":3.0,"B-":2.7,"C+":2.3,"C":2.0,"C-":1.7,"D+":1.3,"D":1.0,"F":0.0};

function defaultState(){
  return {
    tasks: [],
    subjects: [],
    notes: [],
    goals: [],
    habits: [],
    sessions: [],          // {id, mode, subjectId, minutes, date, timestamp}
    gpaCourses: [],
    settings: { theme: "dark", name: "Student", durations: { focus:25, short:5, long:15 } }
  };
}

let state = loadState();

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultState(), parsed, {
      settings: Object.assign(defaultState().settings, parsed.settings || {})
    });
  }catch(e){
    console.error("Failed to load state", e);
    return defaultState();
  }
}

function saveState(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }catch(e){
    console.error("Failed to save state", e);
    toast("Couldn't save — storage may be full.", "error");
  }
}

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */
function uid(prefix){ return (prefix||"id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function pad(n){ return n.toString().padStart(2,"0"); }
function fmtDate(d){ return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
function todayStr(){ return fmtDate(new Date()); }
function parseLocalDate(str){ const [y,m,d] = str.split("-").map(Number); return new Date(y, m-1, d); }
function niceDate(str){
  if(!str) return "";
  const d = parseLocalDate(str);
  return d.toLocaleDateString(undefined, { month:"short", day:"numeric" });
}
function escapeHtml(s){
  return (s||"").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function subjectById(id){ return state.subjects.find(s => s.id === id); }
function subjectName(id){ const s = subjectById(id); return s ? s.name : null; }
function subjectColor(id){ const s = subjectById(id); return s ? s.color : "var(--text-3)"; }
function lastNDays(n){
  const out = [];
  for(let i=n-1;i>=0;i--){
    const d = new Date(); d.setDate(d.getDate()-i);
    out.push(fmtDate(d));
  }
  return out;
}
function cssVar(name){ return getComputedStyle(document.body).getPropertyValue(name).trim(); }

let searchTerm = "";

/* ---------------------------------------------------------
   TOASTS
--------------------------------------------------------- */
function toast(message, type){
  const stack = document.getElementById("toastStack");
  const el = document.createElement("div");
  el.className = "toast " + (type === "error" ? "error" : "success");
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

/* ---------------------------------------------------------
   NAVIGATION
--------------------------------------------------------- */
const PAGE_META = {
  dashboard: ["Overview", "Your focus space for the day"],
  tasks: ["Tasks", "Plan, prioritize and complete your work"],
  pomodoro: ["Focus Timer", "Stay in the zone with timed sessions"],
  calendar: ["Calendar", "See everything due, day by day"],
  subjects: ["Subjects", "Organize your coursework"],
  notes: ["Notes", "Lecture notes and quick summaries"],
  goals: ["Goals", "Track progress toward your targets"],
  habits: ["Habits", "Small actions, tracked daily"],
  analytics: ["Analytics", "How your study time breaks down"],
  gpa: ["GPA Calculator", "Estimate your grade point average"],
  settings: ["Settings", "Personalize your planner"]
};

function goToSection(name){
  if(!PAGE_META[name]) return;
  document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.dataset.page === name));
  document.querySelectorAll(".nav-link").forEach(a => a.classList.toggle("active", a.dataset.section === name));
  document.getElementById("pageTitle").textContent = PAGE_META[name][0];
  document.getElementById("pageSubtitle").textContent = PAGE_META[name][1];
  closeSidebar();
  renderPage(name);
  window.scrollTo({top:0, behavior:"smooth"});
}

function renderPage(name){
  switch(name){
    case "dashboard": renderDashboard(); break;
    case "tasks": renderTasks(); break;
    case "pomodoro": renderSessionHistory(); break;
    case "calendar": renderCalendar(); break;
    case "subjects": renderSubjects(); break;
    case "notes": renderNotes(); break;
    case "goals": renderGoals(); break;
    case "habits": renderHabits(); break;
    case "analytics": renderAnalytics(); break;
    case "gpa": renderGpa(); break;
    case "settings": renderSettings(); break;
  }
}

function openSidebar(){ document.getElementById("sidebar").classList.add("open"); document.getElementById("sidebarOverlay").classList.add("open"); }
function closeSidebar(){ document.getElementById("sidebar").classList.remove("open"); document.getElementById("sidebarOverlay").classList.remove("open"); }

/* ---------------------------------------------------------
   THEME
--------------------------------------------------------- */
function applyTheme(theme){
  document.body.setAttribute("data-theme", theme);
  state.settings.theme = theme;
  saveState();
}
function toggleTheme(){
  applyTheme(state.settings.theme === "dark" ? "light" : "dark");
  if(document.querySelector(".page.active")) renderPage(document.querySelector(".page.active").dataset.page);
}

/* ---------------------------------------------------------
   MODALS
--------------------------------------------------------- */
let pendingConfirm = null;

function openModal(modalId){
  document.getElementById("modalOverlay").classList.add("open");
  document.querySelectorAll(".modal").forEach(m => m.classList.toggle("open", m.id === modalId));
}
function closeModals(){
  document.getElementById("modalOverlay").classList.remove("open");
  document.querySelectorAll(".modal").forEach(m => m.classList.remove("open"));
  pendingConfirm = null;
}
function openConfirm(message, onConfirm){
  document.getElementById("confirmMessage").textContent = message;
  pendingConfirm = onConfirm;
  openModal("confirmModal");
}

document.addEventListener("click", (e) => {
  if(e.target === document.getElementById("modalOverlay")) closeModals();
});
document.querySelectorAll(".modal-close").forEach(btn => btn.addEventListener("click", closeModals));
document.addEventListener("keydown", (e) => { if(e.key === "Escape") closeModals(); });
document.getElementById("confirmActionBtn").addEventListener("click", () => {
  if(typeof pendingConfirm === "function") pendingConfirm();
  closeModals();
});

/* ---------------------------------------------------------
   SUBJECT SELECT POPULATION
--------------------------------------------------------- */
function populateSubjectSelects(){
  const selects = [
    document.getElementById("taskSubject"),
    document.getElementById("taskFilterSubject"),
    document.getElementById("noteSubject"),
    document.getElementById("noteFilterSubject"),
    document.getElementById("goalSubject"),
    document.getElementById("timerSubjectSelect")
  ];
  selects.forEach(sel => {
    if(!sel) return;
    const isFilter = sel.id.toLowerCase().includes("filter");
    const keep = sel.value;
    const baseOption = isFilter
      ? '<option value="all">All subjects</option>'
      : '<option value="">No subject</option>';
    sel.innerHTML = baseOption + state.subjects.map(s =>
      `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
    if([...sel.options].some(o => o.value === keep)) sel.value = keep;
  });
}

/* ---------------------------------------------------------
   DASHBOARD
--------------------------------------------------------- */
function hasActivityOnDay(dateStr){
  return state.tasks.some(t => t.completed && t.completedAt === dateStr)
    || state.sessions.some(s => s.mode === "focus" && s.date === dateStr)
    || state.habits.some(h => h.history && h.history[dateStr]);
}
function computeOverallStreak(){
  let streak = 0;
  const cursor = new Date();
  if(!hasActivityOnDay(fmtDate(cursor))) cursor.setDate(cursor.getDate()-1);
  while(hasActivityOnDay(fmtDate(cursor))){
    streak++;
    cursor.setDate(cursor.getDate()-1);
  }
  return streak;
}

function renderDashboard(){
  const name = state.settings.name || "Student";
  const hour = new Date().getHours();
  const greetWord = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  document.getElementById("heroGreeting").textContent = `${greetWord}, ${name}.`;

  const today = todayStr();
  const todaysTasks = state.tasks.filter(t => t.due === today);
  const doneToday = todaysTasks.filter(t => t.completed).length;
  document.getElementById("heroSummary").textContent = todaysTasks.length
    ? `You have ${todaysTasks.length} task${todaysTasks.length===1?"":"s"} due today — ${doneToday} done so far.`
    : "Nothing due today. Good time to get ahead or review your notes.";

  const pct = todaysTasks.length ? Math.round((doneToday/todaysTasks.length)*100) : 0;
  const circumference = 364.4;
  document.getElementById("heroRingProgress").style.strokeDashoffset = circumference - (circumference*pct/100);
  document.getElementById("heroRingValue").textContent = pct + "%";

  document.getElementById("statTasksDone").textContent = `${doneToday}/${todaysTasks.length}`;

  const focusMinutesToday = state.sessions.filter(s => s.mode==="focus" && s.date===today).reduce((a,s)=>a+s.minutes,0);
  document.getElementById("statFocusTime").textContent = focusMinutesToday >= 60
    ? (focusMinutesToday/60).toFixed(1)+"h" : focusMinutesToday+"m";

  const streak = computeOverallStreak();
  document.getElementById("statStreak").textContent = `${streak} day${streak===1?"":"s"}`;
  document.getElementById("streakCount").textContent = streak;

  const goalPct = state.goals.length
    ? Math.round(state.goals.reduce((a,g)=>a+Math.min(100,(g.current/Math.max(1,g.target))*100),0)/state.goals.length)
    : 0;
  document.getElementById("statGoals").textContent = goalPct + "%";

  // Upcoming task list (pending, sorted by due date, next 6)
  const upcoming = state.tasks.filter(t=>!t.completed).sort((a,b)=>(a.due||"9999").localeCompare(b.due||"9999")).slice(0,6);
  const dashTaskList = document.getElementById("dashTaskList");
  dashTaskList.innerHTML = upcoming.length ? upcoming.map(t => `
    <li>
      <span class="tag tag-priority-${t.priority}">${t.priority}</span>
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(t.title)}</span>
      <span class="tag tag-due">${t.due ? niceDate(t.due) : "No date"}</span>
    </li>`).join("") : '<li class="empty-row">All caught up — nothing pending.</li>';

  // Habits today
  const dashHabitList = document.getElementById("dashHabitList");
  dashHabitList.innerHTML = state.habits.length ? state.habits.slice(0,6).map(h => {
    const done = !!(h.history && h.history[today]);
    return `<li><span style="flex:1;">${escapeHtml(h.name)}</span><span class="tag ${done?'tag-priority-low':'tag-due'}">${done?"Done":"Pending"}</span></li>`;
  }).join("") : '<li class="empty-row">No habits yet.</li>';

  // Subjects chip list
  const dashSubjectList = document.getElementById("dashSubjectList");
  dashSubjectList.innerHTML = state.subjects.length ? state.subjects.map(s =>
    `<li class="chip" style="background:${s.color}22;color:${s.color};"><span class="dot" style="background:${s.color}"></span>${escapeHtml(s.name)}</li>`
  ).join("") : '<li class="empty-row">No subjects yet.</li>';

  document.getElementById("navTaskCount").textContent = state.tasks.filter(t=>!t.completed).length;

  renderWeeklyChart();
}

let dashWeeklyChartInstance = null;
function renderWeeklyChart(){
  const days = lastNDays(7);
  const data = days.map(d => state.sessions.filter(s=>s.mode==="focus" && s.date===d).reduce((a,s)=>a+s.minutes,0));
  const labels = days.map(d => parseLocalDate(d).toLocaleDateString(undefined,{weekday:"short"}));
  const canvas = document.getElementById("dashWeeklyChart");
  if(dashWeeklyChartInstance) dashWeeklyChartInstance.destroy();
  dashWeeklyChartInstance = new Chart(canvas, {
    type: "bar",
    data: { labels, datasets:[{ data, backgroundColor: "#5EEAD4", borderRadius:8, maxBarThickness:28 }] },
    options: chartBaseOptions(false)
  });
}

function chartBaseOptions(showLegend){
  const text = cssVar("--text-2") || "#888";
  const grid = cssVar("--track") || "rgba(255,255,255,.08)";
  return {
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{ display: !!showLegend, labels:{ color:text, font:{family:"Plus Jakarta Sans", size:11} } } },
    scales:{
      x:{ ticks:{color:text, font:{size:11}}, grid:{display:false} },
      y:{ ticks:{color:text, font:{size:11}}, grid:{color:grid}, beginAtZero:true }
    }
  };
}

/* ---------------------------------------------------------
   TASKS
--------------------------------------------------------- */
function openTaskModal(id){
  const isEdit = !!id;
  document.getElementById("taskModalTitle").textContent = isEdit ? "Edit task" : "New task";
  const t = isEdit ? state.tasks.find(x=>x.id===id) : null;
  document.getElementById("taskId").value = id || "";
  document.getElementById("taskTitle").value = t ? t.title : "";
  document.getElementById("taskDesc").value = t ? t.desc : "";
  document.getElementById("taskSubject").value = t ? (t.subjectId||"") : "";
  document.getElementById("taskPriority").value = t ? t.priority : "medium";
  document.getElementById("taskDue").value = t ? (t.due||"") : "";
  document.getElementById("taskTime").value = t ? (t.time||"") : "";
  openModal("taskModal");
  document.getElementById("taskTitle").focus();
}

document.getElementById("taskModal").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("taskId").value;
  const payload = {
    title: document.getElementById("taskTitle").value.trim(),
    desc: document.getElementById("taskDesc").value.trim(),
    subjectId: document.getElementById("taskSubject").value,
    priority: document.getElementById("taskPriority").value,
    due: document.getElementById("taskDue").value,
    time: document.getElementById("taskTime").value
  };
  if(!payload.title) return;
  if(id){
    const t = state.tasks.find(x=>x.id===id);
    Object.assign(t, payload);
    toast("Task updated", "success");
  } else {
    state.tasks.push(Object.assign({ id: uid("task"), completed:false, completedAt:null, createdAt: Date.now() }, payload));
    toast("Task added", "success");
  }
  saveState();
  closeModals();
  renderPage(document.querySelector(".page.active").dataset.page);
});

function toggleTaskComplete(id){
  const t = state.tasks.find(x=>x.id===id);
  if(!t) return;
  t.completed = !t.completed;
  t.completedAt = t.completed ? todayStr() : null;
  saveState();
  renderPage(document.querySelector(".page.active").dataset.page);
}
function deleteTask(id){
  openConfirm("Delete this task? This can't be undone.", () => {
    state.tasks = state.tasks.filter(x=>x.id!==id);
    saveState();
    toast("Task deleted", "success");
    renderPage(document.querySelector(".page.active").dataset.page);
  });
}

function renderTasks(){
  const statusF = document.getElementById("taskFilterStatus").value;
  const subjF = document.getElementById("taskFilterSubject").value;
  const prioF = document.getElementById("taskFilterPriority").value;
  const sortBy = document.getElementById("taskSort").value;

  let list = state.tasks.slice();
  if(statusF !== "all") list = list.filter(t => statusF === "completed" ? t.completed : !t.completed);
  if(subjF !== "all") list = list.filter(t => t.subjectId === subjF);
  if(prioF !== "all") list = list.filter(t => t.priority === prioF);
  if(searchTerm) list = list.filter(t => t.title.toLowerCase().includes(searchTerm));

  if(sortBy === "due") list.sort((a,b)=>(a.due||"9999").localeCompare(b.due||"9999"));
  else if(sortBy === "priority"){ const order={high:0,medium:1,low:2}; list.sort((a,b)=>order[a.priority]-order[b.priority]); }
  else list.sort((a,b)=>b.createdAt-a.createdAt);

  const ul = document.getElementById("taskList");
  const empty = document.getElementById("taskEmptyState");
  empty.style.display = list.length ? "none" : "flex";
  ul.innerHTML = list.map(t => {
    const overdue = !t.completed && t.due && t.due < todayStr();
    return `
    <li class="task-item ${t.completed?'completed':''}" data-id="${t.id}">
      <button class="task-check" data-action="toggle" aria-label="Toggle complete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>
      </button>
      <div class="task-body">
        <div class="task-title">${escapeHtml(t.title)}</div>
        ${t.desc ? `<div class="task-desc">${escapeHtml(t.desc)}</div>` : ""}
        <div class="task-meta">
          <span class="tag tag-priority-${t.priority}">${t.priority}</span>
          ${t.subjectId && subjectName(t.subjectId) ? `<span class="tag" style="background:${subjectColor(t.subjectId)}22;color:${subjectColor(t.subjectId)}">${escapeHtml(subjectName(t.subjectId))}</span>` : ""}
          ${t.due ? `<span class="tag tag-due ${overdue?'overdue':''}">${niceDate(t.due)}${t.time?" · "+t.time:""}</span>` : ""}
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-btn" data-action="edit" aria-label="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        <button class="icon-btn" data-action="delete" aria-label="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>
      </div>
    </li>`;
  }).join("");

  document.getElementById("navTaskCount").textContent = state.tasks.filter(t=>!t.completed).length;
}

document.getElementById("taskList").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if(!btn) return;
  const id = btn.closest(".task-item").dataset.id;
  if(btn.dataset.action === "toggle") toggleTaskComplete(id);
  else if(btn.dataset.action === "edit") openTaskModal(id);
  else if(btn.dataset.action === "delete") deleteTask(id);
});
document.getElementById("dashTaskList").addEventListener("click", () => {}); // dashboard list is read-only preview

["taskFilterStatus","taskFilterSubject","taskFilterPriority","taskSort"].forEach(id =>
  document.getElementById(id).addEventListener("change", renderTasks));
document.getElementById("openTaskModal").addEventListener("click", () => openTaskModal());
document.getElementById("heroAddTask").addEventListener("click", () => openTaskModal());
document.getElementById("addTaskQuick").addEventListener("click", () => openTaskModal());

/* ---------------------------------------------------------
   SUBJECTS
--------------------------------------------------------- */
let selectedColor = SUBJECT_COLORS[0];
function buildColorPicker(){
  const row = document.getElementById("subjectColorRow");
  row.innerHTML = SUBJECT_COLORS.map(c =>
    `<span class="color-dot ${c===selectedColor?'selected':''}" data-color="${c}" style="background:${c}"></span>`).join("");
}
document.getElementById("subjectColorRow").addEventListener("click", (e) => {
  const dot = e.target.closest(".color-dot");
  if(!dot) return;
  selectedColor = dot.dataset.color;
  buildColorPicker();
});

function openSubjectModal(id){
  const isEdit = !!id;
  document.getElementById("subjectModalTitle").textContent = isEdit ? "Edit subject" : "New subject";
  const s = isEdit ? state.subjects.find(x=>x.id===id) : null;
  document.getElementById("subjectId").value = id || "";
  document.getElementById("subjectName").value = s ? s.name : "";
  document.getElementById("subjectInstructor").value = s ? s.instructor : "";
  document.getElementById("subjectCredits").value = s ? s.credits : 3;
  selectedColor = s ? s.color : SUBJECT_COLORS[state.subjects.length % SUBJECT_COLORS.length];
  buildColorPicker();
  openModal("subjectModal");
  document.getElementById("subjectName").focus();
}
document.getElementById("subjectModal").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("subjectId").value;
  const payload = {
    name: document.getElementById("subjectName").value.trim(),
    instructor: document.getElementById("subjectInstructor").value.trim(),
    credits: parseFloat(document.getElementById("subjectCredits").value) || 0,
    color: selectedColor
  };
  if(!payload.name) return;
  if(id){
    Object.assign(state.subjects.find(x=>x.id===id), payload);
    toast("Subject updated", "success");
  } else {
    state.subjects.push(Object.assign({ id: uid("subj") }, payload));
    toast("Subject added", "success");
  }
  saveState();
  populateSubjectSelects();
  closeModals();
  renderPage(document.querySelector(".page.active").dataset.page);
});
function deleteSubject(id){
  openConfirm("Delete this subject? Linked tasks and notes will keep their data but lose the subject tag.", () => {
    state.subjects = state.subjects.filter(x=>x.id!==id);
    saveState();
    populateSubjectSelects();
    toast("Subject deleted", "success");
    renderPage(document.querySelector(".page.active").dataset.page);
  });
}

function renderSubjects(){
  const grid = document.getElementById("subjectGrid");
  const empty = document.getElementById("subjectEmptyState");
  let list = state.subjects.slice();
  if(searchTerm) list = list.filter(s => s.name.toLowerCase().includes(searchTerm));
  empty.style.display = list.length ? "none" : "flex";

  const cards = list.map(s => {
    const taskCount = state.tasks.filter(t=>t.subjectId===s.id).length;
    const noteCount = state.notes.filter(n=>n.subjectId===s.id).length;
    return `
    <div class="subject-card glass" style="--card-color:${s.color}" data-id="${s.id}">
      <div class="card-actions">
        <button class="icon-btn" data-action="edit"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        <button class="icon-btn" data-action="delete"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>
      </div>
      <div class="subject-card-head">
        <span class="subject-dot" style="background:${s.color}"></span>
        <h4>${escapeHtml(s.name)}</h4>
      </div>
      ${s.instructor ? `<p class="muted" style="font-size:12px;color:var(--text-3)">${escapeHtml(s.instructor)}</p>` : ""}
      <div class="subject-meta">
        <span><strong>${s.credits}</strong> credits</span>
        <span><strong>${taskCount}</strong> tasks</span>
        <span><strong>${noteCount}</strong> notes</span>
      </div>
    </div>`;
  }).join("");
  grid.innerHTML = cards + (list.length ? "" : "") ;
  if(!list.length) grid.appendChild(empty);
}
document.getElementById("subjectGrid").addEventListener("click", (e) => {
  const card = e.target.closest(".subject-card");
  if(!card) return;
  const btn = e.target.closest("button[data-action]");
  if(!btn) return;
  const id = card.dataset.id;
  if(btn.dataset.action === "edit") openSubjectModal(id);
  else deleteSubject(id);
});
document.getElementById("openSubjectModal").addEventListener("click", () => openSubjectModal());

/* ---------------------------------------------------------
   NOTES
--------------------------------------------------------- */
function openNoteModal(id){
  const isEdit = !!id;
  document.getElementById("noteModalTitle").textContent = isEdit ? "Edit note" : "New note";
  const n = isEdit ? state.notes.find(x=>x.id===id) : null;
  document.getElementById("noteId").value = id || "";
  document.getElementById("noteTitle").value = n ? n.title : "";
  document.getElementById("noteSubject").value = n ? (n.subjectId||"") : "";
  document.getElementById("noteContent").value = n ? n.content : "";
  openModal("noteModal");
  document.getElementById("noteTitle").focus();
}
document.getElementById("noteModal").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("noteId").value;
  const payload = {
    title: document.getElementById("noteTitle").value.trim(),
    subjectId: document.getElementById("noteSubject").value,
    content: document.getElementById("noteContent").value.trim()
  };
  if(!payload.title) return;
  if(id){
    Object.assign(state.notes.find(x=>x.id===id), payload, { updatedAt: Date.now() });
    toast("Note updated", "success");
  } else {
    state.notes.push(Object.assign({ id: uid("note"), createdAt: Date.now(), updatedAt: Date.now() }, payload));
    toast("Note added", "success");
  }
  saveState();
  closeModals();
  renderNotes();
});
function deleteNote(id){
  openConfirm("Delete this note?", () => {
    state.notes = state.notes.filter(x=>x.id!==id);
    saveState();
    toast("Note deleted", "success");
    renderNotes();
  });
}
function renderNotes(){
  const subjF = document.getElementById("noteFilterSubject").value;
  let list = state.notes.slice().sort((a,b)=>b.updatedAt-a.updatedAt);
  if(subjF !== "all") list = list.filter(n=>n.subjectId===subjF);
  if(searchTerm) list = list.filter(n => n.title.toLowerCase().includes(searchTerm) || n.content.toLowerCase().includes(searchTerm));

  const grid = document.getElementById("noteGrid");
  const empty = document.getElementById("noteEmptyState");
  empty.style.display = list.length ? "none" : "flex";

  grid.innerHTML = list.map(n => `
    <div class="note-card glass" data-id="${n.id}">
      <div class="card-actions">
        <button class="icon-btn" data-action="edit"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        <button class="icon-btn" data-action="delete"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>
      </div>
      <h4>${escapeHtml(n.title)}</h4>
      <p>${escapeHtml(n.content) || "No content yet."}</p>
      <div class="note-card-foot">
        ${n.subjectId && subjectName(n.subjectId) ? `<span class="tag" style="background:${subjectColor(n.subjectId)}22;color:${subjectColor(n.subjectId)}">${escapeHtml(subjectName(n.subjectId))}</span>` : "<span></span>"}
        <span class="muted-tag">${new Date(n.updatedAt).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</span>
      </div>
    </div>`).join("");
  if(!list.length) grid.appendChild(empty);
}
document.getElementById("noteGrid").addEventListener("click", (e) => {
  const card = e.target.closest(".note-card");
  if(!card) return;
  const btn = e.target.closest("button[data-action]");
  if(!btn) return;
  const id = card.dataset.id;
  if(btn.dataset.action === "edit") openNoteModal(id);
  else deleteNote(id);
});
document.getElementById("openNoteModal").addEventListener("click", () => openNoteModal());
document.getElementById("noteFilterSubject").addEventListener("change", renderNotes);

/* ---------------------------------------------------------
   GOALS
--------------------------------------------------------- */
function openGoalModal(id){
  const isEdit = !!id;
  document.getElementById("goalModalTitle").textContent = isEdit ? "Edit goal" : "New goal";
  const g = isEdit ? state.goals.find(x=>x.id===id) : null;
  document.getElementById("goalId").value = id || "";
  document.getElementById("goalTitle").value = g ? g.title : "";
  document.getElementById("goalSubject").value = g ? (g.subjectId||"") : "";
  document.getElementById("goalTarget").value = g ? g.target : 10;
  document.getElementById("goalCurrent").value = g ? g.current : 0;
  document.getElementById("goalDue").value = g ? (g.due||"") : "";
  openModal("goalModal");
  document.getElementById("goalTitle").focus();
}
document.getElementById("goalModal").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("goalId").value;
  const payload = {
    title: document.getElementById("goalTitle").value.trim(),
    subjectId: document.getElementById("goalSubject").value,
    target: parseFloat(document.getElementById("goalTarget").value) || 1,
    current: parseFloat(document.getElementById("goalCurrent").value) || 0,
    due: document.getElementById("goalDue").value
  };
  if(!payload.title) return;
  if(id){
    Object.assign(state.goals.find(x=>x.id===id), payload);
    toast("Goal updated", "success");
  } else {
    state.goals.push(Object.assign({ id: uid("goal"), createdAt: Date.now() }, payload));
    toast("Goal added", "success");
  }
  saveState();
  closeModals();
  renderGoals();
});
function deleteGoal(id){
  openConfirm("Delete this goal?", () => {
    state.goals = state.goals.filter(x=>x.id!==id);
    saveState();
    toast("Goal deleted", "success");
    renderGoals();
  });
}
function bumpGoal(id, delta){
  const g = state.goals.find(x=>x.id===id);
  if(!g) return;
  g.current = Math.max(0, Math.min(g.target, g.current+delta));
  saveState();
  renderGoals();
}
function renderGoals(){
  let list = state.goals.slice();
  if(searchTerm) list = list.filter(g => g.title.toLowerCase().includes(searchTerm));
  const grid = document.getElementById("goalGrid");
  const empty = document.getElementById("goalEmptyState");
  empty.style.display = list.length ? "none" : "flex";

  grid.innerHTML = list.map(g => {
    const pct = Math.min(100, Math.round((g.current/Math.max(1,g.target))*100));
    return `
    <div class="goal-card glass" data-id="${g.id}">
      <div class="card-actions">
        <button class="icon-btn" data-action="edit"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        <button class="icon-btn" data-action="delete"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>
      </div>
      <h4>${escapeHtml(g.title)}</h4>
      ${g.subjectId && subjectName(g.subjectId) ? `<span class="tag" style="background:${subjectColor(g.subjectId)}22;color:${subjectColor(g.subjectId)}">${escapeHtml(subjectName(g.subjectId))}</span>` : ""}
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="goal-foot">
        <span><strong>${g.current}</strong> / ${g.target}</span>
        <span>${g.due ? "Due " + niceDate(g.due) : "No deadline"}</span>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button class="btn btn-ghost btn-sm" data-action="dec">−1</button>
        <button class="btn btn-ghost btn-sm" data-action="inc">+1</button>
      </div>
    </div>`;
  }).join("");
  if(!list.length) grid.appendChild(empty);
}
document.getElementById("goalGrid").addEventListener("click", (e) => {
  const card = e.target.closest(".goal-card");
  if(!card) return;
  const btn = e.target.closest("button[data-action]");
  if(!btn) return;
  const id = card.dataset.id;
  if(btn.dataset.action === "edit") openGoalModal(id);
  else if(btn.dataset.action === "delete") deleteGoal(id);
  else if(btn.dataset.action === "inc") bumpGoal(id, 1);
  else if(btn.dataset.action === "dec") bumpGoal(id, -1);
});
document.getElementById("openGoalModal").addEventListener("click", () => openGoalModal());

/* ---------------------------------------------------------
   HABITS
--------------------------------------------------------- */
function openHabitModal(id){
  const isEdit = !!id;
  document.getElementById("habitModalTitle").textContent = isEdit ? "Edit habit" : "New habit";
  const h = isEdit ? state.habits.find(x=>x.id===id) : null;
  document.getElementById("habitId").value = id || "";
  document.getElementById("habitName").value = h ? h.name : "";
  document.getElementById("habitFrequency").value = h ? h.frequency : "daily";
  openModal("habitModal");
  document.getElementById("habitName").focus();
}
document.getElementById("habitModal").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("habitId").value;
  const payload = {
    name: document.getElementById("habitName").value.trim(),
    frequency: document.getElementById("habitFrequency").value
  };
  if(!payload.name) return;
  if(id){
    Object.assign(state.habits.find(x=>x.id===id), payload);
    toast("Habit updated", "success");
  } else {
    state.habits.push(Object.assign({ id: uid("habit"), history:{}, createdAt: Date.now() }, payload));
    toast("Habit added", "success");
  }
  saveState();
  closeModals();
  renderHabits();
});
function deleteHabit(id){
  openConfirm("Delete this habit and its history?", () => {
    state.habits = state.habits.filter(x=>x.id!==id);
    saveState();
    toast("Habit deleted", "success");
    renderHabits();
  });
}
function toggleHabitToday(id){
  const h = state.habits.find(x=>x.id===id);
  if(!h) return;
  h.history = h.history || {};
  const t = todayStr();
  if(h.history[t]) delete h.history[t]; else h.history[t] = true;
  saveState();
  renderHabits();
}
function computeHabitStreak(h){
  let streak = 0;
  const cursor = new Date();
  function isCheckedOrSkippable(dateStr, d){
    if(h.history && h.history[dateStr]) return "checked";
    if(h.frequency === "weekday" && (d.getDay()===0 || d.getDay()===6)) return "skip";
    return "miss";
  }
  let status = isCheckedOrSkippable(fmtDate(cursor), cursor);
  if(status === "miss") cursor.setDate(cursor.getDate()-1);
  while(true){
    status = isCheckedOrSkippable(fmtDate(cursor), cursor);
    if(status === "checked"){ streak++; cursor.setDate(cursor.getDate()-1); }
    else if(status === "skip"){ cursor.setDate(cursor.getDate()-1); }
    else break;
  }
  return streak;
}
function renderHabits(){
  let list = state.habits.slice();
  if(searchTerm) list = list.filter(h => h.name.toLowerCase().includes(searchTerm));
  const wrap = document.getElementById("habitListWrap");
  const empty = document.getElementById("habitEmptyState");
  empty.style.display = list.length ? "none" : "flex";
  const today = todayStr();
  const week = lastNDays(7);

  wrap.innerHTML = list.map(h => {
    const done = !!(h.history && h.history[today]);
    const streak = computeHabitStreak(h);
    const weekDots = week.map(d => `<span class="${h.history && h.history[d] ? 'filled':''}"></span>`).join("");
    return `
    <div class="habit-row glass" data-id="${h.id}">
      <button class="habit-check ${done?'done':''}" data-action="toggle" aria-label="Toggle today">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>
      </button>
      <div class="habit-info">
        <h4>${escapeHtml(h.name)}</h4>
        <span>${h.frequency === "weekday" ? "Weekdays" : "Every day"}</span>
      </div>
      <div class="habit-week">${weekDots}</div>
      <div class="habit-flame">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2c1 4-4 5-4 9a4 4 0 0 0 8 0c0-1.5-1-2-1-3.5 1.5 1 3 3 3 5.5a6 6 0 1 1-12 0c0-5 4-6 6-11Z"/></svg>
        ${streak}
      </div>
      <div class="task-actions">
        <button class="icon-btn" data-action="edit"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        <button class="icon-btn" data-action="delete"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>
      </div>
    </div>`;
  }).join("");
  if(!list.length) wrap.appendChild(empty);
}
document.getElementById("habitListWrap").addEventListener("click", (e) => {
  const row = e.target.closest(".habit-row");
  if(!row) return;
  const btn = e.target.closest("button[data-action]");
  if(!btn) return;
  const id = row.dataset.id;
  if(btn.dataset.action === "toggle") toggleHabitToday(id);
  else if(btn.dataset.action === "edit") openHabitModal(id);
  else if(btn.dataset.action === "delete") deleteHabit(id);
});
document.getElementById("openHabitModal").addEventListener("click", () => openHabitModal());

/* ---------------------------------------------------------
   POMODORO TIMER
--------------------------------------------------------- */
const timer = {
  mode: "focus",
  remaining: 0,
  total: 0,
  running: false,
  intervalId: null
};

function durationFor(mode){
  const d = state.settings.durations;
  return (mode === "focus" ? d.focus : mode === "short" ? d.short : d.long) * 60;
}
function setMode(mode, resetTime){
  timer.mode = mode;
  document.querySelectorAll(".mode-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
  document.getElementById("timerSessionLabel").textContent = mode === "focus" ? "Focus session" : mode === "short" ? "Short break" : "Long break";
  if(resetTime !== false){
    pauseTimer();
    timer.total = durationFor(mode);
    timer.remaining = timer.total;
    updateTimerDisplay();
  }
}
function updateTimerDisplay(){
  const m = Math.floor(timer.remaining/60), s = timer.remaining%60;
  document.getElementById("timerDisplay").textContent = `${pad(m)}:${pad(s)}`;
  const circumference = 754;
  const pct = timer.total ? (timer.total - timer.remaining)/timer.total : 0;
  document.getElementById("timerProgress").style.strokeDashoffset = circumference - circumference*pct;
  const ringColor = timer.mode === "focus" ? "#5EEAD4" : timer.mode === "short" ? "#8B7CF6" : "#F4C76B";
  document.getElementById("timerProgress").style.stroke = ringColor;
}
function startTimer(){
  if(timer.running) return;
  if(timer.remaining <= 0) timer.remaining = durationFor(timer.mode);
  timer.running = true;
  document.querySelector(".timer-ring-wrap").classList.add("running");
  document.getElementById("iconPlay").style.display = "none";
  document.getElementById("iconPause").style.display = "block";
  document.getElementById("timerBtnLabel").textContent = "Pause";
  timer.intervalId = setInterval(() => {
    timer.remaining--;
    updateTimerDisplay();
    if(timer.remaining <= 0){
      completeSession();
    }
  }, 1000);
}
function pauseTimer(){
  timer.running = false;
  clearInterval(timer.intervalId);
  document.querySelector(".timer-ring-wrap").classList.remove("running");
  document.getElementById("iconPlay").style.display = "block";
  document.getElementById("iconPause").style.display = "none";
  document.getElementById("timerBtnLabel").textContent = "Start";
}
function resetTimer(){
  pauseTimer();
  timer.total = durationFor(timer.mode);
  timer.remaining = timer.total;
  updateTimerDisplay();
}
function skipTimer(){
  pauseTimer();
  cycleMode();
}
function cycleMode(){
  const next = timer.mode === "focus" ? "short" : "focus";
  setMode(next);
}
function completeSession(){
  pauseTimer();
  const minutes = Math.round(durationFor(timer.mode)/60);
  state.sessions.push({
    id: uid("sess"), mode: timer.mode,
    subjectId: document.getElementById("timerSubjectSelect").value,
    minutes, date: todayStr(), timestamp: Date.now()
  });
  saveState();
  toast(timer.mode === "focus" ? "Focus session complete — nice work!" : "Break's over, back to it.", "success");
  renderSessionHistory();
  if(document.querySelector('.page[data-page="dashboard"]').classList.contains("active")) renderDashboard();
  cycleMode();
}
document.querySelectorAll(".mode-btn").forEach(btn => btn.addEventListener("click", () => setMode(btn.dataset.mode)));
document.getElementById("timerStartPause").addEventListener("click", () => timer.running ? pauseTimer() : startTimer());
document.getElementById("timerReset").addEventListener("click", resetTimer);
document.getElementById("timerSkip").addEventListener("click", skipTimer);
document.getElementById("heroStartFocus").addEventListener("click", () => { goToSection("pomodoro"); });

["durFocus","durShort","durLong"].forEach(id => {
  document.getElementById(id).addEventListener("change", (e) => {
    const map = { durFocus:"focus", durShort:"short", durLong:"long" };
    state.settings.durations[map[id]] = Math.max(1, parseInt(e.target.value) || 1);
    saveState();
    if(timer.mode === map[id] && !timer.running) resetTimer();
  });
});

function renderSessionHistory(){
  const today = todayStr();
  const todays = state.sessions.filter(s => s.date === today).sort((a,b)=>b.timestamp-a.timestamp);
  document.getElementById("sessionTodayCount").textContent = `${todays.filter(s=>s.mode==='focus').length} today`;
  const list = document.getElementById("sessionHistoryList");
  list.innerHTML = todays.length ? todays.map(s => `
    <li>
      <span class="tag tag-priority-${s.mode==='focus'?'high':'low'}">${s.mode==='focus'?'Focus':s.mode==='short'?'Short break':'Long break'}</span>
      <span style="flex:1">${s.minutes} min${s.subjectId && subjectName(s.subjectId) ? " · "+escapeHtml(subjectName(s.subjectId)) : ""}</span>
      <span class="tag tag-due">${new Date(s.timestamp).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</span>
    </li>`).join("") : '<li class="empty-row">No sessions yet today.</li>';
}

/* ---------------------------------------------------------
   CALENDAR
--------------------------------------------------------- */
let calView = { year: new Date().getFullYear(), month: new Date().getMonth() };
let calSelected = todayStr();

function renderCalendar(){
  const first = new Date(calView.year, calView.month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(calView.year, calView.month+1, 0).getDate();
  const daysInPrevMonth = new Date(calView.year, calView.month, 0).getDate();

  document.getElementById("calMonthLabel").textContent = first.toLocaleDateString(undefined, { month:"long", year:"numeric" });

  const cells = [];
  for(let i=startDay-1;i>=0;i--) cells.push({ day: daysInPrevMonth-i, muted:true, dateStr:null });
  for(let d=1; d<=daysInMonth; d++){
    const dateStr = `${calView.year}-${pad(calView.month+1)}-${pad(d)}`;
    cells.push({ day:d, muted:false, dateStr });
  }
  while(cells.length % 7 !== 0) cells.push({ day: cells.length, muted:true, dateStr:null });

  const today = todayStr();
  const grid = document.getElementById("calendarGrid");
  grid.innerHTML = cells.map(c => {
    const tasksOnDay = c.dateStr ? state.tasks.filter(t=>t.due===c.dateStr) : [];
    const dots = tasksOnDay.slice(0,4).map(t => `<span style="background:${t.subjectId && subjectColor(t.subjectId) !== 'var(--text-3)' ? subjectColor(t.subjectId) : 'var(--mint)'}"></span>`).join("");
    const classes = ["cal-cell"];
    if(c.muted) classes.push("muted");
    if(c.dateStr === today) classes.push("today");
    if(c.dateStr === calSelected) classes.push("selected");
    return `<div class="${classes.join(' ')}" data-date="${c.dateStr||''}">
      <span class="cal-num">${c.day}</span>
      <div class="cal-dots">${dots}</div>
    </div>`;
  }).join("");

  renderCalendarDay();
}
function renderCalendarDay(){
  const tasksOnDay = state.tasks.filter(t=>t.due===calSelected);
  document.getElementById("calDaySelectedLabel").textContent = calSelected ? parseLocalDate(calSelected).toLocaleDateString(undefined,{weekday:"long", month:"long", day:"numeric"}) : "Select a day";
  const list = document.getElementById("calDayTasks");
  list.innerHTML = tasksOnDay.length ? tasksOnDay.map(t => `
    <li>
      <span class="tag tag-priority-${t.priority}">${t.priority}</span>
      <span style="flex:1">${escapeHtml(t.title)}${t.time ? " · "+t.time : ""}</span>
      <span class="tag ${t.completed?'tag-priority-low':'tag-due'}">${t.completed?"Done":"Pending"}</span>
    </li>`).join("") : '<li class="empty-row">Nothing scheduled.</li>';
}
document.getElementById("calendarGrid").addEventListener("click", (e) => {
  const cell = e.target.closest(".cal-cell");
  if(!cell || !cell.dataset.date) return;
  calSelected = cell.dataset.date;
  renderCalendar();
});
document.getElementById("calPrev").addEventListener("click", () => {
  calView.month--; if(calView.month<0){calView.month=11; calView.year--;}
  renderCalendar();
});
document.getElementById("calNext").addEventListener("click", () => {
  calView.month++; if(calView.month>11){calView.month=0; calView.year++;}
  renderCalendar();
});
document.getElementById("calToday").addEventListener("click", () => {
  const now = new Date();
  calView.year = now.getFullYear(); calView.month = now.getMonth(); calSelected = todayStr();
  renderCalendar();
});

/* ---------------------------------------------------------
   ANALYTICS
--------------------------------------------------------- */
let chartFocusTrendInst=null, chartSubjectTimeInst=null, chartTaskStatusInst=null, chartHabitConsistencyInst=null;

function renderAnalytics(){
  const days14 = lastNDays(14);

  // Focus trend
  const focusData = days14.map(d => state.sessions.filter(s=>s.mode==="focus" && s.date===d).reduce((a,s)=>a+s.minutes,0));
  if(chartFocusTrendInst) chartFocusTrendInst.destroy();
  chartFocusTrendInst = new Chart(document.getElementById("chartFocusTrend"), {
    type:"line",
    data:{ labels: days14.map(d=>niceDate(d)), datasets:[{
      data:focusData, borderColor:"#5EEAD4", backgroundColor:"rgba(94,234,212,.18)",
      fill:true, tension:.35, pointRadius:0, borderWidth:2.5
    }]},
    options: chartBaseOptions(false)
  });

  // Time by subject (focus minutes)
  const subjMinutes = state.subjects.map(s => ({
    name:s.name, color:s.color,
    minutes: state.sessions.filter(sess=>sess.mode==="focus" && sess.subjectId===s.id).reduce((a,sess)=>a+sess.minutes,0)
  })).filter(x=>x.minutes>0);
  if(chartSubjectTimeInst) chartSubjectTimeInst.destroy();
  chartSubjectTimeInst = new Chart(document.getElementById("chartSubjectTime"), {
    type:"doughnut",
    data:{ labels: subjMinutes.length?subjMinutes.map(s=>s.name):["No data yet"],
      datasets:[{ data: subjMinutes.length?subjMinutes.map(s=>s.minutes):[1],
        backgroundColor: subjMinutes.length?subjMinutes.map(s=>s.color):["#3a4156"], borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:"68%",
      plugins:{ legend:{ position:"bottom", labels:{ color: cssVar("--text-2"), font:{size:10.5}, boxWidth:10 } } } }
  });

  // Task completion
  const completed = state.tasks.filter(t=>t.completed).length;
  const pending = state.tasks.filter(t=>!t.completed).length;
  if(chartTaskStatusInst) chartTaskStatusInst.destroy();
  chartTaskStatusInst = new Chart(document.getElementById("chartTaskStatus"), {
    type:"doughnut",
    data:{ labels:["Completed","Pending"], datasets:[{ data:(completed+pending)?[completed,pending]:[1],
      backgroundColor:(completed+pending)?["#5EEAD4","#3a4156"]:["#3a4156"], borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:"68%",
      plugins:{ legend:{ position:"bottom", labels:{ color: cssVar("--text-2"), font:{size:10.5}, boxWidth:10 } } } }
  });

  // Habit consistency
  const habitPct = days14.map(d => {
    if(!state.habits.length) return 0;
    const checked = state.habits.filter(h=>h.history && h.history[d]).length;
    return Math.round((checked/state.habits.length)*100);
  });
  if(chartHabitConsistencyInst) chartHabitConsistencyInst.destroy();
  chartHabitConsistencyInst = new Chart(document.getElementById("chartHabitConsistency"), {
    type:"bar",
    data:{ labels: days14.map(d=>niceDate(d)), datasets:[{ data:habitPct, backgroundColor:"#8B7CF6", borderRadius:6, maxBarThickness:22 }] },
    options: Object.assign(chartBaseOptions(false), { scales: Object.assign({}, chartBaseOptions(false).scales, { y:{ beginAtZero:true, max:100, ticks:{color:cssVar("--text-2")}, grid:{color:cssVar("--track")} } }) })
  });
}

/* ---------------------------------------------------------
   GPA CALCULATOR
--------------------------------------------------------- */
function gradeOptions(selected){
  return Object.keys(GRADE_POINTS).map(g => `<option value="${g}" ${g===selected?"selected":""}>${g}</option>`).join("");
}
function addGpaRow(prefill){
  state.gpaCourses.push(Object.assign({ id: uid("gpa"), name:"New course", credits:3, grade:"A" }, prefill||{}));
  saveState();
  renderGpa();
}
function renderGpa(){
  if(!state.gpaCourses.length){
    if(state.subjects.length){
      state.subjects.forEach(s => state.gpaCourses.push({ id: uid("gpa"), name:s.name, credits:s.credits||3, grade:"A" }));
    } else {
      addGpaRow({name:"Course 1"});
      addGpaRow({name:"Course 2"});
      return;
    }
    saveState();
  }
  const tbody = document.getElementById("gpaTableBody");
  tbody.innerHTML = state.gpaCourses.map(c => `
    <tr data-id="${c.id}">
      <td><input type="text" class="gpa-name" value="${escapeHtml(c.name)}"></td>
      <td><input type="number" class="gpa-credits" min="0" step="0.5" value="${c.credits}"></td>
      <td><select class="gpa-grade">${gradeOptions(c.grade)}</select></td>
      <td><button type="button" class="icon-btn gpa-remove" aria-label="Remove"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button></td>
    </tr>`).join("");
  computeGpa();
}
function computeGpa(){
  let totalCredits = 0, totalPoints = 0;
  state.gpaCourses.forEach(c => {
    totalCredits += c.credits;
    totalPoints += c.credits * (GRADE_POINTS[c.grade] ?? 0);
  });
  const gpa = totalCredits ? (totalPoints/totalCredits) : 0;
  document.getElementById("gpaResultValue").textContent = gpa.toFixed(2);
  document.getElementById("gpaResultCredits").textContent = `${totalCredits} total credit hour${totalCredits===1?"":"s"}`;
}
document.getElementById("gpaTableBody").addEventListener("input", (e) => {
  const tr = e.target.closest("tr"); if(!tr) return;
  const c = state.gpaCourses.find(x=>x.id===tr.dataset.id); if(!c) return;
  if(e.target.classList.contains("gpa-name")) c.name = e.target.value;
  if(e.target.classList.contains("gpa-credits")) c.credits = parseFloat(e.target.value)||0;
  saveState();
  computeGpa();
});
document.getElementById("gpaTableBody").addEventListener("change", (e) => {
  const tr = e.target.closest("tr"); if(!tr) return;
  const c = state.gpaCourses.find(x=>x.id===tr.dataset.id); if(!c) return;
  if(e.target.classList.contains("gpa-grade")) c.grade = e.target.value;
  saveState();
  computeGpa();
});
document.getElementById("gpaTableBody").addEventListener("click", (e) => {
  const btn = e.target.closest(".gpa-remove"); if(!btn) return;
  const tr = btn.closest("tr");
  state.gpaCourses = state.gpaCourses.filter(x=>x.id!==tr.dataset.id);
  saveState();
  renderGpa();
});
document.getElementById("gpaAddRow").addEventListener("click", () => addGpaRow());

/* ---------------------------------------------------------
   SETTINGS
--------------------------------------------------------- */
function renderSettings(){
  document.getElementById("settingName").value = state.settings.name || "";
}
document.getElementById("settingName").addEventListener("input", (e) => {
  state.settings.name = e.target.value;
  document.getElementById("userAvatar").textContent = (e.target.value||"S").trim().charAt(0).toUpperCase() || "S";
  saveState();
});
document.getElementById("settingsThemeToggle").addEventListener("click", toggleTheme);
document.getElementById("exportData").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "cadence-study-planner-backup.json";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast("Data exported", "success");
});
document.getElementById("importData").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      state = Object.assign(defaultState(), parsed, { settings: Object.assign(defaultState().settings, parsed.settings||{}) });
      saveState();
      applyTheme(state.settings.theme);
      populateSubjectSelects();
      initAfterLoad();
      toast("Data imported successfully", "success");
    }catch(err){
      toast("That file couldn't be read as valid backup data.", "error");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});
document.getElementById("resetData").addEventListener("click", () => {
  openConfirm("This permanently deletes all tasks, notes, subjects, goals, habits and sessions stored on this device. Continue?", () => {
    localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    saveState();
    applyTheme("dark");
    populateSubjectSelects();
    initAfterLoad();
    toast("All data reset", "success");
  });
});

/* ---------------------------------------------------------
   GLOBAL SEARCH
--------------------------------------------------------- */
document.getElementById("globalSearch").addEventListener("input", (e) => {
  searchTerm = e.target.value.trim().toLowerCase();
  const active = document.querySelector(".page.active").dataset.page;
  if(["tasks","notes","subjects","goals","habits"].includes(active)) renderPage(active);
});

/* ---------------------------------------------------------
   NAV WIRING
--------------------------------------------------------- */
document.querySelectorAll(".nav-link, .link-nav").forEach(el => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    goToSection(el.dataset.section);
  });
});
document.getElementById("menuBtn").addEventListener("click", openSidebar);
document.getElementById("sidebarClose").addEventListener("click", closeSidebar);
document.getElementById("sidebarOverlay").addEventListener("click", closeSidebar);
document.getElementById("themeToggle").addEventListener("click", toggleTheme);

/* ---------------------------------------------------------
   INIT
--------------------------------------------------------- */
function initAfterLoad(){
  populateSubjectSelects();
  document.getElementById("durFocus").value = state.settings.durations.focus;
  document.getElementById("durShort").value = state.settings.durations.short;
  document.getElementById("durLong").value = state.settings.durations.long;
  document.getElementById("userAvatar").textContent = (state.settings.name||"S").trim().charAt(0).toUpperCase() || "S";
  setMode("focus");
  goToSection("dashboard");
}

applyTheme(state.settings.theme || "dark");
initAfterLoad();

})();