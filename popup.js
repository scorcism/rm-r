let DEBUG = true;
let hasNotificationPermission = false;

function log(message, data = null) {
  if (DEBUG) {
    console.log(`[${new Date().toISOString()}] ${message}`, data || "");
  }
}

document.addEventListener("DOMContentLoaded", async function () {
  log("Popup opened");
  await checkNotificationPermission();

  document
    .getElementById("enableNotifications")
    .addEventListener("click", requestNotificationPermission);
  document
    .getElementById("eventForm")
    .addEventListener("submit", handleFormSubmit);

  loadEvents();
});

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
  const form = document.getElementById("eventForm");

  if (!hasNotificationPermission) {
    banner.style.display = "flex";
    form.style.opacity = "0.5";
    form.style.pointerEvents = "none";
  } else {
    banner.style.display = "none";
    form.style.opacity = "1";
    form.style.pointerEvents = "auto";
  }
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
    if (granted) {
      log("Permission granted");
    } else {
      log("Permission denied");
    }
  } catch (error) {
    log("Error requesting permission", error);
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();

  if (!hasNotificationPermission) {
    alert("Please enable notifications first");
    return;
  }

  saveEvent();
}

function saveEvent() {
  const title = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const eventTime = document.getElementById("eventTime").value;
  const notify30 = document.getElementById("notify30").checked;
  const notify10 = document.getElementById("notify10").checked;
  const notify5 = document.getElementById("notify5").checked;

  if (!title || !eventTime) {
    alert("Please fill in all required fields");
    return;
  }

  const event = {
    id: Date.now(),
    title,
    description,
    eventTime: new Date(eventTime).getTime(),
    completed: false,
    notifications: {
      thirty: notify30,
      ten: notify10,
      five: notify5,
      atTime: true,
    },
  };

  chrome.storage.local.get(["events"], function (result) {
    const events = result.events || [];
    events.push(event);

    chrome.storage.local.set({ events }, function () {
      setEventAlarms(event);
      loadEvents();
      document.getElementById("eventForm").reset();
    });
  });
}

function setEventAlarms(event) {
  if (event.completed) return;

  const eventTime = event.eventTime;

  createAlarm(`${event.id}_0`, eventTime);

  if (event.notifications.thirty) {
    createAlarm(`${event.id}_30`, eventTime - 30 * 60 * 1000);
  }
  if (event.notifications.ten) {
    createAlarm(`${event.id}_10`, eventTime - 10 * 60 * 1000);
  }
  if (event.notifications.five) {
    createAlarm(`${event.id}_5`, eventTime - 5 * 60 * 1000);
  }
}

function createAlarm(alarmName, timestamp) {
  const now = Date.now();
  if (timestamp > now) {
    chrome.alarms.create(alarmName, { when: timestamp });
    log("Alarm created", {
      name: alarmName,
      time: new Date(timestamp).toLocaleString(),
      timeUntilAlarm: Math.round((timestamp - now) / 1000 / 60) + " minutes",
    });
  }
}

function clearEventAlarms(eventId) {
  ["0", "5", "10", "30"].forEach((minutes) => {
    chrome.alarms.clear(`${eventId}_${minutes}`);
  });
}

function toggleComplete(eventId) {
  chrome.storage.local.get(["events"], function (result) {
    const events = result.events || [];
    const eventIndex = events.findIndex((e) => e.id === eventId);

    if (eventIndex !== -1) {
      events[eventIndex].completed = !events[eventIndex].completed;
      chrome.storage.local.set({ events }, loadEvents);

      if (events[eventIndex].completed) {
        clearEventAlarms(eventId);
      } else {
        setEventAlarms(events[eventIndex]);
      }
    }
  });
}

function deleteEvent(eventId) {
  chrome.storage.local.get(["events"], function (result) {
    const events = result.events || [];
    const newEvents = events.filter((e) => e.id !== eventId);
    chrome.storage.local.set({ events: newEvents }, loadEvents);
    clearEventAlarms(eventId);
  });
}

function loadEvents() {
  chrome.storage.local.get(["events"], function (result) {
    const events = result.events || [];
    const eventsList = document.getElementById("eventsList");
    eventsList.innerHTML = "";

    events
      .sort((a, b) => b.eventTime - a.eventTime)
      .forEach((event) => {
        eventsList.appendChild(createEventCard(event));
      });
  });
}

function createEventCard(event) {
  const card = document.createElement("div");
  card.className = `event-card ${event.completed ? "completed" : ""}`;

  const timeUntil = getTimeUntil(event.eventTime);

  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: start;">
      <div>
        <h3 style="font-size: 1rem; margin: 0; ${
          event.completed
            ? "text-decoration: line-through; color: var(--text-light);"
            : ""
        }">${event.title}</h3>
        <span style="font-size: 0.75rem; color: var(--text-light);">
          ${new Date(event.eventTime).toLocaleString()}
        </span>
      </div>
      <div class="event-actions">
        <button class="icon-button complete-btn" data-id="${event.id}" title="${
    event.completed ? "Mark Incomplete" : "Mark Complete"
  }">
          ${event.completed ? "Mark Undone" : "Mark Done"}
        </button>
        <button class="icon-button delete-btn" data-id="${
          event.id
        }" title="Delete">
          Delete
        </button>
      </div>
    </div>
    <p style="margin: 8px 0; color: var(--text-light);">${
      event.description || ""
    }</p>
    <span style="font-size: 0.75rem; color: var(--primary);">${timeUntil}</span>
  `;

  const completeBtn = card.querySelector(".complete-btn");
  const deleteBtn = card.querySelector(".delete-btn");

  completeBtn.addEventListener("click", () => toggleComplete(event.id));
  deleteBtn.addEventListener("click", () => deleteEvent(event.id));

  return card;
}
function getTimeUntil(timestamp) {
  const now = Date.now();
  const diff = timestamp - now;

  if (diff < 0) return "Past event";

  const minutes = Math.floor(diff / 1000 / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} ${days === 1 ? "day" : "days"} until event`;
  if (hours > 0)
    return `${hours} ${hours === 1 ? "hour" : "hours"} until event`;
  if (minutes > 0)
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} until event`;
  return "Starting now";
}

// Chrome Extension Storage Event Listener
chrome.storage.onChanged.addListener(function (changes, namespace) {
  if (namespace === "local" && changes.events) {
    loadEvents();
  }
});
