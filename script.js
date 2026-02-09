document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let tasks = [];
    const LOCAL_STORAGE_KEY = 'brutalist_kanban_data';
    let currentTheme = localStorage.getItem('theme') || 'light-mode';

    // --- DOM ELEMENTS ---
    const body = document.body;
    const toggleBtn = document.getElementById('theme-toggle');
    const saveBtn = document.getElementById('save-data-btn');
    const saveStatus = document.getElementById('save-status');
    const modal = document.getElementById('card-modal');
    const closeModalBtn = document.querySelector('.close-modal-btn');
    const confirmAddBtn = document.getElementById('confirm-add-btn');

    // Inputs
    const inputId = document.getElementById('input-id');
    const inputTitle = document.getElementById('input-title');
    const inputDetails = document.getElementById('input-details');
    const inputTag = document.getElementById('input-tag');

    let currentAddColumnId = null;

    // --- INITIALIZATION ---
    function init() {
        // Load Theme
        if (currentTheme === 'dark-mode') {
            enableDarkMode();
        } else {
            enableLightMode();
        }

        // Load Data
        const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedData) {
            tasks = JSON.parse(savedData);
        } else {
            // Default Initial Data if empty
            tasks = [
                { id: 'REQ-402', title: 'RESEARCH MCP SPECS', body: 'Analyze Model Context Protocol.', tag: '[SYS-CORE]', status: 'todo' },
                { id: 'TASK-88', title: 'UI GENERATION', body: 'Wireframes & Assets.', tag: '[DESIGN]', status: 'progress' }
            ];
        }
        renderBoard();
    }

    // --- THEME ---
    toggleBtn.addEventListener('click', () => {
        if (body.classList.contains('light-mode')) {
            enableDarkMode();
        } else {
            enableLightMode();
        }
    });

    function enableDarkMode() {
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
        toggleBtn.textContent = 'DARK';
        localStorage.setItem('theme', 'dark-mode');
    }

    function enableLightMode() {
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
        toggleBtn.textContent = 'LIGHT';
        localStorage.setItem('theme', 'light-mode');
    }

    // --- RENDERING ---
    function renderBoard() {
        // Clear all columns
        document.querySelectorAll('.column-content').forEach(col => col.innerHTML = '');

        tasks.forEach(task => {
            const card = createCardElement(task);
            const column = document.querySelector(`.kanban-column[data-status="${task.status}"] .column-content`);
            if (column) {
                column.appendChild(card);
            }
        });

        setupDragAndDrop();
    }

    function createCardElement(task) {
        const div = document.createElement('div');
        div.className = 'blueprint-card';
        div.setAttribute('draggable', 'true');
        div.setAttribute('data-id', task.id); // Valid attribute for DOM element

        div.innerHTML = `
            <button class="delete-card-btn" onclick="deleteTask('${task.id}')">×</button>
            <div class="card-markers">
                <div class="marker-tl"></div><div class="marker-tr"></div>
                <div class="marker-bl"></div><div class="marker-br"></div>
            </div>
            <div class="card-id">${task.id}</div>
            <div class="card-title">${task.title}</div>
            <div class="card-body">${task.body}</div>
            <div class="card-footer">
                <span class="tag">${task.tag}</span>
            </div>
        `;
        return div;
    }

    // --- DRAG AND DROP ---
    function setupDragAndDrop() {
        const draggables = document.querySelectorAll('.blueprint-card');
        const columns = document.querySelectorAll('.column-content');

        draggables.forEach(draggable => {
            draggable.addEventListener('dragstart', () => {
                draggable.classList.add('dragging');
            });
            draggable.addEventListener('dragend', () => {
                draggable.classList.remove('dragging');
                updateTaskStatus(draggable); // Update status after drop
            });
        });

        columns.forEach(column => {
            column.addEventListener('dragover', e => {
                e.preventDefault();
                const afterElement = getDragAfterElement(column, e.clientY);
                const draggable = document.querySelector('.dragging');
                if (afterElement == null) {
                    column.appendChild(draggable);
                } else {
                    column.insertBefore(draggable, afterElement);
                }
            });
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.blueprint-card:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function updateTaskStatus(cardElement) {
        const newColumn = cardElement.closest('.kanban-column');
        if (!newColumn) return;

        const newStatus = newColumn.getAttribute('data-status');
        const taskId = cardElement.getAttribute('data-id');

        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex > -1) {
            tasks[taskIndex].status = newStatus;
            saveData(false); // Auto-save silently on move
        }
    }


    // --- ADD / DELETE / SAVE LOGIC ---

    // Exposed global functions for HTML inline onclick events
    window.addNewCard = function (columnId) {
        currentAddColumnId = columnId;
        // Reset inputs
        inputId.value = `REQ-${Math.floor(Math.random() * 1000)}`;
        inputTitle.value = '';
        inputDetails.value = '';
        inputTag.value = '[NEW]';

        modal.classList.remove('hidden');
    };

    window.deleteTask = function (id) {
        if (confirm('CONFIRM DELETE: Are you sure?')) {
            tasks = tasks.filter(t => t.id !== id);
            renderBoard();
            saveData(false);
        }
    };

    closeModalBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    confirmAddBtn.addEventListener('click', () => {
        const columnMap = { 'col-todo': 'todo', 'col-progress': 'progress', 'col-done': 'done' };
        const status = columnMap[currentAddColumnId] || 'todo';

        const newTask = {
            id: inputId.value,
            title: inputTitle.value,
            body: inputDetails.value,
            tag: inputTag.value,
            status: status
        };

        tasks.push(newTask);
        renderBoard();
        saveData(true);
        modal.classList.add('hidden');
    });

    saveBtn.addEventListener('click', () => {
        saveData(true);
    });

    function saveData(showFeedback) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
        if (showFeedback) {
            const originalText = saveStatus.innerText;
            saveStatus.innerText = "SAVING...";
            saveStatus.style.color = "var(--accent-color)";
            setTimeout(() => {
                saveStatus.innerText = "DATA SAVED";
                setTimeout(() => {
                    saveStatus.innerText = originalText;
                    saveStatus.style.color = "inherit";
                }, 1500);
            }, 500);
        }
    }

    // Run Init
    init();
});
