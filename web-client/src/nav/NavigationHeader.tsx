import * as React from "react";
import TopNavigation from "@cloudscape-design/components/top-navigation";

export default () => {

    return (
        <TopNavigation
            identity={{
                href: "#",
                title: "Serverless Surveillance Platform Example"
            }}
            utilities={[]}
            i18nStrings={{
                overflowMenuTriggerText: "More",
                overflowMenuTitleText: "All",
            }}
        />
    );
}