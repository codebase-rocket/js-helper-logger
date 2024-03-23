------------
Create Table
------------
Test table for DynamoDB

* Table Name: test_logger
* Partition Key: id [string]
* Sort Key: t [number]

* Secondary Index: [NONE]
* Read/write capacity mode: On-demand



-----------------
Create IAM policy
-----------------
* Create Your Own Policy -> Select 'JSON'
* Name: `test-policy-dynamodb-logger`
* Description: Test policy for dynamodb logger table
* Policy Document:
```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowUserToAccessLoggerTable",
      "Effect": "Allow",
      "Action": [
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem",
        "dynamodb:ConditionCheckItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem",
        "dynamodb:GetItem",
        "dynamodb:Scan",
        "dynamodb:Query",
        "dynamodb:UpdateItem",
        "dynamodb:UpdateTable"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/test_logger"
    }
  ]
}
```



---------------
Create IAM User
---------------
* Name: `test-user`
* Access type: Programmatic access
* Attach existing policies directly: `test-policy-dynamodb-logger`
* Note down AWS Key and Secret
