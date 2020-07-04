import React, {Component} from 'react';
import {EventManager, ReducerManager, HANDLER_GROUP_DEFAULT} from "../";
import {
    ACTION_ACCELEROMETER_MOTION,
    ACTION_ACCELEROMETER_ENABLED,
    AccelerometerManager,
    CONTROLLER_ACCELEROMETER_MOTION
} from "../input/accelerometer";

const SERVER_SHAKE = "Shake";
const CONTROLLER_SHAKE = "Gesture:SHAKE";
const ACTION_SHAKE_EXPIRE = "Gesture:SHAKE_EXPIRE";

class ShakeComponent extends Component {
    render() {
        const {debug, shakable, shaken} = this.props;
        const visibilityClass = shaken ? "visible" : "hidden";
        return <div>
            <div className={visibilityClass}>
                <div className="ribbon">SHAKE</div>
            </div>
            {shakable ? null : <button onClick={ShakeManager.commands.shake}>Shake</button>}

            {debug ?
                <div>
                    <pre>
                    {JSON.stringify(this.props, null, 2)}
                </pre>
                </div> : null
            }
        </div>
    }
}

const defaultState = {
    shaken: false,
    shakable: false,
    debug: false,
};

const reducerManager = new ReducerManager({
    [CONTROLLER_SHAKE]: (state, action) => {
        return {
            ...state,
            shaken: true,
        }
    },
    [ACTION_SHAKE_EXPIRE]: (state, action) => {
        return {
            ...state,
            shaken: false
        }
    },
    [ACTION_ACCELEROMETER_ENABLED]: (state, action) => {
        return {
            ...state,
            shakable: action.value
        }
    }
}, defaultState);

const timeoutShakeExpire = null;
const ShakeManager = {
    commands: {
        shake: () => {
            const shake = { shakeTime: Date.now() };
            ShakeManager.dispatchEvent(CONTROLLER_SHAKE, shake);
            ShakeManager.dispatchUI(CONTROLLER_SHAKE, shake);
            if (timeoutShakeExpire != null) {
                clearTimeout(timeoutShakeExpire);
            }
            setTimeout(() => {
                ShakeManager.dispatchUIDirect(ACTION_SHAKE_EXPIRE);
            }, 1250);
        }
    }

};
Object.assign(ShakeManager, new EventManager('Gesture - Shake', reducerManager));


const Shake = ShakeManager.connect(ShakeComponent, [CONTROLLER_SHAKE, ACTION_ACCELEROMETER_ENABLED]);

AccelerometerManager.registerEventHandler(CONTROLLER_ACCELEROMETER_MOTION, HANDLER_GROUP_DEFAULT + ":Shake", (acc) => {
    const SHAKE_THRESHOLD = 1.5 * 9.8;
    const mag2 = acc.x * acc.x + acc.y * acc.y + acc.z * acc.z;
    if (mag2 > SHAKE_THRESHOLD * SHAKE_THRESHOLD) {
        console.log("Detected Shake");
        ShakeManager.commands.shake();

    }
});

export {Shake, ShakeManager, SERVER_SHAKE, CONTROLLER_SHAKE};
