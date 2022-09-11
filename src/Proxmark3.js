import _ from 'lodash'
import * as utils from './utils'
import Packet from './Packet.js'

export const PM3_CMD = _.fromPairs(_.map([
  // For the bootloader
  [0x0000, 'DEVICE_INFO'],
  [0x0001, 'SETUP_WRITE'],
  [0x0003, 'FINISH_WRITE'],
  [0x0004, 'HARDWARE_RESET'],
  [0x0005, 'START_FLASH'],
  [0x0006, 'CHIP_INFO'],
  [0x0007, 'BL_VERSION'],
  [0x00fe, 'NACK'],
  [0x00ff, 'ACK'],

  // For general mucking around
  [0x0100, 'DEBUG_PRINT_STRING'],
  [0x0101, 'DEBUG_PRINT_INTEGERS'],
  [0x0102, 'DEBUG_PRINT_BYTES'],
  [0x0103, 'LCD_RESET'],
  [0x0104, 'LCD'],
  [0x0105, 'BUFF_CLEAR'],
  [0x0106, 'READ_MEM'],
  [0x0107, 'VERSION'],
  [0x0108, 'STATUS'],
  [0x0109, 'PING'],
  [0x0110, 'DOWNLOAD_EML_BIGBUF'],
  [0x0111, 'DOWNLOADED_EML_BIGBUF'],
  [0x0112, 'CAPABILITIES'],
  [0x0113, 'QUIT_SESSION'],
  [0x0114, 'SET_DBGMODE'],
  [0x0115, 'STANDALONE'],
  [0x0116, 'WTX'],
  [0x0117, 'TIA'],
  [0x0118, 'BREAK_LOOP'],
  [0x0119, 'SET_TEAROFF'],
  [0x0120, 'GET_DBGMODE'],

  // RDV40, Flash memory operations
  [0x0121, 'FLASHMEM_WRITE'],
  [0x0122, 'FLASHMEM_WIPE'],
  [0x0123, 'FLASHMEM_DOWNLOAD'],
  [0x0124, 'FLASHMEM_DOWNLOADED'],
  [0x0125, 'FLASHMEM_INFO'],
  [0x0126, 'FLASHMEM_SET_SPIBAUDRATE'],

  // RDV40, High level flashmem SPIFFS Manipulation
  // ALL function will have a lazy or Safe version
  // that will be handled as argument of safety level [0..2] respectiveley normal / lazy / safe
  // However as how design is, MOUNT and UNMOUNT only need/have lazy as safest level so a safe level will still execute a lazy version
  // see spiffs.c for more about the normal/lazy/safety information)
  [0x0130, 'SPIFFS_MOUNT'],
  [0x0131, 'SPIFFS_UNMOUNT'],
  [0x0132, 'SPIFFS_WRITE'],

  // We take +0x1000 when having a variant of similar function (todo : make it an argument!)
  [0x1132, 'SPIFFS_APPEND'],

  [0x0133, 'SPIFFS_READ'],
  // We use no open/close instruction, as they are handled internally.
  [0x0134, 'SPIFFS_REMOVE'],
  [0x0134, 'SPIFFS_RM'],
  [0x0135, 'SPIFFS_RENAME'],
  [0x0135, 'SPIFFS_MV'],
  [0x0136, 'SPIFFS_COPY'],
  [0x0136, 'SPIFFS_CP'],
  [0x0137, 'SPIFFS_STAT'],
  [0x0138, 'SPIFFS_FSTAT'],
  [0x0139, 'SPIFFS_INFO'],
  [0x0122, 'SPIFFS_FORMAT'],

  [0x013A, 'SPIFFS_WIPE'],

  // This take a +0x2000 as they are high level helper and special functions
  // As the others, they may have safety level argument if it makkes sense
  [0x2130, 'SPIFFS_PRINT_TREE'],
  [0x2131, 'SPIFFS_GET_TREE'],
  [0x2132, 'SPIFFS_TEST'],
  [0x2133, 'SPIFFS_PRINT_FSINFO'],
  [0x2134, 'SPIFFS_DOWNLOAD'],
  [0x2135, 'SPIFFS_DOWNLOADED'],
  [0x3000, 'SPIFFS_CHECK'],
  // more ?

  // RDV40,  Smart card operations
  [0x0140, 'SMART_RAW'],
  [0x0141, 'SMART_UPGRADE'],
  [0x0142, 'SMART_UPLOAD'],
  [0x0143, 'SMART_ATR'],
  [0x0144, 'SMART_SETBAUD'],
  [0x0145, 'SMART_SETCLOCK'],

  // RDV40, FPC USART
  [0x0160, 'USART_RX'],
  [0x0161, 'USART_TX'],
  [0x0162, 'USART_TXRX'],
  [0x0163, 'USART_CONFIG'],

  // For low-frequency tags
  [0x0202, 'LF_TI_READ'],
  [0x0203, 'LF_TI_WRITE'],
  [0x0205, 'LF_ACQ_RAW_ADC'],
  [0x0206, 'LF_MOD_THEN_ACQ_RAW_ADC'],
  [0x0207, 'DOWNLOAD_BIGBUF'],
  [0x0208, 'DOWNLOADED_BIGBUF'],
  [0x0209, 'LF_UPLOAD_SIM_SAMPLES'],
  [0x020A, 'LF_SIMULATE'],
  [0x020B, 'LF_HID_WATCH'],
  [0x020C, 'LF_HID_SIMULATE'],
  [0x020D, 'LF_SET_DIVISOR'],
  [0x020E, 'LF_SIMULATE_BIDIR'],
  [0x020F, 'SET_ADC_MUX'],
  [0x0210, 'LF_HID_CLONE'],
  [0x0211, 'LF_EM410X_CLONE'],
  [0x0214, 'LF_T55XX_READBL'],
  [0x0215, 'LF_T55XX_WRITEBL'],
  [0x0216, 'LF_T55XX_RESET_READ'],
  [0x0217, 'LF_PCF7931_READ'],
  [0x0223, 'LF_PCF7931_WRITE'],
  [0x0229, 'LF_EM4X_LOGIN'],
  [0x0218, 'LF_EM4X_READWORD'],
  [0x0219, 'LF_EM4X_WRITEWORD'],
  [0x021B, 'LF_EM4X_PROTECTWORD'],
  [0x022A, 'LF_EM4X_BF'],
  [0x021A, 'LF_IO_WATCH'],
  [0x021C, 'LF_EM410X_WATCH'],
  [0x0240, 'LF_EM4X50_INFO'],
  [0x0241, 'LF_EM4X50_WRITE'],
  [0x0242, 'LF_EM4X50_WRITEPWD'],
  [0x0243, 'LF_EM4X50_READ'],
  [0x0245, 'LF_EM4X50_BRUTE'],
  [0x0246, 'LF_EM4X50_LOGIN'],
  [0x0250, 'LF_EM4X50_SIM'],
  [0x0251, 'LF_EM4X50_READER'],
  [0x0252, 'LF_EM4X50_ESET'],
  [0x0253, 'LF_EM4X50_CHK'],
  [0x0260, 'LF_EM4X70_INFO'],
  [0x0261, 'LF_EM4X70_WRITE'],
  [0x0262, 'LF_EM4X70_UNLOCK'],
  [0x0263, 'LF_EM4X70_AUTH'],
  [0x0264, 'LF_EM4X70_WRITEPIN'],
  [0x0265, 'LF_EM4X70_WRITEKEY'],
  // Sampling configuration for LF reader/sniffer
  [0x021D, 'LF_SAMPLING_SET_CONFIG'],
  [0x021E, 'LF_FSK_SIMULATE'],
  [0x021F, 'LF_ASK_SIMULATE'],
  [0x0220, 'LF_PSK_SIMULATE'],
  [0x0232, 'LF_NRZ_SIMULATE'],
  [0x0221, 'LF_AWID_WATCH'],
  [0x0222, 'LF_VIKING_CLONE'],
  [0x0224, 'LF_T55XX_WAKEUP'],
  [0x0225, 'LF_COTAG_READ'],
  [0x0226, 'LF_T55XX_SET_CONFIG'],
  [0x0227, 'LF_SAMPLING_PRINT_CONFIG'],
  [0x0228, 'LF_SAMPLING_GET_CONFIG'],

  [0x0230, 'LF_T55XX_CHK_PWDS'],
  [0x0231, 'LF_T55XX_DANGERRAW'],

  // ZX8211
  [0x0270, 'LF_ZX_READ'],
  [0x0271, 'LF_ZX_WRITE'],

  /* CMD_SET_ADC_MUX: ext1 is 0 for lopkd, 1 for loraw, 2 for hipkd, 3 for hiraw */

  // For the 13.56 MHz tags
  [0x0300, 'HF_ISO15693_ACQ_RAW_ADC'],
  [0x0303, 'HF_SRI_READ'],
  [0x0305, 'HF_ISO14443B_COMMAND'],
  [0x0310, 'HF_ISO15693_READER'],
  [0x0311, 'HF_ISO15693_SIMULATE'],
  [0x0312, 'HF_ISO15693_SNIFF'],
  [0x0313, 'HF_ISO15693_COMMAND'],
  [0x0315, 'HF_ISO15693_FINDAFI'],
  [0x0316, 'HF_ISO15693_CSETUID'],
  [0x0317, 'HF_ISO15693_SLIX_L_DISABLE_PRIVACY'],
  [0x0318, 'HF_ISO15693_SLIX_L_DISABLE_AESAFI'],

  [0x0360, 'LF_SNIFF_RAW_ADC'],

  // For Hitag2 transponders
  [0x0370, 'LF_HITAG_SNIFF'],
  [0x0371, 'LF_HITAG_SIMULATE'],
  [0x0372, 'LF_HITAG_READER'],

  // For HitagS
  [0x0367, 'LF_HITAGS_TEST_TRACES'],
  [0x0368, 'LF_HITAGS_SIMULATE'],
  [0x0373, 'LF_HITAGS_READ'],
  [0x0375, 'LF_HITAGS_WRITE'],

  [0x0376, 'LF_HITAG_ELOAD'],

  [0x0380, 'HF_ISO14443A_ANTIFUZZ'],
  [0x0381, 'HF_ISO14443B_SIMULATE'],
  [0x0382, 'HF_ISO14443B_SNIFF'],

  [0x0383, 'HF_ISO14443A_SNIFF'],
  [0x0384, 'HF_ISO14443A_SIMULATE'],

  [0x0385, 'HF_ISO14443A_READER'],

  [0x0387, 'HF_LEGIC_SIMULATE'],
  [0x0388, 'HF_LEGIC_READER'],
  [0x0389, 'HF_LEGIC_WRITER'],

  [0x038A, 'HF_EPA_COLLECT_NONCE'],
  [0x038B, 'HF_EPA_REPLAY'],

  [0x03BC, 'HF_LEGIC_INFO'],
  [0x03BD, 'HF_LEGIC_ESET'],

  // iCLASS / Picopass
  [0x038F, 'HF_ICLASS_READCHECK'],
  [0x0391, 'HF_ICLASS_DUMP'],
  [0x0392, 'HF_ICLASS_SNIFF'],
  [0x0393, 'HF_ICLASS_SIMULATE'],
  [0x0394, 'HF_ICLASS_READER'],
  [0x0396, 'HF_ICLASS_READBL'],
  [0x0397, 'HF_ICLASS_WRITEBL'],
  [0x0398, 'HF_ICLASS_EML_MEMSET'],
  [0x039A, 'HF_ICLASS_CHKKEYS'],
  [0x039B, 'HF_ICLASS_RESTORE'],

  // For ISO1092 / FeliCa
  [0x03A0, 'HF_FELICA_SIMULATE'],
  [0x03A1, 'HF_FELICA_SNIFF'],
  [0x03A2, 'HF_FELICA_COMMAND'],
  // temp
  [0x03AA, 'HF_FELICALITE_DUMP'],
  [0x03AB, 'HF_FELICALITE_SIMULATE'],

  // For 14a config
  [0x03B0, 'HF_ISO14443A_PRINT_CONFIG'],
  [0x03B1, 'HF_ISO14443A_GET_CONFIG'],
  [0x03B2, 'HF_ISO14443A_SET_CONFIG'],

  // For measurements of the antenna tuning
  [0x0400, 'MEASURE_ANTENNA_TUNING'],
  [0x0401, 'MEASURE_ANTENNA_TUNING_HF'],
  [0x0402, 'MEASURE_ANTENNA_TUNING_LF'],
  [0x0420, 'LISTEN_READER_FIELD'],
  [0x0430, 'HF_DROPFIELD'],

  // For direct FPGA control
  [0x0500, 'FPGA_MAJOR_MODE_OFF'],

  // For mifare commands
  [0x0601, 'HF_MIFARE_EML_MEMCLR'],
  [0x0602, 'HF_MIFARE_EML_MEMSET'],
  [0x0603, 'HF_MIFARE_EML_MEMGET'],
  [0x0604, 'HF_MIFARE_EML_LOAD'],

  // magic chinese card commands
  [0x0605, 'HF_MIFARE_CSETBL'],
  [0x0606, 'HF_MIFARE_CGETBL'],
  [0x0607, 'HF_MIFARE_CIDENT'],

  [0x0610, 'HF_MIFARE_SIMULATE'],

  [0x0611, 'HF_MIFARE_READER'],
  [0x0612, 'HF_MIFARE_NESTED'],
  [0x0613, 'HF_MIFARE_ACQ_ENCRYPTED_NONCES'],
  [0x0614, 'HF_MIFARE_ACQ_NONCES'],
  [0x0615, 'HF_MIFARE_STATIC_NESTED'],

  [0x0620, 'HF_MIFARE_READBL'],
  [0x0720, 'HF_MIFAREU_READBL'],
  [0x0621, 'HF_MIFARE_READSC'],
  [0x0721, 'HF_MIFAREU_READCARD'],
  [0x0622, 'HF_MIFARE_WRITEBL'],
  [0x0627, 'HF_MIFARE_VALUE'],
  [0x0722, 'HF_MIFAREU_WRITEBL'],
  [0x0723, 'HF_MIFAREU_WRITEBL_COMPAT'],

  [0x0623, 'HF_MIFARE_CHKKEYS'],
  [0x0624, 'HF_MIFARE_SETMOD'],
  [0x0625, 'HF_MIFARE_CHKKEYS_FAST'],
  [0x0626, 'HF_MIFARE_CHKKEYS_FILE'],

  [0x0630, 'HF_MIFARE_SNIFF'],
  [0x0631, 'HF_MIFARE_MFKEY'],
  [0x0632, 'HF_MIFARE_PERSONALIZE_UID'],

  // ultralightC
  [0x0724, 'HF_MIFAREUC_AUTH'],
  // 0x0725 and 0x0726 no longer used
  [0x0727, 'HF_MIFAREUC_SETPWD'],

  // mifare desfire
  [0x0728, 'HF_DESFIRE_READBL'],
  [0x0729, 'HF_DESFIRE_WRITEBL'],
  [0x072a, 'HF_DESFIRE_AUTH1'],
  [0x072b, 'HF_DESFIRE_AUTH2'],
  [0x072c, 'HF_DESFIRE_READER'],
  [0x072d, 'HF_DESFIRE_INFO'],
  [0x072e, 'HF_DESFIRE_COMMAND'],

  [0x0730, 'HF_MIFARE_NACK_DETECT'],
  [0x0731, 'HF_MIFARE_STATIC_NONCE'],

  // MFU OTP TearOff
  [0x0740, 'HF_MFU_OTP_TEAROFF'],
  // MFU_Ev1 Counter TearOff
  [0x0741, 'HF_MFU_COUNTER_TEAROFF'],

  [0x0800, 'HF_SNIFF'],
  [0x0801, 'HF_PLOT'],

  // Fpga plot download
  [0x0802, 'FPGAMEM_DOWNLOAD'],
  [0x0803, 'FPGAMEM_DOWNLOADED'],

  // For ThinFilm Kovio
  [0x0810, 'HF_THINFILM_READ'],
  [0x0811, 'HF_THINFILM_SIMULATE'],

  // For Atmel CryptoRF
  [0x0820, 'HF_CRYPTORF_SIM'],

  // Gen 3 magic cards
  [0x0850, 'HF_MIFARE_GEN3UID'],
  [0x0851, 'HF_MIFARE_GEN3BLK'],
  [0x0852, 'HF_MIFARE_GEN3FREEZ'],

  // Gen 4 GTU magic cards
  [0x0860, 'HF_MIFARE_G4_RDBL'],

  [0xFFFF, 'UNKNOWN'],
], ([a, b]) => [b, a]))

export class PacketResponseNG {
  // https://github.com/RfidResearchGroup/proxmark3/blob/master/doc/new_frame_format.md
  // magic 4 + length 2 + status 2 + cmd 2 + data max 512 + crc 2
  constructor (pack) {
    if (!Packet.isLen(pack)) throw new TypeError('invalid pack')
    this.pack = pack
    this.data = pack.subarray(10 + (this.ng ? 0 : 24), pack.byteLength - 2)
  }

  get len () { return this.pack.byteLength }
  get ng () { return (this.pack.getUint8(5) & 0x80) > 0 }
  get status () { return this.pack.getInt16(6) }
  get cmd () { return this.pack.getUint16(8) }
  get crc () { return this.pack.getUint16(this.pack.byteLength - 2) }
  getArg (index) { return this.pack.getBigUint64(10 + (index << 3)) }
}

export class PacketResponseOLD {
  constructor (pack) {
    if (!Packet.isLen(pack)) throw new TypeError('invalid pack')
    this.pack = pack
    this.data = pack.subarray(32)
  }

  get cmd () { return this.pack.getUint16(0) }
  getArg (index) { return this.pack.getBigUint64(8 + (index << 3)) }
}

const findPm3FrameOffsetLength = buf => {
  let len = 544
  if (buf.length >= 10 && buf.getUint32(0) === 0x62334D50) len = (buf.getUint16(4) & 0x7FFF) + 12
  return [0, buf.length >= len ? len : 0]
}

export default class Proxmark3 {
  constructor (adapter) {
    this.middlewares = {}
    this.plugins = new Map()
    this.respBuf = []
    this.rxBuf = new Packet()
    this.tx = null

    this.rx = new TransformStream({
      transform: (pack, controller) => {
        this.rxBuf = Packet.merge(this.rxBuf, pack)

        do {
          const [offset, length] = findPm3FrameOffsetLength(this.rxBuf)
          if (length < 1) return
          const pack = this.rxBuf.slice(offset, offset + length)
          controller.enqueue(pack.getUint32(0) === 0x62334D50 ? new PacketResponseNG(pack) : new PacketResponseOLD(pack))
          this.rxBuf = this.rxBuf.slice(offset + length)
        } while (true)
      },
    })

    this.rx.readable.pipeTo(new WritableStream({ // no wait
      write: pack => { this.respBuf.push(pack) },
    }))
  }

  // install plugin
  async use (plugin, option = {}) {
    if (!plugin || !_.isFunction(plugin.install) || !_.isString(plugin.name)) throw new TypeError('property plugin.name and method plugin.install is required.')
    const pluginId = `$${plugin.name}`
    if (this.hasPlugin(pluginId)) return this
    const installed = await plugin.install({
      Packet,
      pm3: this,
      PM3_CMD,
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

  addMiddleware (key, middleware) {
    if (!_.isString(key) || !key.length) throw new TypeError('key is required')
    if (!_.isFunction(middleware)) throw new TypeError('middleware is required')

    if (!_.isArray(this.middlewares[key])) this.middlewares[key] = []
    this.middlewares[key].push(middleware)
  }

  async writePacket (pack) {
    const handler = utils.middlewareCompose([
      ...(this.middlewares.writePacket ?? []),
      async (ctx, next) => {
        if (!Packet.isLen(ctx.pack)) throw new TypeError('pack should be Packet')
        ctx.writer = this.tx?.writable?.getWriter?.()
        if (!ctx.writer) throw new Error('Failed to getWriter(). Did you remember to use adapter plugin?')
        await ctx.writer.write(ctx.pack)
        ctx.writer.releaseLock()
      },
    ])
    return await handler({ pack })
  }

  async sendCommandNG ({ cmd, data = new Packet(), ng = true }) {
    if (!Packet.isLen(data)) throw new TypeError('data should be Packet')
    if (data.byteLength > 512) throw new TypeError('data.byteLength > 512')
    const pack = new Packet(data.byteLength + 10) // magic 4 + length 2 + cmd 2 + dataLen + crc 2
    pack.set(Packet.fromUtf8('PM3a'))
    pack.setUint16(4, data.byteLength | (ng ? 0x8000 : 0))
    pack.setUint16(6, Number(BigInt.asUintN(16, BigInt(cmd))))
    if (data.byteLength) pack.set(data, 8)
    pack.set(Packet.fromUtf8('a3'), data.byteLength + 8) // COMMANDNG_POSTAMBLE_MAGIC = a3
    await this.writePacket(pack)
  }

  async sendCommandMix ({ cmd, arg = [], data = new Packet() }) {
    if (!Packet.isLen(data)) throw new TypeError('data should be Packet')
    if (data.byteLength > 488) throw new TypeError('data.byteLength > 488')
    const pack = new Packet(data.byteLength + 24) // mix format: 3 * arg 8
    if (data.byteLength) pack.set(data, 24)
    for (let i = 0; i < 3; i++) pack.setBigUint64(i << 3, BigInt(arg[i] ?? 0))
    return await this.sendCommandNG({ cmd, data: pack, ng: false })
  }

  async sendCommandOLD ({ cmd, arg = [], data = new Packet() }) {
    if (!Packet.isLen(data)) throw new TypeError('data should be Packet')
    if (data.byteLength > 512) throw new TypeError('data.byteLength > 512')
    const pack = new Packet(544) // mix format: 3 * arg 8
    if (data.byteLength) pack.set(data, 32)
    pack.setBigUint64(0, BigInt(cmd))
    for (let i = 0; i < 3; i++) pack.setBigUint64(8 + (i << 3), BigInt(arg[i] ?? 0))
    await this.writePacket(pack)
  }

  clearRespBuf () {
    this.respBuf.splice(0, this.respBuf.length)
  }

  async readRespTimeout (cmd = null, timeout = 5e3) {
    const handler = utils.middlewareCompose([
      ...(this.middlewares.readRespTimeout ?? []),
      async (ctx, next) => {
        ctx.startedAt = Date.now()
        while (true) {
          ctx.nowts = Date.now()
          if (ctx.nowts > ctx.startedAt + ctx.timeout) throw new Error(`readRespTimeout ${ctx.timeout}ms`)
          while (this.respBuf.length) {
            const resp = this.respBuf.shift()
            if (resp.cmd === PM3_CMD.DEBUG_PRINT_STRING) {
              utils.logTime(resp.data.subarray(2).utf8)
              continue
            }
            if (resp.cmd === PM3_CMD.WTX && resp.data.byteLength === 2) {
              const wtx = resp.data.getUint16(0)
              if (wtx < 0xFFFF) {
                utils.logTime(`extend timeout: ${ctx.timeout} + ${wtx} = ${ctx.timeout + wtx} ms`)
                ctx.timeout += wtx
              }
              continue
            }
            if (cmd !== PM3_CMD.UNKNOWN && resp.cmd !== ctx.cmd) continue // dirty resp
            return resp
          }
          await utils.sleep(10)
        }
      },
    ])
    return await handler({ cmd, timeout })
  }
}
