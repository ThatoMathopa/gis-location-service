const express = require('express');
const { getLocationByGuid, getLocationByLisKey } = require('./gisService');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'gis-location-service' });
});

/**
 * POST /api/location/lookup
 *
 * Called by SSCv2 External Hook (Pre-Hook) before Case save.
 *
 * SSCv2 sends this structure:
 * {
 *   "entity": "sap.crm.caseservice.entity.case",
 *   "currentImage": {
 *     "GUID": "a1b2c3d4-...",
 *     "LISKey": "...",
 *     "Street": "...",
 *     ...all extension fields
 *   },
 *   "beforeImage": { ...previous state... },
 *   "skipValidations": false,
 *   "context": { ... }
 * }
 *
 * Extension fields including GUID live inside currentImage.
 *
 * Response MUST be { "value": { ...fields } } — SSCv2 requirement.
 * ALWAYS return HTTP 200 — non-200 blocks the Case save.
 */
app.post('/api/location/lookup', async (req, res) => {
  const body = req.body || {};

  // Extension fields are nested inside currentImage
  const currentImage = body.currentImage || {};

  console.log('[GIS Pre-Hook] Top-level keys:', Object.keys(body));
  console.log('[GIS Pre-Hook] currentImage keys:', Object.keys(currentImage));
  console.log('[GIS Pre-Hook] GUID from currentImage:', currentImage.GUID);
  console.log('[GIS Pre-Hook] LISKey from currentImage:', currentImage.LISKey);

  // Primary: GUID extension field (set by mashup when location confirmed)
  const guid   = currentImage.GUID   ? String(currentImage.GUID).trim()   : null;
  // Fallback: LISKey extension field
  const lisKey = currentImage.LISKey ? String(currentImage.LISKey).trim() : null;

  if (!guid && !lisKey) {
    console.warn('[GIS Pre-Hook] No GUID or LISKey in currentImage — returning empty value');
    return res.status(200).json({ value: {} });
  }

  try {
    let location = null;

    if (guid) {
      console.log('[GIS Pre-Hook] Looking up by GUID:', guid);
      location = await getLocationByGuid(guid);
    }

    if (!location && lisKey) {
      console.log('[GIS Pre-Hook] GUID lookup returned null — trying LISKey:', lisKey);
      location = await getLocationByLisKey(lisKey);
    }

    if (!location) {
      console.warn('[GIS Pre-Hook] No GIS record found — returning empty value');
      return res.status(200).json({ value: {} });
    }

    console.log('[GIS Pre-Hook] Match found:', location.Street, location.Suburb);

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
    return res.status(200).json({ value: {} });
  }
});

/**
 * POST /api/location/sync
 * Direct call — body: { "guid": "<case-uuid>" }
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
      message: `Location found for GUID ${guid}`,
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
