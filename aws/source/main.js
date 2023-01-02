const AWS = require("aws-sdk")
let docClient = new AWS.DynamoDB.DocumentClient()
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3")
const s3Client = new S3Client({ region: process.region })

const Common = require("./common.js")

const infoKey = "info"
const cachedDataName = "AllEventSummaryData.json"

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

    await setIsEventDataDirty(true)

    return {
        eventSummaryData: eventSummaryData
    }
})}

module.exports.getEventSummary = (e, c, cb) => { Common.handler(e, c, cb, async (event, context) => {
    let key = decodeURIComponent(event.pathParameters.key)

    let getParams = {
        TableName : process.env.EVENT_SUMMARY_TABLE,
        Key: {
            key: key
        }
    }
    let eventSummaryData = await docClient.get(getParams).promise().then((response) => {
        return response.Item
    }).catch((error) => {
        throw error
    })

    if (eventSummaryData === undefined) {
        throw `Can't find event with id: ${key}`
    }

    return {
        eventSummaryData: eventSummaryData
    }
})}

module.exports.getAllEvents = (e, c, cb) => { Common.handler(e, c, cb, async (event, context) => {
    console.log("test start")
    let allEventSummaryData
    let isEventDataDirty = true
    let getInfoParams = {
        TableName : process.env.INFO_TABLE,
        Key: {
            key: infoKey
        }
    }
    await docClient.get(getInfoParams).promise().then((response) => {
        isEventDataDirty = response.Item === undefined || response.Item.isEventDataDirty
    }).catch((error) => {
        throw error
    })

    if (isEventDataDirty) {
        allEventSummaryData = await scanEventData()

        let putBucketParams = {
            Bucket: process.env.CACHE_BUCKET,
            Key: cachedDataName,
            Body: JSON.stringify(allEventSummaryData)
        }

        await s3Client.send(new PutObjectCommand(putBucketParams)).catch((error) => {
            throw error
        })

        await setIsEventDataDirty(false)
    } else {
        const streamToString = (stream) =>
        new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        });

        let getBucketParams = {
            Bucket: process.env.CACHE_BUCKET,
            Key: cachedDataName
        }
        allEventSummaryData = await s3Client.send(new GetObjectCommand(getBucketParams)).then((response) => {
            return streamToString(response.Body)
        }).then((dataString) => {
            return JSON.parse(dataString)
        }).catch((error) => {
            throw error
        })
    }

    return {
        allEventSummaryData: allEventSummaryData
    }
})}

module.exports.importFromAllData = (e, c, cb) => { Common.handler(e, c, cb, async (event, context) => {
    let request = JSON.parse(event.body) || {}
    const allData = request.allData

    if (allData === undefined || allData.eventsData === undefined) {
        throw "Missing eventsData"
    }

    let putRequests = []
    for (let eventDataKey in allData.eventsData) {
        const eventData = allData.eventsData[eventDataKey]
        let putEvent = Object.assign({
            key: eventDataKey
        }, eventData)
        putRequests.push({
            PutRequest: {
                Item: putEvent
            }
        })
    }

    console.log(putRequests)

    await batchPutItems(process.env.EVENT_SUMMARY_TABLE, putRequests)

    return {
        success: true,
        importedEventsCount: putRequests.length
    }
})}

async function scanEventData() {
    let allEvents = {}

    let scanParams = {
        TableName : process.env.EVENT_SUMMARY_TABLE
    }
    let items
    do {
        items = await docClient.scan(scanParams).promise().catch((error) => {
            throw error
        })
        for (let eventData of items.Items) {
            allEvents[eventData.key] = eventData
        }

        scanParams.ExclusiveStartKey = items.LastEvaluatedKey;
    } while (items.LastEvaluatedKey !== undefined)

    return allEvents
}

async function setIsEventDataDirty(isDirty) {
    let putInfoParams = {
        TableName : process.env.INFO_TABLE,
        Item: {
            key: infoKey,
            isEventDataDirty: isDirty
        }
    }
    await docClient.put(putInfoParams).promise().catch((error) => {
        throw error
    })
}

async function batchPutItems(tableName, putRequests) {
    for (let i = 0; i < putRequests.length; i += 25) {
        let params = {
            RequestItems: {
                [tableName]: putRequests.slice(i, i + 25)
            }
        }
        await docClient.batchWrite(params).promise().catch((error) => {
            throw error
        })
    }
}
