import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * vitest 専用設定。
 *
 * vite.config.ts（VitePWA 等を含む）とは分離し、テスト実行時はこちらを優先使用する。
 * Dexie は globalThis.indexedDB を参照するため、setupFiles で fake-indexeddb を先に登録する。
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
