/* eslint-disable no-alert */
/* eslint-disable no-loop-func */
/* eslint-disable func-style */
/* eslint-disable no-nested-ternary */
"use strict"

const React = require("react")
const ReactDOM = require("react-dom")
const MobxReact = require("mobx-react")
import DatePicker from "react-datepicker"
const { v4: uuidv4 } = require("uuid")
const StringSimilarity = require("string-similarity")

require("react-datepicker/dist/react-datepicker.css")
require("./index.less")

// Google form development: https://forms.gle/gw65dM2d1PLK2jqD9
// Google form prod: https://forms.gle/JXXsxLmq9WnHEA8XA

const awsPath = __STAGE__ === "DEVELOPMENT" ? " https://xyf6qhiwi1.execute-api.us-west-2.amazonaws.com/development/" : "https://wyach4oti8.execute-api.us-west-2.amazonaws.com/production/"

function importFromAllData(e) {
    console.log(e.target.value)

    const fileReader = new FileReader()
    fileReader.readAsText(e.target.files[0])
    fileReader.onload = (x) => {
        const jsonData = JSON.parse(x.target.result)
        console.log(jsonData)

        postData(`${awsPath}importFromAllData`, {
            allData: jsonData
        }).then((response) => {
            console.log(response)
            alert(`Imported ${response.importedEventsCount} events`)
        }).catch((error) => {
            console.error(error)
        })
    }
}

function postData(url, data) {
    return fetch(url, {
        method: "POST",
        mode: "cors",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    }).then((response) => {
        return response.json()
    })
}

function getData(url) {
    return fetch(url, {
        method: "GET",
        mode: "cors",
        headers: {
            "Content-Type": "application/json"
        }
    }).then((response) => {
        return response.json()
    })
}

@MobxReact.observer class Main extends React.Component {
    constructor() {
        super()

        this.state = {
            eventKey: "",
            eventName: "",
            eventStartDate: new Date(),
            eventEndDate: new Date(),
            searchOutput: null,
            searchText: ""
        }

        this.getEventData()
    }

    getEventData() {
        getData(`${awsPath}getAllEvents`).then((data) => {
            this.state.eventData = data.allEventSummaryData
            this.setState(this.state)
            console.log(this.state.eventData)
        }).catch((error) => {
            console.error(`Failed to download Event data: ${error}`)
        })
    }

    onKeyChanged(e) {
        this.state.eventKey = e.target.value
        this.setState(this.state)
    }

    onNameChanged(e) {
        this.state.eventName = e.target.value
        this.setState(this.state)
    }

    onStartDateChanged(e) {
        this.state.eventStartDate = new Date(e)
        this.setState(this.state)
    }

    onEndDateChanged(e) {
        this.state.eventEndDate = new Date(e)
        this.setState(this.state)
    }

    generateNewKey() {
        this.state.eventKey = uuidv4()
        this.setState(this.state)
    }

    getDateString(date) {
        return date.toISOString().split("T")[0]
    }

    setEvent() {
        postData(`${awsPath}setEventSummary/${this.state.eventKey}`, {
            eventName: this.state.eventName,
            startDate: this.getDateString(this.state.eventStartDate),
            endDate: this.getDateString(this.state.eventEndDate)
        }).then((response) => {
            console.log(response)
            alert(`Set ${response.eventSummaryData.eventName}`)
        }).catch((error) => {
            console.error(error)
        })
    }

    onSearchTextChanged(e) {
        this.state.searchText = e.target.value
        this.setState(this.state)
    }

    onSearchKeyDown(e) {
        if (e.key === "Enter") {
            this.searchEvents(this.state.searchText)
        }
    }

    tryAddSearchResult(foundEvents, eventData, similar) {
        let maxResults = 15
        if (similar > 0) {
            let shouldAdd = false
            if (foundEvents.length < maxResults) {
                shouldAdd = true
            } else if (foundEvents[maxResults - 1].score < similar) {
                shouldAdd = true
                foundEvents.pop()
            }
            if (shouldAdd) {
                let insertIndex = foundEvents.findIndex((data) => data.score < similar)
                foundEvents.splice(insertIndex >= 0 ? insertIndex : foundEvents.length, 0, {
                    eventData: eventData,
                    score: similar
                })
            }
        }
    }

    searchEvents(str) {
        this.state.searchOutput = null

        let foundEvents = []
        for (let key in this.state.eventData) {
            let eventData = this.state.eventData[key]
            if (eventData !== undefined) {
                let name = eventData.eventName.toLowerCase()
                let similar = StringSimilarity.compareTwoStrings(str.toLowerCase(), name)
                this.tryAddSearchResult(foundEvents, eventData, similar)

                similar = StringSimilarity.compareTwoStrings(str.toLowerCase(), key)
                this.tryAddSearchResult(foundEvents, eventData, similar)
            }
        }

        if (foundEvents.length > 0) {
            this.state.searchOutput = []
            for (let { eventData } of foundEvents) {
                this.state.searchOutput.push(
                    <tr key={eventData.key}>
                        <td><button onClick={() => navigator.clipboard.writeText(eventData.key)}>{eventData.key}</button></td>
                        <td>{eventData.eventName}</td>
                        <td>{eventData.startDate}</td>
                        <td>{eventData.endDate}</td>
                    </tr>
                )
            }

            this.setState(this.state)
        }
    }

    render() {
        return (
            <div>
                <h2>
                    Create/Modify Event
                </h2>
                <div className="controls">
                    <label>
                        Event Key:
                        <input value={this.state.eventKey} onChange={(e) => this.onKeyChanged(e)}/>
                        <button onClick={() => this.generateNewKey()}>Generate New Key</button>
                    </label>
                    <label>
                        Event Name:
                        <input value={this.state.eventName} onChange={(e) => this.onNameChanged(e)}/>
                    </label>
                    {<label>
                        Start Date:
                        <DatePicker selected={this.state.eventStartDate} onChange={(e) => this.onStartDateChanged(e)}/>
                    </label>}
                    {<label>
                        End Date:
                        <DatePicker selected={this.state.eventEndDate} onChange={(e) => this.onEndDateChanged(e)}/>
                    </label>}
                    <button onClick={() => this.setEvent()}>Submit</button>
                </div>
                <h2>
                    Find Event
                </h2>
                <div className="controls">
                    <label>
                        Search by Name or Key:
                        <input value={this.state.searchText} onChange={(e) => this.onSearchTextChanged(e)} onKeyDown={(e) => this.onSearchKeyDown(e)}/>
                        <button onClick={() => this.searchEvents(this.state.searchText)}>Search</button>
                    </label>
                    <div>
                        {this.state.searchOutput}
                    </div>
                </div>
                <h2>
                    Import From All Data
                </h2>
                <div>
                    <input type="file" accept=".json" onChange={(e) => importFromAllData(e)}/>
                </div>
            </div>
        )
    }
}

function render() {
    ReactDOM.render(
        <Main />,
        document.getElementById("mount")
    )
}

render()
