// claudx configuration file
// This file supports JavaScript expressions and environment variables

module.exports = {
  datastores: [
    {
      type: 'sqlite',
      options: {
        // Optional custom database path
        // dbPath: process.env.CLAUDX_DB_PATH || undefined
      }
    },

    // Datadog dataStore
    {
      type: 'datadog',
      options: {
        apiKey: process.env.DATADOG_API_KEY,
        site: 'datadoghq.com',
        service: 'claudx',
        env: 'development',
        tags: {
          team: 'claudx-developers',
          // Add more custom tags as needed
        }
      }
    }
  ]
};