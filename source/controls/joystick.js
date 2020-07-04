import React, {Component} from 'react';
import { EventManager, ReducerManager } from '../';

var nipplejs = require('nipplejs');

const ACTION_JOYSTICK_MOTION = "Joystick:MOTION";
const CONTROLLER_JOYSTICK_MOTION = "Joystick:MOTION";
const SERVER_JOYSTICK_BY_ANGLE = "JoystickMotionByAngle";
const SERVER_JOYSTICK_ANGLE_FORCE = "JoystickMotionAngleForce";

class JoystickComponent extends Component {
    constructor(props) {
        super(props);
        this.joyRef = React.createRef();
        this.manager = null;
    }

    componentDidMount() {

        let options = {
            zone: this.joyRef.current,
            mode: 'semi',
            color: null
        };

        if(this.props.options) {
            options = {
                ...options,
                ...this.props.options,
            }
        }

        this.manager = nipplejs.create(options); // mode: 'semi', color: 'red'

        this.manager.on('added', function (evt, nipple) { // start move end dir plain


            nipple.on('start move end dir plain', function (evt, data) {
                const joystickData = {
                    identifier: evt.target.identifier,              // the identifier of the touch/mouse that triggered it
                    position: evt.target.position,
                    direction: evt.target.direction,
                    angle: data.angle,
                    force: data.force,
                    type: evt.type
                };

                if (joystickData.type === 'move') {
                    if (joystickData.angle != null && joystickData.force != null) {
                        JoystickManager.dispatchUI(ACTION_JOYSTICK_MOTION, joystickData);
                        JoystickManager.dispatchEvent(CONTROLLER_JOYSTICK_MOTION, joystickData);
                    }
                }

                if (joystickData.type === 'end') {
                    JoystickManager.dispatchUI(ACTION_JOYSTICK_MOTION, joystickData);
                    JoystickManager.dispatchEvent(CONTROLLER_JOYSTICK_MOTION, joystickData);
                }
            });
        }).on('removed', function (evt, nipple) {
            console.log("Joystick Motion removed");
            nipple.off('start move end dir plain');
        });
        //  this.props.managerListener(this.manager);
    }


    UNSAFE_componentWillMount() {
        JoystickManager.setReducerEnabled(ACTION_JOYSTICK_MOTION, true);

    }

    componentWillUnmount() {
        JoystickManager.setReducerEnabled(ACTION_JOYSTICK_MOTION, false);
    }


    render() {
        /* <pre>
                    {JSON.stringify(this.props, null, 2)}
                </pre>*/

        //{JSON.stringify(this.props, null, 2)}
        return (
            <div ref={this.joyRef} className={"joystick"} id={this.props.id}> </div>
        );
    }
}

JoystickComponent.defaultProps = {
    options: {
        /*mode: 'static',
        catchDistance: 150,
        color: 'red',*/
    },
};



const defaultState = {
    id: "Joystick " + Math.random(),
    /*x: 0.0,
    y: 0.0,
    springTension: 1.0,
    dummy: 5*/
};

const reducerManager = new ReducerManager({
    [ACTION_JOYSTICK_MOTION]: (state, action) => {
        return {
            ...state,
            ...action.value
        };
    }
}, defaultState);

const JoystickManager = new EventManager("Joystick", reducerManager);

const Joystick = JoystickManager.connect(JoystickComponent);



export {Joystick, JoystickManager, ACTION_JOYSTICK_MOTION, CONTROLLER_JOYSTICK_MOTION, SERVER_JOYSTICK_BY_ANGLE, SERVER_JOYSTICK_ANGLE_FORCE};