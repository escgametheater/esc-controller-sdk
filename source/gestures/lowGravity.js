import React, {Component} from 'react';
import {EventManager, ReducerManager, HANDLER_GROUP_DEFAULT} from "@esc_games/esc-react-redux";
import {
    GRAVITY,
    ACTION_ACCELEROMETER_ENABLED,
    AccelerometerManager,
    CONTROLLER_ACCELEROMETER_MOTION
} from "../input/accelerometer";

const CONTROLLER_LOW_GRAVITY = "Gesture:LowGravity";
const ACTION_LOW_GRAVITY_EXPIRE = "Gesture:LowGravity_EXPIRE";


const LowGravityDetector = (threshold) => {
    return (acc) => {
        const m2 = acc.x * acc.x + acc.y * acc.y + acc.z * acc.z;

        // If the mag squared of the accelerometer is below a threshold, return the acc values
        if (m2 < GRAVITY * GRAVITY * (threshold * threshold)) {
            LowGravityManager.commands.LowGravity(acc.x, acc.y, acc.z);
        }
    };
};

class LowGravityComponent extends Component {
    render() {
        const {debug, gravityEnabled, lowGravity} = this.props;
        const visibilityClass = lowGravity ? "visible" : "hidden";
        return <div>
            <div className={visibilityClass}>
                <div className="ribbon">LowGravity</div>
            </div>
            {gravityEnabled ? null : <button onClick={LowGravityManager.commands.LowGravity}>LowGravity</button>}

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
    lowGravity: false,
    gravityEnabled: false,
    debug: false,
};

const reducerManager = new ReducerManager({
    [CONTROLLER_LOW_GRAVITY]: (state, action) => {
        return {
            ...state,
            lowGravity: true,
        }
    },
    [ACTION_LOW_GRAVITY_EXPIRE]: (state, action) => {
        return {
            ...state,
            lowGravity: false
        }
    },
    [ACTION_ACCELEROMETER_ENABLED]: (state, action) => {
        return {
            ...state,
            gravityEnabled: action.value
        }
    }
}, defaultState);

const timeoutLowGravityExpire = null;

const LowGravityManager = {
    commands: {
        LowGravity: (x, y, z) => {
            LowGravityManager.dispatchEvent(CONTROLLER_LOW_GRAVITY, {x, y, z});
            LowGravityManager.dispatchUI(CONTROLLER_LOW_GRAVITY, {x, y, z});
            if (timeoutLowGravityExpire != null) {
                clearTimeout(timeoutLowGravityExpire);
            }
            setTimeout(() => {
                LowGravityManager.dispatchUIDirect(ACTION_LOW_GRAVITY_EXPIRE);
            }, 1250);
        },
        triggerOnThreshold(threshold) {
            AccelerometerManager.registerEventHandler(CONTROLLER_ACCELEROMETER_MOTION, HANDLER_GROUP_DEFAULT + ":LowGravity", LowGravityDetector(threshold));
        }
    }

};
Object.assign(LowGravityManager, new EventManager('Gesture - LowGravity', reducerManager));


const LowGravity = LowGravityManager.connect(LowGravityComponent, [CONTROLLER_LOW_GRAVITY, ACTION_ACCELEROMETER_ENABLED]);


export {LowGravity, LowGravityManager, CONTROLLER_LOW_GRAVITY};
