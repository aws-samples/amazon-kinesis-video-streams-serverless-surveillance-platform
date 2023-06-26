import * as React from "react";
import {useEffect} from "react";
import Table from "@cloudscape-design/components/table";
import {
    Alert,
    Box,
    Button,
    Container,
    ContentLayout,
    Flashbar,
    FormField,
    Grid,
    Header,
    Input,
    SpaceBetween
} from "@cloudscape-design/components";
import Form from "@cloudscape-design/components/form";
import {addDeviceUser, getDeviceInfo, getPermissions} from "../util/Backend";
import {FlashbarProps} from "@cloudscape-design/components/flashbar/interfaces";
import {useCookies} from "react-cookie";
import Viewer from "../util/WebRTCViewer";


interface DeviceItem {
    serial_number: string;
    country: string;
    version: string;
    provisioned: boolean;
}

export interface DataItem {
    AccessKeyId: string | undefined;
    SecretAccessKey: string | undefined;
    SerialNumber: string | undefined;
    SessionToken: string | undefined;
}

export default () => {

    const [cookies] = useCookies(['CognitoCookie']);
    const cognitoCookie = cookies['CognitoCookie'];

    const [inputSerialNumber, setInputSerialNumber] = React.useState("");
    const [modalVisible, setModalVisible] = React.useState(true);
    const [inputSecret, setInputSecret] = React.useState("");
    const [data, setData] = React.useState <DeviceItem []>([]);
    const [flashbar, setFlashbar] = React.useState <FlashbarProps.MessageDefinition[] | never[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedItems, setSelectedItems] = React.useState <DeviceItem []>([]);
    const [secrets, setSecrets] = React.useState <DataItem>({
        AccessKeyId: undefined,
        SecretAccessKey: undefined,
        SerialNumber: undefined,
        SessionToken: undefined
    });

    useEffect(() => {

        const loadSecrets = async (cognitoCookie: { idToken: string; }) => {
            await getPermissions(cognitoCookie)
                .then(results => setSecrets(results.data.body))
        }

        const loadDevices = async (cognitoCookie: { idToken: string; }) => {
            await getDeviceInfo(cognitoCookie)
                .then(results => {
                    setData(results.data.body)
                    setLoading(false)
                })
        }

        if (cognitoCookie) {
            loadSecrets(cognitoCookie);
            loadDevices(cognitoCookie);
        } else {
            setLoading(false)
            setFlashbar([{
                header: "Cookie not set, please log in first",
                type: "error",
                dismissible: true,
                onDismiss: () => setFlashbar([]),
                id: "1"
            }])
        }

    }, []);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setLoading(true)

        const data = new FormData(event.currentTarget);

        await addDeviceUser(data.get('serialnumber'), data.get('secret'), cognitoCookie)
            .then(result => {
                setFlashbar([{
                    header: result.data.body,
                    type: result.data.statusCode > 399 ? "error" : "success",
                    dismissible: true,
                    onDismiss: () => setFlashbar([]),
                    id: "1"
                }])
                setInputSerialNumber("")
                setInputSecret("")
            }).catch(error => {
                setFlashbar([{
                    header: error.response.data.message,
                    type: "error",
                    dismissible: true,
                    onDismiss: () => setFlashbar([]),
                    id: "1"
                }])
                setInputSerialNumber("")
                setInputSecret("")
            })

        await getDeviceInfo(cognitoCookie).then(results => {
            setData(results.data.body)
            setLoading(false)
        }).catch(e => setLoading(false))

    }

    return (
        <ContentLayout
            header={
                <SpaceBetween size="m">
                    <Header
                        variant="h1"
                        description="Add a new camera to your account."
                    >
                        Register a camera
                    </Header>

                </SpaceBetween>
            }
        >

            <SpaceBetween size="xxl">
                <Alert
                    statusIconAriaLabel="Info"
                    header="Device Provisioning"
                >
                    Surveillance cameras can be registered but need to be provisioned to access the live camera feed.
                    Start the fleet provisioning process with the corresponding script.
                </Alert>
                <Flashbar items={flashbar}/>
                <Table
                    onSelectionChange={({detail}) =>
                        setSelectedItems(detail.selectedItems)
                    }
                    selectedItems={selectedItems}
                    selectionType="single"
                    columnDefinitions={[
                        {
                            header: "Serial Number",
                            cell: ({serial_number}) => serial_number,
                            width: 250,
                            minWidth: 250,
                            sortingField: "serialnumber"
                        },
                        {
                            header: "Version",
                            cell: ({version}) => version,
                            width: 150,
                            minWidth: 150,
                        },
                        {
                            header: "Country",
                            cell: ({country}) => country,
                            width: 150,
                            minWidth: 150
                        },
                        {
                            header: "Provisioned",
                            cell: ({provisioned}) => String(provisioned),
                            width: 150,
                            minWidth: 150
                        }
                    ]}
                    items={data}
                    loading={loading}
                    loadingText="Loading resources"
                    resizableColumns
                    empty={
                        <Box textAlign="center" color="inherit">
                            <b>No resources</b>
                            <Box
                                padding={{bottom: "s"}}
                                variant="p"
                                color="inherit"
                            >
                                No resources to display.
                            </Box>

                        </Box>
                    }
                    header={
                        <>
                            <Header>Registered surveillance cameras</Header>
                            <p>Select a camera from the first column to stream the current content</p>
                        </>
                    }
                />

                {selectedItems.length > 0 ? <Viewer AccessKeyId={secrets.AccessKeyId}
                                                    SecretAccessKey={secrets.SecretAccessKey}
                                                    SerialNumber={String(selectedItems[0].serial_number)}
                                                    SessionToken={secrets.SessionToken}/> : ""}


                <form onSubmit={e => handleSubmit(e)}>
                    <Form
                        actions={
                            <SpaceBetween direction="horizontal" size="xs">
                                <Button variant="primary">Submit</Button>
                            </SpaceBetween>
                        }
                    >
                        <Container
                            header={
                                <Header variant="h2">
                                </Header>
                            }
                        >
                            <SpaceBetween direction="vertical" size="xl">
                                {modalVisible ?
                                    <Alert
                                        dismissible
                                        onDismiss={() => setModalVisible(!modalVisible)}
                                        type="warning"
                                        header="Development purpose only"
                                    >
                                        The secret and serial number are shown here in the clear for simplicity and
                                        experimental purpose only. You can add additional devices in the DynamoDB
                                        table. <br/> Serial numbers and secrets should always be protected when used in
                                        production.
                                    </Alert> : ""}
                                <Grid gridDefinition={[{colspan: 6}, {colspan: 6}]}>
                                    <FormField label="Serial number" info="BCM2835-00000000b211cf11" constraintText="Input must be alphanumeric and can contain a hyphen">
                                        <Input
                                            value={inputSerialNumber}
                                            name="serialnumber"
                                            onChange={event =>
                                                setInputSerialNumber(event.detail.value)
                                            }
                                            invalid={!(/^[a-zA-Z\d-]+$/.test(inputSerialNumber))}
                                        />
                                    </FormField>
                                    <FormField label="Secret" info="841524" constraintText="Input must be numeric">
                                        <Input
                                            value={inputSecret}
                                            name="secret"
                                            type="password"
                                            onChange={event =>
                                                setInputSecret(event.detail.value)
                                            }
                                            invalid={!(/^\d+$/.test(inputSecret))}/>
                                    </FormField>
                                </Grid>
                            </SpaceBetween>
                        </Container>
                    </Form>
                </form>

            </SpaceBetween>
        </ContentLayout>
    );
}