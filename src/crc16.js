import _ from 'lodash'
import Packet from './Packet'

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
}
const cached = {}

export const reflect8 = u8 => {
  if (!cached.reflect8) {
    const tbl = cached.reflect8 = new Packet(256)
    for (let i = 0; i < 256; i++) {
      let b = i
      b = (b & 0xF0) >> 4 | (b & 0x0F) << 4
      b = (b & 0xCC) >> 2 | (b & 0x33) << 2
      b = (b & 0xAA) >> 1 | (b & 0x55) << 1
      tbl[i] = b
    }
  }
  return cached.reflect8[u8 & 0xFF]
}

export const reflect16 = u16 => reflect8(u16 >> 8) | (reflect8(u16) << 8)

const crc2packet = u16 => new Packet([u16 & 0xFF, (u16 >> 8) & 0xFF])

const getPoly = (poly, refin) => {
  const key = `${poly}${refin ? 1 : 0}`
  if (!_.hasIn(cached, `poly.${key}`)) {
    const tbl = new Uint16Array(256)
    for (let i = 0; i < 256; i++) {
      let c = (refin ? reflect8(i) : i) << 8
      let crc = 0
      for (let j = 0; j < 8; j++) {
        crc = (((crc ^ c) & 0x8000) ? CRC16_POLY[poly] : 0) ^ (crc << 1)
        c = (c << 1) & 0xFFFF
      }
      tbl[i] = refin ? reflect16(crc) : crc
    }
    _.set(cached, `poly.${key}`, tbl)
  }
  return cached.poly[key]
}

const crc16Fast = (data, poly, crc, refin, refout) => {
  if (!Packet.isLen(data)) throw new TypeError('invalid data')
  if (!data.length) return ~crc
  const table = getPoly(poly, refin)
  if (refin) {
    crc = reflect16(crc)
    for (const d of data) crc = (crc >> 8) ^ table[(crc & 0xFF) ^ d]
    return refout ? crc : reflect16(crc)
  } else {
    crc &= 0xFFFF
    for (const d of data) crc = ((crc & 0xFF) << 8) ^ table[(crc >> 8) ^ d]
    return refout ? reflect16(crc) : crc
  }
}

// http://www.sunshine2k.de/coding/javascript/crc/crc_js.html
// https://crccalc.com/
export const crc16A = data => crc2packet(crc16Fast(data, 'CCITT', 0xC6C6, true, true)) // 14443a
export const crc16Arc = data => crc2packet(crc16Fast(data, 'ARC', 0x0000, true, true)) // arc
export const crc16AugCcitt = data => crc2packet(crc16Fast(data, 'CCITT', 0x1D0F, false, false)) // arg ccitt
export const crc16Buypass = data => crc2packet(crc16Fast(data, 'ARC', 0x0000, false, false)) // buypass
export const crc16CcittFalse = data => crc2packet(crc16Fast(data, 'CCITT', 0xFFFF, false, false)) // ccitt false
export const crc16CcittZero = data => crc2packet(crc16Fast(data, 'CCITT', 0x0000, false, false)) // ccitt zero
export const crc16Cdma2000 = data => crc2packet(crc16Fast(data, 'CDMA2000', 0xFFFF, false, false)) // cdma2000
export const crc16Dds110 = data => crc2packet(crc16Fast(data, 'ARC', 0x800D, false, false)) // dds 110
export const crc16DectR = data => crc2packet(0x0001 ^ crc16Fast(data, 'DECT', 0x0000, false, false)) // dect r
export const crc16DectX = data => crc2packet(crc16Fast(data, 'DECT', 0x0000, false, false)) // dect x
export const crc16Dnp = data => crc2packet(0xFFFF ^ crc16Fast(data, 'DNP', 0x0000, false, false)) // dnp
export const crc16En13757 = data => crc2packet(0xFFFF ^ crc16Fast(data, 'DNP', 0x0000, true, true)) // en 13757
export const crc16Fdxb = data => crc2packet(crc16Fast(data, 'CCITT', 0x0000, false, true)) // 11784
export const crc16Genibus = data => crc2packet(0xFFFF ^ crc16Fast(data, 'CCITT', 0xFFFF, false, false)) // genibus
export const crc16Iclass = data => crc2packet(crc16Fast(data, 'CCITT', 0x4807, true, true)) // iclass
export const crc16Kermit = data => crc2packet(crc16Fast(data, 'CCITT', 0x0000, true, true)) // kermit
export const crc16Legic = (data, uidcrc) => crc2packet(crc16Fast(data, 'LEGIC', (uidcrc << 8) | uidcrc, true, false)) // legic
export const crc16Maxim = data => crc2packet(0xFFFF ^ crc16Fast(data, 'ARC', 0x0000, true, true)) // maxim
export const crc16Mcrf4xx = data => crc2packet(crc16Fast(data, 'CCITT', 0xFFFF, true, true)) // mcrf4xx
export const crc16Modbus = data => crc2packet(crc16Fast(data, 'ARC', 0xFFFF, true, true)) // modbus
export const crc16Riello = data => crc2packet(crc16Fast(data, 'CCITT', 0xB2AA, true, true)) // riello
export const crc16T10Dif = data => crc2packet(crc16Fast(data, 'T10_DIF', 0x0000, false, false)) // t10 dif
export const crc16Teledisk = data => crc2packet(crc16Fast(data, 'TELEDISK', 0x0000, false, false)) // teledisk
export const crc16Tms37157 = data => crc2packet(crc16Fast(data, 'CCITT', 0x89EC, true, true)) // tms37157
export const crc16Usb = data => crc2packet(0xFFFF ^ crc16Fast(data, 'ARC', 0xFFFF, true, true)) // usb
export const crc16X25 = data => crc2packet(0xFFFF ^ crc16Fast(data, 'CCITT', 0xFFFF, true, true)) // cryptorf, 14443b, 15693
export const crc16Xmodem = data => crc2packet(crc16Fast(data, 'CCITT', 0x0000, false, false)) // xmodem
