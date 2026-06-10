# GIS Location Service

Node.js microservice running on SAP BTP Cloud Foundry (eu10).  
Called by SAP Service Cloud V2 Pre-Hook before Case save to look up GIS location
data from S/4HANA OData V4 service `ZSB_GIS_LOCATION` and auto-populate Case extension fields.

## Architecture

```
Service Cloud V2 Pre-Hook
↓  POST /api/location/lookup  { lisKey }
gis-location-service (BTP CF eu10)
↓  OData V4 GET /GisLocation?$filter=Liskey eq '...'
S/4HANA — ZSB_GIS_LOCATION
↓  returns location record
Pre-Hook populates: Street, Suburb, Ward, Region, NearestCorner, StreetNo, PortionNo, ERFNumber, GPSLong, GPSLat
```

## API

### POST /api/location/lookup

**Request:**
```json
{ "lisKey": "12345" }
```

**Response:**
```json
{
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
    "GisX": "28.2293",
    "GisY": "-25.7479",
    "Guid": "ABC123..."
  }
}
```

### GET /health

Returns service status.

## Deploy to BTP Cloud Foundry

```bash
npm install
cf login -a https://api.cf.eu10.hana.ondemand.com
cf push
```

## BTP Destination (S4H_GIS_DEST)

Configure in BTP Cockpit → Connectivity → Destinations:

- Type: HTTP
- URL: https://\<your-s4h-host\>
- Authentication: BasicAuthentication
- Property: sap-client = \<client\>

## Service Cloud V2 Pre-Hook

- Trigger: Case → Before Save
- Logic: If LISKey not empty → POST to /api/location/lookup → populate location extension fields
