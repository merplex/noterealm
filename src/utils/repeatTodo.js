import { v4 as uuidv4 } from 'uuid';

const MAX_COUNT = { day: 30, week: 20, month: 12, year: 5 };

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
 * - ตรวจสอบ repeatParentId + dueDate ก่อนสร้าง เพื่อไม่สร้างซ้ำ
 * - คืน array ของ todo ใหม่ที่ยังไม่มีใน existingTodos
 */
export function generateRepeatInstances(parentTodo, existingTodos) {
  const { dueDate, repeatEvery, repeatUnit, id, repeatEnabled } = parentTodo;
  if (!dueDate || !repeatEvery || !repeatUnit || !repeatEnabled) return [];

  // ดึง set ของ dueDate ที่มีอยู่แล้วสำหรับ parent นี้
  const existingDates = new Set(
    existingTodos
      .filter(t => t.repeatParentId === id && !t.deletedAt)
      .map(t => t.dueDate)
  );

  const maxCount = MAX_COUNT[repeatUnit] || 10;
  const instances = [];
  let current = dueDate;

  for (let i = 0; i < maxCount; i++) {
    current = addRepeatInterval(current, repeatEvery, repeatUnit);
    if (!existingDates.has(current)) {
      const now = new Date().toISOString();
      instances.push({
        ...parentTodo,
        id: uuidv4(),
        dueDate: current,
        done: false,
        completedAt: undefined,
        repeatEnabled: false,     // child ไม่ repeat ต่อ
        repeatParentId: id,       // อ้างอิง parent
        createdAt: now,
        updatedAt: now,
      });
      existingDates.add(current); // ป้องกันซ้ำใน batch เดียวกัน
    }
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
