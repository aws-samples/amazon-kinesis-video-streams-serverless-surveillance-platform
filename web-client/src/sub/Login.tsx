import * as React from "react";
import {Button, Container, ContentLayout, FormField, Grid, Header, SpaceBetween} from "@cloudscape-design/components";
import {Navigate, useNavigate} from "react-router-dom";
import {useCookies} from "react-cookie";

export default () => {
    const navigate = useNavigate();
    const [cookies, setCookie, removeCookie] = useCookies(['CognitoCookie']);

    // Set Cookie with received credentials from URL Callback
    let id_token = new URLSearchParams(window.location.hash).get('#id_token');
    let expiration_date = new URLSearchParams(window.location.hash).get('expires_in');

    if (id_token) {
        let content = {"idToken": id_token}
        setCookie('CognitoCookie', JSON.stringify(content), { path: '/', maxAge: Number(expiration_date)});
        return <Navigate to="/cameras" />;
    }

    let isLoggedIn = cookies["CognitoCookie"];

    // If user is logged in redirect to Amazon Cognito hosted UI to log user in
    // Otherwise delete cookie and reload page
    const buttonClick = () => {
        if (isLoggedIn) {
            removeCookie("CognitoCookie")
            navigate("/", {replace: true});
        } else {
            window.location.href = import.meta.env.VITE_COGNITO_UI || "/";
        }
    }

    return (
        <ContentLayout
            header={
                <SpaceBetween size="m">
                    <Header
                        variant="h1"
                        description="Enter the credentials created in the installation script, see below."
                    >
                        User
                    </Header>

                </SpaceBetween>
            }
        >
            <Container
                header={
                    <Header variant="h2">
                    </Header>
                }
            >
                <Grid gridDefinition={[{colspan: 4}, {colspan: 4}, {colspan: 4}]}>
                    <FormField label="Username" info="linus@testuser.com">

                    </FormField>
                    <FormField label="Password" info="TemporaryPassword1!">
                    </FormField>
                    <Button
                        ariaLabel="Login"
                        onClick={() => buttonClick()}
                        iconAlign="left"
                        iconName="user-profile"
                    >
                        {isLoggedIn ? "Logout" : "Login"}
                    </Button>
                </Grid>

            </Container>
        </ContentLayout>
    );
}