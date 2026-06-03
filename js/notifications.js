// ── SignalR Notifications ──────────────────────
let notificationConnection = null;
let notifications          = [];
let unreadCount            = 0;

function initNotifications() {
    const token = localStorage.getItem('token');
    if (!token) return;

    notificationConnection = new signalR.HubConnectionBuilder()
        .withUrl('http://localhost:5081/hubs/notifications', {
            accessTokenFactory: () => token
        })
        .withAutomaticReconnect()
        .build();

    notificationConnection.on('Notification', (data) => {
        addNotification(data);
    });

    notificationConnection.start()
        .then(() => console.log('SignalR connected'))
        .catch(err => console.warn('SignalR error:', err));
}

function addNotification(data) {
    notifications.unshift({
        id:        Date.now(),
        type:      data.type      || 'info',
        entity:    data.entity    || '',
        recordId:  data.recordId  || 0,
        message:   data.message   || '',
        occurredAt: data.occurredAt || new Date().toISOString(),
        read:      false
    });

    // Máximo 50 notificaciones
    if (notifications.length > 50) notifications.pop();

    unreadCount++;
    updateBadge();
    renderPanel();
    showToast(data);
}

function updateBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    if (unreadCount > 0) {
        badge.textContent    = unreadCount > 9 ? '9+' : unreadCount;
        badge.style.display  = 'flex';
    } else {
        badge.style.display  = 'none';
    }
}

function renderPanel() {
    const list = document.getElementById('notifList');
    if (!list) return;

    if (notifications.length === 0) {
        list.innerHTML = `
            <div style="text-align:center;padding:32px;color:var(--text3)">
                <i class="ti ti-bell-off" style="font-size:32px;display:block;margin-bottom:8px"></i>
                No notifications yet
            </div>`;
        return;
    }

    list.innerHTML = notifications.map(n => `
        <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markRead(${n.id})">
            <div class="notif-icon ${getNotifIconClass(n.type)}">
                <i class="ti ${getNotifIcon(n.type)}"></i>
            </div>
            <div class="notif-content">
                <div class="notif-message">${n.message}</div>
                <div class="notif-time">${formatTime(n.occurredAt)}</div>
            </div>
        </div>
    `).join('');
}

function getNotifIcon(type) {
    switch(type) {
        case 'create':  return 'ti-plus';
        case 'update':  return 'ti-edit';
        case 'delete':  return 'ti-trash';
        case 'status':  return 'ti-refresh';
        case 'warning': return 'ti-alert-triangle';
        case 'login':   return 'ti-login';
        default:        return 'ti-bell';
    }
}

function getNotifIconClass(type) {
    switch(type) {
        case 'create':  return 'notif-create';
        case 'update':  return 'notif-update';
        case 'delete':  return 'notif-delete';
        case 'status':  return 'notif-status';
        case 'warning': return 'notif-warning';
        case 'login':   return 'notif-login';
        default:        return 'notif-info';
    }
}

function formatTime(dateStr) {
    const d    = new Date(dateStr);
    const now  = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60)  return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function markRead(id) {
    const n = notifications.find(n => n.id === id);
    if (n && !n.read) {
        n.read = true;
        unreadCount = Math.max(0, unreadCount - 1);
        updateBadge();
        renderPanel();
    }
}

function markAllRead() {
    notifications.forEach(n => n.read = true);
    unreadCount = 0;
    updateBadge();
    renderPanel();
}

function clearAll() {
    notifications = [];
    unreadCount   = 0;
    updateBadge();
    renderPanel();
}

function togglePanel() {
    const panel = document.getElementById('notifPanel');
    if (!panel) return;
    const isOpen = panel.classList.contains('show');
    if (isOpen) {
        panel.classList.remove('show');
    } else {
        panel.classList.add('show');
        markAllRead();
    }
}

function showToast(data) {
    const toast = document.createElement('div');
    toast.className = 'notif-toast';
    toast.innerHTML = `
        <div class="toast-icon ${getNotifIconClass(data.type)}">
            <i class="ti ${getNotifIcon(data.type)}"></i>
        </div>
        <div class="toast-body">
            <div class="toast-title">${data.entity || 'Notification'}</div>
            <div class="toast-msg">${data.message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="ti ti-x"></i>
        </button>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}