// Load the AWS SDK for Node.js
const AWS = require('aws-sdk');

// Load the JWT Verifier for Node.js
const {CognitoJwtVerifier} = require("aws-jwt-verify");

// Create the DynamoDB service object
let ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

// Create the STS service object
var sts = new AWS.STS();

exports.handler = async (event, context, callback) => {

    //get AccountID and Region
    const awsAccountId = context.invokedFunctionArn.split(':')[4]
    const awsRegion = context.invokedFunctionArn.split(':')[3]

    //get OAuth id token and device serialnumber from request
    const jwtToken = event.headers.id_token;

    // Verify id token to receive user email
    const tokenPayload = await verifyToken(process.env.POOLID, process.env.CLIENTID, jwtToken);

    if (typeof tokenPayload.email === 'undefined') {
        callback(null, {
            statusCode: 401,
            body: 'Token not valid!'
        })
    }

    //Receive all devices of user email from device mapping database
    let getParams = {
        TableName: process.env.MAPPINGTABLENAME,
        ExpressionAttributeValues: {
            ':e': {S: tokenPayload.email}
        },
        KeyConditionExpression: 'email = :e'
    };

    let deviceItem = await ddb.query(getParams).promise();
    let devices = deviceItem.Items

    if (devices.length > 0) {
        //Request Credentials for devices
        let result = await getCredentials(devices, awsAccountId, awsRegion)

        callback(null, {
            "statusCode": 200,
            "body": result
        });
    } else {
        callback(null, {
            statusCode: 404,
            body: 'No devices bound to email'
        })
    }


};


async function getCredentials(devices, awsAccountId, awsRegion) {


    let resources = []
    for (let index in devices) {
        let resource = `arn:aws:kinesisvideo:${awsRegion}:${awsAccountId}:channel/${devices[index].device_sn.S}/*`
        resources.push(resource)
    }

    let inlinePolicy = {
        "Version":"2012-10-17",
        "Statement":[
            {
                "Effect":"Allow",
                "Action":[
                    "kinesisvideo:ConnectAsViewer",
                    "kinesisvideo:DescribeSignalingChannel",
                    "kinesisvideo:GetIceServerConfig",
                    "kinesisvideo:GetSignalingChannelEndpoint"
                ],
                "Resource": resources
            }
        ]
    }


    let credentialsResult = await sts.assumeRole({
        Policy: JSON.stringify(inlinePolicy),
        RoleArn: `arn:aws:iam::${awsAccountId}:role/KVSPermissionHandler`,
        RoleSessionName: `device-${devices[0].device_sn.S}-RoleSession`,
    }).promise()


    return credentialsResult.Credentials;
}


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

