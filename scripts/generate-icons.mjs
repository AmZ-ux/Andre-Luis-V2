import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const GRID = 32

const BLUE = [37, 99, 235]
const DARK_BLUE = [29, 78, 216]
const WHITE = [255, 255, 255]
const DARK = [15, 23, 42]

function set(px, x, y, [r, g, b, a = 255]) {
  if (x < 0 || y < 0 || x >= GRID || y >= GRID) return
  const i = (y * GRID + x) * 4
  px[i] = r
  px[i + 1] = g
  px[i + 2] = b
  px[i + 3] = a
}

function rect(px, x0, y0, x1, y1, c) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) set(px, x, y, c)
  }
}

function drawIcon() {
  const px = new Uint8Array(GRID * GRID * 4)
  rect(px, 0, 0, 31, 31, BLUE)
  rect(px, 5, 10, 26, 11, WHITE)
  rect(px, 4, 12, 27, 27, WHITE)
  rect(px, 7, 13, 11, 16, DARK_BLUE)
  rect(px, 13, 13, 17, 16, DARK_BLUE)
  rect(px, 19, 13, 23, 16, DARK_BLUE)
  rect(px, 4, 18, 27, 18, DARK_BLUE)
  rect(px, 8, 23, 12, 26, DARK)
  rect(px, 20, 23, 24, 26, DARK)
  rect(px, 8, 27, 12, 27, BLUE)
  rect(px, 20, 27, 24, 27, BLUE)
  return px
}

function scaleNearest(src, size) {
  const out = new Uint8Array(size * size * 4)
  const factor = size / GRID
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.min(GRID - 1, Math.floor(x / factor))
      const sy = Math.min(GRID - 1, Math.floor(y / factor))
      const si = (sy * GRID + sx) * 4
      const di = (y * size + x) * 4
      out[di] = src[si]
      out[di + 1] = src[si + 1]
      out[di + 2] = src[si + 2]
      out[di + 3] = src[si + 3]
    }
  }
  return out
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePNG(rgba, width) {
  const height = width
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (1 + width * 4) + 1)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const base = drawIcon()
for (const size of [192, 512]) {
  const png = encodePNG(scaleNearest(base, size), size)
  const file = join(outDir, `icon-${size}.png`)
  writeFileSync(file, png)
  console.log(`Gerado ${file} (${png.length} bytes)`)
}
