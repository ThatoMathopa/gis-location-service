const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');

const DESTINATION_NAME = process.env.S4H_DESTINATION || 'THD_NEW';

const BASE_URL =
  '/sap/opu/odata4/sap/zsb_gis_location/srvd_a2x/sap/zsd_gis_location/0001/GisLocation';

/**
 * Primary lookup: fetch GIS location by GUID (direct OData key lookup).
 *
 * Case.id in SSCv2 === ZGIS_LOCATION.GUID in S/4HANA.
 * The GIS picker widget embedded in the Case form confirms a location
 * and writes the Case UUID into ZGIS_LOCATION.GUID. This fetches that record.
 *
 * Uses direct key lookup: GisLocation('<guid>') — faster than $filter.
 *
 * @param {string} guid - The Case id from SSCv2 (= GUID in ZGIS_LOCATION)
 * @returns {object|null} Full location record or null if not found
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
 * Fallback: fetch by LIS Key using $filter.
 * Use if the Case stores LISKey instead of GUID.
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
