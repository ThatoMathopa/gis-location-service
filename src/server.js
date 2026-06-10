const express = require('express');
const { getLocationByLisKey } = require('./gisService');

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
 * Called by SAP Service Cloud V2 External Hook (Pre-Hook) before Case save.
 *
 * SSCv2 External Hook sends ONLY extension fields in the payload — not
 * the standard Case id. We read LISKey from extensions and use it to
 * look up the full location record in ZGIS_LOCATION via OData V4.
 *
 * Payload from SSCv2 (extension fields only):
 * {
 *   "LISKey": "12345",
 *   "Street": "...",
 *   "Suburb": "...",
 *   ...other extension fields
 * }
 *
 * Response MUST be wrapped in "value" key — SSCv2 requirement:
 * { "value": { "Street": "...", "Suburb": "...", ... } }
 *
 * ALWAYS return HTTP 200 — non-200 blocks the Case save.
 * Return { "value": {} } on no-match so save proceeds cleanly.
 */
app.post('/api/location/lookup', async (req, res) => {
  const body = req.body || {};

  // Log full payload for debugging
  console.log('[GIS Pre-Hook] Received payload keys:', Object.keys(body));
  console.log('[GIS Pre-Hook] LISKey value:', body.LISKey);

  const lisKey = body.LISKey;

  if (!lisKey || String(lisKey).trim() === '') {
    console.warn('[GIS Pre-Hook] No LISKey in payload — returning empty value');
    return res.status(200).json({ value: {} });
  }

  try {
    const location = await getLocationByLisKey(String(lisKey).trim());

    if (!location) {
      console.warn(`[GIS Pre-Hook] No GIS record found for LISKey: ${lisKey}`);
      return res.status(200).json({ value: {} });
    }

    console.log('[GIS Pre-Hook] Match found for LISKey:', lisKey, '→', location.Street, location.Suburb);

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
 * POST /api/location/enrich
 * Direct call outside Pre-Hook. Body: { "lisKey": "...", "caseId": "..." }
 */
app.post('/api/location/enrich', async (req, res) => {
  const { lisKey, caseId } = req.body;

  if (!lisKey) {
    return res.status(400).json({ error: 'lisKey is required' });
  }

  try {
    const location = await getLocationByLisKey(String(lisKey).trim());

    if (!location) {
      return res.status(404).json({ error: `No GIS location found for LISKey: ${lisKey}` });
    }

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
    console.error('[GIS Enrich Error]', err.message);
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`GIS Location Service running on port ${PORT}`);
});

module.exports = app;
