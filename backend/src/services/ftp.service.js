import { Client } from 'basic-ftp';
import { getFtpProfile } from '../config/ftp.config.js';

class FtpService {
  constructor(profileName) {
    this.config = getFtpProfile(profileName);
  }

  async uploadFile(localPath, remoteDir, remoteFileName) {
    const client = new Client();
    try {
      await client.access(this.config);
      await client.ensureDir(remoteDir);
      await client.uploadFrom(localPath, remoteFileName);
    } finally {
      client.close();
    }
  }
}

export default FtpService;
