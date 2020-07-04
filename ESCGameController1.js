import React, {Component} from 'react';
import {Provider} from 'react-redux';
import logo from './images/esc-logo.png';
import {DebugNotifications} from './debug';
import {Screen} from './input/screen';
import {initializeStore} from "@esc_games/esc-react-redux";
import {/*TattooManager,*/ TattooDisplay, TattooSelector} from './controls';

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
            autoSizeEnabled = true,
            appModeEnabled = true,
        } = this.props;

        return (
            <Provider store={store}>
                <div id={"outerdiv"}>
                        < div id={"gofullscreen"} className={"gofullscreen"} style={{fontSize: "1em", position:"fixed", left:5, bottom:10}}>
                        ^<br/>^ <br/>^ Swipe<br/>^ Up<br/>^ Here<br/>^ To<br/>^ Go<br/>^ Full<br/>^ Screen<br/>
                        </div>
                    <div style={{zIndex:3}}>
                    <div id={controllerId} style={{position:"absolute", left:0, top:0, width:"100vw", height:"100vh", zIndex: 1}} >
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
                        <Screen desiredOrientation={desiredOrientation} autoSizeEnabled={autoSizeEnabled} appModeEnabled={appModeEnabled}/>
                    </div>
                        ^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>
                        ^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>
                        ^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>^<br/>
                    </div>
                </div>
            </Provider>
        );
    }
}

export {ESCGameController};