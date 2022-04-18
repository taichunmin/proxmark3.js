import _ from 'lodash'
import { crc16A, crc16X25 } from './crc16.js'
import Iso14aCardSelect from './Iso14aCardSelect.js'
import Mifare1k from './Mifare1k.js'
import Packet from './Packet.js'
import Proxmark3Adapter, { CMD } from './Proxmark3Adapter.js'
import * as utils from './utils'

const { retry } = utils

const mfTypeToMaxSector = (() => {
  const MF_MAX_SECTOR = { mini: 5, '1k': 16, '2k': 32, '4k': 40 }
  return type => {
    type = _.toLower(type)
    if (!MF_MAX_SECTOR[type]) throw new TypeError('invalid mifare type')
    return MF_MAX_SECTOR[type]
  }
})()

export default class Proxmark3 {
  constructor (adapter) {
    this.adapter = adapter ?? new Proxmark3Adapter()
    this.plugins = new Map()
    this.hooks = {}
  }

  // install plugin
  async use (plugin, option = {}) {
    if (!plugin || !_.isFunction(plugin.install) || !_.isString(plugin.name)) throw new TypeError('property plugin.name and method plugin.install is required.')
    const pluginId = `$${plugin.name}`
    if (this.hasPlugin(pluginId)) return this
    const installed = await plugin.install({
      Packet,
      pm3: this,
      CMD,
      utils,
    }, option)
    // console.log(installed)
    if (!_.isNil(installed)) this[pluginId] = installed
    this.addPlugin(pluginId, plugin)
    return this
  }

  addPlugin (pluginId, plugin) {
    this.plugins.set(pluginId, plugin)
  }

  hasPlugin (pluginId) {
    return this.plugins.has(pluginId)
  }

  async hfDropField () {
    this.adapter.clearSerialReadBuffer()
    await this.adapter.sendCommandNG({ cmd: CMD.HF_DROPFIELD })
  }

  async hf14aDeselectCard () {
    await this.adapter.sendCommandMix({ cmd: CMD.HF_ISO14443A_READER })
  }

  async hf14aSelectCard () {
    await this.hfDropField()
    this.adapter.clearSerialReadBuffer()
    await this.adapter.sendCommandMix({ cmd: CMD.HF_ISO14443A_READER, arg: [0b11n] }) // ISO14A_CONNECT | ISO14A_NO_DISCONNECT
    const resp = await this.adapter.waitRespTimeout(CMD.ACK) // cmd = ack
    resp.selectStatus = Number(resp.getArg(0))
    resp.card = new Iso14aCardSelect(resp.data) // mix format: 3 * arg 8
    if (resp.selectStatus === 0) { // 0: couldn't read, 1: OK, with ATS, 2: OK, no ATS, 3: proprietary Anticollision
      throw new Error('failed to select iso14443a card')
    } else if (resp.selectStatus === 3) {
      throw new Error(`Card doesn't support standard iso14443-3 anticollision, ATQA: ${resp.card.atqa.hex}`)
    }
    return resp
  }

  // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/cmdhf14a.c#L1735
  async cmdHf14aInfo () {
    try {
      // TODO: Detect Information
      return await this.hf14aSelectCard()
    } finally {
      await this.hf14aDeselectCard()
    }
  }

  // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/mifare/mifarehost.c#L807
  async cmdMfRdBl (blockNo, keyType, key) {
    if (!(key instanceof Packet)) throw new TypeError('key should be Packet')
    if (key.byteLength !== 6) throw new TypeError('invalid key')
    const data = new Packet(8)
    data.setUint8(0, blockNo)
    data.setUint8(1, keyType)
    data.set(key, 2)
    this.adapter.clearSerialReadBuffer()
    await this.adapter.sendCommandNG({ cmd: CMD.HF_MIFARE_READBL, data })
    const resp = await this.adapter.waitRespTimeout(CMD.HF_MIFARE_READBL)
    if (resp.status) throw new Error('Failed to read block')
    return resp.data
  }

  // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/mifare/mifarehost.c#L786
  async cmdMfRdSc (sectorNo, keyType, key) {
    if (!(key instanceof Packet)) throw new TypeError('key should be Packet')
    if (key.byteLength !== 6) throw new TypeError('invalid key')
    this.adapter.clearSerialReadBuffer()
    await this.adapter.sendCommandMix({ cmd: CMD.HF_MIFARE_READSC, arg: [sectorNo, keyType], data: key })
    const resp = await this.adapter.waitRespTimeout(CMD.ACK)
    const status = Number(resp.getArg(0)) & 0xFF
    if (!status) throw new Error(`Failed to read block, sectorNo = ${sectorNo}, err = ${this.adapter.error}`)
    return resp.data.slice(0, 64)
  }

  async mfReadSectorKeyBA ({ sectorNo, ka, kb }) { // 使用 BA key 嘗試讀取 sector
    const fn1 = async () => {
      try {
        return await this.cmdMfRdSc(sectorNo, 1, kb)
      } catch (err) {}
      return await this.cmdMfRdSc(sectorNo, 0, ka)
    }
    try {
      const sector = await retry(fn1)
      if (ka) sector.set(ka, 48)
      if (kb) sector.set(kb, 58)
      return sector
    } catch (err) {
      throw _.set(new Error(`Failed to read sector ${sectorNo}`), 'data.sectorNo', sectorNo)
    }
  }

  async mfReadCard ({ type = '1k', keys }) {
    if (!keys) throw new TypeError('invalid keys')
    const secKeys = await this.cmdMfFchk({ type, keys })
    const maxSector = mfTypeToMaxSector(type)
    const card = new Packet(maxSector * 64)
    const errors = []
    for (let i = 0; i < maxSector; i++) {
      try {
        card.set(await this.mfReadSectorKeyBA({
          sectorNo: i,
          ka: secKeys[i * 2],
          kb: secKeys[i * 2 + 1],
        }), i * 64)
      } catch (err) {
        errors.push(err)
      }
    }
    return { errors, card }
  }

  // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/cmdhfmf.c#L438
  async cmdMfWrbl (blockNo, keyType, key, block) {
    if (!(key instanceof Packet)) throw new TypeError('key should be Packet')
    if (key.byteLength !== 6) throw new TypeError('invalid key')
    if (!(block instanceof Packet)) throw new TypeError('block should be Packet')
    if (block.byteLength !== 16) throw new TypeError('invalid block')
    const data = new Packet(26)
    data.set(key, 0)
    data.set(block, 10)
    this.adapter.clearSerialReadBuffer()
    await this.adapter.sendCommandMix({ cmd: CMD.HF_MIFARE_WRITEBL, arg: [blockNo, keyType], data })
    const resp = await this.adapter.waitRespTimeout(CMD.ACK)
    const status = Number(resp.getArg(0)) & 0xFF
    if (!status) throw new Error(`Failed to write block, blockNo = ${blockNo}, err = ${this.adapter.error}`)
  }

  async mfWriteSectorKeyBA ({ sectorNo, sector, ka, kb }) {
    if (!(sector instanceof Packet) || sector.byteLength !== 64) throw new TypeError('invalid sector')
    if (!Mifare1k.isValidAcl(sector.subarray(54, 57))) throw new TypeError('invalid sector acl')
    const errors = []
    const fn1 = async (blockNo, block) => {
      try {
        return await this.cmdMfWrbl(blockNo, 1, kb, block)
      } catch (err) {}
      await this.cmdMfWrbl(blockNo, 0, ka, block)
    }
    for (let i = 0; i < 4; i++) {
      const blockNo = (sectorNo * 4) + i
      const block = sector.subarray(i * 16, (i + 1) * 16)
      try {
        await retry(() => fn1(blockNo, block))
      } catch (err) {
        _.set(err, 'data.blockNo', blockNo)
        errors.push(err)
      }
    }
    return { errors }
  }

  async mfWriteCard ({ type = '1k', keys, card }) {
    if (!keys) throw new TypeError('invalid keys')
    const maxSector = mfTypeToMaxSector(type)
    if (!(card instanceof Packet) || card.byteLength !== maxSector * 64) throw new TypeError('invalid card')
    const secKeys = await this.cmdMfFchk({ type, keys })
    const errors = []
    for (let i = 0; i < maxSector; i++) {
      const { errors: errors1 } = await this.mfWriteSectorKeyBA({
        ka: secKeys[i * 2],
        kb: secKeys[i * 2 + 1],
        sector: card.subarray(i * 64, (i + 1) * 64),
        sectorNo: i,
      })
      if (errors1.length) errors.push(...errors1)
    }
    return { errors }
  }

  // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/mifare/mifarehost.c#L866
  async cmdMfEset (blockData, blockNo, blockCnt = 1, blockSize = 16) {
    if (!(blockData instanceof Packet)) throw new TypeError('blockData should be Packet')
    if (blockData.byteLength !== blockCnt * blockSize) throw new TypeError('invalid blockData.byteLength')
    const data = new Packet(blockData.byteLength + 3)
    data.set(new Packet([blockNo, blockCnt, blockSize]))
    data.set(blockData, 3)
    this.adapter.clearSerialReadBuffer()
    await this.adapter.sendCommandNG({ cmd: CMD.HF_MIFARE_EML_MEMSET, data })
  }

  // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/mifare/mifarehost.c#L832
  async cmdMfEget (blockNo) {
    this.adapter.clearSerialReadBuffer()
    await this.adapter.sendCommandNG({ cmd: CMD.HF_MIFARE_EML_MEMGET, data: new Packet([blockNo, 1]) })
    const resp = await this.adapter.waitRespTimeout(CMD.HF_MIFARE_EML_MEMGET)
    if (resp.status) throw new Error('Failed to read block from eml')
    return resp.data
  }

  // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/cmdhfmf.c#L3416
  async cmdMfSim ({
    type = '1k',
    uid,
    atqa,
    sak,
    exitAfter = 0,
    interactive = false,
    nrArAttack = false,
    emukeys = false,
    cve = false,
  }) {
    const data = new Packet(16)
    let flags = 0

    if (uid) {
      if (!(uid instanceof Packet)) throw new TypeError('uid should be Packet')
      if (!_.includes([4, 7, 10], uid.byteLength)) throw new TypeError('invalid uid')
      data.set(uid, 3)
      flags |= (1 << _.floor(uid.byteLength / 3)) // FLAG_4B_UID_IN_DATA, FLAG_7B_UID_IN_DATA, FLAG_10B_UID_IN_DATA
    } else flags |= 0x10 // FLAG_UID_IN_EMUL

    if (atqa) {
      if (!(atqa instanceof Packet)) throw new TypeError('atqa should be Packet')
      if (atqa.byteLength !== 2) throw new TypeError('invalid atqa.byteLength')
      data.set(atqa, 13)
      flags |= 0x800 // FLAG_FORCED_ATQA
    }

    if (sak) {
      if (!(sak instanceof Packet)) throw new TypeError('sak should be Packet')
      if (sak.byteLength !== 1) throw new TypeError('invalid sak.byteLength')
      data.set(sak, 15)
      flags |= 0x1000 // FLAG_FORCED_SAK
    }

    if (interactive) flags |= 0x1 // FLAG_INTERACTIVE
    if (nrArAttack) flags |= 0x20 // FLAG_NR_AR_ATTACK
    if (cve) flags |= 0x2000 // FLAG_CVE21_0430

    const FLAGS_TYPE = {
      mini: 0x80,
      '1k': 0x100,
      '2k': 0x200,
      '4k': 0x400,
    }
    type = _.toLower(type)
    if (!FLAGS_TYPE[type]) throw new TypeError('invalid type')
    flags |= FLAGS_TYPE[type]

    data.setUint16(0, flags)
    data.setUint8(2, exitAfter)

    this.adapter.clearSerialReadBuffer()
    await this.adapter.sendCommandNG({ cmd: CMD.HF_MIFARE_SIMULATE, data })
    if (!interactive) return
    while (true) {
      const resp = await this.adapter.waitRespTimeout(CMD.ACK)
      if (!nrArAttack) break
      if ((Number(resp.getArg(0)) & 0xFFFF) !== CMD.HF_MIFARE_SIMULATE) break
      // TODO: readerAttack not implemented
      console.log('nrArAttack', resp)
    }
  }

  // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/cmdhfmf.c#L4472
  async cmdMfCsetblk (blockNo, data, wipe = false) {
    if (!_.inRange(blockNo, 0, 64)) throw new TypeError('invalid blockNo')
    if (!(data instanceof Packet)) throw new TypeError('data should be Packet')
    if (data.byteLength !== 16) throw new TypeError('invalid data')
    // MAGIC_SINGLE = (MAGIC_WUPC | MAGIC_HALT | MAGIC_INIT | MAGIC_OFF) // 0x1E
    // MAGIC_WIPE = 0x40
    const flags = 0x1E | (wipe ? 0x40 : 0)
    this.adapter.clearSerialReadBuffer()
    await this.adapter.sendCommandMix({ cmd: CMD.HF_MIFARE_CSETBL, arg: [flags, blockNo], data })
    const resp = await this.adapter.waitRespTimeout(CMD.ACK, 35e2)
    const status = Number(resp.getArg(0)) & 0xFF
    if (!status) throw new Error(`Failed to write block, blockNo = ${blockNo}, err = ${this.adapter.error}`)
    return resp.data.slice(0, 4)
  }

  async mfWriteMagicCard ({ type = '1k', card }) {
    const maxSector = mfTypeToMaxSector(type)
    if (!(card instanceof Packet) || card.byteLength !== maxSector * 64) throw new TypeError('invalid card')
    const blocks = card.chunk(16)
    const errors = []
    for (let i = 0; i < blocks.length; i++) {
      try {
        await retry(() => this.cmdMfCsetblk(i, blocks[i]))
      } catch (err) {
        _.set(err, 'data.blockNo', i)
        errors.push(err)
      }
    }
    return { errors }
  }

  // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/cmdhfmf.c#L4662
  async cmdMfCgetblk (blockNo) {
    if (!_.inRange(blockNo, 0, 64)) throw new TypeError('invalid blockNo')
    // MAGIC_SINGLE = (MAGIC_WUPC | MAGIC_HALT | MAGIC_INIT | MAGIC_OFF) // 0x1E
    const flags = 0x1E
    this.adapter.clearSerialReadBuffer()
    await this.adapter.sendCommandMix({ cmd: CMD.HF_MIFARE_CGETBL, arg: [flags, blockNo] })
    const resp = await this.adapter.waitRespTimeout(CMD.ACK)
    const status = Number(resp.getArg(0)) & 0xFF
    if (!status) throw new Error(`Failed to write block, blockNo = ${blockNo}, err = ${this.adapter.error}`)
    return resp.data.slice(0, 16)
  }

  async mfReadMagicCard ({ type = '1k' }) {
    const maxBlock = mfTypeToMaxSector(type) * 4
    const card = new Packet(maxBlock * 16)
    const errors = []
    for (let i = 0; i < maxBlock; i++) {
      try {
        card.set(await retry(() => this.cmdMfCgetblk(i)), i * 16)
      } catch (err) {
        _.set(err, 'data.blockNo', i)
        errors.push(err)
      }
    }
    return { errors, card }
  }

  // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/cmdhf14a.c#L1222
  async cmdHf14aRaw ({
    active = 0, // 0: nothing, 1: active with select, 2: active without select
    crc = false, // calculate and append CRC
    data = new Packet(), // raw bytes to send
    disconnect = true, // keep signal field ON after receive
    ecp = false, // use enhanced contactless polling
    magsafe = false, // use Apple magsafe polling
    numbits = 0, // number of bits to send. Useful for send partial byte
    rats = true, // ISO14443-3 select only (skip RATS)
    reply = true, // has reply or not
    timeout = 0, // timeout in milliseconds
    topaz = false, // use Topaz protocol to send command
  } = {}) {
    if (!(data instanceof Packet)) throw new TypeError('invalid data type')
    if (data.byteLength >= 512) throw new TypeError('invalid data length')
    if (crc) { // crc
      if (data.byteLength >= 510) throw new TypeError('failed to add CRC') // PM3_CMD_DATA_SIZE 512 - 2 = 510
      if (data.byteLength > 0) data = Packet.merge(data, topaz ? crc16X25(data) : crc16A(data))
    }

    let flags = [0, 0x1, 0x81]?.[active] // ISO14A_CONNECT = 0x1, ISO14A_NO_SELECT = 0x80
    if (timeout > 0) {
      flags |= 0x40 // ISO14A_SET_TIMEOUT
      timeout = _.floor(1356 / (8 * 16) * Math.min(timeout, 40542464)) // timeout in ETUs (time to transfer 1 bit, approx. 9.4 us)
    }
    if (!disconnect) flags |= 0x2 // ISO14A_NO_DISCONNECT
    if (data.byteLength) flags |= 0x8 // ISO14A_RAW
    if (topaz) flags |= 0x100 // ISO14A_TOPAZMODE
    if (!rats) flags |= 0x200 // ISO14A_NO_RATS
    if (ecp) flags |= 0x800 // ISO14A_USE_ECP
    if (magsafe) flags |= 0x1000 // ISO14A_USE_MAGSAFE
    this.adapter.clearSerialReadBuffer()
    await this.adapter.sendCommandOLD({ cmd: CMD.HF_ISO14443A_READER, arg: [flags, data.byteLength | (numbits << 16), timeout], data })
    if (!reply) return
    if (active === 1) { // 1: active with select
      const selRes = await this.adapter.waitRespTimeout(CMD.ACK, timeout + 2500)
      selRes.uidlen = Number(selRes.getArg(1)) & 0xFFFF
      if (!selRes.uidlen) throw new Error('Failed to select card')
    }
    if (!data.byteLength) return
    const resp = await this.adapter.waitRespTimeout(CMD.ACK, timeout + 2500)
    resp.datalen = Number(resp.getArg(0)) & 0xFFFF
    if (!resp.datalen) throw new Error('Failed to receive data')
    const dataWithoutCrc = resp.data.subarray(0, -2)
    if (resp.datalen >= 3 && crc16A(dataWithoutCrc).isEqual(resp.data.subarray(-2))) {
      resp.dataWithoutCrc = dataWithoutCrc
    }
    return resp
  }

  async cmdMfFchk ({ type = '1k', keys = null }) {
    const maxSector = mfTypeToMaxSector(type)
    const argIterator = {
      * [Symbol.iterator] () {
        if (!keys) {
          yield { arg: [0x1100 | maxSector, 0x101, 0] }
          return
        }
        if (_.isArray(keys)) {
          keys = Packet.merge(...(_.chain(keys)
            .filter(key => key instanceof Packet && key.byteLength === 6)
            .uniqBy('hex')
            .values()))
        }
        if (!(keys instanceof Packet)) throw new TypeError('invalid keys type')
        const keyslen = keys.byteLength
        if (keyslen < 6 || keyslen % 6) throw new TypeError('invalid keys length')
        for (const strategy of [1, 2]) {
          for (let i = 0; i < keyslen; i += 510) { // 512 - 512 % 6 = 510
            const data = keys.subarray(i, i + 510)
            yield {
              data,
              arg: [
                // (isLast << 12) | (isFirst << 8) | maxSector
                ((i + 510 >= keyslen) << 12) | ((i === 0) << 8) | maxSector,
                strategy, // strategys: 1= deep first on sector 0 AB,  2= width first on all sectors
                data.byteLength / 6, // size
              ],
            }
          }
        }
      },
    }

    let resp
    for (const arg of argIterator) {
      this.adapter.clearSerialReadBuffer()
      await this.adapter.sendCommandOLD({ cmd: CMD.HF_MIFARE_CHKKEYS_FAST, ...arg })
      resp = await this.adapter.waitRespTimeout(CMD.ACK, 36e4) // 360s
      if (Number(resp.getArg(0)) === maxSector * 2) break // all key found
    }
    const found = {
      flags: new Packet(_.map([7, 6, 5, 4, 3, 2, 1, 0, 8, 9], idx => resp.data[480 + idx])),
      keys: [],
    }
    for (let i = 0; i < maxSector; i++) {
      for (const j of [2 * i, 2 * i + 1]) {
        const isFound = (found.flags[j >> 3] >> (j & 7)) & 1
        found.keys[j] = isFound ? resp.data.subarray(j * 6, j * 6 + 6) : null
      }
    }
    return found.keys
  }
}
