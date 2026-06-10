const express = require('express');
const { getLocationByGuid, getLocationByLisKey } = require('./gisService');

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
 * POST /api/location/lookup
 *
 * Called by SSCv2 External Hook (Pre-Hook) before Case save.
 *
 * SSCv2 sends extension fields only in the payload.
 * We read the GUID extension field which equals ZGIS_LOCATION.GUID.
 * The mashup writes the Case UUID into both ZGIS_LOCATION.GUID
 * and the Case GUID extension field when location is confirmed.
 *
 * Payload from SSCv2:
 * {
 *   "GUID": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
 *   "LISKey": "...",
 *   "Street": "...",
 *   ...other extension fields
 * }
 *
 * Response MUST be { "value": { ...fields } } — SSCv2 requirement.
 * ALWAYS return HTTP 200 — non-200 blocks the Case save.
 */
app.post('/api/location/lookup', async (req, res) => {
  const body       = req.body || {};
  const extensions = body.currentImage?.extensions || {};

  console.log('[GIS Pre-Hook] Extensions:', JSON.stringify(extensions));

  // Extension fields live inside currentImage.extensions
  const guid   = extensions.GUID   ? String(extensions.GUID).trim()   : null;
  const lisKey = extensions.LISKey ? String(extensions.LISKey).trim() : null;

  console.log('[GIS Pre-Hook] GUID:', guid);
  console.log('[GIS Pre-Hook] LISKey:', lisKey);

  if (!guid && !lisKey) {
    console.warn('[GIS Pre-Hook] No GUID or LISKey in payload — returning empty value');
    return res.status(200).json({ value: {} });
  }

  try {
    let location = null;

    if (guid) {
      console.log('[GIS Pre-Hook] Looking up by GUID:', guid);
      location = await getLocationByGuid(guid);
    }

    if (!location && lisKey) {
      console.log('[GIS Pre-Hook] GUID lookup failed — falling back to LISKey:', lisKey);
      location = await getLocationByLisKey(lisKey);
    }

    if (!location) {
      console.warn('[GIS Pre-Hook] No GIS record found — returning empty value');
      return res.status(200).json({ value: {} });
    }

    console.log('[GIS Pre-Hook] Match found:', location.Street, location.Suburb);

    // Wrap in "value" — required by SSCv2 External Hook response parser
    // Field names must match exact Case extension field technical names
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
        LISKey:        location.Liskey        || '',
        ZGPSLongitude: location.GisX          || '',
        ZGPSLatitude:  location.GisY          || ''
      }
    });

  } catch (err) {
    console.error('[GIS Pre-Hook Error]', err.message);
    // Always 200 — never block the Case save
    return res.status(200).json({ value: {} });
  }
});

/**
 * POST /api/location/sync
 *
 * Direct call endpoint — used when mashup can call microservice directly.
 * Fetches location from S/4 and returns location data.
 *
 * Body: { "guid": "<zgis-location-guid>" }
 */
app.post('/api/location/sync', async (req, res) => {
  const { guid } = req.body;

  if (!guid || String(guid).trim() === '') {
    return res.status(400).json({ success: false, error: 'guid is required' });
  }

  try {
    const location = await getLocationByGuid(String(guid).trim());

    if (!location) {
      return res.status(404).json({
        success: false,
        error: `No GIS location found for GUID: ${guid}`
      });
    }

    return res.status(200).json({
      success: true,
      message: `Location data found for GUID ${guid}`,
      location: {
        Street:        location.Street        || '',
        StreetNo:      location.StreetNo      || '',
        Suburb:        location.Suburb        || '',
        Ward:          location.Ward          || '',
        Region:        location.Region        || '',
        NearestCorner: location.NearestCorner || '',
        ZPortionNo:    location.PortionNo     || '',
        ZERFNumber:    location.Erfno         || '',
        LISKey:        location.Liskey        || '',
        ZGPSLongitude: location.GisX          || '',
        ZGPSLatitude:  location.GisY          || ''
      }
    });

  } catch (err) {
    console.error('[GIS Sync Error]', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch GIS location',
      detail: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`GIS Location Service running on port ${PORT}`);
});

module.exports = app;
