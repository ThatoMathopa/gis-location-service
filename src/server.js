const express = require('express');
const { getLocationByGuid } = require('./gisService');

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
 * POST /api/location/lookup
 *
 * Called by SAP Service Cloud V2 Pre-Hook before Case save.
 *
 * The Case `id` in SSCv2 is the same UUID stored as GUID in ZGIS_LOCATION.
 * The GIS picker widget confirms a location and writes the Case UUID into
 * ZGIS_LOCATION.GUID. The Pre-Hook reads Case.id and sends it here.
 *
 * Body:     { "guid": "<case-id-uuid>" }
 * Response: { "success": true, "location": { Street, StreetNo, Suburb, ... } }
 */
app.post('/api/location/lookup', async (req, res) => {
  const { guid } = req.body;

  if (!guid || String(guid).trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'guid is required'
    });
  }

  try {
    const location = await getLocationByGuid(String(guid).trim());

    if (!location) {
      return res.status(404).json({
        success: false,
        error: `No GIS location found for GUID: ${guid}`
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
        Liskey:        location.Liskey        || '',
        GisX:          location.GisX          || '',
        GisY:          location.GisY          || '',
        Guid:          location.Guid          || ''
      }
    });

  } catch (err) {
    console.error('[GIS Lookup Error]', err.message);
    return res.status(500).json({
      success: false,
      error: 'Internal error during GIS lookup',
      detail: err.message
    });
  }
});

/**
 * POST /api/location/enrich
 *
 * Same as /lookup but accepts caseId explicitly for logging/tracing.
 * Useful for direct calls outside the Pre-Hook.
 *
 * Body:     { "guid": "<uuid>", "caseId": "<case-uuid>" }
 * Response: { "success": true, "message": "...", "location": { ... } }
 */
app.post('/api/location/enrich', async (req, res) => {
  const { guid, caseId } = req.body;

  if (!guid || !caseId) {
    return res.status(400).json({
      success: false,
      error: 'guid and caseId are required'
    });
  }

  try {
    const location = await getLocationByGuid(String(guid).trim());

    if (!location) {
      return res.status(404).json({
        success: false,
        error: `No GIS location found for GUID: ${guid}`
      });
    }

    return res.json({
      success: true,
      message: `Case ${caseId} enriched with GIS data for GUID ${guid}`,
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
        GisY:          location.GisY          || '',
        Guid:          location.Guid          || ''
      }
    });

  } catch (err) {
    console.error('[GIS Enrich Error]', err.message);
    return res.status(500).json({
      success: false,
      error: 'Internal error during GIS enrich',
      detail: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`GIS Location Service running on port ${PORT}`);
});

module.exports = app;
