import React, {Component} from 'react';
import {ESCManager, ReducerManager, EventManager, HANDLER_GROUP_DEFAULT} from '../';
import {ShakeManager} from '../gestures/shake';
import {DebugManager} from "../debug/debug";
import escLogo from '../images/esc-games-logo.svg';

let tattooIndex = "";
let tattooColor = "";
let initialized = false;

const SERVER_SELECT_TATTOO = "SelectTattoo";
const CONTROLLER_SELECT_TATTOO = "SelectTattoo";
const ACTION_SELECT_TATTOO = "ESC:TattooUpdated";


function selectTattoo(tattoo) {
    tattooIndex = tattoo;
    TattooManager.commands.selectTattoo(
        tattooIndex,
        tattooColor
    );
}

function selectColor(color) {
    tattooColor = color;
    TattooManager.commands.selectTattoo(
        tattooIndex,
        tattooColor
    );
}


function importAll(r) {
    let images = {};
    r.keys().map((item, index) => {
        images[item.replace('./', '')] = r(item);
    });
    return images;
}

const images = importAll(require.context('../images/tattoos/', false, /\.(png|jpe?g|svg)$/));


const colors = ["#F44336", "#E91E63", "#9C27B0", "#673AB7", "#3F51B5", "#2196F3",
    "#03A9F4", "#00BCD4", "#009688", "#4CAF50", "#8BC34A", "#CDDC39",
    "#FFEB3B", "#FFC107", "#FF9800", "#FF5722", "#795548", "#9E9E9E",
    "#607D8B", "#000000"];

//****************************************************************************************\\
// Custom touch-and-hold scrolling
//
// Touch-and-hold to scroll down, then at the bottom you can touch again to start again from the top.
//
// With normal swipe to scroll it is difficult to stop the body from getting scrolled or pulled
// when at the top of the scroll. I couldn't get overscrollBehavior to work well.
// Also, the scrolling orientation was wrong when rotated -- horizontal was swapped with vertical.
// So I implemented a custom scrolling UI.
// I could have duplicated the normal swipe to scroll, but I decided to try something a little different.

// Keep track of the elements that are being touch-scrolled
let Touching = {} ;
let TouchInterval = {} ;
let ScrolledToBottom = {} ;

const ScrollSpeed = 0.1 ; // Fraction of client height per step
const StartupSteps = 40 ; // Number of steps at a slower speed
const StartupSpeed = ScrollSpeed/3 ;
const StepInterval = 50 ; // milliseconds between steps
const InitialDelay = 100 ; // milliseconds delay before first step

const TattooAndColorSelectStyle = {
    width: "20em",
    height: "10em",
    clear: "both"
};

// This is where the magic happens
const TouchStartHandler = (e) => {
    // The only thing we need to know about the event is the current target
    // Copy it so it's in the setTimeout scope.
    let currentTarget = e.currentTarget ;
    Touching[currentTarget] = true ;
    // Keep track of the scroll point -- when the scroll point doesn't change by the amount we are scrolling,
    // we know we've reached the bottom.
    let currentScrollTop = currentTarget.scrollTop ;

    const scrollStep = currentTarget.clientHeight * ScrollSpeed ;
    const startupStep = currentTarget.clientHeight * StartupSpeed ;
    let steps = 0 ;

    setTimeout(() => {
        if (Touching[currentTarget]) {
            TouchInterval[currentTarget] = setInterval(()=> {
                if (Touching[currentTarget]) {
                    if (ScrolledToBottom[currentTarget]) {
                        currentTarget.scrollTo(0,0);
                        ScrolledToBottom[currentTarget] = false ;
                        currentScrollTop = 0 ;
                    }
                    const thisStep = Math.floor(steps < StartupSteps ? startupStep : scrollStep) ;
                    currentTarget.scrollBy(0,thisStep);
                    steps ++ ;
                    //console.log(`steps ${steps} currentScrollTop ${currentScrollTop} scrolltop ${currentTarget.scrollTop} clientheight ${currentTarget.clientHeight}`);
                    let newScrollTop = currentTarget.scrollTop ;
                    if (newScrollTop - currentScrollTop < thisStep) {
                        clearInterval(TouchInterval[currentTarget]);
                        ScrolledToBottom[currentTarget] = true ;
                    }
                    else {
                        ScrolledToBottom[currentTarget] = false ;
                    }
                    currentScrollTop = newScrollTop ;
                }
                else {
                    clearInterval(TouchInterval[currentTarget]);
                }
            },StepInterval);
        }
    },InitialDelay);
};

const TouchEndHandler = (e) => {
    if (TouchInterval[e.currentTarget])
        clearInterval(TouchInterval[e.currentTarget]);
    Touching[e.currentTarget] = false ;
};

const AddEventListeners = (el) => {
    // TODO: figure out how to scroll manually?
    el.addEventListener("touchstart", TouchStartHandler, false);
    el.addEventListener("mousedown", TouchStartHandler, false); // Mouse events allow testing on laptop browser
    el.addEventListener("touchend", TouchEndHandler, false);
    el.addEventListener("mouseup", TouchEndHandler, false);
    el.addEventListener("touchcancel", TouchEndHandler, false);
    //el.style.overscrollBehavior = "none";
};
class TattooSelectorComponent extends Component {
    componentDidMount() {
        AddEventListeners(document.getElementById("tattooSelect"));
        AddEventListeners(document.getElementById("colorSelect"));
    }

    render() {
        const {tattooColor, tattooIndex} = this.props;


        const tattooSelectStyle = {
            width: "50%",
            height: "100%",
            overflowY: "scroll",
            background: tattooColor,
            float: "left",
        };

        const colorSelectStyle = {
            width: "50%",
            height: "100%",
            overflowY: "scroll",
            float: "left",
        };

        return <div id={"tattooAndColorSelect"} style={TattooAndColorSelectStyle}>
            <div id={"tattooSelect"} style={tattooSelectStyle}>
                {[...Array(200)].map((x, i) => {
                    return <Tattoo key={i} tattoo={i + 1} tattooIndex={tattooIndex}/>
                })}
            </div>
            <div id={"colorSelect"} style={colorSelectStyle}>
                {colors.map((color, i) => {
                    return <Color key={i} color={color} tattooColor={tattooColor}/>
                })}
            </div>
        </div>
    }
}

class Color extends Component {
    render() {
        const {color, tattooColor} = this.props;

        const style = {
            float: "left",
            background: color
        };

        return <div id={"ColorSelect-" + color}
                    style={style}
                    className="tattooSize"
                    onClick={() => selectColor(color)}>
        </div>
    }
}

class Tattoo extends Component {
    render() {
        const {id, tattoo, tattooIndex} = this.props;

        const style = {
            float: "left",
        };
        if (tattoo === tattooIndex) {
            style.boxShadow = "inset 0 0 0 1px white";
        }

        const tattooNumber = (tattoo < 10 ? "00" : (tattoo < 100) ? "0" : "") + tattoo;

        const imageName = "Toy_Box_Tattoos-" + tattooNumber + ".png";

        return <div id={"Toy_Box_Tattoos-" + tattoo}
                    style={style}
                    className="tattooSize"
                    onClick={() => selectTattoo(tattoo)}>
            <img src={images[imageName]} width="100%" height="100%"/>
        </div>
    }
}

class TattooDisplayComponent extends Component {
    render() {
        const {tattooColor, tattooIndex} = this.props;

        const tattooDisplayStyle = {
            background: tattooColor
        };

        return <div id={"tattooDisplay"} style={tattooDisplayStyle} className="tattooSize" onClick={ShakeManager.commands.shake}>
            <Tattoo tattoo={tattooIndex}/>
        </div>
    }
}

class TattooBarComponent extends Component {
    render() {
        // Display Tattoo if it has been initialized by the server.
        const tattooDisplay = initialized ? (<TattooDisplay/>) : "" ;
        
        return (
            <div className="tattooBarContainer">
                <img src ={escLogo} alt="ESC Logo" className="escLogo" />
                <div className="spacer"/>
                <div className="tattooBar">
                    {tattooDisplay}
                </div>
            </div>
        );
    }
}

const defaultState = {
    tattooIndex: 1,
    tattooColor: colors[0]
};
const TattooManager = new EventManager("Tattoo", new ReducerManager({
    [ACTION_SELECT_TATTOO]: (state, action) => {
        initialized = true;
        return {
            ...state,
            tattooIndex: action.value.tattooIndex || state.tattooIndex,
            tattooColor: action.value.tattooColor || state.tattooColor,
        }
    },
}, defaultState));

TattooManager.commands = {
    selectTattoo(tattooIndex, tattooColor) {
        TattooManager.dispatchUI(ACTION_SELECT_TATTOO, {
            tattooIndex,
            tattooColor,
        });
        TattooManager.dispatchEvent(CONTROLLER_SELECT_TATTOO, {tattooIndex, tattooColor});
    },
    getTattoo() {
        return {
            tattooIndex: tattooIndex,
            tattooColor: tattooColor
        }
    }
};


ESCManager.networking.registerEventHandler(SERVER_SELECT_TATTOO, HANDLER_GROUP_DEFAULT, (message) => {
    TattooManager.dispatchUI(ACTION_SELECT_TATTOO, message);
});

const TattooSelector = TattooManager.connect(TattooSelectorComponent, [ACTION_SELECT_TATTOO]);
const TattooDisplay = TattooManager.connect(TattooDisplayComponent, [ACTION_SELECT_TATTOO]);
const TattooBar = TattooManager.connect(TattooBarComponent, [ACTION_SELECT_TATTOO]);

export {TattooManager, TattooSelector, TattooDisplay, TattooBar, ACTION_SELECT_TATTOO, SERVER_SELECT_TATTOO, CONTROLLER_SELECT_TATTOO};
