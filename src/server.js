const express = require('express');
const { getLocationByGuid, getLocationByLisKey } = require('./gisService');
const { patchCaseLocation } = require('./sscv2Service');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'gis-location-service' });
});

/**
 * POST /api/location/sync
 *
 * Called by the HTML mashup immediately after it writes location
 * data to ZGIS_LOCATION on S/4HANA. The GUID in ZGIS_LOCATION
 * equals the SSCv2 Case UUID.
 *
 * Flow:
 * 1. Receive { guid } from mashup
 * 2. Fetch full location from ZGIS_LOCATION via OData V4
 * 3. PATCH SSCv2 Case with all location fields via Case_Object destination
 * 4. Location fields appear on Case form before agent saves
 *
 * Body:     { "guid": "<SSCv2-Case-UUID>" }
 * Response: { "success": true, "message": "Case <id> populated" }
 */
app.post('/api/location/sync', async (req, res) => {
  const { guid } = req.body;

  console.log('[GIS Sync] Received guid:', guid);

  if (!guid || String(guid).trim() === '') {
    return res.status(400).json({ success: false, error: 'guid is required' });
  }

  const caseId = String(guid).trim();

  try {
    // Step 1: fetch location from S/4HANA ZGIS_LOCATION
    const location = await getLocationByGuid(caseId);

    if (!location) {
      console.warn(`[GIS Sync] No ZGIS_LOCATION record found for GUID: ${caseId}`);
      return res.status(404).json({
        success: false,
        error: `No GIS location found for GUID: ${caseId}`
      });
    }

    console.log('[GIS Sync] Location fetched from S/4:', location.Street, location.Suburb);

    // Step 2: PATCH SSCv2 Case with location fields
    await patchCaseLocation(caseId, location);

    console.log('[GIS Sync] SSCv2 Case patched successfully:', caseId);

    return res.status(200).json({
      success: true,
      message: `Case ${caseId} populated with GIS location data`,
      location: {
        Street:        location.Street        || '',
        StreetNo:      location.StreetNo      || '',
        Suburb:        location.Suburb        || '',
        Ward:          location.Ward          || '',
        Region:        location.Region        || '',
        NearestCorner: location.NearestCorner || '',
        PortionNo:     location.PortionNo     || '',
        Erfno:         location.Erfno         || '',
        Liskey:        location.Liskey        || '',
        GisX:          location.GisX          || '',
        GisY:          location.GisY          || ''
      }
    });

  } catch (err) {
    console.error('[GIS Sync Error]', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to sync GIS location to Case',
      detail: err.message
    });
  }
});

/**
 * POST /api/location/lookup
 *
 * Legacy Pre-Hook endpoint — reads LISKey from SSCv2 extension
 * fields payload and returns { value: { ...fields } }.
 * Kept for backward compatibility with External Hook config.
 */
app.post('/api/location/lookup', async (req, res) => {
  const body = req.body || {};

  console.log('[GIS Pre-Hook] Payload keys:', Object.keys(body));

  const lisKey = body.LISKey;

  if (!lisKey || String(lisKey).trim() === '') {
    console.warn('[GIS Pre-Hook] No LISKey — returning empty value');
    return res.status(200).json({ value: {} });
  }

  try {
    const location = await getLocationByLisKey(String(lisKey).trim());

    if (!location) {
      console.warn(`[GIS Pre-Hook] No record for LISKey: ${lisKey}`);
      return res.status(200).json({ value: {} });
    }

    console.log('[GIS Pre-Hook] Match:', location.Street, location.Suburb);

    return res.status(200).json({
      value: {
        Street:        location.Street        || '',
        StreetNo:      location.StreetNo      || '',
        Suburb:        location.Suburb        || '',
        Ward:          location.Ward          || '',
        Region:        location.Region        || '',
        NearestCorner: location.NearestCorner || '',
        ZPortionNo:    location.PortionNo     || '',
        ZERFNumber:    location.Erfno         || '',
        ZGPSLongitude: location.GisX          || '',
        ZGPSLatitude:  location.GisY          || ''
      }
    });

  } catch (err) {
    console.error('[GIS Pre-Hook Error]', err.message);
    return res.status(200).json({ value: {} });
  }
});

app.listen(PORT, () => {
  console.log(`GIS Location Service running on port ${PORT}`);
});

module.exports = app;
