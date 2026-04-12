import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

/** แปลง UUID string → integer (สำหรับ notification ID) */
function uuidToInt(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2147483647; // max 32-bit int
}

/** เช็คว่าแอปอยู่บน Native platform (Android/iOS) ไหม */
function isNative() {
  return Capacitor.isNativePlatform();
}

/**
 * ขอ permission แจ้งเตือน — คืน true ถ้าได้รับสิทธิ์
 */
export async function requestNotificationPermission() {
  if (!isNative()) return false;
  try {
    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted';
  } catch {
    return false;
  }
}

/**
 * เช็คสถานะ permission โดยไม่ขอใหม่
 */
export async function checkNotificationPermission() {
  if (!isNative()) return false;
  try {
    const { display } = await LocalNotifications.checkPermissions();
    return display === 'granted';
  } catch {
    return false;
  }
}

/**
 * สร้าง notification schedule date จาก dueDate + dueTime
 * ถ้าไม่มี dueTime จะแจ้งเตือน 08:00 น. ของวันนั้น
 */
function buildScheduleDate(dueDate, dueTime) {
  const timeStr = dueTime || '08:00';
  return new Date(`${dueDate}T${timeStr}:00`);
}

/**
 * ตั้ง notification สำหรับ todo 1 รายการ
 * - ข้ามถ้า: ไม่มี dueDate, done แล้ว, หรือเลยกำหนดไปแล้ว
 */
export async function scheduleTodoNotification(todo) {
  if (!isNative()) return;
  if (!todo.dueDate || todo.done || todo.repeatEnabled) return;

  const at = buildScheduleDate(todo.dueDate, todo.dueTime);
  if (at <= new Date()) return; // อดีต — ข้าม

  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: uuidToInt(todo.id),
        title: '📋 NoteRealm Todo',
        body: todo.title + (todo.note ? `\n${todo.note}` : ''),
        schedule: { at, allowWhileIdle: true },
        sound: null,
        extra: { todoId: todo.id },
      }],
    });
  } catch (err) {
    console.warn('[Notif] schedule failed:', err);
  }
}

/**
 * ยกเลิก notification ของ todo (เมื่อ done หรือลบ)
 */
export async function cancelTodoNotification(todoId) {
  if (!isNative()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: uuidToInt(todoId) }] });
  } catch (err) {
    console.warn('[Notif] cancel failed:', err);
  }
}

/**
 * ตั้ง notification ให้ทุก todo ที่มี dueDate ในอนาคต (เรียกตอน app load)
 * - ลบ notification เก่าทั้งหมดก่อน แล้ว schedule ใหม่
 */
export async function scheduleAllTodoNotifications(todos) {
  if (!isNative()) return;

  const hasPermission = await checkNotificationPermission();
  if (!hasPermission) return;

  const now = new Date();
  const notifications = [];

  for (const todo of todos) {
    if (!todo.dueDate || todo.done || todo.deletedAt || todo.repeatEnabled) continue;
    const at = buildScheduleDate(todo.dueDate, todo.dueTime);
    if (at <= now) continue;

    notifications.push({
      id: uuidToInt(todo.id),
      title: '📋 NoteRealm Todo',
      body: todo.title + (todo.note ? `\n${todo.note}` : ''),
      schedule: { at, allowWhileIdle: true },
      sound: null,
      extra: { todoId: todo.id },
    });
  }

  if (notifications.length === 0) return;

  try {
    // Cancel ที่ค้างอยู่ก่อน แล้ว schedule ใหม่
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
    await LocalNotifications.schedule({ notifications });
  } catch (err) {
    console.warn('[Notif] bulk schedule failed:', err);
  }
}
