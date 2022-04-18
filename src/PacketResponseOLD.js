import Packet from './Packet.js'

export default class PacketResponseOLD {
  constructor (pack) {
    if (!pack || !(pack instanceof Packet)) throw new TypeError('invalid pack')
    this.pack = pack
    this.data = pack.subarray(32)
  }

  get cmd () { return this.pack.getUint16(0) }
  getArg (index) { return this.pack.getBigUint64(8 + (index << 3)) }
}
