// DOM Elements
document.addEventListener("DOMContentLoaded", function () {
  const taskForm = document.getElementById("taskForm");
  const taskInput = document.getElementById("taskInput");
  const addTaskBtn = document.getElementById("addTask");
  const taskList = document.getElementById("taskList");
  const taskTemplate = document.getElementById("taskTemplate");
  const prioritySelect = document.getElementById("prioritySelect");
  const filterContainer = document.querySelector(".filter-container");
  const taskStats = document.querySelector(".task-stats");
  const allFilter = document.querySelector('.filter[data-status="all"]');
  const clearCompletedBtn = document.getElementById("clearCompleted");
  const bulkActionsBtn = document.querySelector(".bulk-actions-btn");
  const priorityFilters = document.querySelectorAll(".priority-filter");
  const searchInput = document.getElementById("searchInput");
  const clockDisplay = document.getElementById("digitalClock");
  const dateDisplay = document.getElementById("currentDate");
  const themeToggle = document.getElementById("themeToggle");
  const progressFill = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");

  // Task data
  let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
  let currentFilter = "all";
  let currentPriorityFilter = "all";
  let searchTerm = "";

  // Initialize the app
  initApp();

  // Debounce function to limit how often a function can be called
  function debounce(func, wait, immediate) {
    let timeout;
    return function () {
      const context = this,
        args = arguments;
      const later = function () {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  }

  function initApp() {
    // Start the clock
    updateClock();
    setInterval(updateClock, 1000);

    // Load and apply theme
    initTheme();

    // Check for saved tasks on first visit
    if (tasks.length === 0 && !localStorage.getItem("firstVisit")) {
      addSampleTasks();
      localStorage.setItem("firstVisit", "true");
    }

    // Render tasks and update stats
    renderTasks();
    updateTaskStats();
    updateProgressBar();

    // Set active filters
    if (allFilter) allFilter.classList.add("active");
    const defaultPriorityFilter = document.querySelector(
      '.priority-filter[data-priority="all"]'
    );
    if (defaultPriorityFilter) defaultPriorityFilter.classList.add("active");

    // Setup event listeners
    setupEventListeners();

    // Enable swipe gestures on mobile
    enableSwipeGestures();
  }

  function setupEventListeners() {
    // Task form submission
    taskForm.addEventListener("submit", function (e) {
      e.preventDefault();
      addTask();
    });

    // Filter clicks
    filterContainer.addEventListener("click", function (e) {
      if (e.target.classList.contains("filter")) {
        handleFilterClick(e);
      } else if (e.target.classList.contains("priority-filter")) {
        handlePriorityFilterClick(e);
      }
    });

    // Clear completed button
    clearCompletedBtn.addEventListener("click", clearCompletedTasks);

    // Bulk actions button
    bulkActionsBtn.addEventListener("click", toggleBulkActions);

    // Close bulk actions menu when clicking outside
    document.addEventListener("click", closeBulkActionsMenu);

    // Search input
    searchInput.addEventListener("input", debounce(handleSearch, 300));

    // Theme toggle
    themeToggle.addEventListener("change", toggleTheme);

    // Enable keyboard shortcuts
    document.addEventListener("keydown", handleKeyboardShortcuts);

    // Task double click to edit
    taskList.addEventListener("dblclick", handleDoubleClick);

    // Enable swipe gestures for mobile
    enableSwipeGestures();
  }

  // Keyboard shortcuts
  function handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + / to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === "/") {
      e.preventDefault();
      if (searchInput) {
        searchInput.focus();
      }
    }

    // Ctrl/Cmd + N to add new task
    if ((e.ctrlKey || e.metaKey) && e.key === "n") {
      e.preventDefault();
      if (taskInput) {
        taskInput.focus();
      }
    }

    // Escape to clear search
    if (e.key === "Escape" && document.activeElement === searchInput) {
      searchInput.value = "";
      handleSearch({ target: searchInput });
    }
  }

  // Double click to edit
  function handleDoubleClick(e) {
    const taskText = e.target.closest(".task-text");
    if (taskText) {
      const taskItem = taskText.closest(".task-item");
      const taskId = taskItem.dataset.id;
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        showInlineEdit(taskItem, task);
      }
    }
  }

  // Enable swipe gestures for mobile
  function enableSwipeGestures() {
    let touchStartX = 0;
    let touchEndX = 0;
    const minSwipeDistance = 50;

    if (taskList) {
      taskList.addEventListener(
        "touchstart",
        (e) => {
          touchStartX = e.changedTouches[0].screenX;
        },
        { passive: true }
      );

      taskList.addEventListener(
        "touchend",
        (e) => {
          touchEndX = e.changedTouches[0].screenX;
          handleSwipe(e);
        },
        { passive: true }
      );
    }

    function handleSwipe(e) {
      const swipeDistance = touchEndX - touchStartX;
      if (Math.abs(swipeDistance) < minSwipeDistance) return;

      const taskItem = e.target.closest(".task-item");
      if (!taskItem) return;

      const taskId = taskItem.dataset.id;

      // Swipe right to complete/uncomplete
      if (swipeDistance > 0) {
        const checkbox = taskItem.querySelector(".task-checkbox");
        checkbox.checked = !checkbox.checked;
        toggleTaskStatus(taskId);
      }
      // Swipe left to delete
      else if (swipeDistance < 0) {
        // Show confirmation before delete
        taskItem.classList.add("deleting");

        // Add confirmation buttons
        const confirmationDiv = document.createElement("div");
        confirmationDiv.className = "swipe-confirmation";
        confirmationDiv.innerHTML = `
          <span>Delete?</span>
          <button class="confirm-delete">Yes</button>
          <button class="cancel-delete">No</button>
        `;
        taskItem.appendChild(confirmationDiv);

        // Handle confirmation buttons
        confirmationDiv
          .querySelector(".confirm-delete")
          .addEventListener("click", () => {
            deleteTask(taskId);
          });

        confirmationDiv
          .querySelector(".cancel-delete")
          .addEventListener("click", () => {
            taskItem.classList.remove("deleting");
            confirmationDiv.remove();
          });
      }
    }
  }

  // Update digital clock with 12-hour format
  function updateClock() {
    if (!clockDisplay || !dateDisplay) return;

    const now = new Date();

    // Format time in 12-hour format (HH:MM:SS AM/PM)
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";

    // Convert hours to 12-hour format
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    hours = String(hours).padStart(2, "0");

    clockDisplay.textContent = `${hours}:${minutes}:${seconds} ${ampm}`;

    // Format date
    const options = { weekday: "short", month: "short", day: "numeric" };
    dateDisplay.textContent = now.toLocaleDateString("en-US", options);
  }

  // Initialize theme
  function initTheme() {
    const savedTheme =
      localStorage.getItem("theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    document.documentElement.setAttribute("data-theme", savedTheme);

    if (themeToggle) {
      themeToggle.checked = savedTheme === "dark";
    }
  }

  // Toggle theme
  function toggleTheme() {
    const isDark = themeToggle.checked;
    const theme = isDark ? "dark" : "light";

    // Save preference
    localStorage.setItem("theme", theme);

    // Apply theme
    document.documentElement.setAttribute("data-theme", theme);
  }

  // Add sample tasks for first-time users
  function addSampleTasks() {
    const sampleTasks = [
      {
        id: "sample1",
        text: "Welcome to TaskMaster! This is a sample task",
        completed: false,
        priority: "normal",
        createdAt: new Date().toISOString(),
      },
      {
        id: "sample2",
        text: "Try adding a new task using the form above",
        completed: false,
        priority: "high",
        createdAt: new Date().toISOString(),
      },
      {
        id: "sample3",
        text: "Swipe right to complete tasks on mobile",
        completed: true,
        priority: "low",
        createdAt: new Date().toISOString(),
      },
    ];

    tasks = sampleTasks;
    saveTasks();
  }

  // Add a new task
  function addTask() {
    const text = taskInput.value.trim();
    if (!text) return;

    const priority = prioritySelect ? prioritySelect.value : "normal";

    // Create task object
    const task = {
      id: Date.now().toString(),
      text: text,
      completed: false,
      priority: priority,
      createdAt: new Date().toISOString(),
    };

    // Add to array and save
    tasks.push(task);
    saveTasks();

    // Clear input
    taskInput.value = "";
    if (prioritySelect) prioritySelect.value = "normal";

    // Update UI
    renderTasks();
    updateTaskStats();
    updateProgressBar();

    // Focus input
    taskInput.focus();
  }

  // Render tasks based on filters
  function renderTasks() {
    if (!taskList) return;

    // Clear current list
    taskList.innerHTML = "";

    // Filter tasks
    const filteredTasks = tasks.filter((task) => {
      // Status filter
      const statusMatch =
        currentFilter === "all" ||
        (currentFilter === "active" && !task.completed) ||
        (currentFilter === "completed" && task.completed);

      // Priority filter
      const priorityMatch =
        currentPriorityFilter === "all" ||
        task.priority === currentPriorityFilter;

      // Search filter
      const searchMatch =
        searchTerm === "" ||
        task.text.toLowerCase().includes(searchTerm.toLowerCase());

      return statusMatch && priorityMatch && searchMatch;
    });

    // Sort tasks: uncompleted first, then by priority, then by creation date
    filteredTasks.sort((a, b) => {
      // First sort by completion status
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }

      // Then sort by priority
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }

      // Finally sort by creation date
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Show empty state if no tasks
    if (filteredTasks.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.className = "empty-state";
      emptyState.innerHTML = `
        <p>No ${currentFilter !== "all" ? currentFilter + " " : ""}tasks${
        currentPriorityFilter !== "all"
          ? " with " + currentPriorityFilter + " priority"
          : ""
      }${searchTerm ? " matching '" + searchTerm + "'" : ""}</p>
      `;
      taskList.appendChild(emptyState);
      return;
    }

    // Create task elements
    filteredTasks.forEach((task) => createTaskElement(task));
  }

  // Create a task element
  function createTaskElement(task) {
    let taskItem;

    if (taskTemplate) {
      // Use template if available
      const taskElement = taskTemplate.content.cloneNode(true);
      taskItem = taskElement.querySelector(".task-item");

      // Set data attributes
      taskItem.dataset.id = task.id;
      taskItem.dataset.priority = task.priority;

      // Set completed state
      if (task.completed) {
        taskItem.classList.add("completed");
      }

      // Set checkbox
      const checkbox = taskItem.querySelector(".task-checkbox");
      checkbox.checked = task.completed;
      checkbox.id = `task-${task.id}`;

      // Set text
      const taskText = taskItem.querySelector(".task-text");
      taskText.textContent = task.text;
      taskText.htmlFor = `task-${task.id}`;

      // Set priority badge
      const priorityBadge = taskItem.querySelector(".task-priority-badge");
      priorityBadge.textContent =
        task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
      priorityBadge.classList.add(`priority-${task.priority}`);

      // Add creation date tooltip
      const createdDate = new Date(task.createdAt);
      const dateFormatted = createdDate.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      taskItem.setAttribute("title", `Created: ${dateFormatted}`);

      // Set up event listeners
      taskItem
        .querySelector(".task-checkbox")
        .addEventListener("change", function () {
          toggleTaskStatus(task.id);
        });

      taskItem
        .querySelector(".task-edit")
        .addEventListener("click", function () {
          showInlineEdit(taskItem, task);
        });

      taskItem
        .querySelector(".task-delete")
        .addEventListener("click", function () {
          deleteTask(task.id);
        });

      // Add to list
      taskList.appendChild(taskElement);
    } else {
      // Create element manually
      taskItem = document.createElement("li");
      taskItem.classList.add("task-item");

      // Set data attributes
      taskItem.dataset.id = task.id;
      taskItem.dataset.priority = task.priority;

      // Set completed state
      if (task.completed) {
        taskItem.classList.add("completed");
      }

      // Add creation date tooltip
      const createdDate = new Date(task.createdAt);
      const dateFormatted = createdDate.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      taskItem.setAttribute("title", `Created: ${dateFormatted}`);

      // Create HTML content
      taskItem.innerHTML = `
        <div class="task-content">
          <input type="checkbox" class="task-checkbox" id="task-${task.id}" ${
        task.completed ? "checked" : ""
      }>
          <label class="task-text" for="task-${task.id}">${task.text}</label>
          <span class="task-priority-badge priority-${task.priority}">${
        task.priority.charAt(0).toUpperCase() + task.priority.slice(1)
      }</span>
        </div>
        <div class="task-actions">
          <button class="task-edit" aria-label="Edit task"><i class="fas fa-edit"></i></button>
          <button class="task-delete" aria-label="Delete task"><i class="fas fa-trash"></i></button>
        </div>
      `;

      // Set up event listeners
      taskItem
        .querySelector(".task-checkbox")
        .addEventListener("change", function () {
          toggleTaskStatus(task.id);
        });

      taskItem
        .querySelector(".task-edit")
        .addEventListener("click", function () {
          showInlineEdit(taskItem, task);
        });

      taskItem
        .querySelector(".task-delete")
        .addEventListener("click", function () {
          deleteTask(task.id);
        });

      // Add to list
      taskList.appendChild(taskItem);
    }
  }

  // Show inline edit form
  function showInlineEdit(taskItem, task) {
    // Get task content and text elements
    const taskContent = taskItem.querySelector(".task-content");
    const taskActions = taskItem.querySelector(".task-actions");

    // Store original content
    const originalContent = taskContent.innerHTML;
    const originalActions = taskActions.innerHTML;

    // Create edit form
    const editForm = document.createElement("div");
    editForm.className = "task-edit-form";
    editForm.innerHTML = `
      <div class="edit-input-container">
        <input type="text" class="edit-input" value="${task.text}">
        <select class="edit-priority">
          <option value="low" ${
            task.priority === "low" ? "selected" : ""
          }>Low</option>
          <option value="normal" ${
            task.priority === "normal" ? "selected" : ""
          }>Normal</option>
          <option value="high" ${
            task.priority === "high" ? "selected" : ""
          }>High</option>
        </select>
      </div>
      <div class="edit-actions">
        <button class="edit-save" aria-label="Save changes"><i class="fas fa-check"></i></button>
        <button class="edit-cancel" aria-label="Cancel editing"><i class="fas fa-times"></i></button>
      </div>
    `;

    // Replace original content with edit form
    taskContent.innerHTML = "";
    taskContent.appendChild(editForm);
    taskActions.style.display = "none";

    // Focus input
    const editInput = taskItem.querySelector(".edit-input");
    editInput.focus();
    editInput.setSelectionRange(0, editInput.value.length); // Select all text

    // Listen for save button click
    taskItem.querySelector(".edit-save").addEventListener("click", function () {
      saveEdit(
        task,
        taskItem,
        taskContent,
        taskActions,
        originalContent,
        originalActions
      );
    });

    // Listen for cancel button click
    taskItem
      .querySelector(".edit-cancel")
      .addEventListener("click", function () {
        cancelEdit(taskContent, taskActions, originalContent, originalActions);
      });

    // Listen for Enter key (save) and Escape key (cancel)
    editInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        saveEdit(
          task,
          taskItem,
          taskContent,
          taskActions,
          originalContent,
          originalActions
        );
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit(taskContent, taskActions, originalContent, originalActions);
      }
    });
  }

  // Save task edit
  function saveEdit(
    task,
    taskItem,
    taskContent,
    taskActions,
    originalContent,
    originalActions
  ) {
    const newText = taskItem.querySelector(".edit-input").value.trim();
    const newPriority = taskItem.querySelector(".edit-priority").value;

    // Validate new text
    if (!newText) {
      cancelEdit(taskContent, taskActions, originalContent, originalActions);
      return;
    }

    // Update task object
    task.text = newText;

    // Check if priority changed
    if (task.priority !== newPriority) {
      task.priority = newPriority;
      taskItem.dataset.priority = newPriority;
    }

    // Save changes
    saveTasks();

    // Refresh UI by re-rendering tasks
    renderTasks();
  }

  // Cancel task edit
  function cancelEdit(
    taskContent,
    taskActions,
    originalContent,
    originalActions
  ) {
    // Restore original content
    taskContent.innerHTML = originalContent;
    taskActions.innerHTML = originalActions;
    taskActions.style.display = "";
  }

  // Toggle task completion status
  function toggleTaskStatus(taskId) {
    const taskIndex = tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) return;

    // Toggle status
    tasks[taskIndex].completed = !tasks[taskIndex].completed;

    // Save and update UI
    saveTasks();
    renderTasks();
    updateTaskStats();
    updateProgressBar();
  }

  // Delete a task
  function deleteTask(taskId) {
    // Find the task element
    const taskItem = document.querySelector(`.task-item[data-id="${taskId}"]`);

    if (taskItem) {
      // Add animation class
      taskItem.classList.add("deleting");

      // Remove after animation
      setTimeout(() => {
        // Remove from array
        tasks = tasks.filter((task) => task.id !== taskId);

        // Save and update UI
        saveTasks();
        renderTasks();
        updateTaskStats();
        updateProgressBar();
      }, 300);
    } else {
      // If element not found, just remove from data
      tasks = tasks.filter((task) => task.id !== taskId);
      saveTasks();
      renderTasks();
      updateTaskStats();
      updateProgressBar();
    }
  }

  // Save tasks to localStorage
  function saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }

  // Update task statistics
  function updateTaskStats() {
    if (!taskStats) return;

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((task) => task.completed).length;
    const activeTasks = totalTasks - completedTasks;

    // Update counts
    const total = taskStats.querySelector(".total-tasks");
    const active = taskStats.querySelector(".active-tasks");
    const completed = taskStats.querySelector(".completed-tasks");

    if (total) total.textContent = totalTasks;
    if (active) active.textContent = activeTasks;
    if (completed) completed.textContent = completedTasks;

    // Show/hide clear completed button
    if (clearCompletedBtn) {
      clearCompletedBtn.style.display = completedTasks > 0 ? "block" : "none";
    }
  }

  // Update progress bar
  function updateProgressBar() {
    if (!progressFill || !progressText) return;

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((task) => task.completed).length;

    // Calculate percentage
    const percentage =
      totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    // Update progress bar and text
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${percentage}%`;
  }

  // Handle filter clicks
  function handleFilterClick(e) {
    const filter = e.target.closest(".filter");
    if (!filter) return;

    // Get filter status
    const status = filter.dataset.status;
    if (!status) return;

    // Update current filter
    currentFilter = status;

    // Update active class
    document.querySelectorAll(".filter").forEach((f) => {
      f.classList.remove("active");
    });
    filter.classList.add("active");

    // Update UI
    renderTasks();
  }

  // Handle priority filter clicks
  function handlePriorityFilterClick(e) {
    const filter = e.target.closest(".priority-filter");
    if (!filter) return;

    // Get priority
    const priority = filter.dataset.priority;
    if (!priority) return;

    // Update current filter
    currentPriorityFilter = priority;

    // Update active class
    document.querySelectorAll(".priority-filter").forEach((f) => {
      f.classList.remove("active");
    });
    filter.classList.add("active");

    // Update UI
    renderTasks();
  }

  // Handle search input
  function handleSearch(e) {
    searchTerm = e.target.value.trim();
    renderTasks();
  }

  // Clear completed tasks
  function clearCompletedTasks() {
    // Remove completed tasks
    tasks = tasks.filter((task) => !task.completed);

    // Save and update UI
    saveTasks();
    renderTasks();
    updateTaskStats();
    updateProgressBar();
  }

  // Toggle bulk actions menu
  function toggleBulkActions(e) {
    const menu = document.querySelector(".bulk-actions-menu");
    if (!menu) return;

    // Toggle menu
    menu.classList.toggle("active");

    // Add/remove document click listener
    if (menu.classList.contains("active")) {
      document.addEventListener("click", closeBulkActionsMenu);
    } else {
      document.removeEventListener("click", closeBulkActionsMenu);
    }

    // Prevent propagation
    e.stopPropagation();
  }

  // Close bulk actions menu
  function closeBulkActionsMenu(e) {
    const menu = document.querySelector(".bulk-actions-menu");
    const button = document.querySelector(".bulk-actions-btn");

    // Don't close if clicking menu or button
    if (e.target.closest(".bulk-actions-menu") || e.target === button) {
      return;
    }

    // Close menu
    menu.classList.remove("active");
    document.removeEventListener("click", closeBulkActionsMenu);
  }

  // Expose bulk action functions to global scope
  window.markAllCompleted = function () {
    tasks.forEach((task) => {
      task.completed = true;
    });

    saveTasks();
    renderTasks();
    updateTaskStats();
    updateProgressBar();

    const menu = document.querySelector(".bulk-actions-menu");
    if (menu) menu.classList.remove("active");
  };

  window.markAllActive = function () {
    tasks.forEach((task) => {
      task.completed = false;
    });

    saveTasks();
    renderTasks();
    updateTaskStats();
    updateProgressBar();

    const menu = document.querySelector(".bulk-actions-menu");
    if (menu) menu.classList.remove("active");
  };

  window.deleteAllTasks = function () {
    if (confirm("Are you sure you want to delete all tasks?")) {
      tasks = [];
      saveTasks();
      renderTasks();
      updateTaskStats();
      updateProgressBar();

      const menu = document.querySelector(".bulk-actions-menu");
      if (menu) menu.classList.remove("active");
    }
  };

  // Export tasks as PDF - making it globally accessible
  window.exportTasksAsPDF = function () {
    try {
      // Get tasks from local storage
      const tasksData = JSON.parse(localStorage.getItem("tasks")) || [];

      // Check if there are tasks to export
      if (tasksData.length === 0) {
        showNotification("No tasks to export", "error");
        return;
      }

      // Access jsPDF from global scope
      if (typeof window.jspdf === "undefined") {
        showNotification(
          "PDF library not loaded. Please refresh the page and try again.",
          "error"
        );
        console.error(
          "jsPDF library not found. Make sure it's properly loaded."
        );
        return;
      }

      try {
        // Sort tasks by completion status and creation date
        const tasksToPrint = [...tasksData].sort((a, b) => {
          // First sort by completion status
          if (a.completed !== b.completed) {
            return a.completed ? 1 : -1; // Active tasks first
          }
          // Then sort by creation date
          return new Date(b.createdAt) - new Date(a.createdAt);
        });

        // Initialize jsPDF - get constructor from the UMD module
        const doc = new window.jspdf.jsPDF();

        // Prepare table data
        const tableData = tasksToPrint.map((task) => [
          task.completed ? "Complete" : "Active",
          task.text,
          task.priority.charAt(0).toUpperCase() + task.priority.slice(1),
          new Date(task.createdAt).toLocaleDateString(),
        ]);

        // Add title
        doc.setFontSize(20);
        doc.setTextColor(139, 92, 246); // Primary color
        doc.text("TaskMaster - Task List", 14, 20);

        // Add generation date
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 27);

        // Check if autoTable plugin is available
        if (typeof doc.autoTable !== "function") {
          showNotification(
            "PDF autoTable plugin not loaded. Please refresh the page and try again.",
            "error"
          );
          console.error(
            "jsPDF autoTable plugin not found. Make sure it's properly loaded."
          );
          return;
        }

        // Add tasks table using autoTable plugin
        doc.autoTable({
          startY: 35,
          head: [["Status", "Task", "Priority", "Created"]],
          body: tableData,
          headStyles: {
            fillColor: [139, 92, 246], // Primary color
            textColor: [255, 255, 255],
          },
          bodyStyles: {
            textColor: [60, 60, 60],
          },
          didDrawCell: function (data) {
            // Color the priority cell based on priority
            if (data.column.index === 2 && data.section === "body") {
              const priorityText = data.cell.text[0];

              if (priorityText === "High") {
                doc.setTextColor(239, 68, 68); // red
              } else if (priorityText === "Normal") {
                doc.setTextColor(245, 158, 11); // orange
              } else if (priorityText === "Low") {
                doc.setTextColor(16, 185, 129); // green
              }
            }

            // Color the status cell based on status
            if (data.column.index === 0 && data.section === "body") {
              const statusText = data.cell.text[0];

              if (statusText === "Complete") {
                doc.setTextColor(16, 185, 129); // green
              } else if (statusText === "Active") {
                doc.setTextColor(59, 130, 246); // blue
              }
            }

            // Strikethrough completed tasks
            if (data.column.index === 1 && data.section === "body") {
              const rowIndex = data.row.index;
              if (tasksToPrint[rowIndex] && tasksToPrint[rowIndex].completed) {
                const textPos = data.cell.getTextPos();

                // Draw strikethrough
                doc.setDrawColor(150, 150, 150);
                doc.setLineWidth(0.5);
                doc.line(
                  data.cell.x + 2,
                  textPos.y - 1,
                  data.cell.x + data.cell.width - 2,
                  textPos.y - 1
                );
              }
            }
          },
        });

        // Add summary section
        const completedCount = tasksToPrint.filter((t) => t.completed).length;
        const activeCount = tasksToPrint.length - completedCount;
        const percentage = Math.round(
          (completedCount / tasksToPrint.length) * 100
        );

        // Get final Y position after the table
        const finalY = (doc.lastAutoTable.finalY || 35) + 10;

        doc.setTextColor(60, 60, 60);
        doc.setFontSize(12);
        doc.text(`Summary: ${tasksToPrint.length} total tasks`, 14, finalY);
        doc.text(
          `${activeCount} active tasks, ${completedCount} completed (${percentage}%)`,
          14,
          finalY + 6
        );

        // Save the PDF file
        doc.save("taskmaster-tasks.pdf");

        // Show success notification
        showNotification("Tasks exported as PDF successfully!", "success");
      } catch (innerError) {
        console.error("Error in PDF generation process:", innerError);
        showNotification(
          "Error while generating PDF: " +
            (innerError.message || "Unknown error"),
          "error"
        );
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      showNotification(
        "Failed to generate PDF: " + (error.message || "Unknown error"),
        "error"
      );
    }
  };

  // Simple notification function if not already defined
  if (typeof showNotification !== "function") {
    window.showNotification = function (message, type = "info") {
      // Create notification element
      const notification = document.createElement("div");
      notification.className = `notification ${type}`;
      notification.textContent = message;

      // Add to body
      document.body.appendChild(notification);

      // Show notification
      setTimeout(() => {
        notification.classList.add("show");
      }, 10);

      // Remove after 3 seconds
      setTimeout(() => {
        notification.classList.remove("show");
        setTimeout(() => {
          notification.remove();
        }, 300);
      }, 3000);
    };
  }
});
