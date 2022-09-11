export default class Pm3LoggerRxTx {
  constructor () {
    this.name = 'loggerRxTx'
  }

  install (context, pluginOption) {
    const { pn532, utils } = context

    pn532.addMiddleware('writePacket', async (ctx, next) => {
      utils.logTime(`tx = ${ctx.pack.inspect}`)
      return await next()
    })

    pn532.addMiddleware('readRespTimeout', async (ctx, next) => {
      const resp = await next()
      utils.logTime(`rx = ${resp.pack.inspect}`)
      return resp
    })
  }
}
