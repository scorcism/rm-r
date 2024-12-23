
chrome.alarms.onAlarm.addListener(async function (alarm) {
  console.log("Alarm triggered", alarm);

  const hasPermission = await chrome.notifications.getPermissionLevel();
  if (hasPermission !== "granted") {
    console.log("No notification permission");
    return;
  }

  const [eventId, minutes] = alarm.name.split("_");

  chrome.storage.local.get(["events"], function (result) {
    console.log("Retrieved events", result);
    const events = result.events || [];
    const event = events.find((e) => e.id.toString() === eventId);

    if (event && !event.completed) {
      let message =
        minutes === "0"
          ? `${event.title} is starting now!`
          : `${event.title} starts in ${minutes} minutes`;

      chrome.notifications.create(
        {
          type: "basic",
          iconUrl: "/icons/icon48.png",
          title: event.title,
          message: message,
          priority: 2,
          requireInteraction: true,
        },
        function (notificationId) {
          if (chrome.runtime.lastError) {
            console.log("Notification error", chrome.runtime.lastError);
          } else {
            console.log("Notification created", { id: notificationId });
          }
        }
      );
    }
  });
});

chrome.runtime.onInstalled.addListener(function (details) {
  console.log("Extension installed", details);

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
  const eventTime = event.eventTime;
  const now = Date.now();

  if (eventTime > now) {
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
}

function createAlarm(name, time) {
  chrome.alarms.create(name, { when: time });
}
