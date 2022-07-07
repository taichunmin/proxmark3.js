(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('lodash')) :
  typeof define === 'function' && define.amd ? define(['exports', 'lodash'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Proxmark3 = {}, global._));
})(this, (function (exports, _) { 'use strict';

  function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

  var ___default = /*#__PURE__*/_interopDefaultLegacy(_);

  const BASE64URL_CHAR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  class Packet extends Uint8Array {
    constructor (...args) {
      super(...args);
      this.dv = new DataView(this.buffer, this.byteOffset, this.byteLength);
    }

    static fromView (view) {
      if (!ArrayBuffer.isView(view)) throw new TypeError('invalid view')
      return new Packet(view.buffer, view.byteOffset, view.byteLength)
    }

    static fromHex (hex, reverse = false) {
      const matches = hex.replace(/[^0-9A-Fa-f]/g, '').match(/.{2}/g);
      if (reverse) matches.reverse();
      return new Packet(___default["default"].map(matches, b => ___default["default"].parseInt(b, 16)))
    }

    static fromUtf8 (utf8) {
      return Packet.fromView(new TextEncoder().encode(utf8))
    }

    static merge (...packs) {
      if (packs.length < 2) return packs.length ? packs[0] : new Packet()
      const len = ___default["default"].sumBy(packs, 'byteLength');
      const merged = new Packet(len);
      ___default["default"].reduce(packs, (offset, pack) => {
        merged.set(pack, offset);
        return offset + pack.byteLength
      }, 0);
      return merged
    }

    isEqual (other) {
      return this.byteLength === other.byteLength && this.every((v, k) => v === other[k])
    }

    chunk (bytesPerChunk) {
      if (bytesPerChunk < 1) throw new TypeError('invalid bytesPerChunk')
      const chunks = [];
      for (let i = 0; i < this.byteLength; i += bytesPerChunk) chunks.push(this.subarray(i, i + bytesPerChunk));
      return chunks
    }

    // 共通屬性
    get hex () { return ___default["default"].map(this, b => `0${b.toString(16)}`.slice(-2)).join('').toUpperCase() }
    get rhex () { return ___default["default"].map(this, b => `0${b.toString(16)}`.slice(-2)).reverse().join('').toUpperCase() }
    get utf8 () { return new TextDecoder().decode(this) }
    get base64url () {
      const tmp = [];
      for (let i = 0; i < this.byteLength; i += 3) {
        let u24 = 0;
        for (let j = 0; j < 3; j++) u24 |= ((i + j) < this.byteLength ? this[i + j] : 0) << (16 - j * 8);
        tmp.push(___default["default"].times(Math.min(this.byteLength - i + 1, 4), j => BASE64URL_CHAR[(u24 >> (18 - 6 * j)) & 0x3F]).join(''));
      }
      return tmp.join('')
    }

    // DataView getter
    dvGetter (key, byteOffset, littleEndian = true) {
      if (byteOffset < 0) byteOffset += this.dv.byteLength;
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
      if (byteOffset < 0) byteOffset += this.dv.byteLength;
      this.dv[key](byteOffset, value, littleEndian);
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
      const [p8, p16] = little ? [offset + 2, offset] : [offset, offset + 1];
      return (this.getUint8(p8) << 16) | this.getUint16(p16, little)
    }

    setUint24 (offset, value, little = true) {
      const [p8, p16] = little ? [offset + 2, offset] : [offset, offset + 1];
      this.setUint8(p8, (value >> 16) & 0xFF);
      this.setUint16(p16, value & 0xFFFF, little);
      return this
    }

    getInt24 (offset, little = true) {
      const u24 = this.getUint24(offset, little);
      return u24 - (u24 > 0x7FFFFF ? 0x1000000 : 0)
    }

    setInt24 (offset, value, little = true) {
      return this.setUint24(offset, value & 0xFFFFFF, little)
    }
  }

  class Mifare1k {
    constructor (pack) {
      if (!pack) pack = new Packet(1024);
      if (!(pack instanceof Packet) || pack.byteLength !== 1024) throw new TypeError('invalid pack')
      this.pack = pack;
    }

    static fromEml (eml) {
      return new Mifare1k(Packet.fromHex(eml.replace(/-/g, '0')))
    }

    static isValidKey (key) {
      return key instanceof Packet && key.byteLength === 6
    }

    static isValidAcl (acl) {
      const u4arr = ___default["default"].flatten(___default["default"].times(3, i => [(acl[i] & 0xF0) >> 4, acl[i] & 0xF]));
      return ___default["default"].every([[1, 2], [0, 5], [3, 4]], ([a, b]) => u4arr[a] ^ u4arr[b] === 0xF)
    }

    static keysToHexUniq (keys) {
      if (keys instanceof Packet) {
        if (!keys.byteLength || keys.byteLength % 6) throw new TypeError('invalid keys.byteLength')
        keys = keys.chunk(6);
      }
      if (!___default["default"].isArray(keys)) throw new TypeError('invalid keys type')
      return ___default["default"].uniq(___default["default"].map(___default["default"].filter(keys, Mifare1k.isValidKey), 'hex')).join('\n')
    }

    get eml () {
      return ___default["default"].times(64, i => this.pack.subarray(i * 16, (i + 1) * 16).hex).join('\n')
    }

    get kas () {
      return ___default["default"].map(___default["default"].times(16, i => (i * 64) + 48), i => this.pack.subarray(i, i + 6))
    }

    get kbs () {
      return ___default["default"].map(___default["default"].times(16, i => (i * 64) + 58), i => this.pack.subarray(i, i + 6))
    }

    get keys () {
      return ___default["default"].map(___default["default"].flatten(___default["default"].times(16, i => [(i * 64) + 48, (i * 64) + 58])), i => this.pack.subarray(i, i + 6))
    }

    get uid () {
      const tmp = [];
      for (let i = 0; i < 3; i++) {
        if (this.pack[(i << 2) + 3] !== 0x88) {
          tmp.push(this.pack.subarray(i << 2, (i << 2) + 4));
          break
        }
        tmp.push(this.pack.subarray(i << 2, (i << 2) + 3));
      }
      return Packet.merge(...tmp)
    }

    getBlock (i) {
      return this.pack.subarray(i * 16, (i + 1) * 16)
    }

    setBlock (i, block) {
      if (!(block instanceof Packet) || block.byteLength !== 16) throw new TypeError('invalid block')
      this.pack.set(block, i * 16);
      return this
    }

    isEqual (other) {
      return other instanceof Mifare1k && this.pack.isEqual(other.pack)
    }

    isSectorAclValid (i) {
      return Mifare1k.isValidAcl(this.pack.subarray((i * 64) + 54, (i * 64) + 57))
    }

    isAllAclsValid () {
      return ___default["default"].every(___default["default"].times(16), i => this.isSectorAclValid(i))
    }
  }

  const CRC16_POLY = {
    ARC: 0x8005,
    CCITT: 0x1021,
    CDMA2000: 0xC867,
    DECT: 0x0589,
    DNP: 0x3D65,
    KERMIT: 0x8408,
    LEGIC_16: 0x002D,
    LEGIC: 0xC6C6,
    T10_DIF: 0x8BB7,
    TELEDISK: 0xA097,
  };
  const cached = {};

  const reflect8 = u8 => {
    if (!cached.reflect8) {
      const tbl = cached.reflect8 = new Packet(256);
      for (let i = 0; i < 256; i++) {
        let b = i;
        b = (b & 0xF0) >> 4 | (b & 0x0F) << 4;
        b = (b & 0xCC) >> 2 | (b & 0x33) << 2;
        b = (b & 0xAA) >> 1 | (b & 0x55) << 1;
        tbl[i] = b;
      }
    }
    return cached.reflect8[u8 & 0xFF]
  };

  const reflect16 = u16 => reflect8(u16 >> 8) | (reflect8(u16) << 8);

  const crc2packet = u16 => new Packet([u16 & 0xFF, (u16 >> 8) & 0xFF]);

  const getPoly = (poly, refin) => {
    const key = `${poly}${refin ? 1 : 0}`;
    if (!___default["default"].hasIn(cached, `poly.${key}`)) {
      const tbl = new Uint16Array(256);
      for (let i = 0; i < 256; i++) {
        let c = (refin ? reflect8(i) : i) << 8;
        let crc = 0;
        for (let j = 0; j < 8; j++) {
          crc = (((crc ^ c) & 0x8000) ? CRC16_POLY[poly] : 0) ^ (crc << 1);
          c = (c << 1) & 0xFFFF;
        }
        tbl[i] = refin ? reflect16(crc) : crc;
      }
      ___default["default"].set(cached, `poly.${key}`, tbl);
    }
    return cached.poly[key]
  };

  const crc16Fast = (data, poly, crc, refin, refout) => {
    if (!(data instanceof Packet)) throw new TypeError('invalid data type')
    if (!data.byteLength) return ~crc
    const table = getPoly(poly, refin);
    if (refin) {
      crc = reflect16(crc);
      for (const d of data) crc = (crc >> 8) ^ table[(crc & 0xFF) ^ d];
      return refout ? crc : reflect16(crc)
    } else {
      crc &= 0xFFFF;
      for (const d of data) crc = ((crc & 0xFF) << 8) ^ table[(crc >> 8) ^ d];
      return refout ? reflect16(crc) : crc
    }
  };

  // http://www.sunshine2k.de/coding/javascript/crc/crc_js.html
  const crc16A = data => crc2packet(crc16Fast(data, 'CCITT', 0xC6C6, true, true)); // 14443a
  const crc16X25 = data => crc2packet(0xFFFF ^ crc16Fast(data, 'CCITT', 0xFFFF, true, true)); // cryptorf, 14443b, 15693

  class Iso14aCardSelect {
    constructor (pack) {
      // uid 10 + uidlen 1 + atqa 2 + sak 1 + ats_len 1 + ats 256 = 271
      if (!pack || !(pack instanceof Packet) || pack.byteLength < 15) throw new TypeError('invalid pack')
      this.pack = pack;
      this.uid = pack.subarray(0, pack.getUint8(10));
      this.ats = pack.subarray(15, 15 + pack.getUint8(14));
    }

    get atqa () { return this.pack.subarray(11, 13) }
    get sak () { return this.pack.subarray(13, 14) }
  }

  const logTime = (...args) => console.log(`[${new Date().toTimeString().slice(0, 8)}]`, ...args);

  const sleep = t => new Promise(resolve => setTimeout(resolve, t));

  class RethrownError extends Error {
    constructor (err) {
      if (!(err instanceof Error)) throw new TypeError('invalid err type')
      super(err.message);
      this.name = this.constructor.name;
      this.originalError = err;
      this.stack = `${this.stack}\n${err.stack}`;
    }
  }

  const retry$1 = async (fn, times = 3) => {
    if (times < 1) throw new TypeError('invalid times')
    let lastErr = null;
    while (times--) {
      try {
        return await fn()
      } catch (err) {
        lastErr = err;
      }
    }
    throw new RethrownError(lastErr)
  };

  var utils = /*#__PURE__*/Object.freeze({
    __proto__: null,
    logTime: logTime,
    sleep: sleep,
    RethrownError: RethrownError,
    retry: retry$1
  });

  class PacketResponseNG {
    // https://github.com/RfidResearchGroup/proxmark3/blob/master/doc/new_frame_format.md
    // magic 4 + length 2 + status 2 + cmd 2 + data max 512 + crc 2
    constructor (pack) {
      if (!pack || !(pack instanceof Packet)) throw new TypeError('invalid pack')
      this.pack = pack;
      this.data = pack.subarray(10 + (this.ng ? 0 : 24), pack.byteLength - 2);
    }

    get len () { return this.pack.byteLength }
    get ng () { return (this.pack.getUint8(5) & 0x80) > 0 }
    get status () { return this.pack.getInt16(6) }
    get cmd () { return this.pack.getUint16(8) }
    get crc () { return this.pack.getUint16(this.pack.byteLength - 2) }
    getArg (index) { return this.pack.getBigUint64(10 + (index << 3)) }
  }

  class PacketResponseOLD {
    constructor (pack) {
      if (!pack || !(pack instanceof Packet)) throw new TypeError('invalid pack')
      this.pack = pack;
      this.data = pack.subarray(32);
    }

    get cmd () { return this.pack.getUint16(0) }
    getArg (index) { return this.pack.getBigUint64(8 + (index << 3)) }
  }

  const CMD = ___default["default"].fromPairs(___default["default"].map([
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
  ], ([a, b]) => [b, a]));

  class Proxmark3Adapter {
    constructor () {
      this.filters = [
        // http://www.linux-usb.org/usb.ids
        // about://device-log
        { usbVendorId: 0x2D2D, usbProductId: 0x504D }, // proxmark.org: Proxmark3
        { usbVendorId: 0x9AC4, usbProductId: 0x4B8F }, // J. Westhues: ProxMark-3 RFID Instrument (old)
        { usbVendorId: 0x1D6B, usbProductId: 0x0106 }, // iCopy-X
      ];
      this.port = null;
      this.reader = null;
    }

    disconnectListener () {
      logTime('WebSerial disconnected');
      this.reader = null;
      this.port.ondisconnect = null;
      this.port = null;
    }

    async open () {
      if (this.isOpen) return
      if (!('serial' in navigator)) throw new Error('不支援 WebSerial')
      this.port = await navigator.serial.requestPort({ filters: this.filters });
      await this.port.open({ baudRate: 9600 });
      this.port.ondisconnect = () => { this.disconnectListener(); };
      this.clearSerialReadBuffer();
    }

    async readPacket () {
      await this.open();
      if (!this.reader) {
        for (let i = 0; i < 100; i++) { // wait 1s for this.port.readable
          if (this.port.readable) break
          if (i === 99) throw new Error('SerialPort is not readable')
          await sleep(10);
        }
        this.reader = this.port.readable.getReader();
      }
      if (!this.reader) throw new Error('Failed to getReader')
      const { value, done } = await this.reader.read();
      if (done) {
        this.reader.releaseLock();
        this.reader = null;
      }
      return Packet.fromView(value)
    }

    async readBytes (len) {
      if (!___default["default"].isSafeInteger(len) || len < 1) throw new TypeError(`invalid len = ${len}`)
      if (!this.serialReadBuffer) this.clearSerialReadBuffer();
      const ctx = this.serialReadBuffer;
      while (ctx.len < len) {
        const chunk = await this.readPacket();
        ctx.chunks.push(chunk);
        ctx.len += chunk.byteLength;
      }
      const merged = Packet.merge(...ctx.chunks);
      const resp = merged.slice(0, len);
      ctx.len = merged.byteLength - len;
      ctx.chunks = ctx.len > 0 ? [merged.slice(len)] : [];
      // - console.log('readBytes', resp)
      return resp
    }

    clearSerialReadBuffer () {
      if (!this.serialReadBuffer) this.serialReadBuffer = {};
      const ctx = this.serialReadBuffer;
      ctx.chunks = [];
      ctx.errors = [];
      ctx.len = 0;
    }

    async readResp () {
      // https://github.com/RfidResearchGroup/proxmark3/blob/master/doc/new_frame_format.md
      // magic 4 + length 2 + status 2 + cmd 2 + data max 512 + crc 2
      const pre = await this.readBytes(10);
      let resp;
      if (pre.getUint32(0) === 0x62334D50) {
        resp = new PacketResponseNG(Packet.merge(pre, await this.readBytes((pre.getUint16(4) & 0x7FFF) + 2)));
      } else {
        resp = new PacketResponseOLD(Packet.merge(pre, await this.readBytes(534)));
      }
      logTime('readResp', resp);
      return resp
    }

    async waitRespTimeout (cmd, timeout = 25e2) {
      await this.open();
      timeout += 100; // communication_delay 100ms
      const ctx = { startedAt: Date.now(), finished: 0 };
      try {
        return await Promise.race([
          (async () => {
            while (!ctx.finished) {
              const resp = await this.readResp();
              if (resp.cmd === CMD.DEBUG_PRINT_STRING) {
                const err = new Error(resp.data.subarray(2).utf8);
                logTime(err);
                this.serialReadBuffer.errors.push(err);
              }
              if (cmd === CMD.UNKNOWN || resp.cmd === cmd) return resp
              if (resp.cmd === CMD.WTX && resp.data.byteLength === 2) {
                const wtx = resp.data.getUint16(0);
                if (wtx < 0xFFFF) {
                  logTime(`waiting time extend: ${timeout} + ${wtx} = ${timeout + wtx} ms`);
                  timeout += wtx;
                }
              }
            }
          })(),
          (async () => {
            if (timeout < 0) return new Promise(resolve => {}) // 不設定 timeout
            while (!ctx.finished) {
              const sleepts = ctx.startedAt + timeout - Date.now();
              if (sleepts < 0) throw new Error(`waitRespTimeout ${timeout}ms`)
              await sleep(sleepts);
            }
          })(),
        ])
      } finally {
        ctx.finished = 1;
      }
    }

    async writePacket (data) {
      if (!(data instanceof Packet)) throw new TypeError('data should be Packet')
      logTime(`write ${data.byteLength} bytes`, data);
      await this.open();
      for (let i = 0; i < 100; i++) { // wait 1s for this.port.writable
        if (this.port.writable) break
        if (i === 99) throw new Error('SerialPort is not writable')
        await sleep(10);
      }
      const writer = this.port.writable.getWriter();
      if (!writer) throw new Error('Failed to getWriter')
      await writer.write(data);
      writer.releaseLock();
    }

    async sendCommandNG ({ cmd, data = new Packet(), ng = true }) {
      if (!(data instanceof Packet)) throw new TypeError('data should be Packet')
      if (data.byteLength > 512) throw new TypeError('data.byteLength > 512')
      const pack = new Packet(data.byteLength + 10); // magic 4 + length 2 + cmd 2 + dataLen + crc 2
      pack.set(Packet.fromUtf8('PM3a'));
      pack.setUint16(4, data.byteLength | (ng ? 0x8000 : 0));
      pack.setUint16(6, Number(BigInt.asUintN(16, BigInt(cmd))));
      if (data.byteLength) pack.set(data, 8);
      pack.set(Packet.fromUtf8('a3'), data.byteLength + 8); // COMMANDNG_POSTAMBLE_MAGIC = a3
      await this.writePacket(pack);
    }

    async sendCommandMix ({ cmd, arg = [], data = new Packet() }) {
      if (!(data instanceof Packet)) throw new TypeError('data should be Packet')
      if (data.byteLength > 488) throw new TypeError('data.byteLength > 488')
      const pack = new Packet(data.byteLength + 24); // mix format: 3 * arg 8
      if (data.byteLength) pack.set(data, 24);
      for (let i = 0; i < 3; i++) pack.setBigUint64(i << 3, BigInt(arg[i] ?? 0));
      return await this.sendCommandNG({ cmd, data: pack, ng: false })
    }

    async sendCommandOLD ({ cmd, arg = [], data = new Packet() }) {
      if (!(data instanceof Packet)) throw new TypeError('data should be Packet')
      if (data.byteLength > 512) throw new TypeError('data.byteLength > 512')
      const pack = new Packet(544); // mix format: 3 * arg 8
      if (data.byteLength) pack.set(data, 32);
      pack.setBigUint64(0, BigInt(cmd));
      for (let i = 0; i < 3; i++) pack.setBigUint64(8 + (i << 3), BigInt(arg[i] ?? 0));
      await this.writePacket(pack);
    }

    get error () { return ___default["default"].map(this?.serialReadBuffer?.errors, 'message').join(', ') }

    get isOpen () { return this.port !== null }
  }

  const { retry } = utils;

  const mfTypeToMaxSector = (() => {
    const MF_MAX_SECTOR = { mini: 5, '1k': 16, '2k': 32, '4k': 40 };
    return type => {
      type = ___default["default"].toLower(type);
      if (!MF_MAX_SECTOR[type]) throw new TypeError('invalid mifare type')
      return MF_MAX_SECTOR[type]
    }
  })();

  class Proxmark3 {
    constructor (adapter) {
      this.adapter = adapter ?? new Proxmark3Adapter();
      this.plugins = new Map();
      this.hooks = {};
    }

    // install plugin
    async use (plugin, option = {}) {
      if (!plugin || !___default["default"].isFunction(plugin.install) || !___default["default"].isString(plugin.name)) throw new TypeError('property plugin.name and method plugin.install is required.')
      const pluginId = `$${plugin.name}`;
      if (this.hasPlugin(pluginId)) return this
      const installed = await plugin.install({
        Packet,
        pm3: this,
        CMD,
        utils,
      }, option);
      // console.log(installed)
      if (!___default["default"].isNil(installed)) this[pluginId] = installed;
      this.addPlugin(pluginId, plugin);
      return this
    }

    addPlugin (pluginId, plugin) {
      this.plugins.set(pluginId, plugin);
    }

    hasPlugin (pluginId) {
      return this.plugins.has(pluginId)
    }

    async hfDropField () {
      this.adapter.clearSerialReadBuffer();
      await this.adapter.sendCommandNG({ cmd: CMD.HF_DROPFIELD });
    }

    async hf14aDeselectCard () {
      await this.adapter.sendCommandMix({ cmd: CMD.HF_ISO14443A_READER });
    }

    async hf14aSelectCard () {
      await this.hfDropField();
      this.adapter.clearSerialReadBuffer();
      await this.adapter.sendCommandMix({ cmd: CMD.HF_ISO14443A_READER, arg: [0b11n] }); // ISO14A_CONNECT | ISO14A_NO_DISCONNECT
      const resp = await this.adapter.waitRespTimeout(CMD.ACK); // cmd = ack
      resp.selectStatus = Number(resp.getArg(0));
      resp.card = new Iso14aCardSelect(resp.data); // mix format: 3 * arg 8
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
        await this.hf14aDeselectCard();
      }
    }

    // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/mifare/mifarehost.c#L807
    async cmdMfRdBl (blockNo, keyType, key) {
      if (!(key instanceof Packet)) throw new TypeError('key should be Packet')
      if (key.byteLength !== 6) throw new TypeError('invalid key')
      const data = new Packet(8);
      data.setUint8(0, blockNo);
      data.setUint8(1, keyType);
      data.set(key, 2);
      this.adapter.clearSerialReadBuffer();
      await this.adapter.sendCommandNG({ cmd: CMD.HF_MIFARE_READBL, data });
      const resp = await this.adapter.waitRespTimeout(CMD.HF_MIFARE_READBL);
      if (resp.status) throw new Error('Failed to read block')
      return resp.data
    }

    // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/mifare/mifarehost.c#L786
    async cmdMfRdSc (sectorNo, keyType, key) {
      if (!(key instanceof Packet)) throw new TypeError('key should be Packet')
      if (key.byteLength !== 6) throw new TypeError('invalid key')
      this.adapter.clearSerialReadBuffer();
      await this.adapter.sendCommandMix({ cmd: CMD.HF_MIFARE_READSC, arg: [sectorNo, keyType], data: key });
      const resp = await this.adapter.waitRespTimeout(CMD.ACK);
      const status = Number(resp.getArg(0)) & 0xFF;
      if (!status) throw new Error(`Failed to read block, sectorNo = ${sectorNo}, err = ${this.adapter.error}`)
      return resp.data.slice(0, 64)
    }

    async mfReadSectorKeyBA ({ sectorNo, ka, kb }) { // 使用 BA key 嘗試讀取 sector
      const fn1 = async () => {
        try {
          return await this.cmdMfRdSc(sectorNo, 1, kb)
        } catch (err) {}
        return await this.cmdMfRdSc(sectorNo, 0, ka)
      };
      try {
        const sector = await retry(fn1);
        if (ka) sector.set(ka, 48);
        if (kb) sector.set(kb, 58);
        return sector
      } catch (err) {
        throw ___default["default"].set(new Error(`Failed to read sector ${sectorNo}`), 'data.sectorNo', sectorNo)
      }
    }

    async mfReadCard ({ type = '1k', keys }) {
      if (!keys) throw new TypeError('invalid keys')
      const secKeys = await this.cmdMfFchk({ type, keys });
      const maxSector = mfTypeToMaxSector(type);
      const card = new Packet(maxSector * 64);
      const errors = [];
      for (let i = 0; i < maxSector; i++) {
        try {
          card.set(await this.mfReadSectorKeyBA({
            sectorNo: i,
            ka: secKeys[i * 2],
            kb: secKeys[i * 2 + 1],
          }), i * 64);
        } catch (err) {
          errors.push(err);
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
      const data = new Packet(26);
      data.set(key, 0);
      data.set(block, 10);
      this.adapter.clearSerialReadBuffer();
      await this.adapter.sendCommandMix({ cmd: CMD.HF_MIFARE_WRITEBL, arg: [blockNo, keyType], data });
      const resp = await this.adapter.waitRespTimeout(CMD.ACK);
      const status = Number(resp.getArg(0)) & 0xFF;
      if (!status) throw new Error(`Failed to write block, blockNo = ${blockNo}, err = ${this.adapter.error}`)
    }

    async mfWriteSectorKeyBA ({ sectorNo, sector, ka, kb }) {
      if (!(sector instanceof Packet) || sector.byteLength !== 64) throw new TypeError('invalid sector')
      if (!Mifare1k.isValidAcl(sector.subarray(54, 57))) throw new TypeError('invalid sector acl')
      const errors = [];
      const fn1 = async (blockNo, block) => {
        try {
          return await this.cmdMfWrbl(blockNo, 1, kb, block)
        } catch (err) {}
        await this.cmdMfWrbl(blockNo, 0, ka, block);
      };
      for (let i = 0; i < 4; i++) {
        const blockNo = (sectorNo * 4) + i;
        const block = sector.subarray(i * 16, (i + 1) * 16);
        try {
          await retry(() => fn1(blockNo, block));
        } catch (err) {
          ___default["default"].set(err, 'data.blockNo', blockNo);
          errors.push(err);
        }
      }
      return { errors }
    }

    async mfWriteCard ({ type = '1k', keys, card }) {
      if (!keys) throw new TypeError('invalid keys')
      const maxSector = mfTypeToMaxSector(type);
      if (!(card instanceof Packet) || card.byteLength !== maxSector * 64) throw new TypeError('invalid card')
      const secKeys = await this.cmdMfFchk({ type, keys });
      const errors = [];
      for (let i = 0; i < maxSector; i++) {
        const { errors: errors1 } = await this.mfWriteSectorKeyBA({
          ka: secKeys[i * 2],
          kb: secKeys[i * 2 + 1],
          sector: card.subarray(i * 64, (i + 1) * 64),
          sectorNo: i,
        });
        if (errors1.length) errors.push(...errors1);
      }
      return { errors }
    }

    // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/mifare/mifarehost.c#L866
    async cmdMfEset (blockData, blockNo, blockCnt = 1, blockSize = 16) {
      if (!(blockData instanceof Packet)) throw new TypeError('blockData should be Packet')
      if (blockData.byteLength !== blockCnt * blockSize) throw new TypeError('invalid blockData.byteLength')
      const data = new Packet(blockData.byteLength + 3);
      data.set(new Packet([blockNo, blockCnt, blockSize]));
      data.set(blockData, 3);
      this.adapter.clearSerialReadBuffer();
      await this.adapter.sendCommandNG({ cmd: CMD.HF_MIFARE_EML_MEMSET, data });
    }

    // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/mifare/mifarehost.c#L832
    async cmdMfEget (blockNo) {
      this.adapter.clearSerialReadBuffer();
      await this.adapter.sendCommandNG({ cmd: CMD.HF_MIFARE_EML_MEMGET, data: new Packet([blockNo, 1]) });
      const resp = await this.adapter.waitRespTimeout(CMD.HF_MIFARE_EML_MEMGET);
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
      const data = new Packet(16);
      let flags = 0;

      if (uid) {
        if (!(uid instanceof Packet)) throw new TypeError('uid should be Packet')
        if (!___default["default"].includes([4, 7, 10], uid.byteLength)) throw new TypeError('invalid uid')
        data.set(uid, 3);
        flags |= (1 << ___default["default"].floor(uid.byteLength / 3)); // FLAG_4B_UID_IN_DATA, FLAG_7B_UID_IN_DATA, FLAG_10B_UID_IN_DATA
      } else flags |= 0x10; // FLAG_UID_IN_EMUL

      if (atqa) {
        if (!(atqa instanceof Packet)) throw new TypeError('atqa should be Packet')
        if (atqa.byteLength !== 2) throw new TypeError('invalid atqa.byteLength')
        data.set(atqa, 13);
        flags |= 0x800; // FLAG_FORCED_ATQA
      }

      if (sak) {
        if (!(sak instanceof Packet)) throw new TypeError('sak should be Packet')
        if (sak.byteLength !== 1) throw new TypeError('invalid sak.byteLength')
        data.set(sak, 15);
        flags |= 0x1000; // FLAG_FORCED_SAK
      }

      if (interactive) flags |= 0x1; // FLAG_INTERACTIVE
      if (nrArAttack) flags |= 0x20; // FLAG_NR_AR_ATTACK
      if (cve) flags |= 0x2000; // FLAG_CVE21_0430

      const FLAGS_TYPE = {
        mini: 0x80,
        '1k': 0x100,
        '2k': 0x200,
        '4k': 0x400,
      };
      type = ___default["default"].toLower(type);
      if (!FLAGS_TYPE[type]) throw new TypeError('invalid type')
      flags |= FLAGS_TYPE[type];

      data.setUint16(0, flags);
      data.setUint8(2, exitAfter);

      this.adapter.clearSerialReadBuffer();
      await this.adapter.sendCommandNG({ cmd: CMD.HF_MIFARE_SIMULATE, data });
      if (!interactive) return
      while (true) {
        const resp = await this.adapter.waitRespTimeout(CMD.ACK);
        if (!nrArAttack) break
        if ((Number(resp.getArg(0)) & 0xFFFF) !== CMD.HF_MIFARE_SIMULATE) break
        // TODO: readerAttack not implemented
        console.log('nrArAttack', resp);
      }
    }

    // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/cmdhfmf.c#L4472
    async cmdMfCsetblk (blockNo, data, wipe = false) {
      if (!___default["default"].inRange(blockNo, 0, 64)) throw new TypeError('invalid blockNo')
      if (!(data instanceof Packet)) throw new TypeError('data should be Packet')
      if (data.byteLength !== 16) throw new TypeError('invalid data')
      // MAGIC_SINGLE = (MAGIC_WUPC | MAGIC_HALT | MAGIC_INIT | MAGIC_OFF) // 0x1E
      // MAGIC_WIPE = 0x40
      const flags = 0x1E | (wipe ? 0x40 : 0);
      this.adapter.clearSerialReadBuffer();
      await this.adapter.sendCommandMix({ cmd: CMD.HF_MIFARE_CSETBL, arg: [flags, blockNo], data });
      const resp = await this.adapter.waitRespTimeout(CMD.ACK, 35e2);
      const status = Number(resp.getArg(0)) & 0xFF;
      if (!status) throw new Error(`Failed to write block, blockNo = ${blockNo}, err = ${this.adapter.error}`)
      return resp.data.slice(0, 4)
    }

    async mfWriteMagicCard ({ type = '1k', card }) {
      const maxSector = mfTypeToMaxSector(type);
      if (!(card instanceof Packet) || card.byteLength !== maxSector * 64) throw new TypeError('invalid card')
      const blocks = card.chunk(16);
      const errors = [];
      for (let i = 0; i < blocks.length; i++) {
        try {
          await retry(() => this.cmdMfCsetblk(i, blocks[i]));
        } catch (err) {
          ___default["default"].set(err, 'data.blockNo', i);
          errors.push(err);
        }
      }
      return { errors }
    }

    // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/cmdhfmf.c#L4662
    async cmdMfCgetblk (blockNo) {
      if (!___default["default"].inRange(blockNo, 0, 64)) throw new TypeError('invalid blockNo')
      // MAGIC_SINGLE = (MAGIC_WUPC | MAGIC_HALT | MAGIC_INIT | MAGIC_OFF) // 0x1E
      const flags = 0x1E;
      this.adapter.clearSerialReadBuffer();
      await this.adapter.sendCommandMix({ cmd: CMD.HF_MIFARE_CGETBL, arg: [flags, blockNo] });
      const resp = await this.adapter.waitRespTimeout(CMD.ACK);
      const status = Number(resp.getArg(0)) & 0xFF;
      if (!status) throw new Error(`Failed to write block, blockNo = ${blockNo}, err = ${this.adapter.error}`)
      return resp.data.slice(0, 16)
    }

    async mfReadMagicCard ({ type = '1k' }) {
      const maxBlock = mfTypeToMaxSector(type) * 4;
      const card = new Packet(maxBlock * 16);
      const errors = [];
      for (let i = 0; i < maxBlock; i++) {
        try {
          card.set(await retry(() => this.cmdMfCgetblk(i)), i * 16);
        } catch (err) {
          ___default["default"].set(err, 'data.blockNo', i);
          errors.push(err);
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
        if (data.byteLength > 0) data = Packet.merge(data, topaz ? crc16X25(data) : crc16A(data));
      }

      let flags = [0, 0x1, 0x81]?.[active]; // ISO14A_CONNECT = 0x1, ISO14A_NO_SELECT = 0x80
      if (timeout > 0) {
        flags |= 0x40; // ISO14A_SET_TIMEOUT
        timeout = ___default["default"].floor(1356 / (8 * 16) * Math.min(timeout, 40542464)); // timeout in ETUs (time to transfer 1 bit, approx. 9.4 us)
      }
      if (!disconnect) flags |= 0x2; // ISO14A_NO_DISCONNECT
      if (data.byteLength) flags |= 0x8; // ISO14A_RAW
      if (topaz) flags |= 0x100; // ISO14A_TOPAZMODE
      if (!rats) flags |= 0x200; // ISO14A_NO_RATS
      if (ecp) flags |= 0x800; // ISO14A_USE_ECP
      if (magsafe) flags |= 0x1000; // ISO14A_USE_MAGSAFE
      this.adapter.clearSerialReadBuffer();
      await this.adapter.sendCommandOLD({ cmd: CMD.HF_ISO14443A_READER, arg: [flags, data.byteLength | (numbits << 16), timeout], data });
      if (!reply) return
      if (active === 1) { // 1: active with select
        const selRes = await this.adapter.waitRespTimeout(CMD.ACK, timeout + 2500);
        selRes.uidlen = Number(selRes.getArg(1)) & 0xFFFF;
        if (!selRes.uidlen) throw new Error('Failed to select card')
      }
      if (!data.byteLength) return
      const resp = await this.adapter.waitRespTimeout(CMD.ACK, timeout + 2500);
      resp.datalen = Number(resp.getArg(0)) & 0xFFFF;
      if (!resp.datalen) throw new Error('Failed to receive data')
      const dataWithoutCrc = resp.data.subarray(0, -2);
      if (resp.datalen >= 3 && crc16A(dataWithoutCrc).isEqual(resp.data.subarray(-2))) {
        resp.dataWithoutCrc = dataWithoutCrc;
      }
      return resp
    }

    async cmdMfFchk ({ type = '1k', keys = null }) {
      const maxSector = mfTypeToMaxSector(type);
      const argIterator = {
        * [Symbol.iterator] () {
          if (!keys) {
            yield { arg: [0x1100 | maxSector, 0x101, 0] };
            return
          }
          if (___default["default"].isArray(keys)) {
            keys = Packet.merge(...(___default["default"].chain(keys)
              .filter(key => key instanceof Packet && key.byteLength === 6)
              .uniqBy('hex')
              .values()));
          }
          if (!(keys instanceof Packet)) throw new TypeError('invalid keys type')
          const keyslen = keys.byteLength;
          if (keyslen < 6 || keyslen % 6) throw new TypeError('invalid keys length')
          for (const strategy of [1, 2]) {
            for (let i = 0; i < keyslen; i += 510) { // 512 - 512 % 6 = 510
              const data = keys.subarray(i, i + 510);
              yield {
                data,
                arg: [
                  // (isLast << 12) | (isFirst << 8) | maxSector
                  ((i + 510 >= keyslen) << 12) | ((i === 0) << 8) | maxSector,
                  strategy, // strategys: 1= deep first on sector 0 AB,  2= width first on all sectors
                  data.byteLength / 6, // size
                ],
              };
            }
          }
        },
      };

      let resp;
      for (const arg of argIterator) {
        this.adapter.clearSerialReadBuffer();
        await this.adapter.sendCommandOLD({ cmd: CMD.HF_MIFARE_CHKKEYS_FAST, ...arg });
        resp = await this.adapter.waitRespTimeout(CMD.ACK, 36e4); // 360s
        if (Number(resp.getArg(0)) === maxSector * 2) break // all key found
      }
      const found = {
        flags: new Packet(___default["default"].map([7, 6, 5, 4, 3, 2, 1, 0, 8, 9], idx => resp.data[480 + idx])),
        keys: [],
      };
      for (let i = 0; i < maxSector; i++) {
        for (const j of [2 * i, 2 * i + 1]) {
          const isFound = (found.flags[j >> 3] >> (j & 7)) & 1;
          found.keys[j] = isFound ? resp.data.subarray(j * 6, j * 6 + 6) : null;
        }
      }
      return found.keys
    }
  }

  var version = "0.1.0";

  exports.Mifare1k = Mifare1k;
  exports.Packet = Packet;
  exports.Proxmark3 = Proxmark3;
  exports.utils = utils;
  exports.version = version;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
