# GIS Location Service

Node.js microservice on SAP BTP Cloud Foundry (eu10).
Called by SAP Service Cloud V2 External Hook (Pre-Hook) before Case save.

## Key mapping

| SSCv2 field | S/4HANA ZGIS_LOCATION column |
|---|---|
| Case.id (UUID) | GUID |

The GIS picker widget confirms a location and writes Case.id
into ZGIS_LOCATION.GUID. The Pre-Hook fires and calls this service.

## Flow

```
Agent confirms location in GIS picker widget
        ↓  Case.id written into ZGIS_LOCATION.GUID on S/4HANA
External Hook fires (Pre-Hook — Before Save)
        ↓  SSCv2 POSTs full Case payload to /api/location/lookup
        ↓  service reads Case.id → GET GisLocation('<id>') on S/4HANA
        ↓  returns FLAT response with exact Case extension field names
SSCv2 maps flat response directly onto Case before save:
   Street, StreetNo, Suburb, Ward, Region,
   NearestCorner, ZPortionNo, ZERFNumber,
   LISKey, ZGPSLongitude, ZGPSLatitude
```

## CRITICAL: Response format

SSCv2 External Hook requires a FLAT response using exact Case
extension field technical names. No wrapper objects.

```json
{
  "Street": "Main Road",
  "StreetNo": "42",
  "Suburb": "Hatfield",
  "Ward": "Ward 55",
  "Region": "Tshwane",
  "NearestCorner": "Church St",
  "ZPortionNo": "001",
  "ZERFNumber": "ERF123",
  "LISKey": "12345",
  "ZGPSLongitude": "28.2293",
  "ZGPSLatitude": "-25.7479"
}
```

Always return HTTP 200 — even on error or no record found.
Returning 4xx/5xx will block the Case save in SSCv2.

## Endpoints

### POST /api/location/lookup
SSCv2 External Hook endpoint. Receives full Case payload.
Returns flat response with Case field names.

### POST /api/location/enrich
Direct call endpoint. Body: `{ "guid": "<uuid>", "caseId": "<uuid>" }`

### GET /health
Returns `{ "status": "UP" }`

## OData V4 endpoint (S/4HANA)

```
GET /sap/opu/odata4/sap/zsb_gis_location/srvd_a2x/sap/zsd_gis_location/0001/GisLocation('<guid>')
```

## BTP Destinations

### THD_NEW — S/4HANA (OnPremise)

| Property | Value |
|---|---|
| Name | THD_NEW |
| Type | HTTP |
| Proxy Type | OnPremise (via Cloud Connector) |
| System | SAP S/4HANA DEVELOPMENT |
| Authentication | BasicAuthentication |
| sap-client | your client number |

### Case_Object — Service Cloud V2 (Internet)

| Property | Value |
|---|---|
| Name | Case_Object |
| Type | HTTP |
| Proxy Type | Internet |
| System | SAP Service Cloud Version 2 |
| Authentication | OAuth2ClientCredentials |

## Deploy

```bash
npm install
cf login -a https://api.cf.eu10.hana.ondemand.com
cf create-service destination lite gis-destination-service
cf push
```

App URL:
```
https://gis-location-service.cfapps.eu10-004.hana.ondemand.com
```

## External Hook config in SSCv2

| Field | Value |
|---|---|
| Name | GISLocations |
| Event | Pre Hook |
| Service Full Name | sap.crm.service.caseService |
| API Path | /api/location/lookup |
| HTTP Method | POST |
| Communication System | BTPService |
