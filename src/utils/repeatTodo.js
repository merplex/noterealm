import { v4 as uuidv4 } from 'uuid';

// fallback max count ถ้าไม่มี end date — สร้างแค่ instance ใกล้ๆ ก่อน
const FALLBACK_MAX = { day: 3, week: 2, month: 2, year: 1 };

export function addRepeatInterval(dateStr, repeatEvery, repeatUnit) {
  const d = new Date(dateStr + 'T00:00:00');
  if (repeatUnit === 'day') d.setDate(d.getDate() + repeatEvery);
  else if (repeatUnit === 'week') d.setDate(d.getDate() + repeatEvery * 7);
  else if (repeatUnit === 'month') d.setMonth(d.getMonth() + repeatEvery);
  else if (repeatUnit === 'year') d.setFullYear(d.getFullYear() + repeatEvery);
  return d.toISOString().split('T')[0];
}

/**
 * สร้าง child instances จาก parent repeat todo
 *
 * Model:
 *  - repeatStartDate : วันแรกที่เริ่มสร้าง instance
 *  - dueDate         : วันสิ้นสุด (หยุดสร้างหลังวันนี้); ไม่กำหนด = ใช้ fallback max count
 *  - dueTime         : เวลาที่ใช้กับ **ทุก** instance
 */
export function generateRepeatInstances(parentTodo, existingTodos) {
  const {
    repeatStartDate,
    dueDate: endDate,
    dueTime,
    repeatEvery,
    repeatUnit,
    id,
    repeatEnabled,
  } = parentTodo;

  if (!repeatStartDate || !repeatEvery || !repeatUnit || !repeatEnabled) return [];

  // set ของ dueDate ที่มีอยู่แล้ว (ป้องกันซ้ำ)
  const existingDates = new Set(
    existingTodos
      .filter(t => t.repeatParentId === id && !t.deletedAt)
      .map(t => t.dueDate)
  );

  const endDateObj = endDate ? new Date(endDate + 'T23:59:59') : null;
  const maxCount = FALLBACK_MAX[repeatUnit] || 30;
  const instances = [];
  let current = repeatStartDate;
  const SAFETY = 500;

  // ถ้าเวลาของ instance แรก (startDate + dueTime) ผ่านไปแล้ว → เลื่อนไปรอบถัดไป
  // เช่น ตอนนี้ 20:00 ตั้งเริ่ม วันที่ 15 เวลา 10:00 → instance แรกจะเป็นวันที่ 17 10:00
  if (dueTime) {
    const now = new Date();
    const [h, m] = dueTime.split(':').map(Number);
    let advance = 0;
    while (advance < SAFETY) {
      const occ = new Date(current + 'T00:00:00');
      occ.setHours(h, m, 0, 0);
      if (occ > now) break; // ยังไม่ถึงเวลา → ใช้ได้
      const next = addRepeatInterval(current, repeatEvery, repeatUnit);
      if (endDateObj && new Date(next + 'T00:00:00') > endDateObj) return []; // ไม่มีรอบในอนาคตแล้ว
      current = next;
      advance++;
    }
  }

  let count = 0;
  while (count < SAFETY) {
    count++;

    // หยุดถ้าเกิน end date
    if (endDateObj && new Date(current + 'T00:00:00') > endDateObj) break;
    // หยุดถ้าไม่มี end date และครบ max count
    if (!endDateObj && instances.length >= maxCount) break;

    if (!existingDates.has(current)) {
      const now = new Date().toISOString();
      instances.push({
        ...parentTodo,
        id: uuidv4(),
        dueDate: current,
        dueTime: dueTime || undefined,   // เวลาเดียวกันทุก instance
        done: false,
        completedAt: undefined,
        repeatEnabled: false,            // child ไม่ repeat ต่อ
        repeatParentId: id,
        repeatStartDate: undefined,      // child ไม่มี start date
        createdAt: now,
        updatedAt: now,
      });
      existingDates.add(current);
    }

    current = addRepeatInterval(current, repeatEvery, repeatUnit);
  }

  return instances;
}

/** คืน label key สำหรับ repeat unit */
export function repeatLabel(repeatEvery, repeatUnit) {
  if (repeatUnit === 'day' && repeatEvery === 1) return 'repeat.daily';
  if (repeatUnit === 'day' && repeatEvery === 2) return 'repeat.every2days';
  if (repeatUnit === 'week' && repeatEvery === 1) return 'repeat.weekly';
  if (repeatUnit === 'week' && repeatEvery === 2) return 'repeat.every2weeks';
  if (repeatUnit === 'month' && repeatEvery === 1) return 'repeat.monthly';
  if (repeatUnit === 'month' && repeatEvery === 2) return 'repeat.every2months';
  if (repeatUnit === 'month' && repeatEvery === 3) return 'repeat.every3months';
  if (repeatUnit === 'month' && repeatEvery === 6) return 'repeat.every6months';
  if (repeatUnit === 'year' && repeatEvery === 1) return 'repeat.yearly';
  return 'repeat.custom';
}
