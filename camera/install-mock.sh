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

CREDENTIALS_IOT_ENDPOINT=$(aws iot describe-endpoint --endpoint-type iot:CredentialProvider --output text)

echo "[INFO] Create S3-Bucket for Connection Kit"
aws cloudformation deploy \
  --stack-name cfn-surveillance-camera-mock-buckets-${AWS_REGION}-${AWS_ACCOUNT_ID} \
  --template-file cfn-surveillance-camera-mock-buckets.yaml \
  --capabilities CAPABILITY_NAMED_IAM

echo "[INFO] Generate local files"
cat <<EOF > ./service/stream-video.sh
#!/bin/bash

export AWS_IOT_CORE_CREDENTIAL_ENDPOINT=${CREDENTIALS_IOT_ENDPOINT}
export AWS_IOT_CORE_CERT=/iot/certificates/certificate.cert.pem
export AWS_IOT_CORE_PRIVATE_KEY=/iot/certificates/private.pem.key
export AWS_IOT_CORE_ROLE_ALIAS=KvsCameraIoTRoleAlias
export AWS_DEFAULT_REGION=${AWS_REGION}

./amazon-kinesis-video-streams-webrtc-sdk-c/build/samples/kvsWebrtcClientMasterGstSample BCM2835-00000000b211cf11
EOF

mkdir ./build
zip -r ./build/mockDevice.zip scripts claim-certificates service 2>&1 > /dev/null

echo "[INFO] Uploading Mock Device Connection Kit to S3-Bucket"
aws s3 cp ./build/mockDevice.zip s3://surveillance-camera-connection-kit-${AWS_ACCOUNT_ID}-${AWS_REGION}/ 2>&1 > /dev/null

echo "[INFO] Creating EC2 Mock Device"
aws cloudformation deploy \
  --stack-name surveillance-camera-mock-${AWS_REGION}-${AWS_ACCOUNT_ID} \
  --template-file cfn-surveillance-camera-mock.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides CredentialsIotEndpoint=${CREDENTIALS_IOT_ENDPOINT}

echo -e "\n###########################################"
echo -e "\n[INFO] THE COMPILING OF THE KINESIS VIDEO STREAMS WEBRTC SDK IN C ON THE EC2 INSTANCE CAN TAKE UP TO 10 MINUTES!"
echo -e "\n#############################################"