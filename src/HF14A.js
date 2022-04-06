import { uintToPadHex } from './utils'
import adapter, { CMD } from './adapter'
import BufferLE from './BufferLE'
import Iso14aCardSelect from './Iso14aCardSelect'

export default class HF14A {
  constructor () {
    this.adapter = adapter
  }

  async CmdDisconnect () {
    await this.adapter.sendCommandMix({ cmd: CMD.HF_ISO14443A_READER })
  }

  // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/cmdhf14a.c#L1713
  async CmdInfo (isSelect = false) {
    try {
      this.adapter.clearSerialReadBuffer()
      await this.adapter.sendCommandMix({ cmd: CMD.HF_ISO14443A_READER, arg: [0b11n] })
      const resp = await this.adapter.waitRespTimeout(CMD.ACK) // cmd = ack
      const status = Number(resp.getArg(0))
      const card = new Iso14aCardSelect(resp.data) // mix format: 3 * arg 8
      if (status === 0) { // 0: couldn't read, 1: OK, with ATS, 2: OK, no ATS, 3: proprietary Anticollision
        if (isSelect) throw new Error('failed to select iso14443a card')
        return
      } else if (status === 3) {
        throw new Error(`Card doesn't support standard iso14443-3 anticollision, ATQA: ${uintToPadHex(card.atqa, 4)}`)
      }
      const res = {
        uid: card.uid.hex,
        atqa: uintToPadHex(card.atqa, 4),
        sak: uintToPadHex(card.sak, 2),
        status,
      }
      return res
    } catch (err) {
      console.error(err)
      throw err
    } finally {
      if (this.serial?.port?.writable) await this.CmdHF14ADisconnect()
    }
  }

  // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/mifare/mifarehost.c#L807
  async CmdMfRdBl (blockNo, keyType, key) {
    if (!(key instanceof BufferLE)) throw new TypeError('key should be BufferLE')
    if (key.byteLength !== 6) throw new TypeError('invalid key')
    const data = new BufferLE(8)
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
  async CmdMfRdSc (sectorNo, keyType, key) {
    if (!(key instanceof BufferLE)) throw new TypeError('key should be BufferLE')
    if (key.byteLength !== 6) throw new TypeError('invalid key')
    this.adapter.clearSerialReadBuffer()
    await this.adapter.sendCommandMix({ cmd: CMD.HF_MIFARE_READSC, arg: [BigInt(sectorNo), BigInt(keyType)], data: key })
    const resp = await this.adapter.waitRespTimeout(CMD.ACK)
    const status = Number(resp.getArg(0)) & 0xff
    if (!status) throw new Error('Failed to read block')
    return resp.data.slice(0, 64)
  }
}
