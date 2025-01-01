chrome.alarms.onAlarm.addListener(async function (alarm) {
  log("Alarm triggered", alarm);

  const permission = await chrome.notifications.getPermissionLevel();
  if (permission !== "granted") {
    log("No notification permission");
    return;
  }

  const [eventId, minutes] = alarm.name.split("_");
  chrome.storage.local.get(["events"], function (result) {
    const event = result.events?.find((e) => e.id.toString() === eventId);
    if (event && !event.completed) {
      const message =
        minutes === "0"
          ? `${event.title} is starting now!`
          : `${event.title} starts in ${minutes} minutes`;

      createNotification(event.title, message);
    }
  });
});

function createNotification(title, message) {
  chrome.notifications.create(
    {
      type: "basic",
      iconUrl: "/icons/icon48.png",
      title: title,
      message: message,
      priority: 2,
      requireInteraction: true,
      silent: false,
    },
    function (notificationId) {
      if (chrome.runtime.lastError) {
        log("Notification error", chrome.runtime.lastError);
      } else {
        log("Notification created", { id: notificationId });
      }
    }
  );
}

chrome.runtime.onInstalled.addListener(function (details) {
  log("Extension installed", details);
  chrome.alarms.clearAll();

  chrome.storage.local.get(["events"], function (result) {
    const events = result.events || [];
    events.forEach((event) => {
      if (!event.completed) {
        setEventAlarms(event);
      }
    });
  });
});

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

function log(message, data = null) {
  if (true) console.log(`[${new Date().toISOString()}] ${message}`, data || "");
}
