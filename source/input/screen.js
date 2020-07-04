import React, {Component} from 'react';
import NoSleep from 'nosleep.js/dist/NoSleep';

import {EventManager, ReducerManager} from '../'

// https://github.com/richtr/NoSleep.js/blob/master/README.md
const noSleep = new NoSleep();
function enableNoSleep(e) {
    // If event that calls this is not "trusted" (initiated by the user) then there will be an error and the app may
    // crash.
    if (e.isTrusted) {
        noSleep.enable();
        console.log("noSleep enabled!");
        document.removeEventListener('click', enableNoSleep, false);
    }
}
// Enable wake lock.
// (must be wrapped in a user input event handler e.g. a mouse or touch handler)
// The user will usually be expected to click a button to join
document.addEventListener('click', enableNoSleep, false);

const ACTION_SCREEN_ORIENTATION = "ScreenInput:ORIENTATION";
const CONTROLLER_SCREEN_ORIENTATION = "ScreenInput:ORIENTATION";

// For Chrome: To control the screen size and prevent the browser from zooming when rotating, set the viewport header to
// prevent scaling, like so:
// <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no">
// Doesn't work in Safari since iOS 10 :(

let escScreen = {
    DesiredOrientation: "landscape",
    DesiredPrimarySecondary: false,
    AutoSizeEnabled: true,
    AppModeEnabled: true,
    DEBUG: false
};
window.escScreen = escScreen ;
window.esc.getScreen = function() {
    return escScreen ;
};

let controllerElem  ;

const isAndroid = navigator.userAgent.toLowerCase().indexOf("android") > -1;
const iPhone = /iPhone/.test(navigator.userAgent) && !window.MSStream;
const isChromeiOS = /CriOS/.test(navigator.userAgent) ;
const isSamsungBrowser = navigator.userAgent.toLowerCase().indexOf("samsungbrowser") > -1;
const isChromeAndroid = navigator.userAgent.toLowerCase().indexOf("chrome") > -1 && ! isSamsungBrowser ;
const isChrome = isChromeiOS || isChromeAndroid ;
// In US:
// Top 2 mobile browsers: Safari, ChromeAndroid
// Next tier: Chrome on iOS, SamsungBrowser
// Amazon silk next

let ScreenOffsets = {
    viewable: {},
    viewableRotated: {}
};

const screenOrientationIOS = () => {
    switch (window.orientation) {
        case 0:
            return "portrait-primary";
        case 180:
            return "portrait-secondary";
        case -90:
            return "landscape-primary";
        case 90:
            return "landscape-secondary";
    }
    return "undefined";
};

let Touching = false ;

let TouchStartEvent = {};

let StartTouchesById = {};

let FirstTouch = false;

let LastTouch = {};

let Rotation = 0 ;

let Rotated180 = false ;
let Rotated0 = false ;

function copyTouch(touch) {
    return {
        identifier: touch.identifier,
        screenX: touch.screenX,
        screenY: touch.screenY,
        clientX: touch.clientX,
        clientY: touch.clientY,
    };
}


const TouchStartListener = function (e) {
    if (!escScreen.AppModeEnabled)
        return ;

    if (isAndroid) {
        const gfs = document.getElementById("gofullscreen");
        gfs.innerHTML = "d " + (e.changedTouches[0].screenY - e.changedTouches[0].clientY);
    }

    Touching = true ;
    setFullScreenVisibility();
    TouchStartEvent = Object.assign(TouchStartEvent,e) ;
    if (!FirstTouch) {
        FirstTouch =  copyTouch(e.changedTouches[0]) ;
        FirstTouch.wasFullScreen = IsFullScreen();
    }
    for (let i = 0 ; i < e.changedTouches.length ; i++) {
        const t = e.changedTouches[i];
        StartTouchesById[t.identifier] = copyTouch(t) ;

        StartTouchesById[t.identifier].wasFullScreen = IsFullScreen();
        LastTouch = copyTouch(t);
    }
    if (e.changedTouches[0].screenX < 50)
        return ;
    //e.preventDefault();
};

const IsFullScreen =  () => {
    return (GetHeightDifference() < 50);
};

let FullScreenVisibility = 'unknown' ;

const setFullScreenVisibility = (v) => {
    v = v || IsFullScreen() ? 'hidden' :  'visible' ;
    const vnot = (v === 'hidden') ? 'visible' : 'hidden' ;
    if (FullScreenVisibility === v) {
        // Shouldn't return if there are new elements added dynamically
        //return ;
    }
    const fullScreenHiddenElems = document.getElementsByClassName('full-screen-hidden');
    for (let i = 0; i < fullScreenHiddenElems.length; i ++) {
        fullScreenHiddenElems[i].style.visibility = v;
    }
    const fullScreenVisibleElems = document.getElementsByClassName('full-screen-visible');
    for (let i = 0; i < fullScreenVisibleElems.length; i ++) {
        fullScreenVisibleElems[i].style.visibility = vnot;
    }
    FullScreenVisibility = v;
};

const GetElementUnderTouch = e => {
    let el = document.elementFromPoint(e.changedTouches[0].clientX,e.changedTouches[0].clientY);
    //setDebug(el.toString() + " " + el.id);
    return el ;
};

const TouchMoveListener = function (e) {
    if (!escScreen.AppModeEnabled)
        return ;

    // Strange behaviour when the user swipes up then down if there's no preventDefault
    // -- the Y value stops increasing around 12 pixels before the initial touch.
    Touching = true ;
    LastTouch = copyTouch(e.changedTouches[0]);
    LastTouch.LeftEdge = false ;

    setFullScreenVisibility();

    // Only allow swipes on the left side of the screen
    if (e.touches.length === 1) {
        if (e.changedTouches[0].screenX < 50) {
            LastTouch.LeftEdge = true ;
            return ;
        }
    }
    // Prevent zooming, swipes
    e.preventDefault();
};
const TouchCancelListener = function (e) {
    Touching = false ;
    for (let i = 0 ; i < e.changedTouches.length ; i++) {
        const t = e.changedTouches[i];
        delete StartTouchesById[t.identifier];
    }
    if (e.touches.length === 0) {
        FirstTouch = false;
    }
    if (!escScreen.AppModeEnabled)
        return ;
    e.preventDefault();
};


const elsToNotPreventDefaultOn = {
    'button': 1,
    'select': 1,
    'input': 1,
    'textarea': 1,
};
/**
 * Determines if `preventDefault` should be called on the event, by element
 * @param  {Element}
 * @return {Boolean}
 */
const shouldPreventDefaultOnEl = (el) => el && !elsToNotPreventDefaultOn[el.tagName.toLowerCase()];

// let lastTouchEnd = 0;
const TouchEndListener = function (e) {
    if (e.touches.length === 0) {
        setTimeout(()=>{
            Touching = false ;
            AutoSize();
            // Sometimes the zooming isn't complete so call AutoSize again after a bit.
            setTimeout(()=>{
                AutoSize();
            },100);
        },100);
        FirstTouch = false ;
    }
    for (let i = 0 ; i < e.changedTouches.length ; i++) {
        const t = e.changedTouches[i];
        delete StartTouchesById[t.identifier];
    }
    if (!escScreen.AppModeEnabled)
        return ;


    // preventDefault in a touchend handler stops iOS Safari double-tap zoom.
//    if (iPhone) {
        if (e.changedTouches[0].screenX >= 50) {
            let elem = GetElementUnderTouch(e) ;
            console.log("TouchEndListener, GetElementUnderTouch returned ", elem);

            if (shouldPreventDefaultOnEl(elem)) {
                e.preventDefault();
                // preventDefault prevents clicks from getting sent, so we trigger to the original target,
                // But, we have to make sure that the touch was still over the target, and that the target is click-able
                if (e.target === elem) {
                    if (e.target === document) {
                        // Call enabledNoSleep directly so it is trusted
                        enableNoSleep(e);
                    }
                    if (e.target.click) {
                        e.target.click();
                    }
                }
            }           
        }
//    }



    /*
    //One way of preventing iOS double-tap zoom, but it restricts clicks to once every 300 ms
    var now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    else {
        lastTouchEnd = now;
    }*/

};

const setDebug = s => {
    if (!escScreen.DEBUG) return ;
    const debugElem = document.getElementById("screendebug");
    debugElem.innerHTML = s ;
};

const GetScreenOrientation = () => {
    if (isMobile()) {
        const orientation = window.screen.msOrientation || (window.screen.orientation || window.screen.mozOrientation || {}).type || screenOrientationIOS();
        if (orientation) {
            return orientation ;
        }
    }
    const cw = document.documentElement.clientWidth ;
    const ch = document.documentElement.clientHeight ;
    if (ch >= cw) {
        return "portrait-primary";
    }
    if (escScreen.DesiredPrimarySecondary === "secondary") {
        return "landscape-secondary";
    }
    return "landscape-primary";
};

const ScreenSizeListener = function (e) {
    //console.log("ScreenSizeListener");

    if (window.esc && window.esc.skipAutoSize) {
        return;
    }

    const clientWidth = document.documentElement.clientWidth;
    const clientHeight =  document.documentElement.clientHeight;
    //const clientTop = document.documentElement.clientTop ;
    //const clientLeft = document.documentElement.clientLeft ;
    const screenWidth =window.screen.width;
    const screenHeight =window.screen.height;
    const screenOrientation = GetScreenOrientation();

    if (screenOrientation === "undefined") {
        console.log("Screen orientation undefined. window.screen is ",window.screen)
    }
    const newRotation = AutoRotate();
    AutoSize();
    setTimeout(()=>{
        AutoSize();
    },100);
    setTimeout(()=>{
        AutoSize();
    },200);


    const message = {
        screenOrientation,
        clientHeight,
        clientWidth,
        screenWidth,
        screenHeight,
    };


    //console.log("Screen message",message);
    ScreenManager.dispatchUI(ACTION_SCREEN_ORIENTATION, message);
    ScreenManager.dispatchEvent(CONTROLLER_SCREEN_ORIENTATION, message);
    //ScreenManager.dispatchUI(ACTION_SCREEN_ORIENTATION, message);
};


function transformMatrixString(a,b,c,d,e,f) {
    return "matrix(" + a + "," + b + "," + c + "," + d + "," + e + "," + f + ")";
}

function getScreenRotationTransform(dir,vw,vh) {
    const vwvh2 = (vw-vh)/2;
    const mstring = transformMatrixString(0,-dir,dir,0,vwvh2,-vwvh2);
    //console.log(mstring);
    return transformMatrixString(0,-dir,dir,0,vwvh2,-vwvh2);
//    return transformMatrixString(0,-dir,dir,0,0,0);
}

const getMyState =  () => {
    return ScreenManager.store.getState()[ScreenManager.managerName];
};

let AutoRotateOrientation = "" ;
let AutoRotateScreenDesiredOrientation = "";
let AutoRotateDesiredPrimarySecondary = "";

const AutoRotate = (sendDispatch) => {
    const orientation = GetScreenOrientation() ;

    if (orientation === AutoRotateOrientation &&
        escScreen.DesiredPrimarySecondary === AutoRotateDesiredPrimarySecondary &&
        escScreen.DesiredOrientation === AutoRotateScreenDesiredOrientation
    ) {
        return ;
    }
    AutoRotateOrientation = orientation ;
    AutoRotateScreenDesiredOrientation = escScreen.DesiredOrientation ;
    AutoRotateDesiredPrimarySecondary = escScreen.DesiredPrimarySecondary ;

    AutoSize();

    const state = getMyState() ;
    const newRotation = state.screen? {
        rotationDirection: state.screen.rotationDirection,
        rotated0: state.screen.rotated0,
        rotated180: state.screen.rotated180
    } : {} ;

    if (escScreen.DesiredOrientation !== "landscape" && escScreen.DesiredOrientation !== "portrait" ) {
        console.log(`DesiredOrientation:"${escScreen.DesiredOrientation}"`);
        return ;
    }

    // lastDesiredOrientation is the full orientation (including primary or secondary)
    // from the last time we were in the desired orientation
    let lastDesiredOrientation = state? state.lastDesiredOrientation : "" ;
    if (escScreen.DesiredPrimarySecondary) {
        lastDesiredOrientation = escScreen.DesiredOrientation + "-" + escScreen.DesiredPrimarySecondary ;
    }

    const orientationSplit = orientation.split("-");
    //const controllerElem = getControllerElem();
    if (controllerElem == null)
        return ;

    if (orientationSplit[0] !== escScreen.DesiredOrientation) {
        // figure out if we should rotate clockwise or counterclockwise to rotate between portrait and landscape
        // Goal is to keep the same orientation as before or desired
        let dir = 1 ;
        if (orientation === "portrait-primary" && lastDesiredOrientation === "landscape-secondary" ) {
            dir = -1 ;
        }
        else if (orientation === "portrait-secondary" && lastDesiredOrientation === "landscape-primary" ) {
            dir = -1 ;
        }
        else if (orientation === "landscape-secondary" && lastDesiredOrientation === "portrait-secondary" ) {
            dir = -1 ;
        }
        else if (orientation === "landscape-primary" && lastDesiredOrientation === "portrait-primary" ) {
            dir = -1 ;
        }
        if (isAndroid)
            dir = -dir ;
        controllerElem.style.transform = getScreenRotationTransform(dir,controllerElem.offsetHeight,controllerElem.offsetWidth);

        newRotation.rotationDirection = dir ;
        newRotation.rotated180 = false ;
        newRotation.rotated0 = false ;
    }
    else {
        if (!escScreen.DesiredPrimarySecondary || lastDesiredOrientation === orientation) {
            if (state.screen && state.screen.rotated180) {
                controllerElem.style.transform = "none";
            }
            else {
                controllerElem.style.transform = "none";
            }
            newRotation.rotationDirection = 0 ;
            newRotation.rotated180 = false ;
            newRotation.rotated0 = true ;
        }
        else {
            if (state.screen && state.screen.rotated0) {
                controllerElem.style.transform = "rotate(-180deg)";
            }
            else {
                controllerElem.style.transform = "rotate(180deg)";
            }
            newRotation.rotationDirection = 0 ;
            newRotation.rotated180 = true ;
            newRotation.rotated0 = false ;
        }
    }

    if (!state.screen || state.screen.rotationDirection !== newRotation.rotationDirection
        || state.screen.rotated180 !== newRotation.rotated180
        || state.screen.rotated0 !== newRotation.rotated0
    ) {
        console.log("new rotation: ",newRotation, state);
        if (state.screen) {
            ScreenManager.dispatchUI(ACTION_SCREEN_ORIENTATION, {...state.screen,...newRotation});
        }

        return newRotation ;
    }
    return {};
};

function transitionend180Listener() {
    controllerElem.style.transition = "transform 0s";
    controllerElem.style.transform = "rotate(180deg)";
    AutoSize();
    controllerElem.removeEventListener("transitionend",transitionend180Listener,false);
}
function transitionend0Listener() {
    controllerElem.style.transition = "transform 0s";
    controllerElem.style.transform = "rotate(0deg)";
    AutoSize();
    controllerElem.removeEventListener("transitionend",transitionend0Listener,false);
}

const GetZoom = () => {
    // Detect zoom level by seeing if clientHeight/Width match innerHeight/Width, and scale if not
    // On Safari, at least, innerHeight/Width changes with zoom
    const ih = window.innerHeight;
    const iw = window.innerWidth;
    const ch = document.documentElement.clientHeight;
    const cw = document.documentElement.clientWidth;
    // Compare widths, so address bar, etc., not included
    // Make sure that we're comparing against the right dimension
    const c = (iw > ih) ? Math.max(cw, ch) : Math.min(cw, ch);
    return c / iw;
};

const GetHeightDifference = () => {
    //const ch = document.documentElement.clientHeight;
    //const cw = document.documentElement.clientWidth;
    const ih = window.innerHeight ;
    const iw = window.innerWidth ;
    const sh = window.screen.height ;
    const sw = window.screen.width ;

    // clientHeight doesn't change on iOS Safari between full screen and not - so we use innerHeight
    // Inner height changes when phone is (d.
    // Screen height doesn't (possibly depends on phone -- it does vary on chrome simulator)
    // Determine whether we want screen height or width
    const s = (ih > iw) ? Math.max(sh,sw) : Math.min(sh,sw);

    return s - ih*GetZoom() ;
};
const GetWidthDifference = () => {
    const ih = window.innerHeight ;
    const iw = window.innerWidth ;
    const sh = window.screen.height ;
    const sw = window.screen.width ;
    const s = (iw > ih) ? Math.max(sh,sw) : Math.min(sh,sw);

    return s - iw ;

};

let AutoSizeTimeout = null ;

let AndroidNavBarHeight = 42 ; // Height of the Nav Bar in Chrome on Android. It can vary. We can figure it out exactly if user rotates his phone
let iOSNavBarHeight = 40 ;

const AndroidAdjustSizeForNavBar = true ; // reduce controller size to account for android nav bar
// It seems more natural on Android not to consider the navbar as part of the screen, as it can't be hidden.
// However, that means if the phone is rotated 180 degrees from one landscape orientation to the other,
// the controller image will shift because the nav bar changes sides (it seems to always be on the right side, though that could depend on the phone's os)

const isMobile = () => {
    const cw = document.documentElement.clientWidth ;
    const sw = window.screen.width ;
    return cw >= sw  || isAndroid || iPhone;
};

const AutoSize = () => {
    // Allow dynamic disabling of autosize
    if (window.esc && window.esc.skipAutoSize) {
        return;
    }

    if (!escScreen.AutoSizeEnabled) {
        return ;
    }
    // Make the controllerElem the exact size of the screen, adjusting for zoom

    if (Touching) {
        if (AutoSizeTimeout) {
            clearTimeout(AutoSizeTimeout);
        }
        AutoSizeTimeout=setTimeout(AutoSize,10);
        return ;
    }

    //const controllerElem = getControllerElem();

    //let h = document.body.offsetHeight ;
    //let w = document.body.offsetWidth ;
    const ch = document.documentElement.clientHeight ;
    const cw = document.documentElement.clientWidth ;
    const cmax = Math.max(ch,cw);
    const cmin = Math.min(ch,cw);

    let sh = window.screen.height ;
    let sw = window.screen.width ;

    ScreenOffsets.viewable = {top:0,left:0,right:0,bottom:0} ;

    // iPhone X fix
    if (iPhone && sw === 375 && sh === 812 && window.devicePixelRatio === 3) {
        // Let's not count the curved portion of the iPhone X screen.
        sh = sh - 80;
    }

    if (isAndroid) {
        // In android phones, I know of no way to hide the nav bar from javascript
        // So we have to subtract it from the bottom or right of the screen.
        // Some users or phones might have different nav bars, so there is no guarantee where it is
        if (sw > sh) {
            AndroidNavBarHeight = sw - window.innerWidth ;
            if (AndroidAdjustSizeForNavBar) sw = sw - AndroidNavBarHeight ;
        }
        else {
            if (AndroidAdjustSizeForNavBar) sh = sh - AndroidNavBarHeight ;
        }

        if (escScreen.DesiredOrientation === "landscape")  {
            const navbar = AndroidAdjustSizeForNavBar ? 0 : AndroidNavBarHeight  ;
            if (sh >= sw) {
                // In landscape, held in portrait
                ScreenOffsets.viewable.top = sh - window.innerHeight - navbar ;
                ScreenOffsets.viewable.bottom = navbar ;
            }
            else {
                ScreenOffsets.viewable.top = (sh - window.innerHeight) ;
                ScreenOffsets.viewable.right = navbar ;
            }
        } else {
            // TODO: android portrait mode
        }
    }
    else if (iPhone) {
        if (escScreen.DesiredOrientation === "landscape") {
            if (Rotation !== 0) {
                ScreenOffsets.viewable.top = GetHeightDifference();
                if (!IsFullScreen() && !isChrome) {
                    ScreenOffsets.viewable.bottom = iOSNavBarHeight ;
                    ScreenOffsets.viewable.top = ScreenOffsets.viewable.top - ScreenOffsets.viewable.bottom ;
                }
            } else {
                ScreenOffsets.viewable.top = GetHeightDifference();
//                ScreenOffsets.viewable.top = GetHeightDifference();
            }
        } else {
            // TODO: iPhone portrait mode
        }
    }


    //let h = isMobile ? action.value.screenHeight : action.value.clientHeight ;
    //let w = isMobile ? action.value.screenWidth  : action.value.clientWidth ;
    let h = isMobile() ? sh : ch ;
    let w = isMobile() ? sw : cw ;

    // Swap to match desired orientation
    if ((escScreen.DesiredOrientation.toString() === "portrait") && w > h || escScreen.DesiredOrientation === "landscape" && h > w ) {
        let t = w ;
        w = h ;
        h = t ;
    }
    let zoom = 1 ;
    // On mobile safari, normal methods to prevent user zooming do not work since iOS 10.
    // Also, on Mobile Safari, rotating from portrait to landscape will zoom
    if (iPhone) {
        zoom = GetZoom();
        if (zoom !== 1) {
            w /= zoom ;
            h /= zoom ;
            w = Math.ceil(w);
            h = Math.ceil(h);
        }
    }

    // fix font size to a fraction of the controller
    const contentAspectRatio = 3/2;
    const effectiveWidth = Math.min(w,h*contentAspectRatio);

    document.body.style.fontSize = `${effectiveWidth/50}px`;
    setDebug("Dimensions "+w+"x"+h+"<br/>effective width:" +effectiveWidth +"<br/>fontSize: "+ document.body.style.fontSize);

    // did not work on safari:
    //let viewport = document.querySelector('meta[name="viewport"]');
    //if ( viewport ) {
    //    viewport.content = "initial-scale=1";
    //    viewport.content = 'width=device-width';
    //}


    controllerElem.style.fontSize = "100%";

    if (iPhone && !isChromeiOS || true) {
        const rect = controllerElem.getBoundingClientRect();
        AutoSize.iPhoneVerticalCorrection = AutoSize.iPhoneVerticalCorrection || 0 ;
        const newVerticalCorrection = controllerElem.offsetTop - rect.top ;
        if (Math.abs(newVerticalCorrection - AutoSize.iPhoneVerticalCorrection) > 5) {
            AutoSize.iPhoneVerticalCorrection = newVerticalCorrection;
        }
        else {
            const filterK = 0.5;
            AutoSize.iPhoneVerticalCorrection = filterK * AutoSize.iPhoneVerticalCorrection + (1-filterK)*newVerticalCorrection;
        }
        controllerElem.style.top = "" + Math.round( - ScreenOffsets.viewable.top/zoom + AutoSize.iPhoneVerticalCorrection) + "px";
        controllerElem.style.left = "" + Math.round( -ScreenOffsets.viewable.left/zoom) + "px";
        //controllerElem.style.top = "" + Math.round( controllerElem.offsetTop - ScreenOffsets.viewable.top/zoom - rect.top ) + "px";

        const verbose = false ;
        if (verbose) {
            setDebug("z " + zoom +
                "<br>style.top "+ controllerElem.style.top +
                "<br>controllerElem.offsetTop " + controllerElem.offsetTop +
                "<br>ScreenOffsets.top " + ScreenOffsets.viewable.top +
                "<br>rec.top "+ rect.top +
                "<br>heightDifference " + GetHeightDifference()
            );
            console.log({
                zoom,
                "controllerElem.style.top":controllerElem.style.top,
                "controllerElem.offsetTop":controllerElem.offsetTop,
                "ScreenOffsets.viewable.top":ScreenOffsets.viewable.top,
                "rect.top":rect.top,
                "heightDifference":GetHeightDifference()
            });
        }

    }
    else {
        controllerElem.style.top = "" + (- ScreenOffsets.viewable.top) + "px";
        controllerElem.style.left = "" + (- ScreenOffsets.viewable.left) + "px";
    }

    //const el = document.body ;
    //console.log("AutoSize "+w+"x"+h,controllerElem.style);

    // Border width and background color only for testing
    const borderWidth = escScreen.DEBUG ? 2 : 0 ;


    controllerElem.style.width = "" + (w-borderWidth*2)  + "px";
    controllerElem.style.height = "" + (h-borderWidth*2) + "px" ;

    //setDebug( "s " + w + "x" + h + " top " + controllerElem.style.top + " left " + controllerElem.style.left + " navbar " + AndroidNavBarHeight + "<br/>" + "t " + ScreenOffsets.viewable.top + " l " + ScreenOffsets.viewable.left + " b " + ScreenOffsets.viewable.bottom + " r " + ScreenOffsets.viewable.right);

    //controllerElem.style.backgroundColor = "yellow" ;
    controllerElem.style.border = "solid red "+borderWidth + "px";

    // use getBoundingClientRect() ?

    ScreenOffsets.viewableRotated = {
        top: ScreenOffsets.viewable.top ,
        left: ScreenOffsets.viewable.left ,
        bottom: ScreenOffsets.viewable.bottom ,
        right: ScreenOffsets.viewable.right,
    };
    if (Rotation > 0) {
        ScreenOffsets.viewableRotated = {
            top: ScreenOffsets.viewable.left ,
            left: ScreenOffsets.viewable.bottom ,
            bottom: ScreenOffsets.viewable.right ,
            right: ScreenOffsets.viewable.top,
        };
    } else if (Rotation < 0) {
        ScreenOffsets.viewableRotated = {
            top: ScreenOffsets.viewable.right ,
            left: ScreenOffsets.viewable.top,
            bottom: ScreenOffsets.viewable.left ,
            right: ScreenOffsets.viewable.bottom,
        };
    }



    const viewableBorderWidth = 4 ;
    const viewableSymmetricBorderWidth = 6 ;
    const viewableDiv = document.getElementById("viewable");
    const viewableSymmetricDiv = document.getElementById("viewableSymmetric");
    if (viewableDiv) {
        viewableDiv.style.left = "" + ScreenOffsets.viewableRotated.left + "px";
        viewableDiv.style.right = "" + ScreenOffsets.viewableRotated.right + "px" ;
        viewableDiv.style.top = "" + ScreenOffsets.viewableRotated.top + "px" ;
        viewableDiv.style.bottom = "" + ScreenOffsets.viewableRotated.bottom + "px" ;
        viewableDiv.style.border = "solid green "+viewableBorderWidth + "px";
    }
    if (viewableSymmetricDiv) {
        viewableSymmetricDiv.style.left = "" + Math.max(ScreenOffsets.viewableRotated.left, ScreenOffsets.viewableRotated.right) + "px";
        viewableSymmetricDiv.style.top = "" + Math.max(ScreenOffsets.viewableRotated.top, ScreenOffsets.viewableRotated.bottom) + "px";
        viewableSymmetricDiv.style.right = viewableSymmetricDiv.style.left;
        viewableSymmetricDiv.style.bottom = viewableSymmetricDiv.style.top;
        viewableSymmetricDiv.style.border = "solid blue " + viewableSymmetricBorderWidth + "px";
    }


    setDynamicClassPositions();
    setFullScreenVisibility();
};

const setDynamicClassPositions = () => {
    // Adjust class names left-visible, right-visible, top-visible, bottom-visible
    for (let d in ScreenOffsets.viewableRotated ) {
        let elems = document.getElementsByClassName(`${d}-visible`);
        for (let i = 0 ; i < elems.length ; i++) {
            //console.log(`${d}-visible`,elems[i]);
            elems[i].style[d] = ScreenOffsets.viewableRotated[d] + "px";
        }
    }
};

const ScreenManager = new EventManager('Screen', new ReducerManager({
    [ACTION_SCREEN_ORIENTATION]: (state, action) => {
        console.log("State,action:",state,action);

        let lastDesiredOrientation = state.lastDesiredOrientation ;


        if (action.value.screenOrientation) {
            const orientationSplit = action.value.screenOrientation.split("-");
            if (orientationSplit[0] === escScreen.DesiredOrientation)
                lastDesiredOrientation = action.value.screenOrientation ;
        }


        return {
            ...state,
            lastDesiredOrientation ,
            lastScreen: {...state.screen},
            screen: {... state.screen, ...action.value},
            zoom: GetZoom(),
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            rect: controllerElem.getBoundingClientRect()
        }
    },
}));

class ScreenComponent extends Component {
    componentDidMount() {
        controllerElem = document.getElementById("controllerId");
        controllerElem.style.touchAction = "none";
        controllerElem.style.overflow = "hidden";
        //document.body.style.overflow = "hidden";

        AddEventListeners(this.props.captureTouchEvents);
        ScreenSizeListener();

        setFullScreenVisibility();
        if (escScreen.AppModeEnabled || escScreen.AutoSizeEnabled) {
            let viewport = document.querySelector("meta[name=viewport]");
            viewport.setAttribute('content', "width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0");
        }
        setInterval(AutoRotate,200);
    }

    render() {
        let {
            desiredOrientation = "landscape",
            androidOrientation = false,
            iPhoneOrientation = false,
            autoSizeEnabled = true,
            appModeEnabled = true,
        } = this.props;

        // To set different orientations based on device,
        // possibly for landscape primary vs. secondary
        if (androidOrientation && isAndroid) {
            desiredOrientation = androidOrientation ;
        }
        else if (iPhoneOrientation && iPhone) {
            desiredOrientation = iPhoneOrientation ;
        }

        const desiredOrientationSplit = desiredOrientation.split("-",2);
        escScreen.DesiredOrientation = desiredOrientationSplit[0] ; // "landscape" or "portrait"
        escScreen.DesiredPrimarySecondary = desiredOrientationSplit[1] ; // "primary", "secondary" or undefined

        escScreen.AutoSizeEnabled = autoSizeEnabled ;
        setFullScreenVisibility();
        setDynamicClassPositions();
        escScreen.AppModeEnabled = appModeEnabled;
        return escScreen.DEBUG ?
            <div>
                {/*
                <div style={{position:"fixed",top:"10em",left:"50%",width:"100%",height:"100%"}}>
                    <div style={{width:"10%",height:"10em", backgroundColor:"black",display:"inline-block"}}>10em</div>
                    <div style={{width:"10%",height:"30%", backgroundColor:"black",display:"inline-block"}}>30%</div>
                    <div style={{width:"10%",height:"30vmin", backgroundColor:"black",display:"inline-block"}}>30vmin</div>
                    <div style={{width:"10%",height:"30vh", backgroundColor:"black",display:"inline-block"}}>30vh</div>
                    <div style={{width:"10%",height:"30vw", backgroundColor:"black",display:"inline-block"}}>30vw</div>
                </div>
                   */}
                <div style={{position:"absolute",zIndex:-1,top:0,left:0,width:"50%",height:"50%",border:"1px dashed gray"}}></div>
                <div style={{position:"absolute",zIndex:-1,bottom:0,right:0,width:"50%",height:"50%",border:"1px dashed gray"}}></div>
                <div style={{position:"absolute",zIndex:-1,top:0,right:0,width:"50%",height:"50%",border:"1px dashed gray"}}></div>
                <div style={{position:"absolute",zIndex:-1,bottom:0,left:0,width:"50%",height:"50%",border:"1px dashed gray"}}></div>
                <div id={"screendebug"} style={{position:"fixed",top:"30%",left:"10%",backgroundColor:"black", padding:"1em",color:"red"}}></div>
            </div>:
            null;
        /*
        const fontSize = controllerElem ? window.getComputedStyle(controllerElem).getPropertyValue('font-size') : "?";
        return <div>
                <pre id={"screencomponent"} style={{border:"solid blue 1pt"}}>
                    Font size: {`${window.getComputedStyle(document.body).getPropertyValue('font-size')} ${fontSize} `}
                    Zoom: {this.props.zoom}
                    <br/>
                    Height diff: {GetHeightDifference()+" "+window.screenY + " "}
                    Client: {"" + document.documentElement.clientWidth + "x" + document.documentElement.clientHeight + " "}
                    Screen: {"" + window.screen.width + "x" + window.screen.height }
                    <br/>
                    {JSON.stringify({FirstTouch}, null, 2)}
                    {JSON.stringify({LastTouch}, null, 2)}
                    {JSON.stringify(this.props.rect, null, 2)}
                </pre>
        </div>
        */
    }
}

const Screen = ScreenManager.connect(ScreenComponent, [ACTION_SCREEN_ORIENTATION]);

ScreenOffsets.viewable = {top:0,bottom:0,left:0,right:0};
ScreenOffsets.viewableRotated = {top:0,bottom:0,left:0,right:0};

const AddEventListeners = (captureTouchEvents=true) => {
    window.addEventListener("resize", ScreenSizeListener, true);
    window.addEventListener("scroll", ScreenSizeListener, false);
    //controllerElem.addEventListener("scroll", e => e.preventDefault(), false);
    if (captureTouchEvents) {
        controllerElem.addEventListener("touchstart",TouchStartListener, false);
        controllerElem.addEventListener("touchmove",TouchMoveListener, false);
        controllerElem.addEventListener("touchend",TouchEndListener, true);
        controllerElem.addEventListener("touchcancel",TouchCancelListener, false);        
    }
    window.addEventListener("contextmenu",e=>{e.preventDefault();},false); // Prevent context menu popups
};

export {
    Screen,
    ScreenManager,
    ACTION_SCREEN_ORIENTATION,
    CONTROLLER_SCREEN_ORIENTATION
};
