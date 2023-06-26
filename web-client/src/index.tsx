import React from 'react';
import ReactDOM from 'react-dom/client';
import "@cloudscape-design/global-styles/index.css"
import App from './App';
import {BrowserRouter} from "react-router-dom";
import {CookiesProvider} from 'react-cookie';

const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);
root.render(
    <CookiesProvider>
        <BrowserRouter>
            <App/>
        </BrowserRouter>
    </CookiesProvider>
);
