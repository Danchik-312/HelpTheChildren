export class MediaStorage {
  async write(_visibility, _key, _buffer) { throw new Error('Not implemented'); }
  async read(_visibility, _key) { throw new Error('Not implemented'); }
  async remove(_visibility, _key) { throw new Error('Not implemented'); }
  async move(_from, _to, _key) { throw new Error('Not implemented'); }
}
