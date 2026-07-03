export const ftpProfiles = {
  nielsen: {
    host: process.env.FTP_NIELSEN_HOST,
    port: parseInt(process.env.FTP_NIELSEN_PORT, 10),
    user: process.env.FTP_NIELSEN_USER,
    password: process.env.FTP_NIELSEN_PASSWORD,
    secure: false,
  },
};

export function getFtpProfile(profileName) {
  const profile = ftpProfiles[profileName];
  if (!profile || !profile.host) {
    throw new Error(`FTP profile "${profileName}" belum dikonfigurasi di .env`);
  }
  return profile;
}
