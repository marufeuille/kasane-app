/**
 * PWA 用アイコンを Node 標準ライブラリのみで生成するスクリプト（scaffold 用）。
 * 外部画像依存を無くすため、単色の RGBA PNG を zlib で直接エンコードする。
 *
 * 実行: node scripts/generate-icons.mjs
 * 出力: public/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon}.png
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '..', 'public', 'icons')

// violet-600 #7c3aed (Kasane のブランドアクセント)
const FILL = [0x7c, 0x3a, 0xed, 0xff]

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(size, [r, g, b, a]) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  // 各走査行 = フィルタバイト(0=None) + size * 4 バイト RGBA
  const row = Buffer.alloc(1 + size * 4)
  for (let x = 0; x < size; x++) {
    const o = 1 + x * 4
    row[o] = r
    row[o + 1] = g
    row[o + 2] = b
    row[o + 3] = a
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row))
  const idat = deflateSync(raw, { level: 9 })

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const TARGETS = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

mkdirSync(OUT_DIR, { recursive: true })
for (const { name, size } of TARGETS) {
  const path = resolve(OUT_DIR, name)
  writeFileSync(path, encodePng(size, FILL))
  console.log(`wrote ${path} (${size}x${size})`)
}
