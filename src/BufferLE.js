import _ from 'lodash'

export default class BufferLE extends Uint8Array {
  constructor (...args) {
    super(...args)
    this.dv = new DataView(this.buffer, this.byteOffset, this.byteLength)
  }

  static fromView (view) {
    if (!ArrayBuffer.isView(view)) throw new TypeError('invalid view')
    return new BufferLE(view.buffer, view.byteOffset, view.byteLength)
  }

  static fromHex (hex) {
    return new BufferLE(_.map(hex.match(/.{2}/g), b => _.parseInt(b, 16)))
  }

  static fromUtf8 (utf8) {
    return BufferLE.fromView(new TextEncoder().encode(utf8))
  }

  static merge (...bufs) {
    if (bufs.length < 2) return bufs.length ? bufs[0] : new BufferLE()
    const len = _.sumBy(bufs, 'byteLength')
    const merged = new BufferLE(len)
    _.reduce(bufs, (offset, buf) => {
      merged.set(buf, offset)
      return offset + buf.byteLength
    }, 0)
    return merged
  }

  // 共通屬性
  get hex () { return _.map(this, b => `0${b.toString(16)}`.slice(-2)).join('') }
  get utf8 () { return new TextDecoder().decode(this) }

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
    return this.dv[key](byteOffset, value, littleEndian)
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
}
