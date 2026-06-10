const CPI_URL  = process.env.CPI_GIS_URL  || 'https://cotdevcode.it-cpi033-rt.cfapps.eu10-005.hana.ondemand.com/http/Dev/S4/OData/GetGISLocations';
  const CPI_USER = process.env.CPI_USER || '';
  const CPI_PASS = process.env.CPI_PASS || '';

  function basicAuth() {
    return 'Basic ' + Buffer.from(CPI_USER + ':' + CPI_PASS).toString('base64');
  }

  async function getLocationByGuid(guid) {
    const url = new URL(CPI_URL);
    url.searchParams.set('GUID', guid);
    console.log('[GIS CPI] GET', url.toString());
    const r = await fetch(url.toString(), {
      method: 'GET',
      headers: { Authorization: basicAuth(), Accept: 'application/json' }
    });
    console.log('[GIS CPI] status:', r.status);
    if (r.status === 404) return null;
    if (!r.ok) { const t = await r.text(); throw new Error('CPI ' + r.status + ': ' + t); }
    const d = await r.json();
    if (d && d.value && Array.isArray(d.value)) return d.value.length > 0 ? d.value[0] : null;
    if (Array.isArray(d)) return d.length > 0 ? d[0] : null;
    return d || null;
  }

  module.exports = { getLocationByGuid };
