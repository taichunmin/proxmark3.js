import { logTime, sleep } from './utils'
import BufferLE from './BufferLE'

export default class WebSerial { // Web Serial
  constructor (filters) {
    this.filters = filters
    this.port = null
    this.reader = null
  }

  static isSupported () {
    return 'serial' in navigator
  }

  async requestPort () {
    if (!WebSerial.isSupported()) throw new Error('不支援 WebSerial')
    this.port = await navigator.serial.requestPort({ filters: this.filters })
    await this.port.open({ baudRate: 9600 })
  }

  async ensurePortOpen () {
    if (this.port) return
    await this.requestPort(this.filters)
  }

  async read () {
    await this.ensurePortOpen()
    if (!this.reader) {
      for (let i = 0; i < 100; i++) { // wait 1s for this.port.readable
        if (this.port.readable) break
        if (i === 99) throw new Error('SerialPort is not readable')
        await sleep(10)
      }
      this.reader = this.port.readable.getReader()
    }
    if (!this.reader) throw new Error('Failed to getReader')
    const { value, done } = await this.reader.read()
    if (done) {
      this.reader.releaseLock()
      this.reader = null
    }
    // - console.log('serial.read', value)
    return BufferLE.fromView(value)
  }

  async write (data) {
    if (!(data instanceof BufferLE)) throw new TypeError('data should be BufferLE')
    logTime(`write ${data.byteLength} bytes`, data)
    await this.ensurePortOpen()
    for (let i = 0; i < 100; i++) { // wait 1s for this.port.writable
      if (this.port.writable) break
      if (i === 99) throw new Error('SerialPort is not writable')
      await sleep(10)
    }
    const writer = this.port.writable.getWriter()
    if (!writer) throw new Error('Failed to getWriter')
    await writer.write(data)
    writer.releaseLock()
  }
}
