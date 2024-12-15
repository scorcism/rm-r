let DEBUG = true;
let hasNotificationPermission = false;

function log(message, data = null) {
  if (DEBUG) {
    console.log(`[${new Date().toISOString()}] ${message}`, data || '');
  }
}

// Initialize the popup
document.addEventListener('DOMContentLoaded', async function() {
  log('Popup opened');
  await checkNotificationPermission();
  
  document.getElementById('enableNotifications').addEventListener('click', requestNotificationPermission);
  document.getElementById('eventForm').addEventListener('submit', handleFormSubmit);
  
  loadEvents();
});

// Check notification permission
async function checkNotificationPermission() {
  try {
    const permission = await chrome.notifications.getPermissionLevel();
    hasNotificationPermission = permission === 'granted';
    updateUI();
    return hasNotificationPermission;
  } catch (error) {
    log('Error checking permission', error);
    return false;
  }
}

// Update UI based on permission status
function updateUI() {
  const banner = document.getElementById('permissionBanner');
  const form = document.getElementById('eventForm');
  
  if (!hasNotificationPermission) {
    banner.style.display = 'flex';
    form.style.opacity = '0.5';
    form.style.pointerEvents = 'none';
  } else {
    banner.style.display = 'none';
    form.style.opacity = '1';
    form.style.pointerEvents = 'auto';
  }
}

// Request notification permission
async function requestNotificationPermission() {
  try {
    await chrome.notifications.create('test', {
      type: 'basic',
      iconUrl: '/icons/icon48.png',
      title: 'Notification Test',
      message: 'Notifications are now enabled!'
    });
    
    const granted = await checkNotificationPermission();
    if (granted) {
      log('Permission granted');
    } else {
      log('Permission denied');
    }
  } catch (error) {
    log('Error requesting permission', error);
  }
}

// Handle form submission
async function handleFormSubmit(e) {
  e.preventDefault();
  
  if (!hasNotificationPermission) {
    alert('Please enable notifications first');
    return;
  }
  
  saveEvent();
}

// Save new event
function saveEvent() {
  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  const eventTime = document.getElementById('eventTime').value;
  const notify30 = document.getElementById('notify30').checked;
  const notify10 = document.getElementById('notify10').checked;
  const notify5 = document.getElementById('notify5').checked;

  if (!title || !eventTime) {
    alert('Please fill in all required fields');
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
      atTime: true
    }
  };

  chrome.storage.local.get(['events'], function(result) {
    const events = result.events || [];
    events.push(event);
    
    chrome.storage.local.set({ events }, function() {
      setEventAlarms(event);
      loadEvents();
      document.getElementById('eventForm').reset();
    });
  });
}

// Set alarms for notifications
function setEventAlarms(event) {
  if (event.completed) return;

  const eventTime = event.eventTime;
  
  // Always set alarm for event time
  createAlarm(`${event.id}_0`, eventTime);

  // Set alarms for selected notification times
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

// Create alarm with logging
function createAlarm(alarmName, timestamp) {
  const now = Date.now();
  if (timestamp > now) {
    chrome.alarms.create(alarmName, { when: timestamp });
    log('Alarm created', {
      name: alarmName,
      time: new Date(timestamp).toLocaleString(),
      timeUntilAlarm: Math.round((timestamp - now) / 1000 / 60) + ' minutes'
    });
  }
}

// Load and display events
function loadEvents() {
  chrome.storage.local.get(['events'], function(result) {
    const events = result.events || [];
    const eventsList = document.getElementById('eventsList');
    eventsList.innerHTML = '';

    events
      .sort((a, b) => a.eventTime - b.eventTime)
      .forEach(event => {
        eventsList.appendChild(createEventCard(event));
      });
  });
}

// Create event card
function createEventCard(event) {
  const card = document.createElement('div');
  card.className = 'event-card';
  
  const timeUntil = getTimeUntil(event.eventTime);
  
  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: start;">
      <h3 style="font-size: 1rem; margin: 0;">${event.title}</h3>
      <span style="font-size: 0.75rem; color: var(--text-light);">
        ${new Date(event.eventTime).toLocaleString()}
      </span>
    </div>
    <p style="margin: 8px 0; color: var(--text-light);">${event.description}</p>
    <span style="font-size: 0.75rem; color: var(--primary);">${timeUntil}</span>
  `;
  
  return card;
}

// Get time until event
function getTimeUntil(timestamp) {
  const now = Date.now();
  const diff = timestamp - now;
  
  if (diff < 0) return 'Past event';
  
  const minutes = Math.floor(diff / 1000 / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} days until event`;
  if (hours > 0) return `${hours} hours until event`;
  return `${minutes} minutes until event`;
}

