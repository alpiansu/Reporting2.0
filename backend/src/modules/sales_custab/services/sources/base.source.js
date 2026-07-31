export default class BaseDataSource {
  async fetchData(config) {
    throw new Error('fetchData() must be implemented');
  }

  validateConfig(config) {
    return { valid: true, errors: [] };
  }

  getSourceName() {
    throw new Error('getSourceName() must be implemented');
  }
}
