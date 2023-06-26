import * as React from "react";
import {useEffect} from "react";
import {Container, Flashbar, Header} from "@cloudscape-design/components";
import {DataItem} from "../sub/Camera";
import KVS from 'aws-sdk/clients/kinesisvideo';
import KVSSignalingChannels, {Uris} from 'aws-sdk/clients/kinesisvideosignalingchannels';
import {SignalingClient} from 'amazon-kinesis-video-streams-webrtc';
import {Role} from "amazon-kinesis-video-streams-webrtc/lib/Role";
import {Video} from "./Video";
import {FlashbarProps} from "@cloudscape-design/components/flashbar/interfaces";


interface IceServer {
    urls: Uris,
    username: string,
    credential: string,
}

export default (data: DataItem) => {

    const [stream, setStream] = React.useState(null);
    const [signalClient, setSignalClient] = React.useState(null);
    const [flashbar, setFlashbar] = React.useState <FlashbarProps.MessageDefinition[] | never[]>([]);

    const region = import.meta.env.VITE_AWS_REGION;

    const accessKeyId = data.AccessKeyId;
    const secretAccessKey = data.SecretAccessKey;
    const serialNumber = data.SerialNumber;
    const sessionToken = data.SessionToken;
    const clientId = `client-${Math.random() * 5}`;

    const kinesisVideoClient = new KVS({
        region,
        accessKeyId,
        secretAccessKey,
        sessionToken,
        correctClockSkew: true,
    });

    useEffect(() => {
        setFlashbar([])

        const loadViewer = async () => {
            await createViewer().catch((error) => {
                setFlashbar([{
                    header: "The requested channel is not found or not active. Provisioning the camera mock can take up to 10 minutes. Please refresh page.",
                    type: "error",
                    dismissible: true,
                    onDismiss: () => setFlashbar([]),
                    id: "1"
                }])
            });
        }

        if (!signalClient) {
            loadViewer()
        } else {
            signalClient.close()
            setSignalClient(null)
            setStream(null)
            loadViewer()
        }


    }, [data]);

    const createViewer = async () => {

        // Get signaling channel ARN
        const describeSignalingChannelResponse = await kinesisVideoClient
            .describeSignalingChannel({
                ChannelName: serialNumber,
            })
            .promise()

        const channelARN = describeSignalingChannelResponse.ChannelInfo.ChannelARN;
        console.log('[VIEWER] Channel ARN: ', channelARN);

        const getSignalingChannelEndpointResponse = await kinesisVideoClient.getSignalingChannelEndpoint({
            ChannelARN: channelARN,
            SingleMasterChannelEndpointConfiguration: {
                Protocols: ['WSS', 'HTTPS'],
                Role: "VIEWER"
            },
        }).promise();

        const endpointsByProtocol = getSignalingChannelEndpointResponse.ResourceEndpointList.reduce((endpoints, endpoint) => {
            endpoints[endpoint.Protocol] = endpoint.ResourceEndpoint;
            return endpoints;
        }, {});
        console.log('[VIEWER] Endpoints: ', endpointsByProtocol);


        const kinesisVideoSignalingChannelsClient = new KVSSignalingChannels({
            region,
            accessKeyId,
            secretAccessKey,
            sessionToken,
            endpoint: endpointsByProtocol["HTTPS"],
            correctClockSkew: true,
        });

        const getIceServerConfigResponse = await kinesisVideoSignalingChannelsClient
            .getIceServerConfig({
                ChannelARN: channelARN,
            })
            .promise();

        //For best performance, we collect STUN and TURN ICE server configurations. The KVS STUN endpoint is always stun:stun.kinesisvideo.${region}.amazonaws.com:443. To get TURN servers, the GetIceServerConfig API is used.
        const iceServers: IceServer[] = [
            {urls: [`stun:stun.kinesisvideo.${region}.amazonaws.com:443`], username: "", credential: ""}
        ];

        getIceServerConfigResponse.IceServerList.forEach(iceServer =>
            iceServers.push({
                urls: iceServer.Uris,
                username: iceServer.Username,
                credential: iceServer.Password,
            }),
        );

        console.log('[VIEWER] ICE servers: ', iceServers);

        const peerConnection = new RTCPeerConnection({iceServers});

        const signalingClient = new SignalingClient({
            channelARN,
            channelEndpoint: endpointsByProtocol["WSS"],
            clientId,
            role: Role.VIEWER,
            region,
            credentials: {
                accessKeyId,
                secretAccessKey,
                sessionToken
            },
            systemClockOffset: kinesisVideoClient.config.systemClockOffset,
        });

        signalingClient.on('open', async () => {
            console.log('[VIEWER] Connected to signaling service');


            // Create an SDP offer to send to the master
            console.log('[VIEWER] Creating SDP offer');
            await peerConnection.setLocalDescription(
                await peerConnection.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true,
                }),
            );

            console.log('[VIEWER] Sending SDP offer');
            signalingClient.sendSdpOffer(peerConnection.localDescription);

            console.log('[VIEWER] Generating ICE candidates');
        });


        // When the SDP answer is received back from the master, add it to the peer connection.
        signalingClient.on('sdpAnswer', async answer => {
            await peerConnection.setRemoteDescription(answer);
        });

        // When an ICE candidate is received from the master, add it to the peer connection.
        signalingClient.on('iceCandidate', candidate => {
            peerConnection.addIceCandidate(candidate);
        });

        signalingClient.on('close', () => {
            // Handle client closures
        });

        signalingClient.on('error', error => {
            // Handle client errors
        });

        // Send any ICE candidates to the other peer
        peerConnection.onicecandidate = ({candidate}) => {
            if (candidate) {
                console.log('[VIEWER] Generated ICE candidate');
                console.log('[VIEWER] Sending ICE candidate');
                signalingClient.sendIceCandidate(candidate);
            } else {
                console.log('[VIEWER] All ICE candidates have been generated');
            }
        };

        // As remote tracks are received, add them to the remote view
        peerConnection.ontrack = e => {
            console.log('[VIEWER] Received remote track');
            setStream(e.streams[0]);
        };

        signalingClient.open()
        setSignalClient(signalingClient)
    }

    return (
        <Container
            header={
                <Header variant="h3">
                    {serialNumber}
                </Header>
            }
        >
            <Flashbar items={flashbar}/>
            <Video srcObject={stream} className="centered"/>
        </Container>

    );
}