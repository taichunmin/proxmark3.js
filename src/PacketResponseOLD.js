import BufferLE from './BufferLE'

export default class PacketResponseOLD {
  constructor (buf) {
    if (!buf || !(buf instanceof BufferLE)) throw new TypeError('invalid buf')
    this.buf = buf
    this.data = buf.subarray(32)
  }

  get cmd () { return Number(BigInt.asUintN(16, this.buf.getBigUint64(0))) }
  getArg (index) { return this.buf.getBigUint64(8 + (index << 3)) }
}
