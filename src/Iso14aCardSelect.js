import BufferLE from './BufferLE'

export default class Iso14aCardSelect {
  constructor (buf) {
    // uid 10 + uidlen 1 + atqa 2 + sak 1 + ats_len 1 + ats 256 = 271
    if (!buf || !(buf instanceof BufferLE) || buf.byteLength < 15) throw new TypeError('invalid buf')
    this.buf = buf
    this.uid = buf.subarray(0, buf.getUint8(10))
    this.ats = buf.subarray(15, 15 + buf.getUint8(14))
  }

  get atqa () { return this.buf.getUint16(11) }
  get sak () { return this.buf.getUint8(13) }
}
