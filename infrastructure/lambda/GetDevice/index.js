// Load the AWS SDK for Node.js
const AWS = require('aws-sdk');

const {CognitoJwtVerifier} = require("aws-jwt-verify");

// Create the DynamoDB service object
let ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
let iot = new AWS.Iot({});

exports.handler = async (event, context, callback) => {

    const jwtToken = event.headers.id_token;

    // Verifier that expects valid access tokens:
    const tokenPayload = await verifyToken(process.env.POOLID, process.env.CLIENTID, jwtToken);

    if (typeof tokenPayload.email === 'undefined') {
        callback(null, {
            statusCode: 401,
            body: 'Token not valid!'
        })
    }

    let getParams = {
        TableName: process.env.MAPPINGTABLENAME,
        ExpressionAttributeValues: {
            ':e': {S: tokenPayload.email}
        },
        KeyConditionExpression: 'email = :e'
    };


    // Call DynamoDB to read the item from the table
    let deviceQuery = await ddb.query(getParams).promise();

    if (deviceQuery.Items.length > 0) {

        const devices = deviceQuery.Items

        let result = []
        for (let index in devices) {

            try {
                const deviceInfo = await iot.describeThing({thingName: devices[index].device_sn.S}).promise();
                deviceInfo.attributes["provisioned"] = true
                result.push(deviceInfo.attributes)
            } catch (e) {
                result.push({"serial_number": devices[index].device_sn.S, "provisioned": false, "country": "unknown", "version": "unknown"})
                console.error(e);
            }

        }
        callback(null, {
            "statusCode": 200,
            "body": result
        });
    } else {
        callback(null, {
            "statusCode": 404,
            "body": []
        })
    }
};


/*###########################
       HELPER FUNCTIONS
#############################*/

async function verifyToken(userPoolId, clientId, token) {
    const verifier = CognitoJwtVerifier.create({
        userPoolId: userPoolId,
        tokenUse: "id",
        clientId: clientId,
    });

    try {
        const payload = await verifier.verify(
            token
        );
        return (payload);
    } catch {
        return ("Token not valid!");
    }
}