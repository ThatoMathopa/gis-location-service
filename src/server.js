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
 * Called by SAP Service Cloud V2 External Hook (Pre-Hook) before Case save.
 *
 * SSCv2 External Hook sends the FULL Case payload as the POST body.
 * We read Case.id which equals ZGIS_LOCATION.GUID in S/4HANA.
 * The GIS picker widget wrote the Case UUID into ZGIS_LOCATION.GUID
 * when the agent confirmed a location.
 *
 * IMPORTANT: Response must be a FLAT object using exact Case extension
 * field technical names. SSCv2 maps the response directly onto the Case.
 * No wrapper like { success, location } — just the flat fields.
 *
 * Body (sent by SSCv2): full Case object including { id, Street, Suburb, ... }
 * Response: flat object with Case extension field names as keys
 */
app.post('/api/location/lookup', async (req, res) => {
  const casePayload = req.body;
  const caseId = casePayload?.id;

  console.log('[GIS Pre-Hook] Case id:', caseId);

  if (!caseId || String(caseId).trim() === '') {
    console.warn('[GIS Pre-Hook] No id in Case payload — skipping lookup');
    return res.status(200).json({});
  }

  try {
    const location = await getLocationByGuid(String(caseId).trim());

    if (!location) {
      console.warn(`[GIS Pre-Hook] No GIS record found for GUID: ${caseId}`);
      return res.status(200).json({});
    }

    console.log('[GIS Pre-Hook] Location found:', location.Street, location.Suburb);

    // Flat response — exact Case extension field technical names
    // SSCv2 maps these directly back onto the Case before save
    return res.status(200).json({
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
    });

  } catch (err) {
    console.error('[GIS Pre-Hook Error]', err.message);
    // Return 200 with empty body so SSCv2 doesn't block the Case save
    return res.status(200).json({});
  }
});

/**
 * POST /api/location/enrich
 *
 * Alternative endpoint for direct calls outside the Pre-Hook.
 * Accepts { guid, caseId } and returns the same flat response.
 */
app.post('/api/location/enrich', async (req, res) => {
  const { guid, caseId } = req.body;

  if (!guid) {
    return res.status(400).json({ error: 'guid is required' });
  }

  try {
    const location = await getLocationByGuid(String(guid).trim());

    if (!location) {
      return res.status(404).json({ error: `No GIS location found for GUID: ${guid}` });
    }

    return res.status(200).json({
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
