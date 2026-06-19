const express = require('express');
  const { getLocationByGuid } = require('./gisService');
  const { patchCaseLocation } = require('./sscv2Service');

  const app = express();
  app.use(express.json());
  const PORT = process.env.PORT || 3000;

  app.get('/health', (req, res) => res.json({ status: 'UP', service: 'gis-location-service' }));

  app.post('/api/location/lookup', async (req, res) => {
    const body         = req.body || {};
    const currentImage = body.currentImage || {};
    const beforeImage  = body.beforeImage  || {};
    const context      = body.context      || {};
    const currExt      = currentImage.extensions || {};
    const prevExt      = beforeImage.extensions  || {};

    console.log('[GIS] op:', context.operation, '| caseId:', beforeImage.id, '| GUID:', currExt.GUID);

    const caseId = beforeImage.id || currentImage.id || context.id || context.caseId || null;
    const guid   = currExt.GUID   || prevExt.GUID    || caseId;

    res.status(200).json({ data: {} });

    if (!guid || !caseId) { console.warn('[GIS] skip - no guid/caseId'); return; }

    setImmediate(async () => {
      try {
        const loc = await getLocationByGuid(guid);
        if (!loc) { console.warn('[GIS] no CPI record for', guid); return; }
        console.log('[GIS] found', loc.Street, loc.Suburb, 'patching', caseId);
        await patchCaseLocation(caseId, loc);
        console.log('[GIS] patched OK', caseId);
      } catch (e) { console.error('[GIS] error:', e.message); }
    });
  });

  app.post('/api/location/sync', async (req, res) => {
    const { guid } = req.body;
    if (!guid) return res.status(400).json({ error: 'guid required' });
    try {
      const loc = await getLocationByGuid(String(guid).trim());
      if (!loc) return res.status(404).json({ error: 'not found' });
      return res.status(200).json({ success: true, location: loc });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  });

  app.listen(PORT, () => console.log('GIS Location Service running on port ' + PORT));
  module.exports = app;
