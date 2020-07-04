import React, {Component} from 'react';
import {connect} from 'react-redux'

const EventStats = function (eventManagers) {

    const eventManagerNames = eventManagers.map((eventManager) => eventManager.managerName);
    eventManagers.forEach((eventManager) => {
        if (!eventManager.hasOwnProperty("ACTION_EVENT_STATS") ||
            !eventManager.hasOwnProperty("managerName")) {
            console.log("Not an event manager", eventManager);
            throw new Error("Not an event manager");
        }
    });

    class EventStatsComponent extends Component {
        UNSAFE_componentWillMount() {
            eventManagers.forEach((eventManager) => eventManager.setReducerEnabled(eventManager.ACTION_EVENT_STATS, true));
        }

        componentWillUnmount() {
            eventManagers.forEach((eventManager) => eventManager.setReducerEnabled(eventManager.ACTION_EVENT_STATS, false));
        }

        render() {
            return <div>
                <pre>
                    {JSON.stringify(this.props, null, 2)}
                </pre>
            </div>
        }
    }

    const mapStateToProps = state => {
        const result = eventManagerNames.reduce((result, eventManagerName) => {
            return {
                ...result,
                [eventManagerName]: state[eventManagerName] ? state[eventManagerName].eventStats : { }
            }
        }, {});
        return {
            eventStats: result
        };
    };

    const mapDispatchToProps = dispatch => {
        return {}
    };

    return connect(mapStateToProps, mapDispatchToProps)(EventStatsComponent);
};


export {EventStats};
