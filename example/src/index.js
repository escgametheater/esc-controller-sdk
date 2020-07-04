import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import registerServiceWorker from './registerServiceWorker';

import { ESCGameController } from '@esc_games/esc-controller-sdk'


ReactDOM.render(
    <ESCGameController game="example" includeESCLogo={true} includeTattooDisplay={true} includeTattooSelector={true} desiredOrientation={"landscape"} autoSizeEnabled={true} appModeEnabled={true}>
        <App />
    </ESCGameController>
    ,
    document.getElementById('root'));

registerServiceWorker();

