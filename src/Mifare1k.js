import _ from 'lodash'
import Packet from './Packet.js'

export default class Mifare1k {
  constructor (pack) {
    if (!pack) pack = new Packet(1024)
    if (!(pack instanceof Packet) || pack.byteLength !== 1024) throw new TypeError('invalid pack')
    this.pack = pack
  }

  static fromEml (eml) {
    return new Mifare1k(Packet.fromHex(eml.replace(/-/g, '0')))
  }

  static isValidKey (key) {
    return key instanceof Packet && key.byteLength === 6
  }

  static isValidAcl (acl) {
    const u4arr = _.flatten(_.times(3, i => [(acl[i] & 0xF0) >> 4, acl[i] & 0xF]))
    return _.every([[1, 2], [0, 5], [3, 4]], ([a, b]) => u4arr[a] ^ u4arr[b] === 0xF)
  }

  static keysToHexUniq (keys) {
    if (keys instanceof Packet) {
      if (!keys.byteLength || keys.byteLength % 6) throw new TypeError('invalid keys.byteLength')
      keys = keys.chunk(6)
    }
    if (!_.isArray(keys)) throw new TypeError('invalid keys type')
    return _.uniq(_.map(_.filter(keys, Mifare1k.isValidKey), 'hex')).join('\n')
  }

  get eml () {
    return _.times(64, i => this.pack.subarray(i * 16, (i + 1) * 16).hex).join('\n')
  }

  get kas () {
    return _.map(_.times(16, i => (i * 64) + 48), i => this.pack.subarray(i, i + 6))
  }

  get kbs () {
    return _.map(_.times(16, i => (i * 64) + 58), i => this.pack.subarray(i, i + 6))
  }

  get keys () {
    return _.map(_.flatten(_.times(16, i => [(i * 64) + 48, (i * 64) + 58])), i => this.pack.subarray(i, i + 6))
  }

  get uid () {
    const tmp = []
    for (let i = 0; i < 3; i++) {
      if (this.pack[(i << 2) + 3] !== 0x88) {
        tmp.push(this.pack.subarray(i << 2, (i << 2) + 4))
        break
      }
      tmp.push(this.pack.subarray(i << 2, (i << 2) + 3))
    }
    return Packet.merge(...tmp)
  }

  getBlock (i) {
    return this.pack.subarray(i * 16, (i + 1) * 16)
  }

  setBlock (i, block) {
    if (!(block instanceof Packet) || block.byteLength !== 16) throw new TypeError('invalid block')
    this.pack.set(block, i * 16)
    return this
  }

  isEqual (other) {
    return other instanceof Mifare1k && this.pack.isEqual(other.pack)
  }

  isSectorAclValid (i) {
    return Mifare1k.isValidAcl(this.pack.subarray((i * 64) + 54, (i * 64) + 57))
  }

  isAllAclsValid () {
    return _.every(_.times(16), i => this.isSectorAclValid(i))
  }
}
