# Event Summary Service

Microservice for storing the details of events. Hopefully will be used to provide data for an event calendar in the future.

## Client
Use [Google Form](https://forms.gle/jpXjZvLwWNayfa1n7) to create new events

## Backend
Uses dynamo and an s3 bucket to store and cache event details

Schema
| Property    | Type | Description |
| --- | --- | --- |
| key | string | GUID shared across all microservices |
| eventName | string | First Name |
| createdAt | number | Time in MS when this entry was created |
| startDate | number | Time in MS when this entry last modified |
| endDate | number | FPA Membership Number |
