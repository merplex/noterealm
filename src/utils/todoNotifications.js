import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { getAlertSettings, leadTimeMs } from './alertSettings';

const CHANNEL_ID = 'noterealm-todo';

/** แปลง UUID string → integer สำหรับ notification ID */
function uuidToInt(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2147483647;
}

function isNative() {
  return Capacitor.isNativePlatform();
}

/**
 * สร้าง Notification Channel สำหรับ Android 8+ (ต้องเรียกก่อน schedule)
 */
export async function createNotificationChannel() {
  if (!isNative()) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Todo แจ้งเตือน',
      description: 'แจ้งเตือน Todo ถึงกำหนด',
      importance: 5,          // IMPORTANCE_HIGH — มีเสียง + popup
      sound: 'default',
      vibration: true,
      visibility: 1,          // VISIBILITY_PUBLIC
    });
  } catch (err) {
    console.warn('[Notif] createChannel failed:', err);
  }
}

export async function requestNotificationPermission() {
  if (!isNative()) return false;
  try {
    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted';
  } catch {
    return false;
  }
}

export async function checkNotificationPermission() {
  if (!isNative()) return false;
  try {
    const { display } = await LocalNotifications.checkPermissions();
    return display === 'granted';
  } catch {
    return false;
  }
}

function buildScheduleDate(dueDate, dueTime) {
  const timeStr = dueTime || '08:00';
  return new Date(`${dueDate}T${timeStr}:00`);
}

/** notification IDs สำหรับ todo รายการเดียว */
function notifIds(todoId) {
  return {
    due:   uuidToInt(todoId + ':due'),
    early: uuidToInt(todoId + ':early'),
  };
}

/**
 * สร้าง notification objects สำหรับ todo 1 รายการ
 * - urgent/high: ได้ 2 notifs (ล่วงหน้า + ตรงเวลา)
 * - normal/low: ได้ 1 notif (ตรงเวลา)
 */
function buildNotificationsForTodo(todo, now) {
  if (!todo.dueDate || todo.done || todo.repeatEnabled || todo.deletedAt) return [];

  const atDue = buildScheduleDate(todo.dueDate, todo.dueTime);
  const { urgentDays, urgentHours, highDays, highHours } = getAlertSettings();
  const ids = notifIds(todo.id);
  const notifs = [];
  const priority = todo.priority || 'normal';

  if (priority === 'urgent' || priority === 'high') {
    const leadMs = priority === 'urgent'
      ? leadTimeMs(urgentDays, urgentHours)
      : leadTimeMs(highDays, highHours);

    // notif ล่วงหน้า (ถ้า leadTime > 0)
    if (leadMs > 0) {
      const earlyAt = new Date(atDue.getTime() - leadMs);
      if (earlyAt > now) {
        notifs.push({
          id: ids.early,
          title: priority === 'urgent' ? '🚨 แจ้งเตือนล่วงหน้า' : '⚠️ แจ้งเตือนล่วงหน้า',
          body: todo.title,
          schedule: { at: earlyAt, allowWhileIdle: true },
          sound: 'default',
          channelId: CHANNEL_ID,
          extra: { todoId: todo.id },
        });
      }
    }

    // notif ตรงเวลา
    if (atDue > now) {
      notifs.push({
        id: ids.due,
        title: priority === 'urgent' ? '🚨 ด่วน! Todo ถึงกำหนด' : '⚠️ สำคัญ! Todo ถึงกำหนด',
        body: todo.title,
        schedule: { at: atDue, allowWhileIdle: true },
        sound: 'default',
        channelId: CHANNEL_ID,
        extra: { todoId: todo.id },
      });
    }
  } else {
    if (atDue > now) {
      notifs.push({
        id: ids.due,
        title: '📋 NoteRealm Todo',
        body: todo.title,
        schedule: { at: atDue, allowWhileIdle: true },
        sound: 'default',
        channelId: CHANNEL_ID,
        extra: { todoId: todo.id },
      });
    }
  }

  return notifs;
}

/** ตั้ง notification สำหรับ todo 1 รายการ */
export async function scheduleTodoNotification(todo) {
  if (!isNative()) return;
  const notifs = buildNotificationsForTodo(todo, new Date());
  if (notifs.length === 0) return;
  try {
    await LocalNotifications.schedule({ notifications: notifs });
  } catch (err) {
    console.warn('[Notif] schedule failed:', err);
  }
}

/** ยกเลิก notification ทั้งหมดของ todo (ล่วงหน้า + ตรงเวลา) */
export async function cancelTodoNotification(todoId) {
  if (!isNative()) return;
  try {
    const ids = notifIds(todoId);
    await LocalNotifications.cancel({
      notifications: [{ id: ids.due }, { id: ids.early }],
    });
  } catch (err) {
    console.warn('[Notif] cancel failed:', err);
  }
}

/**
 * ตั้ง notification ให้ทุก todo ที่มี dueDate ในอนาคต (เรียกตอน app load)
 * สร้าง channel ก่อนเสมอ เพื่อ Android 8+
 */
export async function scheduleAllTodoNotifications(todos) {
  if (!isNative()) return;

  await createNotificationChannel();

  const hasPermission = await checkNotificationPermission();
  if (!hasPermission) return;

  const now = new Date();
  const notifications = [];

  for (const todo of todos) {
    const notifs = buildNotificationsForTodo(todo, now);
    notifications.push(...notifs);
  }

  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch (err) {
    console.warn('[Notif] bulk schedule failed:', err);
  }
}
