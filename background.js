let DEBUG = true;

function log(message, data = null) {
  if (DEBUG) {
    console.log(`[${new Date().toISOString()}] ${message}`, data || "");
  }
}

// Handle alarm triggers
chrome.alarms.onAlarm.addListener(async function (alarm) {
  log("Alarm triggered", alarm);

  const hasPermission = await chrome.notifications.getPermissionLevel();
  if (hasPermission !== "granted") {
    log("No notification permission");
    return;
  }

  const [eventId, minutes] = alarm.name.split("_");

  chrome.storage.local.get(["events"], function (result) {
    log("Retrieved events", result);

    const events = result.events || [];
    const event = events.find((e) => e.id.toString() === eventId);

    if (event && !event.completed) {
      let message =
        minutes === "0"
          ? `${event.title} is starting now!`
          : `${event.title} starts in ${minutes} minutes`;

      chrome.notifications.create(
        "",
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
            log("Notification error", chrome.runtime.lastError);
          } else {
            log("Notification created", { id: notificationId });
          }
        }
      );
    }
  });
});

// Installation handler
chrome.runtime.onInstalled.addListener(function (details) {
  log("Extension installed", details);
});
