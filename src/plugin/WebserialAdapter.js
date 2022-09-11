const WEBSERIAL_FILTERS = [
  // http://www.linux-usb.org/usb.ids
  // about://device-log
  { usbVendorId: 0x2D2D, usbProductId: 0x504D }, // proxmark.org: Proxmark3
  { usbVendorId: 0x9AC4, usbProductId: 0x4B8F }, // J. Westhues: ProxMark-3 RFID Instrument (old)
  { usbVendorId: 0x1D6B, usbProductId: 0x0106 }, // iCopy-X
]

export default class Pm3WebserialAdapter {
  constructor () {
    this._isOpen = false
    this.name = 'adapter'
    this.port = null
    this.portInfo = null
  }

  install (context, pluginOption) {
    const { pm3, utils } = context

    if (pm3.$adapter) throw new Error('adapter already exists')

    const isSupport = async () => {
      return 'serial' in navigator
    }

    const isOpen = () => this._isOpen

    const disconnect = async () => {
      utils.logTime('device disconnected')
      this._isOpen = false
      this.portInfo = null
      this.port.removeEventListener('disconnect', disconnect)
      this.port = null
    }

    const connect = async () => {
      if (!await isSupport()) throw new Error('WebSerial not supported')

      // request port
      this.port = await navigator.serial.requestPort({ filters: WEBSERIAL_FILTERS })
      if (!this.port) throw new Error('no port')
      const info = this.portInfo = await this.port.getInfo()
      utils.logTime(`port selected, usbVendorId = ${info.usbVendorId}, usbProductId = ${info.usbProductId}`)

      await this.port.open({ baudRate: 115200 })
      this.port.addEventListener('disconnect', disconnect)

      for (let i = 0; !isOpen() && i < 100; i++) {
        if (!this.port?.readable || !this.port?.writable) {
          await utils.sleep(10)
          continue
        }
        pm3.tx = new TransformStream({
          flush: async controller => {
            await disconnect()
            controller.terminate()
          },
          transform: async (pack, controller) => {
            controller.enqueue(pack)
          },
        })
        pm3.tx.readable.pipeTo(this.port.writable) // no wait
        this.port.readable.pipeTo(pm3.rx.writable) // no wait
        this._isOpen = true
      }
      if (!isOpen()) {
        await disconnect()
        throw new Error('WebSerial not supported')
      }
    }

    pm3.addMiddleware('writePacket', async (ctx, next) => {
      if (!isOpen()) await connect()
      return await next()
    })

    return {
      connect,
      disconnect,
      isOpen,
      isSupport,
    }
  }
}
