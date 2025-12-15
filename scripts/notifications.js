// ============================================
// SYSTÈME DE NOTIFICATIONS
// ============================================

class NotificationManager {
  constructor() {
    this.unreadCount = 0;
    this.notifications = [];
    this.subscription = null;
  }

  // Charger les notifications
  async loadNotifications() {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          from_user:users_profile!from_user_id(username, color),
          post:posts(track_name, artist)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('❌ Erreur chargement notifications:', error);
        return;
      }

      this.notifications = data || [];
      this.unreadCount = this.notifications.filter(n => !n.is_read).length;

      this.updateBadge();
      this.renderNotifications();

      console.log(`✅ ${this.notifications.length} notifications chargées (${this.unreadCount} non lues)`);
    } catch (error) {
      console.error('❌ Error loading notifications:', error);
    }
  }

  // Mettre à jour la pastille
  updateBadge() {
    const badge = document.getElementById('notif-badge');

    if (!badge) return;

    if (this.unreadCount > 0) {
      badge.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  // Afficher les notifications
  renderNotifications() {
    const container = document.getElementById('notif-list');

    if (!container) return;

    if (this.notifications.length === 0) {
      container.innerHTML = `
        <div class="notif-empty">
          <p>Aucune notification</p>
        </div>
      `;
      return;
    }

    const html = this.notifications.map(notif => `
      <div class="notif-item ${notif.is_read ? '' : 'unread'}" data-notif-id="${notif.id}">
        <div class="notif-user-note" style="background: ${notif.from_user.color}">♪</div>
        <div class="notif-content">
          <p class="notif-text">
            <strong>@${notif.from_user.username}</strong>
            ${this.getNotifText(notif)}
          </p>
          <span class="notif-time">${this.formatTime(notif.created_at)}</span>
        </div>
        ${!notif.is_read ? '<div class="notif-dot"></div>' : ''}
      </div>
    `).join('');

    container.innerHTML = html;
  }

  // Texte de la notification selon le type
  getNotifText(notif) {
    switch(notif.type) {
      case 'feel':
        return 'a commencé à te feel';
      case 'like':
        return notif.post ? `a aimé ton shake "${this.truncate(notif.post.track_name, 30)}"` : 'a aimé ton shake';
      case 'comment':
        return notif.post ? `a commenté ton shake "${this.truncate(notif.post.track_name, 30)}"` : 'a commenté ton shake';
      case 'reshake':
        return notif.post ? `a re-shaké "${this.truncate(notif.post.track_name, 30)}"` : 'a re-shaké ton post';
      default:
        return 'a interagi avec toi';
    }
  }

  // Tronquer le texte
  truncate(text, length) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  }

  // Format temps
  formatTime(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now - time;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'À l\'instant';
    if (mins < 60) return `${mins}min`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}j`;
    return time.toLocaleDateString('fr-FR');
  }

  // Marquer toutes comme lues
  async markAllAsRead() {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (!error) {
        this.unreadCount = 0;
        this.updateBadge();
        this.notifications.forEach(n => n.is_read = true);
        this.renderNotifications();
      }
    } catch (error) {
      console.error('❌ Error marking notifications as read:', error);
    }
  }

  // S'abonner aux nouvelles notifications en temps réel
  subscribeToNotifications() {
    const user = supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;

      const userId = data.session.user.id;

      this.subscription = supabase
        .channel('notifications_channel')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            console.log('🔔 Nouvelle notification reçue!', payload);
            this.unreadCount++;
            this.updateBadge();
            this.loadNotifications();
          }
        )
        .subscribe();

      console.log('✅ Abonné aux notifications en temps réel');
    });
  }

  // Se désabonner
  unsubscribe() {
    if (this.subscription) {
      supabase.removeChannel(this.subscription);
      this.subscription = null;
    }
  }
}

// Initialiser le manager
const notifManager = new NotificationManager();

// Toggle menu
function toggleNotifMenu() {
  const menu = document.getElementById('notif-menu');
  if (!menu) return;

  const isVisible = menu.style.display !== 'none';

  if (isVisible) {
    menu.style.display = 'none';
  } else {
    menu.style.display = 'block';
    notifManager.loadNotifications();
    // Marquer comme lues après 1 seconde
    setTimeout(() => {
      notifManager.markAllAsRead();
    }, 1000);
  }
}

// Fermer le menu si on clique en dehors
document.addEventListener('click', (e) => {
  const menu = document.getElementById('notif-menu');
  const btn = document.querySelector('.notif-btn');

  if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) {
    menu.style.display = 'none';
  }
});

console.log('🔔 Notification Manager initialized');
