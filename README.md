# ESC Controller SDK

## Using the controller SDK:

### Pre-requisites

- homebrew
```
brew install npm
```

In your Unity game project directory (e.g. `~/ToyBox/myGame/`), run this command
```bash
npx create-react-app controller
cd controller
```

To use the ESC Controller SDK, you will need an NPM Account (https://npmjs.com) 
and for now, you will need to be explicitly added to the ESC Team.  

Ask Josh to add you to the `@esc_games` organization.
```bash
npm login
```

Install the ESC Controller SDK into your react app

```
npm install @esc_games/esc-controller-sdk --save
```

ESC Controller SDK is a React/Redux dependent SDK.  
You can use the SDK to make ESC Game controllers, 
interfacing directly with the ESC API, as well as plugging 
in dope controller and user input components made by ESC 
and our developer community.

Example index.js:
```javascript
import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import { ESCGameController } from '@esc_games/esc-controller-sdk/';
import './my.css';
import { MyController } from './MyGame';

ReactDOM.render(
    <ESCGameController>
        <MyController/>
    </ESCGameController>,
    document.getElementById('root')
);
```
### Raw User Input
The core user input library from ESC provides access to native User Inputs on the controller device.
- Accelerometer
- Screen
- *UserMedia*
- ... 

### Gestures
The gesture library from ESC provides some concrete implementations of interpreting raw user input into 
controller events.
- Shake
- Flick
- ...

Here's an example of adding the Shake gesture and the default Shake UI component:
```javascript
import { ESCManager } from '@esc_games/esc-controller-sdk'
import { Shake, ShakeManager, CONTROLLER_SHAKE } from '@esc_games/esc-controller-sdk/gestures'

ShakeManager.registerEventHandler(CONTROLLER_SHAKE, "A", (message) => {
    ESCManager.networking.sendEventMessage("Shake:");
});
```

### Controls
ESC Controls are easy-to-use drop-in components for common UI Inputs
- Joystick
- TattooSelector
- TattooDisplay
- ...

Here's how to add a control and subscribe to control events:
```javascript
import React, {Component} from 'react';
import {Joystick, JoystickManager, CONTROLLER_JOYSTICK_MOTION} from "../esc/controls/joystick";

JoystickManager.registerEventHandler(CONTROLLER_JOYSTICK_MOTION, SEA_OF_FOLKS, (message) => {
    console.log("SENDING ", message);
    ESCManager.networking.sendEventMessage("Joystick:" + message);
});

class MyControllerComponent extends Component {
    render() {
        const joystickStyle = {
            float: "right",
        };

        const tattooStyle = {
            float: "left",
        };


        return <div>
            <div style={joystickStyle}>
                <Joystick/>
                <TattooDisplay/>
            </div>

            <div style={tattooStyle}>
                <TattooSelector/>


                <Shake/>
            </div>
        </div>
    }
}

```

## Contributing to the SDK
```bash
git clone git@bitbucket.org:escgametheater/esc-controller-sdk.git
cd esc-controller-sdk
npm install
export BABEL_ENV=production
npm run link
cd ../example
npm install
rm -rf node_modules/@esc_games/esc-controller-sdk
npm link @esc_games/esc-controller-sdk
npm start
```

Now you have a working example of a controller using the SDK.
After making changes to the SDK Content, build again:
```bash
npm run build
```

and your example application should refresh and voila!

To publish a new version of the SDK, update the version in package.json:
`"version": "0.3.6",`
```
npm run dist
```
Note that you cannot publish over an existing version.

## Creating Reusable Controls

Let's use Joystick as an example - here's a simplified component 
that we want to change redux state IFF it's showing 
on the screen:
```javascript
class JoystickComponent extends Component {
    render() {
        const {id, x, y, skinClassName} = this.props;

        return <div id={id} className={"ESCJoystick " + skinClassName}>
            Joystick
            <pre>
                <pre>
                    {JSON.stringify(this.props, null, 2)}
                </pre>
            </pre>
        </div>
    }
}
```

This component is made to be simple, and used for debugging.  That's why only displaying it's props in a fixed width font.

Here's the reducer for it:
```javascript
const defaultState = {
    id: "Joystick " + Math.random(),
    x: 0.0,
    y: 0.0,
    skinClassName: "x86-classic"
};

const reducerManager = new ReducerManager({
    [UI_JOYSTICK_MOTION]: (state, action) => {
        return {
            ...state.joystick,
            x: action.value.x,
            y: action.value.y,
        };
    },
    [UI_JOYSTICK_SKIN]: (state, action) => {
        return {
            ...state.joystick,
            skinClassName: action.value
        };
    }
}, defaultState);

```

Here's how we connect the  GameUI, our props displaying 
React component to ESC's reducer registry:
```javascript
export const Joystick = JoystickManager.connect(JoystickComponent, [UI_JOYSTICK_MOTION, UI_JOYSTICK_SKIN]);
```

This `connect` function should be used instead of redux's 
connect.  The redux actions that should affect state should 
be listed to ensure that only when/if joystick(s) are 
showing/in-use do we affect Redux/UI state.


## Contributing
### Access npm
```
npm login
```

### Build
```
# update package.json to reflect a new version
export BABEL_ENV=production
npm run build

``` 
### Publish
```
npm run dist
``` 

### Test/Tinker
```
cd example
# update package.json to reflect the target version
npm install
npm start
```
