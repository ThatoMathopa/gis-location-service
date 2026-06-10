const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');

const DESTINATION_NAME = process.env.S4H_DESTINATION || 'S4H_GIS_DEST';

const BASE_URL =
  '/sap/opu/odata4/sap/zsb_gis_location/srvd_a2x/sap/zsd_gis_location/0001/GisLocation';

/**
 * Fetches a GIS location record by LIS Key from S/4HANA OData V4.
 * @param {string} lisKey
 * @returns {object|null}
 */
async function getLocationByLisKey(lisKey) {
  const response = await executeHttpRequest(
    { destinationName: DESTINATION_NAME },
    {
      method: 'GET',
      url:    BASE_URL,
      params: {
        $filter:  `Liskey eq '${encodeURIComponent(lisKey)}'`,
        $top:     '1',
        $format:  'json',
        $select:  'Guid,Liskey,Erfno,StreetNo,PortionNo,Street,Suburb,Ward,Region,NearestCorner,GisX,GisY'
      }
    }
  );

  const records = response.data?.value;
  if (!records || records.length === 0) return null;
  return records[0];
}

/**
 * Fetches a GIS location record directly by GUID.
 * @param {string} guid
 * @returns {object|null}
 */
async function getLocationByGuid(guid) {
  const response = await executeHttpRequest(
    { destinationName: DESTINATION_NAME },
    {
      method: 'GET',
      url:    `${BASE_URL}('${encodeURIComponent(guid)}')`,
      params: { $format: 'json' }
    }
  );
  return response.data || null;
}

module.exports = { getLocationByLisKey, getLocationByGuid };
