## Database


------------------------
Create table - Event Log
------------------------
Activity Logs for Module Actions

* Table Name: test_action_log
* Partition Key: id [String]
* Sort Key: t [String]

* Global Secondary Indexes -> Create Index-
  * Partition Key: aid [String]
  * Sort Key: t [String]
  * Index Name: actor-index
  * Projected Attributes: all

Table Structure
---------------
* id (String)   -> entity_type (Type of affected 'entity' tenant|brand|deployment) + '-' + entity_id (ID of affected 'entity' tenant_id.brand_id.deployment_id) [Partition Key]
* aid (String)  -> system_code (Type of system '0':System | 'posist' : Posist) + '-' + actor_type (Type of actor who made changes to the 'entity' support|user|customer|...) + '-' + actor_id (ID of the actor. Ex- 'tenant_id.user_id') [Secondary Partition Key]
* a (String)    -> Action (register-using-phone | ...)
* ip (String)   -> Event Originating ip4, ip6, ip6 (with tunnelling) (Encrypted)
* ua (String)   -> Event Originating UserAgent
* t (String)    -> [Sort Key] Event's Time of happening + '-' +3 random characters. Unix Timestamp [Sort Key]
