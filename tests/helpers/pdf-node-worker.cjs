/* Node transport for the real packaged Web Worker; no PDF engine is mocked. */
const { parentPort } = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.resolve(__dirname, '../../extension/export');
const context = { TextEncoder, TextDecoder, URL, Blob, atob, btoa, setTimeout, clearTimeout, queueMicrotask, console,
  Uint8Array, ArrayBuffer, DataView, Promise, navigator: { userAgent: 'Node PDF fixture' } };
context.self = context; context.globalThis = context;
context.postMessage = (message, transfer) => parentPort.postMessage(message, transfer);
context.importScripts = (...names) => { for (const name of names) vm.runInContext(fs.readFileSync(path.resolve(base, name), 'utf8'), ctx); };
const ctx = vm.createContext(context);
context.importScripts('pdf-worker.js');
parentPort.on('message', data => context.onmessage({ data }));
