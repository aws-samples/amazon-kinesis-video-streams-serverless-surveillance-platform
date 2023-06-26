// Load the AWS SDK for Node.js
const AWS = require('aws-sdk');

// Create the DynamoDB service object
let ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });

exports.handler = async (event) => {
    
    let device_sn = event.parameters.SerialNumber    

    let getParams = {
        TableName: process.env.DEVICETABLENAME,
        Key: {
            'device_sn': { S: device_sn }
        }
    };

    // Call DynamoDB to read the item from the table
    let deviceItem = await ddb.getItem(getParams).promise();

    if (deviceItem.Item) {
        return {'allowProvisioning': true};
    }
    else {
        return {'allowProvisioning': false};
    }
};