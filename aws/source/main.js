const AWS = require("aws-sdk")
const uuid = require("uuid")
let docClient = new AWS.DynamoDB.DocumentClient()
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3")
const s3Client = new S3Client({ region: process.region })

const Common = require("./common.js")

const infoKey = "info"
const cachedDataName = "AllPlayerData.json"


module.exports.addPlayer = (e, c, cb) => { Common.handler(e, c, cb, async (event, context) => {
    let firstName = decodeURIComponent(event.pathParameters.firstName)
    let lastName = decodeURIComponent(event.pathParameters.lastName)
    let request = JSON.parse(event.body) || {}
    let membership = request.membership
    let country = request.country
    let gender = request.gender

    let newPlayerData = {
        key: uuid.v4(),
        firstName: firstName,
        lastName: lastName,
        createdAt: Date.now(),
        lastActive: Date.now(),
        membership: membership || 0,
        country: country,
        gender: gender
    }

    let putParams = {
        TableName : process.env.PLAYER_TABLE,
        Item: newPlayerData
    }
    await docClient.put(putParams).promise().catch((error) => {
        throw error
    })

    await setIsPlayerDataDirty(true)

    return {
        addedPlayer: newPlayerData
    }
})}

module.exports.getAllPlayers = (e, c, cb) => { Common.handler(e, c, cb, async (event, context) => {


    let allPlayers
    let isPlayerDataDirty = true
    let getInfoParams = {
        TableName : process.env.INFO_TABLE,
        Key: {
            key: infoKey
        }
    }
    await docClient.get(getInfoParams).promise().then((response) => {
        isPlayerDataDirty = response.Item === undefined || response.Item.isPlayerDataDirty
    }).catch((error) => {
        throw error
    })

    if (isPlayerDataDirty) {
        allPlayers = await scanPlayers()

        let putBucketParams = {
            Bucket: process.env.CACHE_BUCKET,
            Key: cachedDataName,
            Body: JSON.stringify(allPlayers)
        }

        await s3Client.send(new PutObjectCommand(putBucketParams)).catch((error) => {
            throw error
        })

        await setIsPlayerDataDirty(false)
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
        allPlayers = await s3Client.send(new GetObjectCommand(getBucketParams)).then((response) => {
            return streamToString(response.Body)
        }).then((dataString) => {
            return allPlayers = JSON.parse(dataString)
        }).catch((error) => {
            throw error
        })
    }

    return {
        players: allPlayers
    }
})}

module.exports.removePlayer = (e, c, cb) => { Common.handler(e, c, cb, async (event, context) => {
    let key = decodeURIComponent(event.pathParameters.key)

    let deleteParams = {
        TableName : process.env.PLAYER_TABLE,
        Key: {
            key: key
        }
    }

    await docClient.delete(deleteParams).promise().catch((error) => {
        throw error
    })

    await setIsPlayerDataDirty(true)

    return {}
})}

module.exports.modifyPlayer = (e, c, cb) => { Common.handler(e, c, cb, async (event, context) => {
    let key = decodeURIComponent(event.pathParameters.key)
    let firstName = decodeURIComponent(event.pathParameters.firstName)
    let lastName = decodeURIComponent(event.pathParameters.lastName)
    let request = JSON.parse(event.body) || {}
    let membership = request.membership
    let country = request.country
    let gender = request.gender

    let modifiedPlayerData = {
        key: key,
        firstName: firstName,
        lastName: lastName,
        createdAt: Date.now(),
        lastActive: Date.now(),
        membership: membership || 0,
        country: country,
        gender: gender
    }

    let putParams = {
        TableName : process.env.PLAYER_TABLE,
        Item: modifiedPlayerData
    }
    await docClient.put(putParams).promise().catch((error) => {
        throw error
    })

    await setIsPlayerDataDirty(true)

    return {
        modifiedPlayer: modifiedPlayerData
    }
})}

async function scanPlayers() {
    let allPlayers = {}

    let scanParams = {
        TableName : process.env.PLAYER_TABLE
    }
    let items
    do {
        items = await docClient.scan(scanParams).promise().catch((error) => {
            throw error
        })
        for (let player of items.Items) {
            allPlayers[player.key] = player
        }

        scanParams.ExclusiveStartKey = items.LastEvaluatedKey;
    } while (items.LastEvaluatedKey !== undefined)

    return allPlayers
}

async function setIsPlayerDataDirty(isDirty) {
    let putInfoParams = {
        TableName : process.env.INFO_TABLE,
        Item: {
            key: infoKey,
            isPlayerDataDirty: isDirty
        }
    }
    await docClient.put(putInfoParams).promise().catch((error) => {
        throw error
    })
}