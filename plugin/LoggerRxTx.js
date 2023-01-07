(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('lodash')) :
  typeof define === 'function' && define.amd ? define(['lodash'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Pm3LoggerRxTx = factory(global._));
})(this, (function (_) { 'use strict';

  function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

  var ___default = /*#__PURE__*/_interopDefaultLegacy(_);

  class Pm3LoggerRxTx {
    constructor () {
      this.name = 'loggerRxTx';
    }

    install (context, pluginOption) {
      const { pm3, utils } = context;
      const { short = true } = pluginOption;

      const inspectPm3Frame = pack => {
        if (!short) return pack.inspect
        if (pack.getUint32(0) === 0x61334D50 || pack.getUint32(0) === 0x62334D50) return pack.subarray(6, -2).inspect
        return pack.subarray(0, ___default["default"].findLastIndex(pack, u8 => u8) + 1).inspect
      };

      pm3.addMiddleware('writePacket', async (ctx, next) => {
        utils.logTime(`tx = ${inspectPm3Frame(ctx.pack)}`);
        return await next()
      });

      pm3.addMiddleware('readRespTimeout', async (ctx, next) => {
        const resp = await next();
        utils.logTime(`rx = ${inspectPm3Frame(resp.pack)}`);
        return resp
      });
    }
  }

  return Pm3LoggerRxTx;

}));
