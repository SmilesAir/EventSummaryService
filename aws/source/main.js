const AWS = require("aws-sdk")
let docClient = new AWS.DynamoDB.DocumentClient()

const Common = require("./common.js")

module.exports.setEventSummary = (e, c, cb) => { Common.handler(e, c, cb, async (event, context) => {
    let key = decodeURIComponent(event.pathParameters.key)
    let request = JSON.parse(event.body) || {}
    let eventName = request.eventName
    let startDate = request.startDate
    let endDate = request.endDate

    let eventSummaryData = {
        key: key,
        eventName: eventName,
        startDate: startDate,
        endDate: endDate,
        createdAt: Date.now()
    }

    let putParams = {
        TableName : process.env.EVENT_SUMMARY_TABLE,
        Item: eventSummaryData
    }
    await docClient.put(putParams).promise().catch((error) => {
        throw error
    })

    console.log("setEventSummary", JSON.stringify(eventSummaryData))

    return {
        eventSummaryData: eventSummaryData
    }
})}
