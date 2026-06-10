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
 * SSCv2 payload structure:
 * {
 *   "currentImage": {
 *     "id": "<case-uuid>",
 *     "extensions": {
 *       "GUID": "a1b2c3d4-...",   ← extension field set by mashup
 *       "LISKey": "12345",
 *       "Street": "...",
 *       ...
 *     }
 *   }
 * }
 *
 * Lookup priority:
 * 1. currentImage.extensions.GUID  → direct OData key lookup
 * 2. currentImage.extensions.LISKey → $filter fallback
 * 3. currentImage.id               → ultimate fallback (Case UUID)
 *
 * Response must be { "value": { ...fields } }
 * Always return HTTP 200 — non-200 blocks the Case save.
 */
app.post('/api/location/lookup', async (req, res) => {
  const body         = req.body || {};
  const currentImage = body.currentImage || {};
  const extensions   = currentImage.extensions || {};

  // Log for debugging
  console.log('[GIS Pre-Hook] extensions keys:', Object.keys(extensions));
  console.log('[GIS Pre-Hook] extensions.GUID:', extensions.GUID);
  console.log('[GIS Pre-Hook] extensions.LISKey:', extensions.LISKey);
  console.log('[GIS Pre-Hook] currentImage.id:', currentImage.id);

  // Lookup priority
  const guid   = extensions.GUID   ? String(extensions.GUID).trim()   : null;
  const lisKey = extensions.LISKey ? String(extensions.LISKey).trim() : null;
  const caseId = currentImage.id   ? String(currentImage.id).trim()   : null;

  if (!guid && !lisKey && !caseId) {
    console.warn('[GIS Pre-Hook] No lookup key found — returning empty value');
    return res.status(200).json({ value: {} });
  }

  try {
    let location = null;

    // 1. Try GUID extension field first
    if (guid) {
      console.log('[GIS Pre-Hook] Lookup by extensions.GUID:', guid);
      location = await getLocationByGuid(guid);
    }

    // 2. Fallback to LISKey
    if (!location && lisKey) {
      console.log('[GIS Pre-Hook] Fallback to extensions.LISKey:', lisKey);
      location = await getLocationByLisKey(lisKey);
    }

    // 3. Ultimate fallback — Case id (if mashup stores Case UUID as GUID in S/4)
    if (!location && caseId) {
      console.log('[GIS Pre-Hook] Fallback to currentImage.id:', caseId);
      location = await getLocationByGuid(caseId);
    }

    if (!location) {
      console.warn('[GIS Pre-Hook] No GIS record found — returning empty value');
      return res.status(200).json({ value: {} });
    }

    console.log('[GIS Pre-Hook] Match found:', location.Street, location.Suburb);

    // Wrap in "value" — required by SSCv2 External Hook response parser
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
 * Direct call — body: { "guid": "<uuid>" }
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
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`GIS Location Service running on port ${PORT}`);
});

module.exports = app;
