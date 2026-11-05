/* Small OPFS-shaped disk fixture for extension integration tests. */
const fs = require('node:fs');
const path = require('node:path');
function directory(location) {
  return {
    async getDirectoryHandle(name, { create = false } = {}) {
      const target = path.join(location, name); if (create) fs.mkdirSync(target, { recursive: true });
      if (!fs.existsSync(target)) throw new Error('Directory missing'); return directory(target);
    },
    async *entries() { for (const name of fs.readdirSync(location)) yield [name, {}]; },
    async removeEntry(name) { fs.rmSync(path.join(location, name), { recursive: true, force: true }); },
    async getFileHandle(name, { create = false } = {}) {
      const file = path.join(location, name);
      if (create && !fs.existsSync(file)) fs.writeFileSync(file, '');
      if (!fs.existsSync(file)) throw new Error('File missing');
      return {
        async getFile() { return new Blob([fs.readFileSync(file)]); },
        async createWritable() {
          const temporary = file + '.pending', stream = await fs.promises.open(temporary, 'w'); let done = false;
          return { async write(data) { await stream.write(data); },
            async close() { if (done) return; done = true; await stream.close(); fs.renameSync(temporary, file); },
            async abort() { if (done) return; done = true; await stream.close(); fs.rmSync(temporary, { force: true }); } };
        }
      };
    }
  };
}
module.exports = { directory };
