const express = require('express');
const { getLocationByLisKey } = require('./gisService');
const { enrichCase } = require('./sscv2Service');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

/**
 * Health check
 * GET /health
 */
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'gis-location-service' });
});

/**
 * GIS Location lookup endpoint
 * POST /api/location/lookup
 *
 * Called by SAP Service Cloud V2 Pre-Hook before Case save.
 *
 * Request body:
 * { "lisKey": "12345" }
 *
 * Response:
 * {
 *   "success": true,
 *   "location": {
 *     "Street": "...", "Suburb": "...", ...
 *   }
 * }
 */
app.post('/api/location/lookup', async (req, res) => {
  // Log the full incoming payload so we can see exactly what SSCv2 sends
  console.log('[GIS Pre-Hook] Incoming body:', JSON.stringify(req.body, null, 2));

  // SSCv2 pre-hook sends the full Case entity — try common LISKey field patterns
  const body = req.body || {};
  const lisKey =
    body.lisKey ||
    body.LisKey ||
    body.LISKEY ||
    body.yy1_LISKey_case ||
    body.yy1_Liskey_case ||
    body.yy1_LISKEY_case ||
    (body.value && (body.value.lisKey || body.value.yy1_LISKey_case));

  // If no LISKey found, pass through — do not block the Case save
  if (!lisKey) {
    console.warn('[GIS Pre-Hook] No LISKey found in payload — passing through');
    return res.json({ success: true, skipped: true });
  }

  try {
    const location = await getLocationByLisKey(String(lisKey).trim());

    if (!location) {
      console.warn(`[GIS Pre-Hook] No GIS record for LIS Key: ${lisKey} — passing through`);
      return res.json({ success: true, skipped: true });
    }

    return res.json({
      success: true,
      location: {
        Street:        location.Street        || '',
        StreetNo:      location.StreetNo      || '',
        Suburb:        location.Suburb        || '',
        Ward:          location.Ward          || '',
        Region:        location.Region        || '',
        NearestCorner: location.NearestCorner || '',
        PortionNo:     location.PortionNo     || '',
        Erfno:         location.Erfno         || '',
        GisX:          location.GisX          || '',
        GisY:          location.GisY          || '',
        Guid:          location.Guid          || ''
      }
    });

  } catch (err) {
    console.error('[GIS Lookup Error]', err.message);
    // Return 200 so the Case save is not blocked by a GIS outage
    return res.json({ success: false, error: err.message });
  }
});

/**
 * GIS enrich endpoint — full lookup + Case write-back
 * POST /api/location/enrich
 *
 * Looks up GIS data by LIS Key then PATCHes the SSCv2 Case
 * extension fields via the Case_Object destination.
 *
 * Request body:
 * { "lisKey": "12345", "caseId": "uuid-of-case" }
 */
app.post('/api/location/enrich', async (req, res) => {
  const { lisKey, caseId } = req.body;

  if (!lisKey || !caseId) {
    return res.status(400).json({
      success: false,
      error: 'lisKey and caseId are required'
    });
  }

  try {
    const location = await getLocationByLisKey(String(lisKey).trim());

    if (!location) {
      return res.status(404).json({
        success: false,
        error: `No GIS location found for LIS Key: ${lisKey}`
      });
    }

    await enrichCase(String(caseId).trim(), location);

    return res.json({
      success: true,
      message: `Case ${caseId} enriched with GIS data for LIS Key ${lisKey}`
    });

  } catch (err) {
    console.error('[GIS Enrich Error]', err.message);
    return res.status(500).json({
      success: false,
      error: 'Internal error during GIS enrich'
    });
  }
});

app.listen(PORT, () => {
  console.log(`GIS Location Service running on port ${PORT}`);
});

module.exports = app;
