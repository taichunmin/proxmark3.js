import Packet from './Packet.js'

export default class Iso14aCardSelect {
  constructor (pack) {
    // uid 10 + uidlen 1 + atqa 2 + sak 1 + ats_len 1 + ats 256 = 271
    if (!pack || !(pack instanceof Packet) || pack.byteLength < 15) throw new TypeError('invalid pack')
    this.pack = pack
    this.uid = pack.subarray(0, pack.getUint8(10))
    this.ats = pack.subarray(15, 15 + pack.getUint8(14))
  }

  get atqa () { return this.pack.subarray(11, 13) }
  get sak () { return this.pack.subarray(13, 14) }
}
