import React, {Component} from 'react';
import {EventManager, ReducerManager, ESCManager, GameState} from '@esc_games/esc-controller-sdk'
import {
    //Joystick,
    //JoystickManager,
    TattooManager,
    SERVER_SELECT_TATTOO,
    CONTROLLER_SELECT_TATTOO
} from '@esc_games/esc-controller-sdk/controls'

import {EventStats} from "@esc_games/esc-controller-sdk/debug";
import {CONTROLLER_ACCELEROMETER_MOTION, Accelerometer, AccelerometerManager, DefaultDeviceMotionHandler} from "@esc_games/esc-controller-sdk/input";
//import {Screen, ScreenManager, CONTROLLER_SCREEN_ORIENTATION} from '@esc_games/esc-controller-sdk/input'
import {Shake, ShakeManager, CONTROLLER_SHAKE, SERVER_SHAKE} from '@esc_games/esc-controller-sdk/gestures'
import {LowGravity, LowGravityManager, CONTROLLER_LOW_GRAVITY} from '@esc_games/esc-controller-sdk/gestures'

import './App.css';

const MY_GAME_NAME = "Example";

//const EventStatsUI = EventStats(Object.values(window.managers));

ShakeManager.registerEventHandler(CONTROLLER_SHAKE, MY_GAME_NAME, (message) => {
    ESCManager.networking.sendCommand(SERVER_SHAKE, message);
});

TattooManager.registerEventHandler(CONTROLLER_SELECT_TATTOO, MY_GAME_NAME, (tattoo) => {
    ESCManager.networking.sendCommand(SERVER_SELECT_TATTOO, tattoo);
});

AccelerometerManager.registerEventHandler(CONTROLLER_ACCELEROMETER_MOTION, MY_GAME_NAME, DefaultDeviceMotionHandler);
AccelerometerManager.registerEventHandler(CONTROLLER_LOW_GRAVITY, MY_GAME_NAME, (message) => {
    ESCManager.networking.sendCommand("LowG", message)
});

LowGravityManager.commands.triggerOnThreshold(4);


const ACTION_TEST = "test";

const defaultState = {
    test: "asdf"
};

const reducerManager = new ReducerManager({
    [ACTION_TEST] : (state, action) => {
        return {
            ...state,
            test: action.value
        }
    }
}, defaultState);

const AppManager = new EventManager(MY_GAME_NAME, reducerManager);

class AppComponent extends Component {
    render() {

        return (
            <div className="App" style={{position:"absolute", left:0, top:0, right:0, bottom:0, fontSize:"1em", textAlign:"center"}}>
                <br/>
                <br/>
                <h1>Example App</h1>
                <br/>
                <span style={{fontSize:"1em"}}>1em font</span> <span style={{fontSize:"1rem"}}>1rem font</span>
                <br/>
                <Shake />
            </div>
        );
    }
}

const App = AppManager.connect(AppComponent, [ACTION_TEST]);

/*
setInterval(() => {
    AppManager.dispatchUI(ACTION_TEST, Math.random(), 600);
});
*/

export default App;
