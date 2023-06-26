import React from 'react';
import './App.css';
import {AppLayout} from "@cloudscape-design/components";
import SideNavigation from "./nav/SideNavigation";
import NavigationHeader from "./nav/NavigationHeader";
import Login from "./sub/Login";
import {Route, Routes} from "react-router-dom";
import RegisterCamera from "./sub/Camera";


function App() {

    return (
        <div className="App">
            <NavigationHeader/>
            <AppLayout
                content={
                    <Routes>
                        <Route path="/" element={<Login/>}/>
                        <Route path="/cameras" element={<RegisterCamera/>}/>
                    </Routes>
                }
                navigation={<SideNavigation/>}
                headerSelector="#navbarheader"
                toolsHide={true}
            />
        </div>
    );
}

export default App;
