const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');

const DESTINATION_NAME = process.env.S4H_DESTINATION || 'THD_NEW';

const BASE_URL =
  '/sap/opu/odata4/sap/zsb_gis_location/srvd_a2x/sap/zsd_gis_location/0001/GisLocation';

/**
 * Fetch GIS location by GUID (direct OData key lookup).
 * GUID in ZGIS_LOCATION = SSCv2 Case UUID.
 *
 * @param {string} guid - SSCv2 Case UUID
 * @returns {object|null}
 */
async function getLocationByGuid(guid) {
  try {
    const response = await executeHttpRequest(
      { destinationName: DESTINATION_NAME },
      {
        method: 'GET',
        url:    `${BASE_URL}('${encodeURIComponent(guid)}')`,
        params: {
          $format: 'json',
          $select: 'Guid,Liskey,Erfno,StreetNo,PortionNo,Street,Suburb,Ward,Region,NearestCorner,GisX,GisY'
        }
      }
    );
    return response.data || null;
  } catch (err) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

/**
 * Fetch by LIS Key using $filter (used by Pre-Hook fallback).
 *
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

module.exports = { getLocationByGuid, getLocationByLisKey };
