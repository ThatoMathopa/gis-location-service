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
 * SSCv2 External Hook Pre-Hook.
 *
 * IMPORTANT: currentImage only contains CHANGED fields.
 * Standard id never changes so never appears in currentImage.
 * Extension fields only appear if changed during this save.
 * GUID only appears in extensions after mashup confirms location.
 *
 * Payload structure:
 * {
 *   entity: "...",
 *   currentImage: {
 *     extensions: { GUID: "...", LISKey: "..." }  <- only if changed
 *   },
 *   beforeImage: { id: "...", extensions: { GUID: "..." } },
 *   context: { ... },
 *   skipValidations: false
 * }
 *
 * Lookup priority:
 * 1. currentImage.extensions.GUID  (set by mashup this save)
 * 2. beforeImage.extensions.GUID   (set by mashup previous save)
 * 3. context.id or context.caseId  (Case UUID from context)
 * 4. beforeImage.id                (Case UUID from beforeImage)
 */
app.post('/api/location/lookup', async (req, res) => {
  const body         = req.body || {};
  const currentImage = body.currentImage || {};
  const beforeImage  = body.beforeImage  || {};
  const context      = body.context      || {};
  const currExt      = currentImage.extensions || {};
  const prevExt      = beforeImage.extensions  || {};

  // Full debug log — remove after confirming structure
  console.log('[GIS Debug] context keys:', Object.keys(context));
  console.log('[GIS Debug] context:', JSON.stringify(context));
  console.log('[GIS Debug] beforeImage keys:', Object.keys(beforeImage));
  console.log('[GIS Debug] beforeImage.id:', beforeImage.id);
  console.log('[GIS Debug] beforeImage.extensions:', JSON.stringify(prevExt));
  console.log('[GIS Debug] currentImage.extensions:', JSON.stringify(currExt));

  // Lookup priority — find GUID from any available source
  const guid =
    currExt.GUID      ||
    prevExt.GUID      ||
    context.id        ||
    context.caseId    ||
    context.objectId  ||
    beforeImage.id    ||
    null;

  const lisKey =
    currExt.LISKey    ||
    prevExt.LISKey    ||
    null;

  console.log('[GIS Pre-Hook] Resolved GUID:', guid);
  console.log('[GIS Pre-Hook] Resolved LISKey:', lisKey);

  if (!guid && !lisKey) {
    console.warn('[GIS Pre-Hook] No lookup key found — returning empty value');
    return res.status(200).json({ value: {} });
  }

  try {
    let location = null;

    if (guid) {
      console.log('[GIS Pre-Hook] Lookup by GUID:', guid);
      location = await getLocationByGuid(guid);
    }

    if (!location && lisKey) {
      console.log('[GIS Pre-Hook] Fallback to LISKey:', lisKey);
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

app.post('/api/location/sync', async (req, res) => {
  const { guid } = req.body;
  if (!guid) return res.status(400).json({ success: false, error: 'guid is required' });
  try {
    const location = await getLocationByGuid(String(guid).trim());
    if (!location) return res.status(404).json({ success: false, error: `No record for GUID: ${guid}` });
    return res.status(200).json({ success: true, location });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`GIS Location Service running on port ${PORT}`);
});

module.exports = app;
