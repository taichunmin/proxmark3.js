import Packet from './Packet.js'

export default class PacketResponseNG {
  // https://github.com/RfidResearchGroup/proxmark3/blob/master/doc/new_frame_format.md
  // magic 4 + length 2 + status 2 + cmd 2 + data max 512 + crc 2
  constructor (pack) {
    if (!pack || !(pack instanceof Packet)) throw new TypeError('invalid pack')
    this.pack = pack
    this.data = pack.subarray(10 + (this.ng ? 0 : 24), pack.byteLength - 2)
  }

  get len () { return this.pack.byteLength }
  get ng () { return (this.pack.getUint8(5) & 0x80) > 0 }
  get status () { return this.pack.getInt16(6) }
  get cmd () { return this.pack.getUint16(8) }
  get crc () { return this.pack.getUint16(this.pack.byteLength - 2) }
  getArg (index) { return this.pack.getBigUint64(10 + (index << 3)) }
}
