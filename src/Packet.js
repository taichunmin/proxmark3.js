import _ from 'lodash'

const BASE64URL_CHAR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

export default class Packet extends Uint8Array {
  constructor (...args) {
    super(...args)
    this.dv = new DataView(this.buffer, this.byteOffset, this.length)
  }

  static fromView (view) {
    if (!ArrayBuffer.isView(view)) throw new TypeError('invalid view')
    return new Packet(view.buffer, view.byteOffset, view.byteLength)
  }

  static fromHex (hex, reverse = false) {
    const matches = hex.replace(/[^0-9A-Fa-f]/g, '').match(/.{2}/g)
    if (reverse) matches.reverse()
    return new Packet(_.map(matches, b => _.parseInt(b, 16)))
  }

  static fromUtf8 (utf8) {
    return Packet.fromView(new TextEncoder().encode(utf8))
  }

  static merge (...packs) {
    if (packs.length < 2) return packs.length ? packs[0] : new Packet()
    const len = _.sumBy(packs, 'length')
    const merged = new Packet(len)
    _.reduce(packs, (offset, pack) => {
      merged.set(pack, offset)
      return offset + pack.length
    }, 0)
    return merged
  }

  static isLen (pack, len = null) {
    return !(pack instanceof Packet) || (!_.isNil(len) && pack.length !== len)
  }

  isEqual (other) {
    return this.length === other.length && this.every((v, k) => v === other[k])
  }

  chunk (bytesPerChunk) {
    if (bytesPerChunk < 1) throw new TypeError('invalid bytesPerChunk')
    const chunks = []
    for (let i = 0; i < this.length; i += bytesPerChunk) chunks.push(this.subarray(i, i + bytesPerChunk))
    return chunks
  }

  // 共通屬性
  get hex () { return _.map(this, b => (b + 0x100).toString(16).slice(-2)).join('').toUpperCase() }
  get rhex () { return _.map(this, b => (b + 0x100).toString(16).slice(-2)).reverse().join('').toUpperCase() }
  get inspect () { return `${_.map(this, b => (b + 0x100).toString(16).slice(-2)).join(' ').toUpperCase()} (len=${this.length})` }
  get utf8 () { return new TextDecoder().decode(this) }
  get base64url () {
    const tmp = []
    for (let i = 0; i < this.length; i += 3) {
      let u24 = 0
      for (let j = 0; j < 3; j++) u24 |= ((i + j) < this.length ? this[i + j] : 0) << (16 - j * 8)
      tmp.push(_.times(Math.min(this.length - i + 1, 4), j => BASE64URL_CHAR[(u24 >> (18 - 6 * j)) & 0x3F]).join(''))
    }
    return tmp.join('')
  }

  // DataView getter
  dvGetter (key, byteOffset, littleEndian = true) {
    if (byteOffset < 0) byteOffset += this.dv.byteLength
    return this.dv[key](byteOffset, littleEndian)
  }

  getBigInt64 (...args) { return this.dvGetter('getBigInt64', ...args) }
  getBigUint64 (...args) { return this.dvGetter('getBigUint64', ...args) }
  getFloat32 (...args) { return this.dvGetter('getFloat32', ...args) }
  getFloat64 (...args) { return this.dvGetter('getFloat64', ...args) }
  getInt16 (...args) { return this.dvGetter('getInt16', ...args) }
  getInt32 (...args) { return this.dvGetter('getInt32', ...args) }
  getInt8 (...args) { return this.dvGetter('getInt8', ...args) }
  getUint16 (...args) { return this.dvGetter('getUint16', ...args) }
  getUint32 (...args) { return this.dvGetter('getUint32', ...args) }
  getUint8 (...args) { return this.dvGetter('getUint8', ...args) }

  // DataView setter
  dvSetter (key, byteOffset, value, littleEndian = true) {
    if (byteOffset < 0) byteOffset += this.dv.byteLength
    this.dv[key](byteOffset, value, littleEndian)
    return this
  }

  setBigInt64 (...args) { return this.dvSetter('setBigInt64', ...args) }
  setBigUint64 (...args) { return this.dvSetter('setBigUint64', ...args) }
  setFloat32 (...args) { return this.dvSetter('setFloat32', ...args) }
  setFloat64 (...args) { return this.dvSetter('setFloat64', ...args) }
  setInt16 (...args) { return this.dvSetter('setInt16', ...args) }
  setInt32 (...args) { return this.dvSetter('setInt32', ...args) }
  setInt8 (...args) { return this.dvSetter('setInt8', ...args) }
  setUint16 (...args) { return this.dvSetter('setUint16', ...args) }
  setUint32 (...args) { return this.dvSetter('setUint32', ...args) }
  setUint8 (...args) { return this.dvSetter('setUint8', ...args) }

  getUint24 (offset, little = true) {
    const [p8, p16] = little ? [offset + 2, offset] : [offset, offset + 1]
    return (this.getUint8(p8) << 16) | this.getUint16(p16, little)
  }

  setUint24 (offset, value, little = true) {
    const [p8, p16] = little ? [offset + 2, offset] : [offset, offset + 1]
    this.setUint8(p8, (value >> 16) & 0xFF)
    this.setUint16(p16, value & 0xFFFF, little)
    return this
  }

  getInt24 (offset, little = true) {
    const u24 = this.getUint24(offset, little)
    return u24 - (u24 > 0x7FFFFF ? 0x1000000 : 0)
  }

  setInt24 (offset, value, little = true) {
    return this.setUint24(offset, value & 0xFFFFFF, little)
  }
}
