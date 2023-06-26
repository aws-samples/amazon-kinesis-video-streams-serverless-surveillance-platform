// Load the AWS SDK for Node.js
const AWS = require('aws-sdk');

// Load the JWT Verifier for Node.js
const {CognitoJwtVerifier} = require("aws-jwt-verify");

// Create the DynamoDB service object
let ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

exports.handler = async (event, context, callback) => {

    //get OAuth id token and device serialnumber from request
    const jwtToken = event.headers.id_token;
    const device_sn = event.body.device_sn;
    const device_secret = event.body.secret;

    // Verify id token to receive user email
    const tokenPayload = await verifyToken(process.env.POOLID, process.env.CLIENTID, jwtToken);

    try {

        if (typeof tokenPayload.email === 'undefined') {
            callback(null, {
                statusCode: 401,
                body: 'Token not valid!'
            })
        }

        //Verify device is registered in manufacturing database
        let getParams = {
            TableName: process.env.DEVICETABLENAME,
            Key: {
                'device_sn': {S: device_sn}
            }
        };

        let deviceItemTable = await ddb.getItem(getParams).promise();

        if (deviceItemTable.Item) {

            if (!(deviceItemTable.Item.secret["S"] === device_secret)) {
                callback(null, {
                    statusCode: 401,
                    body: 'Device secret not correct!'
                })
            } else {

                //Verify if device is already bound by scanning the Mapping Database for it
                const params = {
                    FilterExpression: "device_sn = :sn",
                    ExpressionAttributeValues: {
                        ":sn": {S: device_sn}
                    },
                    ProjectionExpression: "device_sn",
                    TableName: process.env.MAPPINGTABLENAME
                };

                let deviceItem = await ddb.scan(params).promise();

                if (deviceItem.Items.length > 0) {
                    callback(null, {
                        statusCode: 401,
                        body: 'Device already bound!'
                    })
                } else {

                    //Create new device user binding
                    let putParams = {
                        Item: {
                            "device_sn": {
                                S: device_sn
                            },
                            "email": {
                                S: tokenPayload.email
                            },
                            "user": {
                                S: tokenPayload["cognito:username"]
                            }
                        },
                        ReturnConsumedCapacity: "TOTAL",
                        TableName: process.env.MAPPINGTABLENAME
                    };

                    await ddb.putItem(putParams).promise();

                    callback(null, {
                        statusCode: 200,
                        body: "Device successfully bound!"
                    });
                }
            }
        } else {
            callback(null, {
                statusCode: 401,
                body: 'Device not found in manufacturing database!'
            })
        }
    } catch (e) {
        callback(null, {
            statusCode: 404,
            body: 'Device not found in manufacturing database!'
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