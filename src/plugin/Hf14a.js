import _ from 'lodash'
import { crc16A, crc16X25 } from '../crc16.js'

export default class Pm3Hf14a {
  constructor () {
    this.name = 'hf14a'
  }

  install (context, pluginOption) {
    const { Packet, pm3, PM3_CMD, utils: { retry } } = context

    const mfTypeToMaxSector = (() => {
      const MF_MAX_SECTOR = { mini: 5, '1k': 16, '2k': 32, '4k': 40 }
      return type => {
        type = _.toLower(type)
        if (!MF_MAX_SECTOR[type]) throw new TypeError('invalid mifare type')
        return MF_MAX_SECTOR[type]
      }
    })()

    const mfIsValidAcl = acl => {
      const u4arr = _.flatten(_.times(3, i => [(acl[i] & 0xF0) >> 4, acl[i] & 0xF]))
      return _.every([[1, 2], [0, 5], [3, 4]], ([a, b]) => u4arr[a] ^ u4arr[b] === 0xF)
    }

    const dropField = async () => {
      pm3.clearRespBuf()
      await pm3.sendCommandNG({ cmd: PM3_CMD.HF_DROPFIELD })
    }

    const deselectCard = async () => {
      await pm3.sendCommandMix({ cmd: PM3_CMD.HF_ISO14443A_READER })
    }

    const selectCard = async () => {
      await dropField()
      pm3.clearRespBuf()
      await pm3.sendCommandMix({ cmd: PM3_CMD.HF_ISO14443A_READER, arg: [0b11n] }) // ISO14A_CONNECT | ISO14A_NO_DISCONNECT
      const resp = await pm3.readRespTimeout(PM3_CMD.ACK) // cmd = ack
      resp.selectStatus = Number(resp.getArg(0))
      resp.card = {
        atqa: resp.data.subarray(11, 13),
        ats: resp.data.subarray(15, 15 + resp.data(10)),
        sak: resp.data.subarray(13, 14),
        uid: resp.data.subarray(resp.data[10]),
      }
      if (resp.selectStatus === 0) { // 0: couldn't read, 1: OK, with ATS, 2: OK, no ATS, 3: proprietary Anticollision
        throw new Error('failed to select iso14443a card')
      } else if (resp.selectStatus === 3) {
        throw new Error(`Card doesn't support standard iso14443-3 anticollision, ATQA: ${resp.card.atqa.hex}`)
      }
      return resp.card
    }

    // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/cmdhf14a.c#L1735
    const cardInfo = async () => {
      try {
        // TODO: Detect Information
        return await selectCard()
      } finally {
        await deselectCard()
      }
    }

    // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/mifare/mifarehost.c#L807
    const mfReadBlock = async (blockNo, keyType, key) => {
      if (!Packet.isLen(key, 6)) throw new TypeError('invalid key')
      const data = new Packet(8)
      data.setUint8(0, blockNo)
      data.setUint8(1, keyType)
      data.set(key, 2)
      pm3.clearRespBuf()
      await pm3.sendCommandNG({ cmd: PM3_CMD.HF_MIFARE_READBL, data })
      const resp = await pm3.readRespTimeout(PM3_CMD.HF_MIFARE_READBL)
      if (resp.status) throw new Error('Failed to read block')
      return resp.data
    }

    // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/mifare/mifarehost.c#L786
    const mfReadSector = async (sectorNo, keyType, key) => {
      if (!Packet.isLen(key, 6)) throw new TypeError('invalid key')
      pm3.clearRespBuf()
      await pm3.sendCommandMix({ cmd: PM3_CMD.HF_MIFARE_READSC, arg: [sectorNo, keyType], data: key })
      const resp = await pm3.readRespTimeout(PM3_CMD.ACK)
      const status = Number(resp.getArg(0)) & 0xFF
      if (!status) throw new Error(`Failed to read block, sectorNo = ${sectorNo}`)
      return resp.data.slice(0, 64)
    }

    const mfReadSectorKeyBA = async ({ sectorNo, ka, kb }) => { // 使用 BA key 嘗試讀取 sector
      const fn1 = async () => {
        try {
          return await mfReadSector(sectorNo, 1, kb)
        } catch (err) {}
        return await mfReadSector(sectorNo, 0, ka)
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

    const mfReadCardByKeys = async ({ type = '1k', keys }) => {
      if (!keys) throw new TypeError('invalid keys')
      const secKeys = await mfCheckKeys({ type, keys })
      const maxSector = mfTypeToMaxSector(type)
      const card = new Packet(maxSector * 64)
      const errors = []
      for (let i = 0; i < maxSector; i++) {
        try {
          card.set(await mfReadSectorKeyBA({
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
    const mfWriteBlock = async (blockNo, keyType, key, block) => {
      if (!Packet.isLen(key, 6)) throw new TypeError('invalid key')
      if (!Packet.isLen(block, 16)) throw new TypeError('invalid block')
      const data = new Packet(26)
      data.set(key, 0)
      data.set(block, 10)
      pm3.clearRespBuf()
      await pm3.sendCommandMix({ cmd: PM3_CMD.HF_MIFARE_WRITEBL, arg: [blockNo, keyType], data })
      const resp = await pm3.readRespTimeout(PM3_CMD.ACK)
      const status = Number(resp.getArg(0)) & 0xFF
      if (!status) throw new Error(`Failed to write block, blockNo = ${blockNo}`)
    }

    const mfWriteSectorKeyBA = async ({ sectorNo, sector, ka, kb }) => {
      if (!Packet.isLen(sector, 64)) throw new TypeError('invalid sector')
      if (!mfIsValidAcl(sector.subarray(54, 57))) throw new TypeError('invalid sector acl')
      const errors = []
      const fn1 = async (blockNo, block) => {
        try {
          return await mfWriteBlock(blockNo, 1, kb, block)
        } catch (err) {}
        await mfWriteBlock(blockNo, 0, ka, block)
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

    const mfWriteCardByKeys = async ({ type = '1k', keys, card }) => {
      if (!keys) throw new TypeError('invalid keys')
      const maxSector = mfTypeToMaxSector(type)
      if (!Packet.isLen(card, maxSector * 64)) throw new TypeError('invalid card')
      const secKeys = await mfCheckKeys({ type, keys })
      const errors = []
      for (let i = 0; i < maxSector; i++) {
        const { errors: errors1 } = await mfWriteSectorKeyBA({
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
    const mfWriteBlockEml = async (data, blockNo, blockCnt = 1, blockSize = 16) => {
      if (!Packet.isLen(data, blockCnt * blockSize)) throw new TypeError('invalid data')
      pm3.clearRespBuf()
      await pm3.sendCommandNG({ cmd: PM3_CMD.HF_MIFARE_EML_MEMSET, data: new Packet([blockNo, blockCnt, blockSize, ...data]) })
    }

    // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/mifare/mifarehost.c#L832
    const mfReadBlockEml = async blockNo => {
      pm3.clearRespBuf()
      await pm3.sendCommandNG({ cmd: PM3_CMD.HF_MIFARE_EML_MEMGET, data: new Packet([blockNo, 1]) })
      const resp = await pm3.readRespTimeout(PM3_CMD.HF_MIFARE_EML_MEMGET)
      if (resp.status) throw new Error('Failed to read block from eml')
      return resp.data
    }

    // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/cmdhfmf.c#L3416
    const mfSimulateCard = async ({
      type = '1k',
      uid,
      atqa,
      sak,
      exitAfter = 0,
      interactive = false,
      nrArAttack = false,
      emukeys = false,
      cve = false,
    }) => {
      const data = new Packet(16)
      let flags = 0

      if (uid) {
        if (!Packet.isLen(uid)) throw new TypeError('invalid uid')
        if (!_.includes([4, 7, 10], uid.byteLength)) throw new TypeError('invalid uid')
        data.set(uid, 3)
        flags |= (1 << _.floor(uid.byteLength / 3)) // FLAG_4B_UID_IN_DATA, FLAG_7B_UID_IN_DATA, FLAG_10B_UID_IN_DATA
      } else flags |= 0x10 // FLAG_UID_IN_EMUL

      if (atqa) {
        if (!Packet.isLen(atqa, 2)) throw new TypeError('invalid atqa')
        data.set(atqa, 13)
        flags |= 0x800 // FLAG_FORCED_ATQA
      }

      if (sak) {
        if (!Packet.isLen(sak, 1)) throw new TypeError('invalid sak')
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

      pm3.clearRespBuf()
      await pm3.sendCommandNG({ cmd: PM3_CMD.HF_MIFARE_SIMULATE, data })
      if (!interactive) return
      while (true) {
        const resp = await pm3.readRespTimeout(PM3_CMD.ACK)
        if (!nrArAttack) break
        if ((Number(resp.getArg(0)) & 0xFFFF) !== PM3_CMD.HF_MIFARE_SIMULATE) break
        // TODO: readerAttack not implemented
        console.log('nrArAttack', resp)
      }
    }

    // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/cmdhfmf.c#L4472
    const mfWriteBlockGen1 = async (blockNo, data, wipe = false) => {
      if (!_.inRange(blockNo, 0, 64)) throw new TypeError('invalid blockNo')
      if (!Packet.isLen(data, 16)) throw new TypeError('invalid data')
      // MAGIC_SINGLE = (MAGIC_WUPC | MAGIC_HALT | MAGIC_INIT | MAGIC_OFF) // 0x1E
      // MAGIC_WIPE = 0x40
      const flags = 0x1E | (wipe ? 0x40 : 0)
      pm3.clearRespBuf()
      await pm3.sendCommandMix({ cmd: PM3_CMD.HF_MIFARE_CSETBL, arg: [flags, blockNo], data })
      const resp = await pm3.readRespTimeout(PM3_CMD.ACK, 35e2)
      const status = Number(resp.getArg(0)) & 0xFF
      if (!status) throw new Error(`Failed to write block, blockNo = ${blockNo}`)
      return resp.data.slice(0, 4)
    }

    const mfWriteCardGen1 = async ({ type = '1k', card }) => {
      const maxSector = mfTypeToMaxSector(type)
      if (!Packet.isLen(card, maxSector * 64)) throw new TypeError('invalid card')
      const blocks = card.chunk(16)
      const errors = []
      for (let i = 0; i < blocks.length; i++) {
        try {
          await retry(() => mfWriteBlockGen1(i, blocks[i]))
        } catch (err) {
          _.set(err, 'data.blockNo', i)
          errors.push(err)
        }
      }
      return { errors }
    }

    // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/cmdhfmf.c#L4662
    const mfReadBlockGen1 = async blockNo => {
      if (!_.inRange(blockNo, 0, 64)) throw new TypeError('invalid blockNo')
      // MAGIC_SINGLE = (MAGIC_WUPC | MAGIC_HALT | MAGIC_INIT | MAGIC_OFF) // 0x1E
      const flags = 0x1E
      pm3.clearRespBuf()
      await pm3.sendCommandMix({ cmd: PM3_CMD.HF_MIFARE_CGETBL, arg: [flags, blockNo] })
      const resp = await pm3.readRespTimeout(PM3_CMD.ACK)
      const status = Number(resp.getArg(0)) & 0xFF
      if (!status) throw new Error(`Failed to write block, blockNo = ${blockNo}`)
      return resp.data.slice(0, 16)
    }

    const mfReadCardGen1 = async ({ type = '1k' }) => {
      const maxBlock = mfTypeToMaxSector(type) * 4
      const card = new Packet(maxBlock * 16)
      const errors = []
      for (let i = 0; i < maxBlock; i++) {
        try {
          card.set(await retry(() => mfReadBlockGen1(i)), i * 16)
        } catch (err) {
          _.set(err, 'data.blockNo', i)
          errors.push(err)
        }
      }
      return { errors, card }
    }

    // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/cmdhf14a.c#L1222
    const sendRaw = async ({
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
    } = {}) => {
      if (!Packet.isLen(data)) throw new TypeError('invalid data type')
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
      pm3.clearRespBuf()
      await pm3.sendCommandOLD({ cmd: PM3_CMD.HF_ISO14443A_READER, arg: [flags, data.byteLength | (numbits << 16), timeout], data })
      if (!reply) return
      if (active === 1) { // 1: active with select
        const selRes = await pm3.readRespTimeout(PM3_CMD.ACK, timeout + 2500)
        selRes.uidlen = Number(selRes.getArg(1)) & 0xFFFF
        if (!selRes.uidlen) throw new Error('Failed to select card')
      }
      if (!data.byteLength) return
      const resp = await pm3.readRespTimeout(PM3_CMD.ACK, timeout + 2500)
      resp.datalen = Number(resp.getArg(0)) & 0xFFFF
      if (!resp.datalen) throw new Error('Failed to receive data')
      const dataWithoutCrc = resp.data.subarray(0, -2)
      if (resp.datalen >= 3 && crc16A(dataWithoutCrc).isEqual(resp.data.subarray(-2))) {
        resp.dataWithoutCrc = dataWithoutCrc
      }
      return resp
    }

    const mfCheckKeys = async ({ type = '1k', keys = null }) => {
      const maxSector = mfTypeToMaxSector(type)
      const argIterator = {
        * [Symbol.iterator] () {
          if (!keys) {
            yield { arg: [0x1100 | maxSector, 0x101, 0] }
            return
          }
          if (_.isArray(keys)) {
            keys = Packet.merge(...(_.chain(keys)
              .filter(key => Packet.isLen(key, 6))
              .uniqBy('hex')
              .values()))
          }
          if (!Packet.isLen(keys)) throw new TypeError('invalid keys type')
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
        pm3.clearRespBuf()
        await pm3.sendCommandOLD({ cmd: PM3_CMD.HF_MIFARE_CHKKEYS_FAST, ...arg })
        resp = await pm3.readRespTimeout(PM3_CMD.ACK, 36e4) // 360s
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

    return {
      cardInfo,
      deselectCard,
      dropField,
      mfCheckKeys,
      mfReadBlock,
      mfReadBlockEml,
      mfReadBlockGen1,
      mfReadCardByKeys,
      mfReadCardGen1,
      mfReadSector,
      mfReadSectorKeyBA,
      mfSimulateCard,
      mfWriteBlock,
      mfWriteBlockEml,
      mfWriteBlockGen1,
      mfWriteCardByKeys,
      mfWriteCardGen1,
      mfWriteSectorKeyBA,
      selectCard,
      sendRaw,
    }
  }
}
