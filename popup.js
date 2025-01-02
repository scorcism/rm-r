let DEBUG = true;
let hasNotificationPermission = false;

function log(message, data = null) {
  if (DEBUG)
    console.log(`[${new Date().toISOString()}] ${message}`, data || "");
}

document.addEventListener("DOMContentLoaded", async function () {
  log("Popup opened");
  await checkNotificationPermission();
  setupTabs();
  setupModal();
  setupEditModal();
  setupEventListeners();
  loadEvents();
});

function setupEventListeners() {
  document
    .getElementById("enableNotifications")
    .addEventListener("click", requestNotificationPermission);
  document
    .getElementById("eventForm")
    .addEventListener("submit", handleFormSubmit);
  document
    .getElementById("editForm")
    .addEventListener("submit", handleEditFormSubmit);
  document.getElementById("closeModal").addEventListener("click", closeModal);
  document
    .querySelector(".close-edit-modal")
    .addEventListener("click", closeEditModal);
  document.querySelector(".footer a").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: e.target.href });
  });
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      document
        .querySelectorAll(".tab-content")
        .forEach((content) => content.classList.remove("active"));
      document.getElementById(tab.dataset.tab).classList.add("active");
    });
  });
}

function setupModal() {
  const addBtn = document.getElementById("addEventBtn");
  const modal = document.getElementById("eventModal");
  const closeBtn = modal.querySelector(".close-modal");

  addBtn.addEventListener("click", () => {
    if (hasNotificationPermission) {
      modal.classList.add("active");
    } else {
      alert("Please enable notifications first");
    }
  });

  closeBtn.addEventListener("click", closeModal);
}

function setupEditModal() {
  const editModal = document.getElementById("editModal");
  const closeBtn = editModal.querySelector(".close-modal");
  closeBtn.addEventListener("click", closeEditModal);
}

async function checkNotificationPermission() {
  try {
    const permission = await chrome.notifications.getPermissionLevel();
    hasNotificationPermission = permission === "granted";
    updateUI();
    return hasNotificationPermission;
  } catch (error) {
    log("Error checking permission", error);
    return false;
  }
}

function updateUI() {
  const banner = document.getElementById("permissionBanner");
  const addBtn = document.getElementById("addEventBtn");
  banner.style.display = hasNotificationPermission ? "none" : "flex";
  addBtn.style.opacity = hasNotificationPermission ? "1" : "0.5";
}

async function requestNotificationPermission() {
  try {
    await chrome.notifications.create("test", {
      type: "basic",
      iconUrl: "/icons/icon48.png",
      title: "Notification Test",
      message: "Notifications are now enabled!",
    });
    const granted = await checkNotificationPermission();
    log(granted ? "Permission granted" : "Permission denied");
  } catch (error) {
    log("Error requesting permission", error);
  }
}

function handleFormSubmit(e) {
  e.preventDefault();
  if (!hasNotificationPermission) {
    alert("Please enable notifications first");
    return;
  }
  saveEvent();
}

function saveEvent() {
  const form = document.getElementById("eventForm");
  console.log({ new: new Date(form.eventTime.value).getTime() });
  const event = {
    id: Date.now(),
    title: form.title.value.trim(),
    description: form.description.value.trim(),
    eventTime: new Date(form.eventTime.value).getTime(),
    completed: false,
    notifications: {
      thirty: form.notify30.checked,
      ten: form.notify10.checked,
      five: form.notify5.checked,
      atTime: true,
    },
  };

  chrome.storage.local.get(["events"], function (result) {
    const events = result.events || [];
    events.push(event);
    chrome.storage.local.set({ events }, () => {
      setEventAlarms(event);
      loadEvents();
      closeModal();
      form.reset();
    });
  });
}
function loadEvents() {
  chrome.storage.local.get(["events"], function (result) {
    const events = result.events || [];
    const now = new Date();

    // Get start and end of today
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();

    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    ).getTime();

    // Filter events
    const completed = events.filter((e) => e.completed);

    const todayTasks = events.filter(
      (e) =>
        !e.completed && e.eventTime >= startOfDay && e.eventTime <= endOfDay
    );

    const pending = events.filter((e) => !e.completed);

    pending.sort((a, b) => a.eventTime - b.eventTime);
    todayTasks.sort((a, b) => a.eventTime - b.eventTime);
    completed.sort((a, b) => b.eventTime - a.eventTime);

    updateTabCounts(pending.length, todayTasks.length, completed.length);
    renderEvents("pending", pending);
    renderEvents("scheduled", todayTasks);
    renderEvents("completed", completed);
  });
}

function updateTabCounts(pending, scheduled, completed) {
  document.querySelector(
    '[data-tab="pending"]'
  ).textContent = `Pending (${pending})`;
  document.querySelector(
    '[data-tab="scheduled"]'
  ).textContent = `Today (${scheduled})`;
  document.querySelector(
    '[data-tab="completed"]'
  ).textContent = `Done (${completed})`;
}

function renderEvents(type, events) {
  const container = document.querySelector(`#${type} .event-list`);
  container.innerHTML = events.length
    ? ""
    : `<div class="empty-state">No ${type} tasks</div>`;
  events.forEach((event) => container.appendChild(createEventElement(event)));
}

function createEventElement(event) {
  const div = document.createElement("div");
  div.className = `event-card ${event.completed ? "completed" : ""}`;
  div.dataset.eventId = event.id;

  const timeDisplay = getTimeDisplay(event.eventTime);
  div.innerHTML = `
    <div class="event-title">${event.title}</div>
    <div class="event-time">${timeDisplay}</div>
    ${
      event.description
        ? `<div class="event-description">${event.description}</div>`
        : ""
    }
    <div class="event-actions">
      ${getActionButtons(event)}
    </div>
  `;

  // Add event listeners after creating the element
  const actions = div.querySelector(".event-actions");
  if (event.completed) {
    const undoBtn = actions.querySelector(".btn-secondary");
    const deleteBtn = actions.querySelector(".btn-danger");

    undoBtn.addEventListener("click", () => toggleComplete(event.id));
    deleteBtn.addEventListener("click", () => deleteEvent(event.id));
  } else {
    const completeBtn = actions.querySelector(".btn-primary");
    const editBtn = actions.querySelector(".btn-secondary");
    const deleteBtn = actions.querySelector(".btn-danger");

    completeBtn.addEventListener("click", () => toggleComplete(event.id));
    editBtn.addEventListener("click", () => editEvent(event.id));
    deleteBtn.addEventListener("click", () => deleteEvent(event.id));
  }

  return div;
}

function getActionButtons(event) {
  return event.completed
    ? `
    <button class="btn btn-secondary">Undo</button>
    <button class="btn btn-danger">Delete</button>
  `
    : `
    <button class="btn btn-primary">Complete</button>
    <button class="btn btn-secondary">Edit</button>
    <button class="btn btn-danger">Delete</button>
  `;
}

function getTimeDisplay(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return isToday
    ? `Today at ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function editEvent(eventId) {
  chrome.storage.local.get(["events"], function (result) {
    const event = result.events?.find((e) => e.id === eventId);
    if (event) {
      const form = document.getElementById("editForm");
      form.editId.value = event.id;
      form.editTitle.value = event.title;
      form.editDescription.value = event.description || "";

      // Convert timestamp to local datetime-local input value
      const date = new Date(event.eventTime);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");

      form.editEventTime.value = `${year}-${month}-${day}T${hours}:${minutes}`;
      document.getElementById("editModal").classList.add("active");
    }
  });
}

function handleEditFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const eventId = parseInt(form.editId.value);

  const eventTime = new Date(form.editEventTime.value);

  const updates = {
    title: form.editTitle.value.trim(),
    description: form.editDescription.value.trim(),
    eventTime: eventTime.getTime(),
  };

  chrome.storage.local.get(["events"], function (result) {
    const events = result.events || [];
    const eventIndex = events.findIndex((e) => e.id === eventId);
    if (eventIndex !== -1) {
      events[eventIndex] = { ...events[eventIndex], ...updates };
      chrome.storage.local.set({ events }, () => {
        clearEventAlarms(eventId);
        setEventAlarms(events[eventIndex]);
        loadEvents();
        closeEditModal();
      });
    }
  });
}

function toggleComplete(eventId) {
  chrome.storage.local.get(["events"], function (result) {
    const events = result.events || [];
    const eventIndex = events.findIndex((e) => e.id === eventId);
    if (eventIndex !== -1) {
      events[eventIndex].completed = !events[eventIndex].completed;
      chrome.storage.local.set({ events }, () => {
        if (events[eventIndex].completed) {
          clearEventAlarms(eventId);
        } else {
          setEventAlarms(events[eventIndex]);
        }
        loadEvents();
      });
    }
  });
}

function deleteEvent(eventId) {
  chrome.storage.local.get(["events"], function (result) {
    const events = (result.events || []).filter((e) => e.id !== eventId);
    chrome.storage.local.set({ events }, () => {
      clearEventAlarms(eventId);
      loadEvents();
    });
  });
}

function setEventAlarms(event) {
  if (event.eventTime > Date.now()) {
    createAlarm(`${event.id}_0`, event.eventTime);
    if (event.notifications.thirty)
      createAlarm(`${event.id}_30`, event.eventTime - 30 * 60 * 1000);
    if (event.notifications.ten)
      createAlarm(`${event.id}_10`, event.eventTime - 10 * 60 * 1000);
    if (event.notifications.five)
      createAlarm(`${event.id}_5`, event.eventTime - 5 * 60 * 1000);
  }
}

function createAlarm(name, time) {
  chrome.alarms.create(name, { when: time });
}

function clearEventAlarms(eventId) {
  ["0", "5", "10", "30"].forEach((minutes) => {
    chrome.alarms.clear(`${eventId}_${minutes}`);
  });
}

function closeModal() {
  document.getElementById("eventModal").classList.remove("active");
  document.getElementById("eventForm").reset();
}

function closeEditModal() {
  document.getElementById("editModal").classList.remove("active");
  document.getElementById("editForm").reset();
}

chrome.storage.onChanged.addListener(function (changes, namespace) {
  if (namespace === "local" && changes.events) {
    loadEvents();
  }
});
