import React, {Component} from "react";
import {ESCNetworking} from './networking/ESCNetworking';
import { EventManager, ReducerManager } from "@esc_games/esc-react-redux";

import './esc-default.css';

const ACTION_GAME_LOADED = "ESC:Loaded";
const ACTION_GAME_CHANGED = "ESC:Changed";
const ACTION_GAME_LIST = "ESC:List";

class GameUI extends Component {
    render() {
        const {debug} = this.props;
        return <div>
            {debug ?
                <pre>
                {JSON.stringify(this.props, null, 2)}
            </pre>
                : null}
        </div>
    };
}

const ESCState = {
    game: {
        gameId: "none",
        gameIsLoaded: "xyz"
    },
    network: {},
    debug: true,
};


const reducerManager = new ReducerManager({
    [ACTION_GAME_LOADED]: (state, action) => {
        return {
            ...state,
            network: {
                ...action.value
            }
        }
    },
    [ACTION_GAME_CHANGED]: (state, action) => {
        ESCManager.currentGame = action.value;
        return {
            ...state,
            game: {
                ...state.game,
                gameId: action.value
            }
        }
    },
    [ACTION_GAME_LIST]: (state, action) => {
        return {
            ...state,
            gameList: action.value
        }
    },
}, ESCState);

const ESCManager = new EventManager('ESCManager', reducerManager);

const PLACEHOLDER_IMAGE = "data:image/png;base64,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";

ESCManager.networking = ESCNetworking;
ESCNetworking.init();

ESCManager.getCustomAssetUrl = (slug) => {
    const customGameAssets = window.esc.page.game_instance.custom_game_assets;
    if(customGameAssets && customGameAssets.hasOwnProperty(slug)) {
        return customGameAssets[slug];
    }
    return null;
};

const GameState = ESCManager.connect(GameUI, [ACTION_GAME_LIST, ACTION_GAME_LOADED, ACTION_GAME_CHANGED]);

export {ESCManager, GameState, ACTION_GAME_LIST, ACTION_GAME_LOADED, ACTION_GAME_CHANGED }