import Packet from './Packet.js'

test.each([
  ['000000', false, 0],
  ['FFFFFF', false, 16777215],
  ['7FFFFF', false, 8388607],
  ['800000', false, 8388608],
  ['000000', true, 0],
  ['FFFFFF', true, 16777215],
  ['FFFF7F', true, 8388607],
  ['000080', true, 8388608],
])('Packet.fromHex(%j).getUint24(0, %j) = %j', async (hex, little, expected) => {
  const actual = Packet.fromHex(hex).getUint24(0, little)
  expect(actual).toEqual(expected)
})

test.each([
  ['000000', false, 0],
  ['FFFFFF', false, -1],
  ['7FFFFF', false, 8388607],
  ['800000', false, -8388608],
  ['000000', true, 0],
  ['FFFFFF', true, -1],
  ['FFFF7F', true, 8388607],
  ['000080', true, -8388608],
])('Packet.fromHex(%j).getInt24(0, %j) = %j', async (hex, little, expected) => {
  const actual = Packet.fromHex(hex).getInt24(0, little)
  expect(actual).toEqual(expected)
})

test.each([
  [0, false, '000000'],
  [16777215, false, 'FFFFFF'],
  [8388607, false, '7FFFFF'],
  [8388608, false, '800000'],
  [0, true, '000000'],
  [16777215, true, 'FFFFFF'],
  [8388607, true, 'FFFF7F'],
  [8388608, true, '000080'],
])('new Packet(3).setUint24(0, %j, %j).hex = %j', async (num, little, expected) => {
  const actual = new Packet(3).setUint24(0, num, little).hex
  expect(actual).toEqual(expected)
})

test.each([
  [0, false, '000000'],
  [-1, false, 'FFFFFF'],
  [8388607, false, '7FFFFF'],
  [-8388608, false, '800000'],
  [0, true, '000000'],
  [-1, true, 'FFFFFF'],
  [8388607, true, 'FFFF7F'],
  [-8388608, true, '000080'],
])('new Packet(3).setInt24(0, %j, %j).hex = %j', async (num, little, expected) => {
  const actual = new Packet(3).setInt24(0, num, little).hex
  expect(actual).toEqual(expected)
})

test.each([
  ['1', 'MQ'],
  ['12', 'MTI'],
  ['123', 'MTIz'],
])('Packet.fromUtf8(%j).base64url = %j', async (hex, expected) => {
  const actual = Packet.fromUtf8(hex).base64url
  expect(actual).toEqual(expected)
})
