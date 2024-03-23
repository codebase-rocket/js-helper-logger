// Info: Logger library. Logs activity in DynamoDB Database
'use strict';

/****************** Notes *********************
* TODO: Get Log entries for each entity sorted by date along with pagination
* TODO: Decide which actors can see IP

* Next Note
***********************************************/

// Shared Dependencies (Managed by Loader)
var Lib = {};

// Exclusive Dependencies
var CONFIG = require('./config'); // Loader can override it with Custom-Config


/////////////////////////// Module-Loader START ////////////////////////////////

  /********************************************************************
  Load dependencies and configurations

  @param {Set} shared_libs - Reference to libraries already loaded in memory by other modules
  @param {Set} config - Custom configuration in key-value pairs

  @return nothing
  *********************************************************************/
  const loader = function(shared_libs, config){

    // Shared Dependencies (Must be loaded in memory already)
    Lib.Utils = shared_libs.Utils;
    Lib.Debug = shared_libs.Debug;
    Lib.Crypto = shared_libs.Crypto;
    Lib.Instance = shared_libs.Instance;
    Lib.HttpHandler = shared_libs.HttpHandler;
    Lib.DynamoDB = shared_libs.DynamoDB;

    // Override default configuration
    if( !Lib.Utils.isNullOrUndefined(config) ){
      Object.assign(CONFIG, config); // Merge custom configuration with defaults
    }

  };

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function(shared_libs, config){

  // Run Loader
  loader(shared_libs, config);

  // Return Public Funtions of this module
  return Logger;

};//////////////////////////// Module Exports END //////////////////////////////



///////////////////////////Public Functions START//////////////////////////////
const Logger = { // Public functions accessible by other modules

  /********************************************************************
  Logs an activity.
  Though it's async function, but it runs in background.

  @param {reference} instance - Request Instance object reference
  @param {String} system_code - [ENUM] known system code ( '0':system | 'posist':Posist )
  @param {String} entity_type - Type of affected 'entity'
  @param {String} entity_id - ID of affected 'entity'
  @param {String} actor_type - Type of actor who made changed to the 'entity' (user|admin|customer|...)
  @param {String} actor_id - ID of the actor
  @param {String} action - Action (register-using-phone | ...)
  @param {String[]} description - Description

  @return Nothing
  *********************************************************************/
  logAction: function(instance, system_code, entity_type, entity_id, actor_type, actor_id, action, description){

    // Generate log-data
    const log_data = _Logger.createLogData(
      system_code,
      entity_type,
      entity_id,
      actor_type,
      actor_id,
      action,
      (
        !Lib.Utils.isEmpty(instance['http_request']) ?
        _Logger.encryptIp( Lib.HttpHandler.getHttpRequestIPAddress(instance) ) : // Get IP address from HTTP Request
        null
      ),
      (
        !Lib.Utils.isEmpty(instance['http_request']) ?
        Lib.HttpHandler.getHttpRequestUserAgent(instance) : // Get User-Agent from HTTP Request
        null
      ),
      _Logger.constructTimeRandom( // In milli Seconds. Add 3 random characters everytime logging takes place so to avoid overlapping of events
        instance['time_ms'],
        Lib.Crypto.generateRandomString(
          `abcdefghijklmnopqrstuvwxyz`,
          3
        )
      ),
      description
    );


    // Create a background process in 'instance'
    const background_function_cleanup = Lib.Instance.backgroundRoutine(instance);

    // Add Log Entry to Logger Database
    _Logger.setLogDataInDynamoDb(
      instance,
      function(err){

        // Since it's a background process, do nothing in case of error. Do nothing with response.

        // Background function finished
        background_function_cleanup(instance);

      },
      log_data
    );

  },


  /********************************************************************
  Get All Logs Data From Database for an Entity

  @param {reference} instance - Request Instance object reference
  @param {Function} cb - Callback function to be invoked once async execution of this function is finished

  @param {String} [start] - (Optional) Starting Record Reference
  @param {Integer} [limit] - (Optional) Number of records to be fetched in this page

  @param {String} actor_type - Actor-Type
  @param {String} entity_type - Entity-Type
  @param {String} entity_id - Entity-Id
  @param {Number} start_date - Start date in unix

  @return - Thru Callback

  @callback(err, logs_data_list, next) - Request Callback.
  * @callback {Error} err - Database Error
  * @callback {Set[]} logs_data_list - Logs Data List
  * @callback {Boolean} logs_data_list - false. No Logs found in database
  * @callback {String} next - Reference for Next page
  *********************************************************************/
  getActionsByEntity: function(instance, cb, start, limit, actor_type, entity_type, entity_id, start_date){

    // Fetch All Logs from DynamoDB
    _Logger.getLogsDataFromDbByEntity(
      instance,
      cb, // return as-it-is
      start,
      limit,
      actor_type,
      entity_type,
      entity_id,
      start_date
    );

  },


  /********************************************************************
  Get All Logs Data From Database for an Actor

  @param {reference} instance - Request Instance object reference
  @param {Function} cb - Callback function to be invoked once async execution of this function is finished

  @param {String} [start] - (Optional) Starting Record Reference
  @param {Integer} [limit] - (Optional) Number of records to be fetched in this page

  @param {String} system_code - [ENUM] known system code ( '0':system | 'posist':Posist )
  @param {String} actor_type - Actor-Type
  @param {String} actor_id - Actor-Id

  @return - Thru Callback

  @callback(err, logs_data_list, next) - Request Callback.
  * @callback {Error} err - Database Error
  * @callback {Set[]} logs_data_list - Logs Data List
  * @callback {Boolean} logs_data_list - false. No Logs found in database
  * @callback {String} next - Reference for Next page
  *********************************************************************/
  getActionsByActor: function(instance, cb, start, limit, system_code, actor_type, actor_id){

    // Fetch All Logs from DynamoDB
    _Logger.getLogsDataFromDbByActor(
      instance,
      cb, // return as-it-is
      start,
      limit,
      system_code,
      actor_type,
      actor_id
    );

  },


  /********************************************************************
  Construct Start Key for Secondary Index (Actor Index)

  @param {String} partition_key - Partition-Key
  @param {String} time - Time

  @return {String} start_key - Start Key (partition_key + '|' + time)
  *********************************************************************/
  constructStartKeyForActorIndex: function(partition_key, time){

    return (partition_key + '|' + time)

  },


  /********************************************************************
  Deconstruct Start Key for Secondary Index (Actor Index)

  @param {String} start_key - Start Key (partition_key + '|' + time)

  @return [partition_key, time] - Return Partition-Key, Time
  *********************************************************************/
  deconstructStartKeyForActorIndex: function(start_key){

    // Initialise
    var [ partition_key, time ] = start_key.split('|');

    // Return
    return [ partition_key, time ];

  },


  /********************************************************************
  Check if valid Time Random String

  @param {String} time_random - Time in milliseconds + random characters

  @return {Boolean} - true on success
  @return {Boolean} - false if validation fails
  *********************************************************************/
  validateTimeRandom: function(time_random){

    // Initialise
    var [time, initiation_time, random_char] = _Logger.deconstructTimeRandom(time_random);

    // Check if Param in within Minimum and Maximum Integer Value
    return (
      Lib.Utils.isInteger(time) && // must be an integer
      Lib.Utils.validateString( // check that it must be in specified range
        random_char, // value to be checked
        3, // fixed length 3 chars
        3 // fixed length 3 chars
      )
    );

  },

};///////////////////////////Public Functions END//////////////////////////////



//////////////////////////Private Functions START//////////////////////////////
const _Logger = { // Private functions accessible within this modules only

  /********************************************************************
  Add Item in logger-database

  @param {reference} instance - Request Instance object reference
  @param {Function} cb - Callback function to be invoked once async execution of this function is finished

  @param {String} log_id - Log ID
  @param {Map} log_data - Log data

  @return Thru request Callback.

  @callback - Request Callback. No Response, only error
  * @callback {Error} err - Unable to reach logger database
  *********************************************************************/
  setLogDataInDynamoDb: function(instance, cb, log_data){

    // Create Logger Record Object that is to be saved in Database
    const db_record = _Logger.createNdbDataFromLogData(log_data);


    // Get data from dynamodb
    Lib.DynamoDB.addRecord(
      instance,
      function(err, is_success){ // Callback function

        if(err){ // Logger Database Error
          return cb(err); // Invoke callback with error
        }

        if(!is_success){ // Logger Database Error
          return cb( Lib.Utils.error(CONFIG.ERR_DATABASE_WRITE_FAILED) ); // Invoke callback with error
        }

        // Invoke callback without any error
        cb(null);

      },
      CONFIG.ACTOR[log_data['actor_type']].DB_SOURCE, // Table Name
      db_record // Record to be saved in database
    );

  },


  /********************************************************************
  Get Logs from database by Entity

  @param {reference} instance - Request Instance object reference
  @param {Function} cb - Callback function to be invoked once async execution of this function is finished

  @param {String} [start] - (Optional) Starting Record Reference
  @param {Integer} [limit] - (Optional) Number of records to be fetched in this page

  @param {String} actor_type - Actor-Type
  @param {String} entity_type - Entity-Type
  @param {String} entity_id - Entity-Id

  @return Thru request Callback.

  @callback(err, logs_data_list, next) - Request Callback.
  * @callback {Error} err - Database Error
  * @callback {Set[]} logs_data_list - Logs Data List
  * @callback {Boolean} logs_data_list - false. No Logs found in database
  * @callback {String} next - Reference for Next page
  *********************************************************************/
  getLogsDataFromDbByEntity: function(
    instance, cb,
    start, limit,
    actor_type,
    entity_type, entity_id,
    start_date
  ){

    // construct page key
    var page_key = null;
    if( !Lib.Utils.isNullOrUndefined(start) ){ // only if start is specified
      page_key = {
        'id' : _Logger.constructPartitionKey( entity_type, entity_id ),
        't': start
      };
    }

    // Declaration
    var condition;
    // Check if start date exist
    if( !Lib.Utils.isNullOrUndefined(start_date) ){
      condition = {
        'key': 't',
        'value': start_date,
        'operator': 'begins_with'
      }
    }

    // Get data from dynamodb
    Lib.DynamoDB.queryRecords(
      instance,
      function(err, response, count, last_evaluated_key){ // Callback function

        // Database Error
        if(err){
          return cb(err); // Return error and exit
        }

        // If data not found
        if( !response ){
          return cb( null, false ); // Return with negative response
        }

        // Reach here means all good

        // next key for pagination
        var next = last_evaluated_key ? last_evaluated_key['t'] : null;

         // Return Campaign Data
        return cb(
          null,
          response.map(function(record){ // Entities List
            return _Logger.createLogDataFromNdbData(record) // Translate Database Response
          }),
          next // reference key for next Page
        );

      },
      CONFIG.ACTOR[actor_type].DB_SOURCE, // Table Name
      null, // No Secondary Index
      'id', // Partition Key
      _Logger.constructPartitionKey( entity_type, entity_id ), // Db Partition ID
      null, // get all fields
      { // Pagination
        'start': page_key,
        'limit': limit
      },
      condition
    );

  },


  /********************************************************************
  Get Logs from database by Entity

  @param {reference} instance - Request Instance object reference
  @param {Function} cb - Callback function to be invoked once async execution of this function is finished

  @param {String} [start] - (Optional) Starting Record Reference
  @param {Integer} [limit] - (Optional) Number of records to be fetched in this page

  @param {String} system_code - [ENUM] known system code ( '0':system | 'posist':Posist )
  @param {String} actor_type - Entity-Type
  @param {String} actor_id - Entity-Id

  @return Thru request Callback.

  @callback(err, logs_data_list, next) - Request Callback.
  * @callback {Error} err - Database Error
  * @callback {Set[]} logs_data_list - Logs Data List
  * @callback {Boolean} logs_data_list - false. No Logs found in database
  * @callback {String} next - Reference for Next page
  *********************************************************************/
  getLogsDataFromDbByActor: function(
    instance, cb,
    start, limit,
    system_code, actor_type, actor_id
  ){

    // construct page key
    var page_key = null;
    if( !Lib.Utils.isNullOrUndefined(start) ){ // only if start is specified

      // Deconstruct Start-Key
      var [partition_key, time_of_creation] = Logger.deconstructStartKeyForActorIndex(start);

      // Construct Page-Key
      page_key = {
        'id' : partition_key,
        'aid' : _Logger.constructSecondaryKeyForActorIndex(system_code, actor_type, actor_id),
        't' : time_of_creation
      };

    }


    // Get data from dynamodb
    Lib.DynamoDB.queryRecords(
      instance,
      function(err, response, count, last_evaluated_key){ // Callback function

        // Database Error
        if(err){
          return cb(err); // Return error and exit
        }

        // If data not found
        if( !response ){
          return cb( null, false ); // Return with negative response
        }


        // Reach here means all good

        // next key for pagination
        var next = (
          last_evaluated_key ? // if last evaluated key found
          Logger.constructStartKeyForActorIndex( // construct next key for pagination
            last_evaluated_key['id'], last_evaluated_key['t']
          ) :
          null // no next key if this is last page
        );

        // Translate Database Object
        var logs_data = response.map(function(record){ // Entities List
          return _Logger.createLogDataFromNdbData(record) // Translate Database Response
        })


        // Return through callback
        cb(
          null,
          logs_data,
          next
        )

      },
      CONFIG.ACTOR[actor_type].DB_SOURCE, // Table Name
      'actor-index', // Secondary Index
      'aid', // Partition Key
      _Logger.constructSecondaryKeyForActorIndex(actor_type, actor_id), // Partition ID
      null, // get all fields
      { // Pagination
        'start': page_key,
        'limit': limit
      }
    );

  },




  /********************************************************************
  Return a Log-Data object

  @param {String} system_code - [ENUM] known system code ( '0':system | 'posist':Posist )
  @param {String} entity_type - Type of affected 'entity'
  @param {String} entity_id - ID of affected 'entity'
  @param {String} actor_type - Type of actor who made changed to the 'entity' (user|admin|customer|...)
  @param {String} actor_id - ID of the actor
  @param {String} action - Action (register-using-phone | ...)
  @param {String} ip - Event Originating ip4, ip6, ip6 (with tunneling) (Encrypted)
  @param {String} user_agent - Event Originating UserAgent
  @param {Integer} time - Event's Time of happening. Unix Timestamp
  @param {String[]} description - Description of action

  @return {Map} - Log Data Object in key-value
  *********************************************************************/
  createLogData: function(
    system_code,
    entity_type, entity_id,
    actor_type, actor_id, action,
    ip, user_agent, time, description,
    initiation_time
  ){

    return {
      'system_code'   : system_code,
      'entity_type'   : entity_type,
      'entity_id'     : entity_id,
      'actor_type'    : actor_type,
      'actor_id'      : actor_id,
      'action'        : action,
      'description'   : description,
      'ip'            : ip,
      'user_agent'    : user_agent,
      'time'          : time,
      'initiation_time': initiation_time
    };

  },




  /********************************************************************
  Create Record Data from Log-Data

  @param {Set} log_data - Log-Data

  @return - db_record
  *********************************************************************/
  createNdbDataFromLogData: function(log_data){

    // Create Record-Data
    var db_record = {
      'id': _Logger.constructPartitionKey(log_data['entity_type'], log_data['entity_id']),
      'aid': _Logger.constructSecondaryKeyForActorIndex(log_data['system_code'], log_data['actor_type'], log_data['actor_id']),
      'a': Lib.Utils.fallback( log_data['action'] ),
      'desc': Lib.Utils.fallback( log_data['description'] ),
      'ip': Lib.Utils.fallback( log_data['ip'] ),
      'ua': Lib.Utils.fallback( log_data['user_agent'] ),
      't': Lib.Utils.fallback( log_data['time'] ),
    }


    // Return
    return db_record;

  },


  /********************************************************************
  Create Log-Data from Database Record Data

  @param {Set} data - Database Record Data

  @return - Log-Data
  *********************************************************************/
  createLogDataFromNdbData: function(data){

    // De-Construct Partition-Key
    var [entity_type, entity_id] = _Logger.deconstructPartitionKey(data['id']);

    // De-construct Secondary-Key
    var [system_code, actor_type, actor_id] = _Logger.deconstructSecondaryKeyForActorIndex(data['aid']);

    // Fix Time
    var [time, initiation_time, random_char] = _Logger.deconstructTimeRandom(data['t']);


    // Create Log Data
    var log_data = _Logger.createLogData(
      system_code,
      entity_type,
      entity_id,
      actor_type,
      actor_id,
      data['a'],
      data['ip'],
      data['ua'],
      time,
      data['desc'],
      initiation_time
    );


    // Return
    return log_data;

  },




  /********************************************************************
  Construct Partition Key

  @param {String} entity_type - Entity-Type
  @param {String} entity_id - Entity-Id

  @return {String} partition_key - Partition Key (entity_type + '-' + entity_id)
  *********************************************************************/
  constructPartitionKey: function(entity_type, entity_id){

    return (entity_type + '-' + entity_id)

  },


  /********************************************************************
  Deconstruct Partition Key

  @param {String} partition_key - Partition Key (entity_type + '-' + entity_id)

  @return [entity_type, entity_id] - Return Entity-Type, Entity-ID
  *********************************************************************/
  deconstructPartitionKey: function(partition_key){

    // Initialise
    var [ entity_type, entity_id ] = partition_key.split('-');

    // Return
    return [ entity_type, entity_id ];

  },


  /********************************************************************
  Construct Partition Key for Secondary Index (Actor Index)

  @param {String} system_code - [ENUM] known system code ( '0':system | 'posist':Posist )
  @param {String} actor_type - Actor-Type
  @param {String} actor_id - Actor-ID

  @return {String} partition_key - Partition Key (system_code + '-' + actor_type + '-' + actor_id)
  *********************************************************************/
  constructSecondaryKeyForActorIndex: function(system_code, actor_type, actor_id){

    return (system_code + '-' + actor_type + '-' + actor_id)

  },


  /********************************************************************
  Deconstruct Partition Key for Secondary Index (Actor Index)

  @param {String} partition_key - Partition Key (system_code + '-' + actor_type + '-' + actor_id)

  @return [system_code, actor_type, actor_id] - Return System-Code, Actor-Type, Actor-ID
  *********************************************************************/
  deconstructSecondaryKeyForActorIndex: function(partition_key){

    // Initialise
    var [ system_code, actor_type, actor_id ] = partition_key.split('-');

    // Return
    return [ system_code, actor_type, actor_id ];

  },


  /********************************************************************
  Construct Time Random

  @param {String} time_ms - Unixtime in milliseconds
  @param {String} random_char - Random characters

  @return {String} time_random - Time Random (time_ms + '-' + random_char)
  *********************************************************************/
  constructTimeRandom: function(time_ms, random_char){

    return (Lib.Utils.getUnixTimeInMilliSeconds() + '-' + time_ms + '-' + random_char)

  },


  /********************************************************************
  Deconstruct Time Random

  @param {String} time_random - Time Random (time_ms + '-' + random_char)

  @return [time_ms, random_char] - Return Time in milliseconds, Random characters
  *********************************************************************/
  deconstructTimeRandom: function(time_random){

    // Initialise
    var [ time_ms, initiation_time_ms, random_char ] = time_random.split('-');

    // Return
    return [ Number(time_ms), Number(initiation_time_ms), random_char ];

  },




  /********************************************************************
  Get encrypted value of IP (IP address is saved into database after encryption)

  @param {String} ip_address - IP Address String which is to be encrypted

  @return {String} - Encrypted string in Hexa-decimal
  *********************************************************************/
  encryptIp: function(ip_address){

    return Lib.Crypto.aesEncryption(
      ip_address,
      CONFIG.IP_ENCRYPT_KEY
    );

  },

};//////////////////////////Private Functions END//////////////////////////////
