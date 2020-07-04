import React, {Component} from 'react';
import { ESCManager, EventManager, ReducerManager } from '../'

const CONTROLLER_ACCELEROMETER_MOTION = "AccelerometerInput:MOTION";
const ACTION_ACCELEROMETER_MOTION = "AccelerometerUI:MOTION";
const ACTION_ACCELEROMETER_ENABLED = "AccelerometerInput:ENABLED";
const SERVER_ACCELEROMETER_DATA = "AccelerometerData";

export const GRAVITY = 9.81 ;

let enabled = false;

let startTime = false ;
let lastTime = false ;
let count = 0 ;

const AccelerometerListener = function (e) {
    const nowMS = Date.now();
    if (!startTime) startTime = nowMS ;

    if (count) {
        const lastInterval = nowMS-lastTime ;
        // This could be one method of tracking performance issues -- if the lastInterval is ever significantly more than e.interval,
        // then something is amiss.

        // Some phones report interval in seconds, some in milliseconds.
        const interval = (e.interval < 1 ? 1000* e.interval : e.interval).toFixed(2) ;

        if (lastInterval > 1.5 * interval) {
            console.warn("Performance slow! devicemotion interval "+interval+" last "+ (nowMS - lastTime) + " total per second "+(count/(nowMS-startTime)*1000 ));
            // Send a report or an alert when in dev mode?
        }
    }
    count ++;
    lastTime = nowMS;

    // Some devices only have accelerationIncludingGravity, no gyro,
    // so try to only use accelerationIncludingGravity.
    const acc = e.accelerationIncludingGravity;

    if (acc && (acc.x != null)) {
        if (!enabled) {
            enabled = true;
            AccelerometerManager.dispatchUI(ACTION_ACCELEROMETER_ENABLED, enabled);
            console.log("AccelerometerInput is now available.", e);
        }
        AccelerometerManager.dispatchEvent(CONTROLLER_ACCELEROMETER_MOTION, acc);
        AccelerometerManager.dispatchUI(ACTION_ACCELEROMETER_MOTION,
            {
                acc,
                accInterval: e.interval
            }
        );
    }
    else {
        if (enabled === true) {
            console.log("AccelerometerInput not available on this device. Control with taps, swipes, or keyboard.");
            enabled = false;
            AccelerometerManager.dispatchUI(ACTION_ACCELEROMETER_ENABLED, enabled);
        }
    }
};

const reducerManager = new ReducerManager({
    [ACTION_ACCELEROMETER_MOTION]: (state, action) => {
        return {
            ...state,
            acc: action.value.acc,
        }
    },
    [ACTION_ACCELEROMETER_ENABLED]: (state, action) => {
        return {
            ...state,
            enabled: action.value,
        }
    }
});
const AccelerometerManager = new EventManager('Accelerometer', reducerManager);


class AccelerometerComponent extends Component {
    render() {
        const {acc, enabled} = this.props;
        return <div>
            <div>
                Accelerometer {enabled ? <span>Raw</span> : <span>Unavailable</span>}
                <pre>
                    {JSON.stringify(this.props, null, 2)}
                </pre>
            </div>
        </div>
    }
}

const Accelerometer = AccelerometerManager.connect(AccelerometerComponent, [ACTION_ACCELEROMETER_ENABLED, ACTION_ACCELEROMETER_MOTION]);

const DeviceMotion = {
    config: {
        thresh: 0.05,
        filterThresh: 0.01,
        fc: 0.75
    },
    filteredAcc: {
        x: 0,
        y: 0,
        z: 0
    },
    lastAcc: {
        x: 0,
        y: 0,
        z: 0
    },
    xyzDiff: function (a, b) {
        return {
            x: a.x - b.x,
            y: a.y - b.y,
            z: a.z - b.z
        };
    },
    /**
     * @return {number}
     */
    RoundToFraction: function (a, f) {
        return Math.round(a * f) / f;
    },
    accRound: function (a) {
        return DeviceMotion.RoundToFraction(a, 1024);
    },
    handle: function (acc) {
        if (!(acc && (acc.x != null))) {
            return;
        }

        let now = Date.now();
        let delta = DeviceMotion.xyzDiff(acc, DeviceMotion.lastAcc);

        let deltaTime = now - DeviceMotion.lastUpdateTime;
        
        
        let thresh = DeviceMotion.config.thresh;
        let filterThresh = DeviceMotion.config.filterThresh;
        let fc = DeviceMotion.config.fc;
        
        
        DeviceMotion.filteredAcc = {
            "x": DeviceMotion.filteredAcc.x * fc + (1 - fc) * acc.x,
            "y": DeviceMotion.filteredAcc.y * fc + (1 - fc) * acc.y,
            "z": DeviceMotion.filteredAcc.z * fc + (1 - fc) * acc.z
        };
        let filterDelta = DeviceMotion.xyzDiff(DeviceMotion.filteredAcc, DeviceMotion.lastAcc);
        let accChange = (delta.x > thresh) || (delta.x < -thresh) ||
            (delta.y > thresh) || (delta.y < -thresh) ||
            (delta.z > thresh) || (delta.z < -thresh);
        accChange = accChange || (filterDelta.x > filterThresh) || (filterDelta.x < -filterThresh) ||
            (filterDelta.y > filterThresh) || (filterDelta.y < -filterThresh) ||
            (filterDelta.z > filterThresh) || (filterDelta.z < -filterThresh);
        if (accChange || (deltaTime > 1000)) {
            acc = {
                x: DeviceMotion.accRound(acc.x),
                y: DeviceMotion.accRound(acc.y),
                z: DeviceMotion.accRound(acc.z)
            };
            DeviceMotion.lastUpdateTime = now;
            ESCManager.networking.sendCommand(SERVER_ACCELEROMETER_DATA, acc);
        }
    }
};

const init = () => {
    console.log("ESC Input: Registering AccelerometerInput");

    if (window.DeviceMotionEvent === undefined) {
        enabled = false;
        AccelerometerManager.dispatchUI(ACTION_ACCELEROMETER_ENABLED, false);
        // notify("AccelerometerInput not available on this device. Control with buttons, swipes, or keys.",3000,"25%","25%");
        console.log("AccelerometerInput not available on this device. Control with buttons, swipes, or keys.")
    }
    else {
        console.log("window.DeviceMotionEvent available.");
        window.ondevicemotion = AccelerometerListener;
    }
};
init();

const DefaultDeviceMotionHandler = DeviceMotion.handle;

export {
    Accelerometer,
    AccelerometerManager,
    DeviceMotion,
    DefaultDeviceMotionHandler,
    CONTROLLER_ACCELEROMETER_MOTION,
    ACTION_ACCELEROMETER_MOTION,
    ACTION_ACCELEROMETER_ENABLED
};