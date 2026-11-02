/* Binary ZIP primitives shared by post exports and the disk-backed archive writer. */
(() => {
  function dosTimestamp(value = new Date()) {
    const year = Math.min(2107, Math.max(1980, value.getFullYear()));
    return { time: (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2),
      date: ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate() };
  }
  function zipHeader(compressedSize, uncompressedSize, crc, nameLength, offset, timestamp, method, central = false) {
    const bytes = new Uint8Array(central ? 46 : 30);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, central ? 0x02014b50 : 0x04034b50, true);
    if (central) {
      view.setUint16(4, 20, true); view.setUint16(6, 20, true); view.setUint16(8, 0x800, true);
      view.setUint16(10, method, true);
      view.setUint16(12, timestamp.time, true); view.setUint16(14, timestamp.date, true);
      view.setUint32(16, crc, true); view.setUint32(20, compressedSize, true); view.setUint32(24, uncompressedSize, true);
      view.setUint16(28, nameLength, true); view.setUint32(42, offset, true);
    } else {
      view.setUint16(4, 20, true); view.setUint16(6, 0x800, true); view.setUint16(8, method, true);
      view.setUint16(10, timestamp.time, true); view.setUint16(12, timestamp.date, true);
      view.setUint32(14, crc, true); view.setUint32(18, compressedSize, true); view.setUint32(22, uncompressedSize, true);
      view.setUint16(26, nameLength, true);
    }
    return bytes;
  }
  function updateCrc32(crc, bytes) {
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return crc;
  }
  globalThis.PatreonZip = Object.freeze({ dosTimestamp, zipHeader, updateCrc32 });
})();
