(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('lodash')) :
  typeof define === 'function' && define.amd ? define(['lodash'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Pm3Hf14a = factory(global._));
})(this, (function (_) { 'use strict';

  function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

  var ___default = /*#__PURE__*/_interopDefaultLegacy(_);

  const BASE64URL_CHAR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  class Packet extends Uint8Array {
    constructor (...args) {
      super(...args);
      this.dv = new DataView(this.buffer, this.byteOffset, this.length);
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
      const len = ___default["default"].sumBy(packs, 'length');
      const merged = new Packet(len);
      ___default["default"].reduce(packs, (offset, pack) => {
        merged.set(pack, offset);
        return offset + pack.length
      }, 0);
      return merged
    }

    static isLen (pack, len = null) {
      return (pack instanceof Packet) && (___default["default"].isNil(len) || pack.length === len)
    }

    isEqual (other) {
      return this.length === other.length && this.every((v, k) => v === other[k])
    }

    chunk (bytesPerChunk) {
      if (bytesPerChunk < 1) throw new TypeError('invalid bytesPerChunk')
      const chunks = [];
      for (let i = 0; i < this.length; i += bytesPerChunk) chunks.push(this.subarray(i, i + bytesPerChunk));
      return chunks
    }

    // 共通屬性
    get hex () { return ___default["default"].map(this, b => (b + 0x100).toString(16).slice(-2)).join('').toUpperCase() }
    get rhex () { return ___default["default"].map(this, b => (b + 0x100).toString(16).slice(-2)).reverse().join('').toUpperCase() }
    get inspect () { return `${___default["default"].map(this, b => (b + 0x100).toString(16).slice(-2)).join(' ').toUpperCase()} (len=${this.length})` }
    get utf8 () { return new TextDecoder().decode(this) }
    get base64url () {
      const tmp = [];
      for (let i = 0; i < this.length; i += 3) {
        let u24 = 0;
        for (let j = 0; j < 3; j++) u24 |= ((i + j) < this.length ? this[i + j] : 0) << (16 - j * 8);
        tmp.push(___default["default"].times(Math.min(this.length - i + 1, 4), j => BASE64URL_CHAR[(u24 >> (18 - 6 * j)) & 0x3F]).join(''));
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
    if (!Packet.isLen(data)) throw new TypeError('invalid data')
    if (!data.length) return ~crc
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
  // https://crccalc.com/
  const crc16A = data => crc2packet(crc16Fast(data, 'CCITT', 0xC6C6, true, true)); // 14443a
  const crc16X25 = data => crc2packet(0xFFFF ^ crc16Fast(data, 'CCITT', 0xFFFF, true, true)); // cryptorf, 14443b, 15693

  class Pm3Hf14a {
    constructor () {
      this.name = 'hf14a';
    }

    install (context, pluginOption) {
      const { Packet, pm3, PM3_CMD, utils: { retry } } = context;

      const mfIsValidAcl = acl => {
        const u4arr = ___default["default"].flatten(___default["default"].times(3, i => [(acl[i] & 0xF0) >> 4, acl[i] & 0xF]));
        return ___default["default"].every([[1, 2], [0, 5], [3, 4]], ([a, b]) => u4arr[a] ^ u4arr[b] === 0xF)
      };

      const mfKeysUniq = keys => {
        if (!___default["default"].isArray(keys)) throw new TypeError('invalid keys')
        return ___default["default"].chain(keys)
          .filter(key => Packet.isLen(key, 6))
          .uniqWith((val1, val2) => val1.isEqual(val2))
          .value()
      };

      const dropField = async () => {
        pm3.clearRespBuf();
        await pm3.sendCommandNG({ cmd: PM3_CMD.HF_DROPFIELD });
      };

      const deselectCard = async () => {
        await pm3.sendCommandMix({ cmd: PM3_CMD.HF_ISO14443A_READER });
      };

      const selectCard = async () => {
        await dropField();
        pm3.clearRespBuf();
        await pm3.sendCommandMix({ cmd: PM3_CMD.HF_ISO14443A_READER, arg: [0b11n] }); // ISO14A_CONNECT | ISO14A_NO_DISCONNECT
        const resp = await pm3.readRespTimeout(PM3_CMD.ACK); // cmd = ack
        resp.selectStatus = Number(resp.getArg(0));
        resp.card = {
          atqa: resp.data.subarray(11, 13),
          ats: resp.data.subarray(15, 15 + resp.data(10)),
          sak: resp.data.subarray(13, 14),
          uid: resp.data.subarray(resp.data[10]),
        };
        if (resp.selectStatus === 0) { // 0: couldn't read, 1: OK, with ATS, 2: OK, no ATS, 3: proprietary Anticollision
          throw new Error('failed to select iso14443a card')
        } else if (resp.selectStatus === 3) {
          throw new Error(`Card doesn't support standard iso14443-3 anticollision, ATQA: ${resp.card.atqa.hex}`)
        }
        return resp.card
      };

      // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/cmdhf14a.c#L1735
      const cardInfo = async () => {
        try {
          // TODO: Detect Information
          return await selectCard()
        } finally {
          await deselectCard();
        }
      };

      // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/mifare/mifarehost.c#L180
      const mfAuthBlock = async ({ block = 0, isKb = 0, key } = {}) => {
        if (!Packet.isLen(key, 6)) throw new TypeError('invalid key')
        isKb = isKb ? 1 : 0;
        pm3.clearRespBuf();
        await pm3.sendCommandNG({ cmd: PM3_CMD.HF_MIFARE_CHKKEYS, data: new Packet([isKb, block, 1, 0, 1]) });
        const resp = await pm3.readRespTimeout(PM3_CMD.HF_MIFARE_CHKKEYS);
        if (resp.status && !resp.data[6]) throw new Error(`Failed to auth block ${block}`)
        return resp.data.subarray(0, 6)
      };

      // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/mifare/mifarehost.c#L807
      const mfReadBlock = async ({ block = 0, isKb = 0, key } = {}) => {
        if (!Packet.isLen(key, 6)) throw new TypeError('invalid key')
        isKb = isKb ? 1 : 0;
        return await retry(async () => {
          pm3.clearRespBuf();
          await pm3.sendCommandNG({ cmd: PM3_CMD.HF_MIFARE_READBL, data: new Packet([block, isKb, ...key]) });
          const resp = await pm3.readRespTimeout(PM3_CMD.HF_MIFARE_READBL);
          if (resp.status) throw new Error(`Failed to read block ${block}`)
          return resp.data
        })
      };

      const mfReadBlockKeyBA = async ({ block = 0, ka, kb } = {}) => {
        for (let isKb = 1; isKb >= 0; isKb--) {
          try {
            return await mfReadBlock({ block, isKb, key: [ka, kb][isKb] })
          } catch (err) {}
        }
        throw new Error(`Failed to read block ${block}`)
      };

      // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/mifare/mifarehost.c#L786
      const mfReadSector = async ({ sector = 0, isKb = 0, key } = {}) => {
        if (!Packet.isLen(key, 6)) throw new TypeError('invalid key')
        isKb = isKb ? 1 : 0;
        return await retry(async () => {
          pm3.clearRespBuf();
          await pm3.sendCommandMix({ cmd: PM3_CMD.HF_MIFARE_READSC, arg: [sector, isKb], data: key });
          const resp = await pm3.readRespTimeout(PM3_CMD.ACK);
          const status = Number(resp.getArg(0)) & 0xFF;
          if (!status) throw new Error(`Failed to read sector ${sector}`)
          return resp.data.slice(0, 64)
        })
      };

      const mfReadSectorKeyBA = async ({ sector = 0, ka, kb } = {}) => { // 使用 BA key 嘗試讀取 sector
        const data = new Packet(64);
        const success = { key: [0, 0], read: [0, 0, 0, 0] };
        for (let isKb = 1; isKb >= 0; isKb--) {
          try {
            const key = [ka, kb][isKb];
            await mfAuthBlock({ block: sector * 4, isKb, key });
            success.key[isKb] = 1;
            for (let i = 0; i < 4; i++) {
              try {
                if (success.read[i]) continue
                const blockData = await mfReadBlock({ block: sector * 4 + i, isKb, key });
                data.set(blockData, i * 16);
                success.read[i] = 1;
              } catch (err) {}
            }
          } catch (err) {}
        }
        for (let isKb = 1; isKb >= 0; isKb--) {
          if (!success.key[isKb]) continue
          data.set([ka, kb][isKb], [48, 58][isKb]);
        }
        return { data, success: success.read }
      };

      const mfReadCardByKeys = async ({ keys, sectorMax = 16 } = {}) => {
        keys = mfKeysUniq(keys);
        if (!keys.length) throw new TypeError('invalid keys')
        const success = [];
        const secKeys = await mfKeysCheck({ keys, sectorMax });
        const data = new Packet(sectorMax * 64);
        for (let i = 0; i < sectorMax; i++) {
          const sectorRes = await mfReadSectorKeyBA({
            sector: i,
            ka: secKeys[i * 2],
            kb: secKeys[i * 2 + 1],
          });
          data.set(sectorRes.data, i * 64);
          success.push(...sectorRes.success);
        }
        return { data, success }
      };

      // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/cmdhfmf.c#L438
      const mfWriteBlock = async ({ block = 0, isKb = 0, key, data } = {}) => {
        if (!Packet.isLen(key, 6)) throw new TypeError('invalid key')
        if (!Packet.isLen(data, 16)) throw new TypeError('invalid data')
        isKb = isKb ? 1 : 0;
        await retry(async () => {
          pm3.clearRespBuf();
          await pm3.sendCommandMix({ cmd: PM3_CMD.HF_MIFARE_WRITEBL, arg: [block, isKb], data: new Packet([...key, 0, 0, 0, 0, ...data]) });
          const resp = await pm3.readRespTimeout(PM3_CMD.ACK);
          const status = Number(resp.getArg(0)) & 0xFF;
          if (!status) throw new Error(`Failed to write block ${block}`)
        });
      };

      const mfWriteBlockKeyBA = async ({ block = 0, ka, kb, data } = {}) => {
        for (let isKb = 1; isKb >= 0; isKb--) {
          try {
            await mfWriteBlock({ block, isKb, key: [ka, kb][isKb], data });
          } catch (err) {}
        }
        throw new Error(`Failed to write block ${block}`)
      };

      const mfWriteSector = async ({ sector = 0, isKb, key, data } = {}) => {
        if (!Packet.isLen(data, 64)) throw new TypeError('invalid data')
        if (!mfIsValidAcl(data.subarray(54, 57))) throw new TypeError('invalid sector acl')
        const success = [0, 0, 0, 0];
        for (let i = 0; i < 4; i++) {
          try {
            await mfWriteBlock({ block: sector * 4 + i, isKb, key, data: data.subarray(i * 16, i * 16 + 16) });
            success[i] = 1;
          } catch (err) {}
        }
        return success
      };

      const mfWriteSectorKeyBA = async ({ sector = 0, ka, kb, data } = {}) => {
        if (!Packet.isLen(data, 64)) throw new TypeError('invalid data')
        if (!mfIsValidAcl(data.subarray(54, 57))) throw new TypeError('invalid sector acl')
        const success = [0, 0, 0, 0];
        for (let isKb = 1; isKb >= 0; isKb--) {
          const key = [ka, kb][isKb];
          for (let i = 0; i < 4; i++) {
            if (success[i]) continue
            try {
              await mfWriteBlock({ block: sector * 4 + i, isKb, key, data: data.subarray(i * 16, i * 16 + 16) });
              success[i] = 1;
            } catch (err) {}
          }
        }
        return success
      };

      const mfWriteCardByKeys = async ({ sectorMax = 16, keys, data } = {}) => {
        if (!Packet.isLen(data, sectorMax * 64)) throw new TypeError('invalid data')
        keys = mfKeysUniq(keys);
        if (!keys.length) throw new TypeError('invalid keys')
        const secKeys = await mfKeysCheck({ sectorMax, keys });
        const success = [];
        for (let i = 0; i < sectorMax; i++) {
          let secSuccess = [0, 0, 0, 0];
          try {
            secSuccess = await mfWriteSectorKeyBA({
              data: data.subarray(i * 64, (i + 1) * 64),
              ka: secKeys[i * 2],
              kb: secKeys[i * 2 + 1],
              sector: i,
            });
          } catch (err) {}
          success.push(...secSuccess);
        }
        return success
      };

      // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/cmdhfmf.c#L4662
      const mfReadBlockGen1a = async ({ block = 0 } = {}) => {
        // MAGIC_SINGLE = (MAGIC_WUPC | MAGIC_HALT | MAGIC_INIT | MAGIC_OFF) // 0x1E
        const flags = 0x1E;
        return await retry(async () => {
          pm3.clearRespBuf();
          await pm3.sendCommandMix({ cmd: PM3_CMD.HF_MIFARE_CGETBL, arg: [flags, block] });
          const resp = await pm3.readRespTimeout(PM3_CMD.ACK);
          const status = Number(resp.getArg(0)) & 0xFF;
          if (!status) throw new Error(`Failed to write block ${block}`)
          return resp.data.slice(0, 16)
        })
      };

      const mfReadSectorGen1a = async ({ sector = 0 } = {}) => {
        const data = new Packet(64);
        const success = [0, 0, 0, 0];
        for (let i = 0; i < 4; i++) {
          try {
            data.set(await mfReadBlockGen1a({ block: i }), i * 16);
            success[i] = 1;
          } catch (err) {}
        }
        return { data, success }
      };

      const mfReadCardGen1a = async ({ sectorMax = 16 } = {}) => {
        const data = new Packet(sectorMax * 64);
        const success = ___default["default"].times(sectorMax * 4, () => 0);
        for (let i = 0; i < sectorMax * 4; i++) {
          try {
            data.set(await mfReadBlockGen1a({ block: i }), i * 16);
            success[i] = 1;
          } catch (err) {}
        }
        return { data, success }
      };

      // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/cmdhfmf.c#L4472
      const mfWriteBlockGen1a = async ({ block, data, wipe = false } = {}) => {
        if (!Packet.isLen(data, 16)) throw new TypeError('invalid data')
        // MAGIC_SINGLE = (MAGIC_WUPC | MAGIC_HALT | MAGIC_INIT | MAGIC_OFF) // 0x1E
        // MAGIC_WIPE = 0x40
        const flags = 0x1E | (wipe ? 0x40 : 0);
        await retry(async () => {
          pm3.clearRespBuf();
          await pm3.sendCommandMix({ cmd: PM3_CMD.HF_MIFARE_CSETBL, arg: [flags, block], data });
          const resp = await pm3.readRespTimeout(PM3_CMD.ACK);
          const status = Number(resp.getArg(0)) & 0xFF;
          if (!status) throw new Error(`Failed to write block ${block}`)
          return resp.data.slice(0, 4)
        });
      };

      const mfWriteSectorGen1a = async ({ sector = 16, data } = {}) => {
        if (!Packet.isLen(data, 64)) throw new TypeError('invalid data')
        const blocks = data.chunk(16);
        const success = [0, 0, 0, 0];
        for (let i = 0; i < blocks.length; i++) {
          try {
            await mfWriteBlockGen1a({ block: sector * 4 + i, data: blocks[i] });
            success[i] = 1;
          } catch (err) {}
        }
        return success
      };

      const mfWriteCardGen1a = async ({ sectorMax = 16, data } = {}) => {
        if (!Packet.isLen(data, sectorMax * 64)) throw new TypeError('invalid data')
        const blocks = data.chunk(16);
        const success = ___default["default"].times(sectorMax * 4, () => 0);
        for (let i = 0; i < blocks.length; i++) {
          try {
            await mfWriteBlockGen1a({ block: i, data: blocks[i] });
            success[i] = 1;
          } catch (err) {}
        }
        return success
      };

      // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/mifare/mifarehost.c#L832
      const mfEmlReadBlock = async ({ block = 0 } = {}) => {
        return await retry(async () => {
          pm3.clearRespBuf();
          await pm3.sendCommandNG({ cmd: PM3_CMD.HF_MIFARE_EML_MEMGET, data: new Packet([block, 1]) });
          const resp = await pm3.readRespTimeout(PM3_CMD.HF_MIFARE_EML_MEMGET);
          if (resp.status) throw new Error('Failed to read block from eml')
          return resp.data
        })
      };

      const mfEmlReadSector = async ({ sector = 0 } = {}) => {
        const data = new Packet(64);
        for (let i = 0; i < 4; i++) {
          try {
            const blockData = await mfEmlReadBlock({ block: sector * 4 + i });
            data.set(blockData, i * 16);
          } catch (err) {}
        }
        return data
      };

      const mfEmlReadCard = async ({ sectorMax = 16 } = {}) => {
        const data = new Packet(sectorMax * 64);
        for (let i = 0; i < 4 * sectorMax; i++) {
          try {
            const blockData = await mfEmlReadBlock({ block: i });
            data.set(blockData, i * 16);
          } catch (err) {}
        }
        return data
      };

      // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/mifare/mifarehost.c#L866
      const mfEmlWriteBlock = async ({ block = 0, data } = {}) => {
        if (!Packet.isLen(data, 16)) throw new TypeError('invalid data')
        await retry(async () => {
          pm3.clearRespBuf();
          await pm3.sendCommandNG({ cmd: PM3_CMD.HF_MIFARE_EML_MEMSET, data: new Packet([block, 1, 16, ...data]) });
        });
      };

      const mfEmlWriteSector = async ({ sector = 0, data } = {}) => {
        if (!Packet.isLen(data, 64)) throw new TypeError('invalid data')
        for (let i = 0; i < 4; i++) {
          try {
            await mfEmlWriteBlock({ block: sector * 4 + i, data: data.subarray(i * 16, i * 16 + 16) });
          } catch (err) {}
        }
      };

      const mfEmlWriteCard = async ({ sectorMax = 16, data } = {}) => {
        if (!Packet.isLen(data, sectorMax * 64)) throw new TypeError('invalid data')
        for (let i = 0; i < 4 * sectorMax; i++) {
          try {
            await mfEmlWriteBlock({ block: i, data: data.subarray(i * 16, i * 16 + 16) });
          } catch (err) {}
        }
      };

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
      } = {}) => {
        const data = new Packet(16);
        let flags = 0;

        if (uid) {
          if (!Packet.isLen(uid)) throw new TypeError('invalid uid')
          if (!___default["default"].includes([4, 7, 10], uid.length)) throw new TypeError('invalid uid')
          data.set(uid, 3);
          flags |= (1 << ___default["default"].floor(uid.length / 3)); // FLAG_4B_UID_IN_DATA, FLAG_7B_UID_IN_DATA, FLAG_10B_UID_IN_DATA
        } else flags |= 0x10; // FLAG_UID_IN_EMUL

        if (atqa) {
          if (!Packet.isLen(atqa, 2)) throw new TypeError('invalid atqa')
          data.set(atqa, 13);
          flags |= 0x800; // FLAG_FORCED_ATQA
        }

        if (sak) {
          if (!Packet.isLen(sak, 1)) throw new TypeError('invalid sak')
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

        pm3.clearRespBuf();
        await pm3.sendCommandNG({ cmd: PM3_CMD.HF_MIFARE_SIMULATE, data });
        if (!interactive) return
        while (true) {
          const resp = await pm3.readRespTimeout(PM3_CMD.ACK);
          if (!nrArAttack) break
          if ((Number(resp.getArg(0)) & 0xFFFF) !== PM3_CMD.HF_MIFARE_SIMULATE) break
          // TODO: readerAttack not implemented
          console.log('nrArAttack', resp);
        }
      };

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
        if (data.length >= 512) throw new TypeError('invalid data length')
        if (crc) { // crc
          if (data.length >= 510) throw new TypeError('failed to add CRC') // PM3_CMD_DATA_SIZE 512 - 2 = 510
          if (data.length > 0) data = Packet.merge(data, topaz ? crc16X25(data) : crc16A(data));
        }

        let flags = [0, 0x1, 0x81]?.[active]; // ISO14A_CONNECT = 0x1, ISO14A_NO_SELECT = 0x80
        if (timeout > 0) {
          flags |= 0x40; // ISO14A_SET_TIMEOUT
          timeout = ___default["default"].floor(1356 / (8 * 16) * Math.min(timeout, 40542464)); // timeout in ETUs (time to transfer 1 bit, approx. 9.4 us)
        }
        if (!disconnect) flags |= 0x2; // ISO14A_NO_DISCONNECT
        if (data.length) flags |= 0x8; // ISO14A_RAW
        if (topaz) flags |= 0x100; // ISO14A_TOPAZMODE
        if (!rats) flags |= 0x200; // ISO14A_NO_RATS
        if (ecp) flags |= 0x800; // ISO14A_USE_ECP
        if (magsafe) flags |= 0x1000; // ISO14A_USE_MAGSAFE
        pm3.clearRespBuf();
        await pm3.sendCommandOLD({ cmd: PM3_CMD.HF_ISO14443A_READER, arg: [flags, data.length | (numbits << 16), timeout], data });
        if (!reply) return
        if (active === 1) { // 1: active with select
          const selRes = await pm3.readRespTimeout(PM3_CMD.ACK, timeout + 2500);
          selRes.uidlen = Number(selRes.getArg(1)) & 0xFFFF;
          if (!selRes.uidlen) throw new Error('Failed to select card')
        }
        if (!data.length) return
        const resp = await pm3.readRespTimeout(PM3_CMD.ACK, timeout + 2500);
        resp.datalen = Number(resp.getArg(0)) & 0xFFFF;
        if (!resp.datalen) throw new Error('Failed to receive data')
        const dataWithoutCrc = resp.data.subarray(0, -2);
        if (resp.datalen >= 3 && crc16A(dataWithoutCrc).isEqual(resp.data.subarray(-2))) {
          resp.dataWithoutCrc = dataWithoutCrc;
        }
        return resp
      };

      const mfKeysCheck = async ({ keys, sectorMax = 16 } = {}) => {
        const argIterator = {
          * [Symbol.iterator] () {
            if (!keys) {
              yield { arg: [0x1100 | sectorMax, 0x101, 0] };
              return
            }
            keys = mfKeysUniq(keys);
            if (!keys.length) throw new TypeError('invalid keys')
            const keyChunks = Packet.merge(...keys).chunk(510);
            for (const strategy of [1, 2]) {
              for (let i = 0; i < keyChunks.length; i++) { // 512 - 512 % 6 = 510
                const data = keyChunks[i];
                yield {
                  data,
                  arg: [
                    // (isLast << 12) | (isFirst << 8) | sectorMax
                    ((i + 1 === keyChunks.length) << 12) | ((i === 0) << 8) | sectorMax,
                    strategy, // strategys: 1= deep first on sector 0 AB,  2= width first on all sectors
                    data.length / 6, // size
                  ],
                };
              }
            }
          },
        };

        let resp;
        for (const arg of argIterator) {
          pm3.clearRespBuf();
          await pm3.sendCommandOLD({ cmd: PM3_CMD.HF_MIFARE_CHKKEYS_FAST, ...arg });
          resp = await pm3.readRespTimeout(PM3_CMD.ACK, 36e4); // 360s
          if (Number(resp.getArg(0)) === sectorMax * 2) break // all key found
        }
        const found = {
          flags: new Packet(___default["default"].map([7, 6, 5, 4, 3, 2, 1, 0, 8, 9], idx => resp.data[480 + idx])),
          keys: [],
        };
        for (let i = 0; i < sectorMax; i++) {
          for (const j of [2 * i, 2 * i + 1]) {
            const isFound = (found.flags[j >> 3] >> (j & 7)) & 1;
            found.keys[j] = isFound ? resp.data.subarray(j * 6, j * 6 + 6) : null;
          }
        }
        return found.keys
      };

      return {
        cardInfo,
        deselectCard,
        dropField,
        mfAuthBlock,
        mfEmlReadBlock,
        mfEmlReadCard,
        mfEmlReadSector,
        mfEmlWriteBlock,
        mfEmlWriteCard,
        mfEmlWriteSector,
        mfKeysCheck,
        mfKeysUniq,
        mfReadBlock,
        mfReadBlockGen1a,
        mfReadBlockKeyBA,
        mfReadCardByKeys,
        mfReadCardGen1a,
        mfReadSector,
        mfReadSectorGen1a,
        mfReadSectorKeyBA,
        mfSimulateCard,
        mfWriteBlock,
        mfWriteBlockGen1a,
        mfWriteBlockKeyBA,
        mfWriteCardByKeys,
        mfWriteCardGen1a,
        mfWriteSector,
        mfWriteSectorGen1a,
        mfWriteSectorKeyBA,
        selectCard,
        sendRaw,
      }
    }
  }

  return Pm3Hf14a;

}));
