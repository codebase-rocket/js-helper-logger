// Info: Configuration file
'use strict';


// Export configration as key-value Map
module.exports = {

  // Encryption key for IP
  IP_ENCRYPT_KEY      : '', // Default key

  // Default Session Actor. More Actors can be added at the time of module initialization
  ACTOR :  {
    'support' : {
      DB_SOURCE           : 'ctp_action_log',
    }
  },

  // Error Codes
  ERR_DATABASE_WRITE_FAILED: {
    code: 'LOGGER_DATABASE_WRITE_FAILED',
    message: 'Faied to write into logger database'
  },

}
