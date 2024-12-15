chrome.alarms.onAlarm.addListener(function (alarm) {
  const [eventId, minutes] = alarm.name.split("_");

  chrome.storage.local.get(["events"], function (result) {
    const events = result.events || [];
    const event = events.find((e) => e.id.toString() === eventId);

    if (event && !event.completed) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icon48.png",
        title: event.title,
        message: `Event starts in ${minutes} minutes: ${event.description}`,
        priority: 2,
      });
    }
  });
});
