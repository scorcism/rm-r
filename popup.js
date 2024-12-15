document.addEventListener("DOMContentLoaded", function () {
  loadEvents();

  document.getElementById("saveEvent").addEventListener("click", saveEvent);
});

function saveEvent() {
  const title = document.getElementById("title").value;
  const description = document.getElementById("description").value;
  const eventTime = document.getElementById("eventTime").value;
  const completed = document.getElementById("completed").checked;
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
    completed,
    notifications: {
      thirty: notify30,
      ten: notify10,
      five: notify5,
    },
  };

  chrome.storage.local.get(["events"], function (result) {
    const events = result.events || [];
    events.push(event);

    chrome.storage.local.set({ events }, function () {
      setEventAlarms(event);
      loadEvents();
      resetForm();
    });
  });
}

function setEventAlarms(event) {
  if (event.completed) return;

  const eventTime = event.eventTime;

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
  }
}

function resetForm() {
  document.getElementById("title").value = "";
  document.getElementById("description").value = "";
  document.getElementById("eventTime").value = "";
  document.getElementById("completed").checked = false;
  document.getElementById("notify30").checked = false;
  document.getElementById("notify10").checked = false;
  document.getElementById("notify5").checked = false;
}

function loadEvents() {
  chrome.storage.local.get(["events"], function (result) {
    const events = result.events || [];
    const eventsList = document.getElementById("eventsList");
    eventsList.innerHTML = "";

    events
      .sort((a, b) => a.eventTime - b.eventTime)
      .forEach((event) => {
        const eventElement = createEventElement(event);
        eventsList.appendChild(eventElement);
      });
  });
}

function createEventElement(event) {
  const div = document.createElement("div");
  div.style.border = "1px solid #ccc";
  div.style.padding = "10px";
  div.style.marginBottom = "10px";

  const title = document.createElement("h3");
  title.textContent = event.title;
  title.style.margin = "0 0 5px 0";

  const time = document.createElement("p");
  time.textContent = new Date(event.eventTime).toLocaleString();
  time.style.margin = "0 0 5px 0";

  const description = document.createElement("p");
  description.textContent = event.description;
  description.style.margin = "0 0 5px 0";

  const status = document.createElement("p");
  status.textContent = `Status: ${event.completed ? "Completed" : "Pending"}`;

  div.appendChild(title);
  div.appendChild(time);
  div.appendChild(description);
  div.appendChild(status);

  return div;
}
