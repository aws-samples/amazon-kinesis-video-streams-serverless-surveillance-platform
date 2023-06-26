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

echo "[INFO] Delete S3-Bucket for lambda functions"
aws s3 rm s3://surveillance-camera-logging-${AWS_ACCOUNT_ID}-${AWS_REGION} --recursive
aws s3 rm s3://surveillance-camera-lambda-functions-${AWS_ACCOUNT_ID}-${AWS_REGION} --recursive

aws cloudformation delete-stack \
  --stack-name cfn-surveillance-camera-buckets-${AWS_REGION}-${AWS_ACCOUNT_ID}

echo "[INFO] Removing local generated files"
find . -name "*.zip" -type f -delete
rm -r lambda/Layer/nodejs/node_modules
rm -r ../camera/claim-certificates
rm -r ../camera/scripts/config.ini
rm -r ../web-client/.env


echo "[INFO] Removing IoT Resources"
THING_PRINCIPAL=$(aws iot list-thing-principals --thing-name BCM2835-00000000b211cf11 --query "principals[0]" --output text)
aws iot detach-thing-principal --thing-name BCM2835-00000000b211cf11 --principal ${THING_PRINCIPAL}
aws iot delete-thing --thing-name BCM2835-00000000b211cf11
aws iot delete-thing-group --thing-group-name V1

for certificate in $(aws iot list-targets-for-policy --policy-name CameraClaimPolicy --query "targets" --output text) ; do aws iot detach-policy --policy-name CameraClaimPolicy --target $certificate; done
for certificate in $(aws iot list-targets-for-policy --policy-name KvsCameraIoTPolicy --query "targets" --output text) ; do aws iot detach-policy --policy-name KvsCameraIoTPolicy --target $certificate; done

echo "[INFO] Delete Cloudformation Stack"
aws cloudformation delete-stack \
  --stack-name cfn-surveillance-camera-infrastructure-${AWS_REGION}-${AWS_ACCOUNT_ID}