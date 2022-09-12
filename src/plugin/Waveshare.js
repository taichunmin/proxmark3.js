import _ from 'lodash'

const UIDS = ['FSTN10m', 'WSDZ10m']

const MODEL = {
  M2in13: { id: 4, type: 'M2in13', proto: 1, name: '2.13 inch NFCTag', len: 16, width: 122, height: 250 },
  M2in9: { id: 9, type: 'M2in9', proto: 1, name: '2.9  inch e-paper', len: 16, width: 296, height: 128 },
  M4in2: { id: 10, type: 'M4in2', proto: 1, name: '4.2  inch e-paper', len: 100, width: 400, height: 300 },
  M7in5: { id: 14, type: 'M7in5', proto: 1, name: '7.5  inch e-paper', len: 120, width: 800, height: 480 },
  M2in7: { id: 16, type: 'M2in7', proto: 2, name: '2.7  inch e-paper', len: 121, width: 176, height: 276 },
  M2in13B: { id: 11, type: 'M2in13B', proto: 2, name: '2.13 inch e-paper B (with red)', len: 106, width: 104, height: 212 },
  M1in54B: { id: 0, type: 'M1in54B', proto: 3, name: '1.54 inch e-paper B (with red)', len: 100, width: 200, height: 200 },
  M7in5HD: { id: 17, type: 'M7in5HD', proto: 1, name: '7.5  inch e-paper HD', len: 120, width: 880, height: 528 },
}

export default class Pm3Waveshare {
  // https://github.com/taichunmin/waveshare-epd-demo/blob/master/User/Browser/Browser.c
  // https://github.com/taichunmin/waveshare-epd-demo/blob/master/User/Browser/Browser.c#L650
  // https://github.com/RfidResearchGroup/proxmark3/blob/master/client/src/cmdhfwaveshare.c#L662

  constructor () {
    this.name = 'waveshare'
  }

  install (context, pluginOption) {
    const { CMD, Packet, pm3, utils: { logTime, retry, sleep } } = context

    const sendCmd = async ({ ack = null, cmd, data = new Packet() }) => {
      if (!Packet.isLen(data)) throw new TypeError('invalid data type')
      const pack = Packet.merge(new Packet([0xCD, cmd]), data)
      // ISO14A_CONNECT = 1
      // ISO14A_NO_DISCONNECT = 2
      // ISO14A_RAW = 8
      // ISO14A_APPEND_CRC = 0x20
      // ISO14A_NO_SELECT = 0x80
      // ISO14A_NO_RATS = 0x200
      // timeout 1s = 1356 / (8 * 16) * Math.min(timeout, 40542464) = 678000
      await pm3.sendCommandMix({ cmd: CMD.HF_ISO14443A_READER, arg: [0x2AB, pack.length], data: pack })
      const resp = await pm3.waitRespTimeout(CMD.ACK)
      const rx = resp.data.subarray(0, Number(resp.getArg(0)))
      if (_.isInteger(ack)) {
        if (rx.length < 2) throw new Error('invalid response length')
        if (rx.getUint16(0, false) !== ack) throw new Error('invalid response ack')
      }
    }

    const sendCmdWithRetry = async ({
      ack = null,
      cmd,
      data = new Packet(),
      retryDelay = 0,
      times = 10,
    }) => {
      await retry(async () => {
        try {
          await sendCmd({ ack, cmd, data })
        } catch (err) {
          await sleep(retryDelay)
          throw err
        }
      }, times)
    }

    return {
      MODEL,

      // await pm3.$waveshare.draw_1in54B({ black: new window.Proxmark3.Packet(5000).fill(0xFF), red: new window.Proxmark3.Packet(5000).fill(0xF0) })
      draw_1in54B: async ({ black, red }) => {
        try {
          // check black and red data
          if (!Packet.isLen(black, 5000)) throw new TypeError('invalid black')
          if (!Packet.isLen(red, 5000)) throw new TypeError('invalid red')

          // select NFCTag, anti-collision and keep field on
          await retry(async () => {
            try {
              const { card: selCard } = await pm3.$hf14a.selectCard()
              if (!_.includes(UIDS, selCard?.uid?.utf8)) throw new Error('invalid waveshare NFCTag')
            } catch (err) {
              await sleep(100)
              throw err
            }
          }, 10)

          logTime('step0: 0xCD0D')
          await sendCmdWithRetry({ cmd: 0x0D, ack: 0x0000 })
          await sleep(20)

          logTime('step1: 0xCD00')
          await sendCmdWithRetry({ cmd: 0x00, ack: 0x0000 })
          await sleep(20)

          logTime('step2: 0xCD01')
          await sendCmdWithRetry({ cmd: 0x01, ack: 0x0000 })
          await sleep(200)

          logTime('step3: 0xCD02')
          await sendCmdWithRetry({ cmd: 0x02, ack: 0x0000 })
          await sleep(100)

          logTime('step4: 0xCD03')
          await sendCmdWithRetry({ cmd: 0x03, ack: 0x0000 })
          await sleep(100)

          logTime('step5: 0xCD05 with black data')
          const packCmd05 = Packet.merge(new Packet([100]), new Packet(100))
          for (let i = 0; i < 50; i++) {
            packCmd05.set(black.subarray(i * 100, (i + 1) * 100), 1)
            await sendCmdWithRetry({ cmd: 0x05, data: packCmd05, ack: 0x0000 })
          }

          logTime('step6: 0xCD04')
          await sendCmdWithRetry({ cmd: 0x04, ack: 0x0000 })

          logTime('step7: 0xCD05 with red data')
          for (let i = 0; i < 50; i++) {
            packCmd05.set(red.subarray(i * 100, (i + 1) * 100), 1)
            await sendCmdWithRetry({ cmd: 0x05, data: packCmd05, ack: 0x0000 })
            await sleep(20)
          }

          logTime('step8: 0xCD06')
          await sendCmdWithRetry({ cmd: 0x06, ack: 0x0000 })
          await sleep(1000) // Black, white and red screen refresh time is longer, wait first

          logTime('step9: 0xCD08')
          await sendCmdWithRetry({ cmd: 0x08, ack: 0xFF00, retryDelay: 100, times: 100 })
          await sleep(20)

          logTime('step10: 0xCD04')
          await sendCmdWithRetry({ cmd: 0x04, ack: 0x0000 })
        } finally {
          // turn field off
          await pm3.$hf14a.dropField()
        }
      },

      // await pm3.$waveshare.drawV1({ model: 'M4in2', black: new window.Proxmark3.Packet(15000).fill(0xF0) })
      // https://developer.mozilla.org/en-US/docs/Web/API/createImageBitmap
      async drawV1 ({ model, black }) {
        try {
          model = MODEL[model]
          if (model?.proto !== 1) throw new TypeError('invalid model')
          if (!Packet.isLen(black, model.width * model.height / 8)) throw new TypeError('invalid black type')

          // select NFCTag, anti-collision and keep field on
          await retry(async () => {
            try {
              const { card: selCard } = await pm3.$hf14a.selectCard()
              if (!_.includes(UIDS, selCard?.uid?.utf8)) throw new Error('invalid waveshare NFCTag')
            } catch (err) {
              await sleep(100)
              throw err
            }
          }, 10)

          logTime('step0: 0xCD0D')
          await sendCmdWithRetry({ cmd: 0x0D, ack: 0x0000 })

          logTime('step1: 0xCD00')
          await sendCmdWithRetry({ cmd: 0x00, data: new Packet([model.id]), ack: 0x0000 })
          await sleep(100)

          logTime('step2: 0xCD01')
          await sendCmdWithRetry({ cmd: 0x01, ack: 0x0000 })
          await sleep(10)

          logTime('step3: 0xCD02')
          await sendCmdWithRetry({ cmd: 0x02, ack: 0x0000 })
          await sleep(10)

          logTime('step4: 0xCD03')
          await sendCmdWithRetry({ cmd: 0x03, ack: 0x0000 })
          await sleep(10)

          logTime('step5: 0xCD05')
          await sendCmdWithRetry({ cmd: 0x05, ack: 0x0000 })
          await sleep(10)

          logTime('step6: 0xCD06')
          await sendCmdWithRetry({ cmd: 0x06, ack: 0x0000 })
          await sleep(10)

          logTime('step7: 0xCD07')
          await sendCmdWithRetry({ cmd: 0x07, ack: 0x0000 })

          logTime('step8: 0xCD08 with black data')
          const packCmd08 = Packet.merge(new Packet([model.len]), new Packet(model.len))
          for (const chunk of black.chunk(model.len)) {
            packCmd08.set(chunk, 1)
            await sendCmdWithRetry({ cmd: 0x08, data: packCmd08, ack: 0x0000 })
          }

          // logTime('step9: 0xCD18')
          // await sendCmdWithRetry({ cmd: 0x18, ack: 0x0000 })

          logTime('step10: 0xCD09')
          await sendCmdWithRetry({ cmd: 0x09, ack: 0x0000 })
          await sleep(200 + (model.type === 'M7in5HD' ? 1000 : 0))

          logTime('step11: 0xCD0A')
          await sendCmdWithRetry({ cmd: 0x0A, ack: 0xFF00, retryDelay: 25, times: 100 })
          await sleep(10)

          logTime('step10: 0xCD04')
          await sendCmdWithRetry({ cmd: 0x04, ack: 0x0000 })
        } finally {
          // turn field off
          await pm3.$hf14a.dropField()
        }
      },
    }
  }
}
