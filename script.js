(() => {
  const STORAGE_KEY = 'focus_list_v3';
  const VIEW_KEY = 'focus_list_view';
  const DAILY_SYNC_KEY = 'focus_list_daily_sync_date';
  const WIP_LIMIT_NOW = 3;

  const ORDER = ['later', 'today', 'now', 'done'];
  const LABELS = {
    later: '나중에',
    today: '오늘 할 일',
    now: '지금',
    done: '완료'
  };

  const SUB_ORDER = ['prep', 'doing', 'done'];
  const SUB_LABELS = {
    prep: '준비',
    doing: '진행',
    done: '끝'
  };

  let tasks = [];
  let currentView = localStorage.getItem(VIEW_KEY) || 'today';

  const el = {
    list: document.getElementById('card-list'),
    tabs: document.querySelectorAll('.tab'),
    quickInput: document.getElementById('quick-input'),
    quickAddBtn: document.getElementById('quick-add-btn'),
    empty: document.getElementById('empty-state'),
    toast: document.getElementById('toast'),
    statDone: document.getElementById('stat-done'),
    statStreak: document.getElementById('stat-streak'),
    statDelta: document.getElementById('stat-delta'),
    statAlive: document.getElementById('stat-alive')
  };

  function seedTasks() {
    return [
      {
        id: crypto.randomUUID(),
        title: '오늘 꼭 하나만 해볼 일을 적어보세요',
        note: '아주 작게 나눠 적으셔도 됩니다. 언제든 바로 수정하실 수 있어요.',
        status: 'today',
        createdAt: Date.now(),
        doneAt: null,
        subtasks: []
      },
      {
        id: crypto.randomUUID(),
        title: '미루고 있던 일을 가볍게 시작해보세요',
        note: '완벽하지 않아도 괜찮습니다. 5분 버전으로 바꿔서 시작해보세요.',
        status: 'today',
        createdAt: Date.now() + 1,
        doneAt: null,
        subtasks: []
      },
      {
        id: crypto.randomUUID(),
        title: '5분 안에 끝낼 수 있는 일을 적어보세요',
        note: '필요 없으면 지우셔도 되고, 지금 바로 완료하셔도 됩니다.',
        status: 'today',
        createdAt: Date.now() + 2,
        doneAt: null,
        subtasks: []
      }
    ];
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      tasks = raw ? JSON.parse(raw) : seedTasks();
      if (!Array.isArray(tasks) || tasks.length === 0) {
        tasks = seedTasks();
      }
      const statusMap = { todo: 'today', progress: 'now', done: 'done', backlog: 'later' };
      tasks = tasks.map((task, index) => {
        const normalizedStatus = statusMap[task.status] || task.status;
        const safeStatus = ORDER.includes(normalizedStatus) ? normalizedStatus : 'today';
        const subtasks = Array.isArray(task.subtasks)
          ? task.subtasks.map((sub) => ({
              id: sub.id || crypto.randomUUID(),
              text: (sub.text || '작은 단계').trim(),
              status: SUB_ORDER.includes(sub.status) ? sub.status : 'prep'
            }))
          : [];
        return {
          id: task.id || crypto.randomUUID(),
          title: task.title || '새 일',
          note: task.note ?? task.body ?? '',
          status: safeStatus,
          createdAt: Number(task.createdAt) || Date.now() + index,
          doneAt: task.doneAt ? Number(task.doneAt) : null,
          repeatDaily: Boolean(task.repeatDaily),
          subtasks
        };
      });
    } catch (error) {
      tasks = seedTasks();
    }

    if (!ORDER.includes(currentView)) {
      currentView = 'today';
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    localStorage.setItem(VIEW_KEY, currentView);
  }

  function runDailyAutoRegistration() {
    const todayKey = localDateKey(Date.now());
    const lastSyncedKey = localStorage.getItem(DAILY_SYNC_KEY);
    if (lastSyncedKey === todayKey) return;

    let updatedCount = 0;
    tasks.forEach((task, index) => {
      if (!task.repeatDaily) return;
      task.status = 'today';
      task.doneAt = null;
      task.createdAt = Date.now() + index;
      updatedCount += 1;
    });

    localStorage.setItem(DAILY_SYNC_KEY, todayKey);
    if (updatedCount > 0) {
      save();
    }
  }

  function localDateKey(timestamp) {
    const d = new Date(timestamp);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getStreak(doneDateSet) {
    let streak = 0;
    const cursor = new Date();
    while (true) {
      const key = localDateKey(cursor.getTime());
      if (!doneDateSet.has(key)) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function renderStats() {
    const todayKey = localDateKey(Date.now());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = localDateKey(yesterday.getTime());

    let doneToday = 0;
    let doneYesterday = 0;
    const doneDates = new Set();

    tasks.forEach((task) => {
      if (!task.doneAt) return;
      const key = localDateKey(task.doneAt);
      doneDates.add(key);
      if (key === todayKey) doneToday += 1;
      if (key === yesterdayKey) doneYesterday += 1;
    });

    const delta = doneToday - doneYesterday;
    const alive = tasks.filter((task) => task.status !== 'done').length;
    const streak = getStreak(doneDates);

    el.statDone.textContent = `오늘 완료한 일: ${doneToday}`;
    el.statStreak.textContent = `연속 ${streak}일째 마무리 중 ${streak >= 2 ? '🔥' : ''}`;
    el.statDelta.textContent = `어제보다 ${delta >= 0 ? '+' : ''}${delta}`;
    el.statAlive.textContent = `아직 살아 있는 일 ${alive}개`;
  }

  function showToast(message, isWarn = false) {
    el.toast.textContent = message;
    el.toast.style.color = isWarn ? 'var(--warn)' : '#ffd54f';
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      el.toast.textContent = '';
    }, 1800);
  }

  function vibrate() {
    if ('vibrate' in navigator) {
      navigator.vibrate(25);
    }
  }

  function moveTask(taskId, direction) {
    const task = tasks.find((x) => x.id === taskId);
    if (!task) return;

    const fromIndex = ORDER.indexOf(task.status);
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= ORDER.length) return;

    const target = ORDER[toIndex];
    if (target === 'now' && task.status !== 'now') {
      const nowCount = tasks.filter((x) => x.status === 'now').length;
      if (nowCount >= WIP_LIMIT_NOW) {
        showToast(`지금 단계는 ${WIP_LIMIT_NOW}개까지만 유지해 주세요.`, true);
        return;
      }
    }

    task.status = target;
    if (target === 'done') {
      task.doneAt = Date.now();
      vibrate();
      showToast('하나 완료하셨어요!');
    }

    save();
    render();
  }

  function toggleDailyAuto(taskId) {
    const task = tasks.find((x) => x.id === taskId);
    if (!task) return;

    task.repeatDaily = !task.repeatDaily;
    showToast(task.repeatDaily ? '매일 자동 등록이 켜졌습니다.' : '매일 자동 등록이 꺼졌습니다.');

    save();
    render();
  }

  function removeTask(taskId) {
    tasks = tasks.filter((x) => x.id !== taskId);
    save();
    render();
  }

  function addTask() {
    const value = el.quickInput.value.trim();
    if (!value) return;

    tasks.unshift({
      id: crypto.randomUUID(),
      title: value,
      note: '',
      status: currentView === 'done' ? 'today' : currentView,
      createdAt: Date.now(),
      doneAt: null,
      repeatDaily: false,
      subtasks: []
    });

    el.quickInput.value = '';
    save();
    render();
  }

  function updateTask(taskId, patch) {
    const task = tasks.find((x) => x.id === taskId);
    if (!task) return;
    Object.assign(task, patch);
    save();
    renderStats();
  }

  function addSubtask(taskId) {
    const task = tasks.find((x) => x.id === taskId);
    if (!task) return;
    if (!Array.isArray(task.subtasks)) task.subtasks = [];
    task.subtasks.push({
      id: crypto.randomUUID(),
      text: '작은 단계',
      status: 'prep'
    });
    save();
    render();
  }

  function cycleSubtask(taskId, subtaskId) {
    const task = tasks.find((x) => x.id === taskId);
    if (!task || !Array.isArray(task.subtasks)) return;
    const subtask = task.subtasks.find((x) => x.id === subtaskId);
    if (!subtask) return;
    const idx = SUB_ORDER.indexOf(subtask.status);
    subtask.status = SUB_ORDER[(idx + 1) % SUB_ORDER.length];
    save();
    render();
  }

  function removeSubtask(taskId, subtaskId) {
    const task = tasks.find((x) => x.id === taskId);
    if (!task || !Array.isArray(task.subtasks)) return;
    task.subtasks = task.subtasks.filter((x) => x.id !== subtaskId);
    save();
    render();
  }

  function updateSubtaskText(taskId, subtaskId, text) {
    const task = tasks.find((x) => x.id === taskId);
    if (!task || !Array.isArray(task.subtasks)) return;
    const subtask = task.subtasks.find((x) => x.id === subtaskId);
    if (!subtask) return;
    subtask.text = text.trim() || '작은 단계';
    save();
    render();
  }

  function subtaskCounts(subtasks) {
    const counts = { prep: 0, doing: 0, done: 0 };
    subtasks.forEach((s) => {
      if (counts[s.status] !== undefined) counts[s.status] += 1;
    });
    return counts;
  }

  function renderCard(task) {
    const li = document.createElement('li');
    li.className = 'card';
    li.dataset.id = task.id;

    const head = document.createElement('div');
    head.className = 'card-head';

    const badge = document.createElement('span');
    badge.className = `badge badge-${task.status}`;
    badge.textContent = LABELS[task.status] || task.status;

    const actions = document.createElement('div');

    const doneBtn = document.createElement('button');
    doneBtn.className = `check-btn ${task.repeatDaily ? 'active' : ''}`;
    doneBtn.type = 'button';
    doneBtn.textContent = task.repeatDaily ? '매일ON' : '매일OFF';
    doneBtn.addEventListener('click', () => toggleDailyAuto(task.id));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = '삭제';
    delBtn.addEventListener('click', () => removeTask(task.id));

    actions.append(doneBtn, delBtn);
    head.append(badge, actions);

    const title = document.createElement('div');
    title.className = 'card-title';
    title.contentEditable = 'true';
    title.spellcheck = false;
    title.textContent = task.title;
    title.addEventListener('blur', () => {
      const next = title.textContent.trim();
      if (next) updateTask(task.id, { title: next });
      else title.textContent = task.title;
    });

    const note = document.createElement('textarea');
    note.className = 'card-note';
    note.placeholder = '메모를 남겨주셔도 좋고, 비워두셔도 괜찮습니다.';
    note.value = task.note || '';
    note.addEventListener('change', () => updateTask(task.id, { note: note.value }));

    li.append(head, title, note);

    const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
    const c = subtaskCounts(subtasks);
    const mini = document.createElement('div');
    mini.className = 'mini-flow';

    const miniHead = document.createElement('div');
    miniHead.className = 'mini-flow-head';
    miniHead.innerHTML = `<span>작은 흐름 ${c.prep}/${c.doing}/${c.done}</span>`;

    const addSubBtn = document.createElement('button');
    addSubBtn.type = 'button';
    addSubBtn.textContent = '+ 작은일';
    addSubBtn.addEventListener('click', () => addSubtask(task.id));
    miniHead.appendChild(addSubBtn);
    mini.appendChild(miniHead);

    subtasks.forEach((sub) => {
      const row = document.createElement('div');
      row.className = `subtask sub-${sub.status}`;

      const text = document.createElement('input');
      text.type = 'text';
      text.value = sub.text;
      text.setAttribute('aria-label', '작은일 내용');
      text.addEventListener('focus', () => {
        if (text.value.trim() === '작은 단계') {
          text.value = '';
        }
      });
      text.addEventListener('change', () => updateSubtaskText(task.id, sub.id, text.value));
      text.addEventListener('blur', () => updateSubtaskText(task.id, sub.id, text.value));

      const stepBtn = document.createElement('button');
      stepBtn.type = 'button';
      stepBtn.textContent = SUB_LABELS[sub.status];
      stepBtn.addEventListener('click', () => cycleSubtask(task.id, sub.id));

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = '삭제';
      removeBtn.addEventListener('click', () => removeSubtask(task.id, sub.id));

      row.append(text, stepBtn, removeBtn);
      mini.appendChild(row);
    });

    li.appendChild(mini);

    wireSwipe(li, task.id);
    return li;
  }

  function wireSwipe(node, taskId) {
    let startX = 0;
    let currentX = 0;
    let dragging = false;

    node.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button, input, textarea, [contenteditable=\"true\"]')) return;
      dragging = true;
      startX = event.clientX;
      currentX = 0;
      node.classList.add('moving');
      node.setPointerCapture(event.pointerId);
    });

    node.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      currentX = event.clientX - startX;
      node.style.transform = `translateX(${Math.max(-120, Math.min(120, currentX))}px)`;
    });

    node.addEventListener('pointerup', (event) => {
      if (!dragging) return;
      dragging = false;
      node.releasePointerCapture(event.pointerId);
      node.classList.remove('moving');

      if (currentX >= 70) {
        moveTask(taskId, 1);
      } else if (currentX <= -70) {
        moveTask(taskId, -1);
      }

      node.style.transform = '';
      currentX = 0;
    });

    node.addEventListener('pointercancel', () => {
      dragging = false;
      node.classList.remove('moving');
      node.style.transform = '';
      currentX = 0;
    });
  }

  function renderTabs() {
    el.tabs.forEach((tab) => {
      const active = tab.dataset.view === currentView;
      tab.classList.toggle('active', active);
    });
  }

  function renderList() {
    el.list.innerHTML = '';

    const viewTasks = tasks
      .filter((task) => task.status === currentView)
      .sort((a, b) => a.createdAt - b.createdAt);

    viewTasks.forEach((task) => {
      el.list.appendChild(renderCard(task));
    });

    el.empty.classList.toggle('hidden', viewTasks.length > 0);
  }

  function render() {
    renderTabs();
    renderList();
    renderStats();
  }

  function bindEvents() {
    el.tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        currentView = tab.dataset.view;
        save();
        render();
      });
    });

    el.quickAddBtn.addEventListener('click', addTask);
    el.quickInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addTask();
      }
    });

  }

  load();
  runDailyAutoRegistration();
  bindEvents();
  render();
  save();
})();

(() => {
  const canvas = document.getElementById('bg-shader');
  if (!canvas) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const div = 11;
  const thickness = 1.05;
  const bgColor = '#f4f0e6';
  const lineColor = 'rgba(92, 76, 47, 0.52)';
  let cols = 0;
  let rows = 0;
  let cellSize = 0;
  let offsetX = 0;
  let offsetY = 0;
  let width = 0;
  let height = 0;
  let frame = 0;
  let rafId = 0;
  let lines = [];

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function buildLine(x, y, angle, on) {
    return {
      x,
      y,
      angle,
      on,
      ampl: 0,
      freq: Math.floor(rand(1, 5)),
      maxAmpl: cellSize * rand(0.08, 0.15),
      speed: rand(0.2, 0.5),
      t0: Math.floor(rand(-1000, -50)),
      t1: 20,
      t2: 100
    };
  }

  function rebuild() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cellSize = Math.max(34, Math.min(width, height) / div);
    cols = Math.ceil(width / cellSize) + 2;
    rows = Math.ceil(height / cellSize) + 2;
    offsetX = (width - (cols * cellSize)) / 2;
    offsetY = (height - (rows * cellSize)) / 2;
    lines = [];

    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const x = i * cellSize + offsetX;
        const y = j * cellSize + offsetY;
        lines.push(buildLine(x, y, 0, Math.random()));
        lines.push(buildLine(x, y, Math.PI / 2, Math.random()));
      }
    }
  }

  function updateLine(line) {
    if (line.on < 0.75) return;

    if (0 <= line.t0 && line.t0 <= line.t1) {
      const p = (line.t0 - 0) / (line.t1 - 0);
      line.ampl = line.maxAmpl * p;
    } else if (line.t1 <= line.t0 && line.t0 <= line.t2) {
      const p = (line.t0 - line.t1) / (line.t2 - line.t1);
      line.ampl = line.maxAmpl * (1 - p);
    } else if (line.t2 <= line.t0) {
      line.t0 = Math.floor(rand(-1500, -300));
      line.ampl = 0;
    }
  }

  function drawLine(line) {
    ctx.save();
    ctx.translate(line.x + cellSize / 2, line.y + cellSize / 2);
    ctx.rotate(line.angle);
    ctx.translate(0, -cellSize / 2);
    ctx.beginPath();

    const steps = Math.max(24, Math.floor(cellSize));
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      const xx = (-cellSize / 2) + (cellSize * t);
      const localAmp = line.ampl * Math.sin(Math.PI * t);
      const yy = localAmp * Math.sin((line.freq * Math.PI * 2 * t) + (frame * line.speed * 0.04));
      if (s === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }

    ctx.stroke();
    ctx.restore();
    line.t0 += 1;
  }

  function drawFrame() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const line of lines) {
      updateLine(line);
      drawLine(line);
    }

    frame += 1;
  }

  function animate() {
    drawFrame();
    if (!prefersReducedMotion) {
      rafId = window.requestAnimationFrame(animate);
    }
  }

  function handleResize() {
    rebuild();
    if (prefersReducedMotion) drawFrame();
  }

  rebuild();
  animate();
  window.addEventListener('resize', handleResize);
  window.addEventListener('pagehide', () => {
    if (rafId) window.cancelAnimationFrame(rafId);
  });
})();
