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

echo "[INFO] Delete S3-Bucket for Connection Kit"
aws s3 rm s3://surveillance-camera-connection-kit-${AWS_ACCOUNT_ID}-${AWS_REGION} --recursive
aws s3 rm s3://surveillance-camera-mock-logging-${AWS_ACCOUNT_ID}-${AWS_REGION} --recursive

aws cloudformation delete-stack \
  --stack-name cfn-surveillance-camera-mock-buckets-${AWS_REGION}-${AWS_ACCOUNT_ID}

echo "[INFO] Removing local generated files"
rm ./service/stream-video.sh 2>&1 > /dev/null
rm -r ./build 2>&1 > /dev/null

echo "[INFO] Removing signaling channel"
KVS_CHANNEL_ARN=$(aws kinesisvideo describe-signaling-channel --channel-name "BCM2835-00000000b211cf11" --query "ChannelInfo.ChannelARN" --output text)
aws kinesisvideo delete-signaling-channel --channel-arn ${KVS_CHANNEL_ARN}

echo "[INFO] Delete Cloudformation Stack: surveillance-camera-mock-${AWS_REGION}-${AWS_ACCOUNT_ID}"
aws cloudformation delete-stack \
  --stack-name surveillance-camera-mock-${AWS_REGION}-${AWS_ACCOUNT_ID}