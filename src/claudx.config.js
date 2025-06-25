// claudx configuration file
// This file supports JavaScript expressions and environment variables

export default {
  destinations: [
    {
      type: 'sqlite',
      options: {
        // Optional custom database path
        // dbPath: process.env.CLAUDX_DB_PATH || undefined
      }
    }
    
    // Example DataDog destination (uncomment and configure):
    // {
    //   type: 'datadog',
    //   options: {
    //     apiKey: process.env.DATADOG_API_KEY,
    //     site: process.env.DATADOG_SITE || 'datadoghq.com',
    //     service: process.env.DATADOG_SERVICE || 'claudx',
    //     env: process.env.DATADOG_ENV || 'development',
    //     tags: {
    //       team: process.env.DATADOG_TEAM_NAME || 'engineering',
    //       // Add more custom tags as needed
    //     }
    //   }
    // }
  ]
};