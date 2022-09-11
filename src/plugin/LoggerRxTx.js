import _ from 'lodash'

export default class Pm3LoggerRxTx {
  constructor () {
    this.name = 'loggerRxTx'
  }

  install (context, pluginOption) {
    const { pm3, utils } = context
    const { short = true } = pluginOption

    const inspectPm3Frame = pack => {
      if (!short) return pack.inspect
      if (pack.getUint32(0) === 0x61334D50 || pack.getUint32(0) === 0x62334D50) return pack.subarray(6, -2).inspect
      return pack.subarray(0, _.findLastIndex(pack, u8 => u8) + 1).inspect
    }

    pm3.addMiddleware('writePacket', async (ctx, next) => {
      utils.logTime(`tx = ${inspectPm3Frame(ctx.pack)}`)
      return await next()
    })

    pm3.addMiddleware('readRespTimeout', async (ctx, next) => {
      const resp = await next()
      utils.logTime(`rx = ${inspectPm3Frame(resp.pack)}`)
      return resp
    })
  }
}
