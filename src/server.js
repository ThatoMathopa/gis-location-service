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
  const { lisKey } = req.body;

  if (!lisKey) {
    return res.status(400).json({
      success: false,
      error: 'lisKey is required'
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
    return res.status(500).json({
      success: false,
      error: 'Internal error during GIS lookup'
    });
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
