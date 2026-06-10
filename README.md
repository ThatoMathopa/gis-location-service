# GIS Location Service

Node.js microservice on SAP BTP Cloud Foundry (eu10).
Called by SAP Service Cloud V2 Pre-Hook before Case save.

## Key mapping

| SSCv2 | S/4HANA ZGIS_LOCATION |
|---|---|
| Case.id (UUID) | GUID column |

The GIS picker widget embedded in the Case form confirms a location
and writes the Case UUID into ZGIS_LOCATION.GUID. The Pre-Hook
reads Case.id and sends it here for lookup.

## Flow

```
Agent uses GIS picker widget on Case form
        ↓  confirms location
        ↓  picker writes Case.id into ZGIS_LOCATION.GUID on S/4HANA
Pre-Hook fires (Before Save)
        ↓  reads Case.id
        ↓  POST /api/location/lookup  { "guid": "<case-id>" }
gis-location-service (BTP CF eu10)
        ↓  GET GisLocation('<case-id>') from S/4HANA OData V4
ZGIS_LOCATION on S/4HANA
        ↓  returns full location record
Pre-Hook sets on Case:
   Street, StreetNo, Suburb, Ward, Region,
   NearestCorner, PortionNo, ERFNumber,
   LISKey, GPSLongitude, GPSLatitude
```

## Endpoints

### POST /api/location/lookup

```json
Request:  { "guid": "<case-id-uuid>" }
Response: {
  "success": true,
  "location": {
    "Street": "Main Road",
    "StreetNo": "42",
    "Suburb": "Hatfield",
    "Ward": "Ward 55",
    "Region": "Tshwane",
    "NearestCorner": "Church St",
    "PortionNo": "001",
    "Erfno": "ERF123",
    "Liskey": "12345",
    "GisX": "28.2293",
    "GisY": "-25.7479",
    "Guid": "<case-id-uuid>"
  }
}
```

### POST /api/location/enrich

```json
Request:  { "guid": "<case-id-uuid>", "caseId": "<case-id-uuid>" }
Response: { "success": true, "message": "Case <id> enriched", "location": { ... } }
```

### GET /health

```json
{ "status": "UP", "service": "gis-location-service" }
```

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

App URL after deploy:
```
https://gis-location-service.cfapps.eu10-004.hana.ondemand.com
```

## Service Cloud V2 Pre-Hook

Navigate to: **Administrator → Business Logic → Logic Editor → Case → Before Save**

```
IF id is not empty THEN

  POST https://gis-location-service.cfapps.eu10-004.hana.ondemand.com/api/location/lookup
  Headers: Content-Type = application/json
  Body:    { "guid": "{id}" }

  IF response.success = true THEN
    SET Street        = response.location.Street
    SET StreetNo      = response.location.StreetNo
    SET Suburb        = response.location.Suburb
    SET Ward          = response.location.Ward
    SET Region        = response.location.Region
    SET NearestCorner = response.location.NearestCorner
    SET ZPortionNo    = response.location.PortionNo
    SET ZERFNumber    = response.location.Erfno
    SET LISKey        = response.location.Liskey
    SET ZGPSLongitude = response.location.GisX
    SET ZGPSLatitude  = response.location.GisY
  END IF

END IF
```
