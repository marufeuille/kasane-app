/**
 * vitest の全テスト実行前に、IndexedDB polyfill（fake-indexeddb）をグローバルに登録する。
 *
 * Dexie は globalThis.indexedDB を参照するため、src/db/db.ts の評価より前に
 * IndexedDB / IDBFactory 等が存在している必要がある。setupFiles は各テストファイルの
 * 評価前に走るため、ここで安全に登録できる。
 */
import 'fake-indexeddb/auto'
