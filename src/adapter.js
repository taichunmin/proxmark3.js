import _ from 'lodash'
import { logTime, sleep } from './utils'
import BufferLE from './BufferLE'
import PacketResponseNG from './PacketResponseNG'
import PacketResponseOLD from './PacketResponseOLD'
import WebSerial from './WebSerial'

export const CMD = {
  ACK: 0x00ff,
  HF_ISO14443A_READER: 0x0385,
  HF_MIFARE_READBL: 0x0620,
  HF_MIFARE_READSC: 0x0621,
  NACK: 0x00fe,
  UNKNOWN: 0xffff,
  WTX: 0x0116,
}

class Adapter {
  constructor () {
    this.serial = new WebSerial([
      // http://www.linux-usb.org/usb.ids
      // about://device-log
      { usbVendorId: 0x2d2d, usbProductId: 0x504d }, // proxmark.org: Proxmark3
      { usbVendorId: 0x9ac4, usbProductId: 0x4b8f }, // J. Westhues: ProxMark-3 RFID Instrument (old)
      { usbVendorId: 0x1d6b, usbProductId: 0x0106 }, // iCopy-X
    ])
  }

  async sendCommandNG ({ cmd, data = null, ng = true }) {
    if (data && !(data instanceof BufferLE)) throw new TypeError('data should be BufferLE')
    const dataLen = data?.byteLength ?? 0
    if (dataLen > 512) throw new TypeError('data.byteLength > 512')
    const buf = new BufferLE(dataLen + 10) // magic 4 + length 2 + cmd 2 + dataLen + crc 2
    buf.set(BufferLE.fromUtf8('PM3a'))
    buf.setUint16(4, dataLen + (ng ? 0x8000 : 0))
    buf.setUint16(6, Number(BigInt.asUintN(16, BigInt(cmd))))
    if (dataLen) buf.set(data, 8)
    buf.set(BufferLE.fromUtf8('a3'), dataLen + 8) // COMMANDNG_POSTAMBLE_MAGIC = a3
    await this.serial.write(buf)
  }

  async sendCommandMix ({ cmd, arg = [], data = null }) {
    if (data && !(data instanceof BufferLE)) throw new TypeError('data should be BufferLE')
    const dataLen = data?.byteLength ?? 0
    if (dataLen > 488) throw new TypeError('data.byteLength > 488')
    const newData = new BufferLE(dataLen + 24) // mix format: 3 * arg 8
    if (dataLen) newData.set(data, 24)
    for (let i = 0; i < 3; i++) {
      arg[i] = arg[i] ?? 0n
      if (typeof arg[i] !== 'bigint') throw new TypeError(`arg${i + 1} should be BigInt`)
      newData.setBigUint64(i << 3, arg[i])
    }
    return await this.sendCommandNG({ cmd, data: newData, ng: false })
  }

  clearSerialReadBuffer () {
    if (!this.serialReadBuffer) this.serialReadBuffer = {}
    const ctx = this.serialReadBuffer
    ctx.chunks = []
    ctx.len = 0
  }

  async readBytes (len) {
    if (!_.isSafeInteger(len) || len < 1) throw new TypeError(`invalid len = ${len}`)
    if (!this.serialReadBuffer) this.clearSerialReadBuffer()
    const ctx = this.serialReadBuffer
    while (ctx.len < len) {
      const chunk = await this.serial.read()
      ctx.chunks.push(chunk)
      ctx.len += chunk.byteLength
    }
    const merged = BufferLE.merge(...ctx.chunks)
    const resp = merged.slice(0, len)
    ctx.len = merged.byteLength - len
    ctx.chunks = ctx.len > 0 ? [merged.slice(len)] : []
    // - console.log('readBytes', resp)
    return resp
  }

  async readResp () {
    // https://github.com/RfidResearchGroup/proxmark3/blob/master/doc/new_frame_format.md
    // magic 4 + length 2 + status 2 + cmd 2 + data max 512 + crc 2
    const pre = await this.readBytes(10)
    // - console.log('pre', pre)
    const resp = pre.getUint32(0) === 0x62334d50 // PM3b
      ? new PacketResponseNG(BufferLE.merge(pre, await this.readBytes((pre.getUint16(4) & 0x7fff) + 2)))
      : new PacketResponseOLD(BufferLE.merge(pre, await this.readBytes(534)))
    logTime('readResp', resp)
    return resp
  }

  async waitRespTimeout (cmd, timeout = 25e2) {
    await this.serial.ensurePortOpen()
    timeout += 100 // communication_delay 100ms
    const ctx = { startedAt: Date.now(), finished: 0 }
    try {
      return await Promise.race([
        (async () => {
          while (!ctx.finished) {
            const resp = await this.readResp()
            if (cmd === CMD.UNKNOWN || resp.cmd === cmd) return resp
            if (resp.cmd === CMD.WTX && resp.data.byteLength === 2) {
              const wtx = resp.data.getUint16(0)
              if (wtx < 0xffff) {
                logTime(`waiting time extend: ${timeout} + ${wtx} = ${timeout + wtx} ms`)
                timeout += wtx
              }
            }
          }
        })(),
        (async () => {
          if (timeout < 0) return new Promise(resolve => {}) // 不設定 timeout
          while (!ctx.finished) {
            const sleepts = ctx.startedAt + timeout - Date.now()
            if (sleepts < 0) throw new Error(`waitRespTimeout ${timeout}ms`)
            await sleep(sleepts)
          }
        })(),
      ])
    } finally {
      ctx.finished = 1
    }
  }
}

export default new Adapter()
