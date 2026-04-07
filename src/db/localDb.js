import Dexie from 'dexie';

export const db = new Dexie('NoteRealm');

// syncSource: 'local' = ยังไม่ได้ push ขึ้น server
//             'server' = มีบน server แล้ว
// dirty: true = มีการแก้ไขที่ยังไม่ได้ push
db.version(1).stores({
  notes: 'id, updatedAt, syncSource, dirty, deletedAt, archived',
  todos: 'id, updatedAt, syncSource, dirty, deletedAt',
  imageCache: 'url', // key = R2 URL → value = { url, blob, cachedAt }
});
