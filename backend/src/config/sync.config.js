/**
 * Configuration for data synchronization schedules
 */

module.exports = {
  // Schedule for automatic synchronization (in 24-hour format)
  schedules: [
    {
      hour: 12,
      minute: 0,
      description: 'Noon synchronization'
    },
    {
      hour: 3,
      minute: 0,
      description: 'Early morning synchronization'
    }
  ],
  
  // External database configuration
  externalDb: {
    host: '192.168.133.3',
    user: 'edp',
    password: 'cUm4l!h4t@datA',
    database: 'db_edp',
    table: 'rekap_ip',
    fields: {
      storeCode: 'kdtk',      // Will be mapped to storeCode in our system
      station: 'station',     // Will be mapped to station in our system
      ipAddress: 'ipaddress', // Will be mapped to dbHost in our system
      type: 'jenis'           // Will be mapped to notes in our system
    }
  },
  
  // Local storage configuration
  localStore: {
    filePath: 'data/stores.json' // Relative to project root
  }
};