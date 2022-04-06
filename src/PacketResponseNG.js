import BufferLE from './BufferLE'

export default class PacketResponseNG {
  // https://github.com/RfidResearchGroup/proxmark3/blob/master/doc/new_frame_format.md
  // magic 4 + length 2 + status 2 + cmd 2 + data max 512 + crc 2
  constructor (buf) {
    if (!buf || !(buf instanceof BufferLE)) throw new TypeError('invalid buf')
    this.buf = buf
    this.data = buf.subarray(10 + (this.ng ? 0 : 24), buf.byteLength - 2)
  }

  get len () { return this.buf.byteLength }
  get ng () { return (this.buf.getUint8(5) & 0x80) > 0 }
  get status () { return this.buf.getInt16(6) }
  get cmd () { return this.buf.getUint16(8) }
  get crc () { return this.buf.getUint16(this.buf.byteLength - 2) }
  getArg (index) { return this.buf.getBigUint64(10 + (index << 3)) }
}
