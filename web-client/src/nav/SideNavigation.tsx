import * as React from "react";
import SideNavigation from "@cloudscape-design/components/side-navigation";
import {useLocation, useNavigate} from "react-router-dom";
import {useEffect} from "react";

export default () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [activeHref, setActiveHref] = React.useState(
        location.pathname
    );

    useEffect(() => {
        setActiveHref(location.pathname);
    }, [location.pathname]);


    return (
        <SideNavigation
            activeHref={activeHref}
            header={{href: "/", text: "Navigation"}}
            onFollow={event => {
                if (!event.detail.external) {
                    event.preventDefault();
                    setActiveHref(event.detail.href);
                    navigate(event.detail.href);
                }
            }}
            items={[
                {type: "link", text: "User", href: "/"},
                {type: "link", text: "Cameras", href: "/cameras"},
            ]}
        />
    );
}