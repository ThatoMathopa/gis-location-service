const express = require('express');
const { getLocationByLisKey } = require('./gisService');

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

app.listen(PORT, () => {
  console.log(`GIS Location Service running on port ${PORT}`);
});

module.exports = app;
