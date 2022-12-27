/* eslint-disable no-alert */
/* eslint-disable no-loop-func */
/* eslint-disable func-style */
/* eslint-disable no-nested-ternary */
"use strict"

const React = require("react")
const ReactDOM = require("react-dom")
const Mobx = require("mobx")

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

function render() {
    ReactDOM.render(
        <div>
            <h1>
                Import From All Data
            </h1>
            <div>
                <input type="file" accept=".json" onChange={(e) => importFromAllData(e)}/>
            </div>
        </div>,
        document.getElementById("mount")
    )
}

render()
