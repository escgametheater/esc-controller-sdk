import React, {Component} from "react";
import './debug.css';
import uuid from 'uuid';
import {EventManager, ReducerManager } from "@esc_games/esc-react-redux";

const ACTION_DEBUG_NOTIFY = "NOTIFY";
const ACTION_DEBUG_NOTIFY_EXPIRE = "ACTION_DEBUG_NOTIFY_EXPIRE";
const ACTION_DEBUG_NOTIFY_FADE = "ACTION_DEBUG_NOTIFY_FADE";

class DebugUI extends Component {
    render() {
        return <div>
            <pre>
                {this.props.notifications.map((alert, i) => {
                    // Return the element. Also pass key
                    return (<Alert key={alert.uuid} alert={alert}/>)
                })}
                {JSON.stringify(this.props, null, 2)}
            </pre>
        </div>
    };
}

class Alert extends Component {
    render() {
        const {uuid, message, top, left, timeout, createTime} = this.props.alert;
        const visibilityClass = createTime + timeout > new Date().getTime() - 300 ? "visible" : "hidden";
        return <div id={uuid}
                    className={"ribbon " + visibilityClass}
                    style={{top: top, left: left}}>{message}</div>;
    }
}

let defaultState = {
    notifications: []
};
const DebugManager = new EventManager("Debug", new ReducerManager({
    [ACTION_DEBUG_NOTIFY]: (state, action) => {
        return {
            ...state,
            notifications: [
                ...state.notifications,
                action.value
            ]
        };
    },
    [ACTION_DEBUG_NOTIFY_EXPIRE]: (state, action) => {
        return {
            ...state,
            notifications: [
                ...state.notifications.filter(value => value.uuid !== action.value),
            ]
        };
    }
}, defaultState));

DebugManager.commands = {
    notify: function (message, timeout, top, left) {
        let alertId = uuid();

        DebugManager.dispatchUI({
            type: ACTION_DEBUG_NOTIFY,
            value: {
                uuid: alertId,
                message: message,
                createTime: new Date().getTime(),
                timeout: timeout || 5000,
                top: top || "38%",
                left: left || "53%"
            }
        });

        setTimeout(() => {
            DebugManager.dispatchUI({type: ACTION_DEBUG_NOTIFY_EXPIRE, value: alertId});
        }, timeout);
    }
};

const DebugNotifications = DebugManager.connect(DebugUI);

export {DebugManager, DebugNotifications};