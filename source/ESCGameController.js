import React, {Component} from 'react';
import {Provider} from 'react-redux';
import logo from './images/esc-logo.png';
import {DebugNotifications} from './debug';
import {Screen} from './input/screen';
import {initializeStore} from "@esc_games/esc-react-redux";
import {/*TattooManager,*/ TattooDisplay, TattooSelector} from './controls';
import {frameRateMetrics} from "./metrics/frameRate";

window.frameRateMetrics = frameRateMetrics ;

const store = initializeStore({});

class ESCGameController extends Component {
    render() {
        const {
            controllerId = "controllerId",
            debug,
            game,
            includeESCLogo = true,
            includeTattooSelector = true,
            includeTattooDisplay = true,
            desiredOrientation = "landscape",
            iPhoneOrientation = false,
            androidOrientation = false,
            autoSizeEnabled = true,
            appModeEnabled = true,
            captureTouchEvents = true,
        } = this.props;


        // Note: z-index only works on positioned elements (position:absolute, position:relative, or position:fixed). Use one of those.
        // https://www.w3schools.com/cssref/pr_pos_z-index.asp

        return (
            <Provider store={store}>
                <div>
                    <div id={"scrollableDiv"} style={{fontSize: "20vmin", opacity:0.0, lineHeight: 0.7, visibility:"visible", width:"10%", position:"relative", zIndex:10}}>
                        E E E E E E E E E E E E E E E E E E E E E E E E E E E E<br/>
                    </div>
                    <div id={"gofullscreen"} className={"full-screen-hidden"}>
                        {String.fromCharCode(9757)}<br/>
                        {String.fromCharCode(9757)}<br/>
                        {String.fromCharCode(9757)}<br/>
                    </div>

                    <div id={controllerId} style={{position:"fixed", left:0, top:0, zIndex:1}} >
                        { /*
                            <div id={"viewableSymmetric"} style={{position:"absolute", zIndex:-1, left:0, top:0, bottom:0,right:0, touchAction:"none"}} >
                            </div>
                            <div id={"viewable"} style={{position:"absolute", zIndex:-1, left:0, top:0, bottom:0,right:0, touchAction:"none"}} >
                            </div>
                        */ }
                        { includeESCLogo ?
                            <header className="controller-header">
                                <img src={logo} className="App-logo" alt="logo" style={{background: "#000"}}/>
                            </header> : null
                        }
                        <div className={"controller-" + game}>
                            {this.props.children}
                            {includeTattooDisplay ?
                                <TattooDisplay/> : null}
                            {includeTattooSelector ?
                                <TattooSelector/> : null}
                            {debug ?
                                <div>
                                    <DebugNotifications/>
                                </div> : null}

                        </div>
                        <Screen
                            desiredOrientation={desiredOrientation}
                            iPhoneOrientation={iPhoneOrientation}
                            androidOrientation={androidOrientation}
                            autoSizeEnabled={autoSizeEnabled}
                            appModeEnabled={appModeEnabled}
                            captureTouchEvents={captureTouchEvents}
                        />
                    </div>
                </div>
            </Provider>
        );
    }
}

export {ESCGameController};