import WrcDtSource from './wrc_dt.source.js';

export default class SourceRegistry {
  constructor() {
    this.sources = new Map();
    this.register('wrc_dt', new WrcDtSource());
  }

  register(name, source) {
    this.sources.set(name, source);
  }

  getSource(name) {
    const source = this.sources.get(name);
    if (!source) {
      throw new Error(`Data source "${name}" tidak ditemukan`);
    }
    return source;
  }

  listSources() {
    return Array.from(this.sources.keys());
  }
}
