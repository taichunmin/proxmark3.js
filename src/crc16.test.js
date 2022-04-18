import * as sut from './crc16.js'
import Packet from './Packet.js'

describe('crc16A', () => {
  test.each([
    ['0000', 'A01E'],
    ['1101035354909000431770033201003B', 'CCAB'],
    ['3A16070A00000000001A0000', '254E'],
    ['5000', '57CD'],
    ['7461696368756E6D696E', '5B9E'],
  ])('crc16A(0x%s) = 0x%s', async (input, expected) => {
    expect(sut.crc16A(Packet.fromHex(input)).hex).toEqual(expected)
  })
})
