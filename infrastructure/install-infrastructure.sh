#!/bin/bash


# Setting ENV variables for Region and Account-ID
echo "[INFO] Calling 'aws sts get-caller-identity' to identify the AWS account id"
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
export AWS_REGION=$(aws configure get region)

if [ -z ${AWS_ACCOUNT_ID} ]; then
  echo "[INFO] AWS_ACCOUNT_ID is not set, please set up aws cli first";
  exit 1
fi

if [ -z ${AWS_REGION} ]; then
  echo "[INFO] AWS_REGION is not set, using default region";
  if [ -z ${AWS_DEFAULT_REGION} ]; then
    echo "[INFO] AWS_DEFAULT_REGION is not set either, please set it to your preferred region";
    exit 1
    else
    export AWS_REGION=$AWS_DEFAULT_REGION
    echo "[INFO] AWS_REGION is set to ${AWS_REGION}";
  fi
fi

echo "[INFO] AWS account-id: $AWS_ACCOUNT_ID"
echo "[INFO] AWS region: $AWS_REGION"

CLOUD9_ID=$1

if [[ -n "$CLOUD9_ID" ]]; then
    echo "[INFO] CLOUD9 Environment ID set to ${1}"
    CALLBACK_URL="https://${CLOUD9_ID}.vfs.cloud9.${AWS_REGION}.amazonaws.com"
else
  CALLBACK_URL="http://localhost:8080"
fi

echo "[INFO] Create S3-Bucket for saving lambda functions"
aws cloudformation deploy \
  --stack-name cfn-surveillance-camera-buckets-${AWS_REGION}-${AWS_ACCOUNT_ID} \
  --template-file cfn-surveillance-camera-buckets.yaml \
  --capabilities CAPABILITY_NAMED_IAM

# Update lambda function libraries, zip and upload function code to S3
cd lambda
cd Layer/nodejs && npm install --silent && cd .. && zip -r nodejs.zip . 2>&1 > /dev/null && cd ..
cd CheckDeviceManufactured && zip -r nodejs.zip . 2>&1 > /dev/null && cd ..
cd CreateUserDeviceBinding && zip -r nodejs.zip . 2>&1 > /dev/null && cd ..
cd GetDevice &&  zip -r nodejs.zip . 2>&1 > /dev/null && cd ..
cd KinesisVideoStreamPermissionHandler && zip -r nodejs.zip . 2>&1 > /dev/null && cd ..
cd ..

aws s3 sync "lambda" s3://surveillance-camera-lambda-functions-${AWS_ACCOUNT_ID}-${AWS_REGION}/ --exclude "*" --include "*.zip"

# Create AWS IoT certificate
CLAIM_CERTIFICATE_ARN=$(aws iot create-keys-and-certificate \
  --set-as-active \
  --certificate-pem-outfile certificate-bootstrap.pem.crt \
  --public-key-outfile public-bootstrap.pem.key \
  --private-key-outfile private-bootstrap.pem.key \
  --output text \
  --query "certificateArn")

# Move certificates
mkdir ../camera/claim-certificates
mv certificate-bootstrap.pem.crt ../camera/claim-certificates
mv public-bootstrap.pem.key ../camera/claim-certificates
mv private-bootstrap.pem.key ../camera/claim-certificates

# Download Amazon Root CA certificate
curl -o ../camera/claim-certificates/root.ca.pem https://www.amazontrust.com/repository/AmazonRootCA1.pem

# Create a Thing type
aws iot create-thing-type \
  --thing-type-name "Camera" \
  --thing-type-properties "thingTypeDescription=surveillance camera, searchableAttributes=version,model,country" \
  2>&1 > /dev/null

aws iot create-thing-group \
    --thing-group-name V1 \
    --thing-group-properties "thingGroupDescription=surveillance camera version 1, attributePayload={attributes={Manufacturer=AnyCompany,wattage=60}}" \
    2>&1 > /dev/null

# Identify iot endpoint
IOT_ENDPOINT=$(aws iot describe-endpoint --endpoint-type iot:Data-ATS --output text)

# Building AWS Lambda functions, Amazon Dynamo DB, Amazon API Gateway and Amazon Cognito resources
aws cloudformation deploy \
  --stack-name cfn-surveillance-camera-infrastructure-${AWS_REGION}-${AWS_ACCOUNT_ID} \
  --template-file cfn-surveillance-camera-infrastructure.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides "CallbackUrl=${CALLBACK_URL}" || exit 1

# Attach AWS IoT certificate to Claim Policy
aws iot attach-policy \
  --policy-name CameraClaimPolicy \
  --target ${CLAIM_CERTIFICATE_ARN}

# Input dummy data to DynamoDB
aws dynamodb put-item \
    --table-name Device_Repository  \
    --item '{"device_sn": {"S": "BCM2835-00000000b211cf11"}, "assemblied": {"S": "1655111897"}, "secret": {"S": "841524"}}'

# Create User account in Cognito Database
USERPOOL_ID=$(aws cognito-idp list-user-pools --max-results 2 --query "reverse(sort_by(UserPools, &CreationDate))[0].Id" --output text)
CLIENT_ID=$(aws cognito-idp list-user-pool-clients --user-pool-id ${USERPOOL_ID} --query "UserPoolClients[0].ClientId" --output text)

aws cognito-idp admin-create-user \
  --user-pool-id ${USERPOOL_ID} \
  --username linus \
  --user-attributes Name=email,Value=linus@testuser.com Name=email_verified,Value=True \
  --message-action SUPPRESS \
  2>&1 > /dev/null

aws cognito-idp admin-set-user-password \
  --user-pool-id ${USERPOOL_ID} \
  --username linus \
  --password TemporaryPassword1! \
  2>&1 > /dev/null

# Set Variables for Web-Application
API_GATEWAY_ID=$(aws apigateway get-rest-apis --query "reverse(sort_by(items, &createdDate))[0].id" --output text)

cat <<EOF >../web-client/.env
VITE_API_BASE_URL=https://${API_GATEWAY_ID}.execute-api.${AWS_REGION}.amazonaws.com/V1
VITE_COGNITO_UI=https://surveillance-camera-example-${AWS_ACCOUNT_ID}.auth.${AWS_REGION}.amazoncognito.com/login?response_type=token&client_id=${CLIENT_ID}&redirect_uri=${CALLBACK_URL}
VITE_AWS_REGION=${AWS_REGION}
GENERATE_SOURCEMAP=false
EOF

# Set Variables for Camera
cat <<EOF >../camera/scripts/config.ini
[SETTINGS]
# IoT
SERIAL_NUMBER = BCM2835-00000000b211cf11

# Set the path to the location containing your certificates (root, private, claim certificate)
SECURE_CERT_PATH = ../claim-certificates
ROOT_CERT = root.ca.pem
CLAIM_CERT = certificate-bootstrap.pem.crt
SECURE_KEY = private-bootstrap.pem.key

# Newly received
PRODUCTION_CERT_PATH = ../certificates
PRODUCTION_CERT = certificate.pem.crt
PRODUCTION_KEY = private.pem.key

# Set the name of your IoT Endpoint
IOT_ENDPOINT = ${IOT_ENDPOINT}

# Include the name for the provisioning template that was created in IoT Core
PRODUCTION_TEMPLATE = CameraProvisioningTemplate
EOF