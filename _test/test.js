// Info: Test Cases
'use strict';

// Shared Dependencies
var Lib = {};

// Set Configrations
const nodb_config = { // Config AWS DynamoDB
  'KEY': 'todo',
  'SECRET': 'todo',
  'REGION': 'us-east-1'
};
const logger_config = { // Configure Logger Module
  'support':{
    IP_ENCRYPT_KEY: '123456',
    DB_SOURCE: 'test_logger'
  },
  'user':{
    IP_ENCRYPT_KEY: '123456',
    DB_SOURCE: 'test_logger'
  }
};

// Dependencies
Lib.Utils = require('js-helper-utils');
Lib.Debug = require('js-helper-debug')(Lib);
Lib.Crypto = require('js-helper-crypto-nodejs')(Lib);
Lib.Instance = require('js-helper-instance')(Lib);
Lib.HttpHandler = require('js-helper-http-handler')(Lib);
Lib.NoDB = require('js-helper-aws-dynamodb')(Lib, nodb_config);
const Logger = require('js-helper-logger')(Lib, logger_config);


////////////////////////////SIMILUTATIONS//////////////////////////////////////

// function to simulate http-gateway callback
var fake_httpGatewayCallback = function(error, return_response, next){

  if(error){
    Lib.Debug.logErrorForResearch(error);
  }

  Lib.Debug.log('return_response', return_response);
  Lib.Debug.log('next', next);

};

///////////////////////////////////////////////////////////////////////////////


/////////////////////////////STAGE SETUP///////////////////////////////////////

// Load Dummy event Data
const event = require('./dummy_data/event.json');

// Dummy logger data
var entity_type = 'store';
var entity_id = 'org_id.brand_id.store_id';
var actor_type = 'user';
var actor_id = '0000000000';
var action = 'test-action';

// Initialize 'instance'
var instance = Lib.Instance.initialize();


// Initialize Http Request with dummy request data
Lib.HttpHandler.initHttpRequestData(instance, event, null, fake_httpGatewayCallback, 'aws');

///////////////////////////////////////////////////////////////////////////////


/////////////////////////////////TESTS/////////////////////////////////////////

// Test logAction()
// console.log(
//   "logAction()",
//   Logger.logAction(
//     instance,
//     system_code
//     entity_type,
//     entity_id,
//     actor_type,
//     actor_id,
//     action
//   )
// );


// Test getActionsByEntity()
// console.log(
//   "getActionsByEntity()",
//   Logger.getActionsByEntity(
//     instance,
//     fake_httpGatewayCallback,
//     "1680080838069cdz", // start
//     3, // limit
//     'org', // entity_type
//     'org_id' // entity_id
//   )
// );


// Test getActionsByActor()
// console.log(
//   "getActionsByActor()",
//   Logger.getActionsByActor(
//     instance,
//     fake_httpGatewayCallback,
//     "store-org_id.brand_id.store_id|1680162604166-kdw", // start
//     3, // limit
//     actor_type, // actor_type
//     actor_id, // actor_id
//   )
// );


// Test validateTimeRandom()
// console.log(
//   "validateTimeRandom()",
//   Logger.validateTimeRandom(
//     "1680162s604166-kds"
//   )
// );

///////////////////////////////////////////////////////////////////////////////
