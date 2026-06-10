const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');

const SSCV2_DESTINATION = process.env.SSCV2_DESTINATION || 'Case_Object';

/**
 * PATCHes a SSCv2 Case with GIS location fields.
 *
 * Uses the Case_Object BTP destination which points to SSCv2.
 * The GUID from ZGIS_LOCATION equals the SSCv2 Case UUID.
 *
 * SSCv2 Case PATCH API:
 * PATCH /sap/c4c/odata/v1/c4codataapi/CaseCollection('<caseId>')
 *
 * @param {string} caseId - SSCv2 Case UUID (= ZGIS_LOCATION.GUID)
 * @param {object} location - Location record from ZGIS_LOCATION
 */
async function patchCaseLocation(caseId, location) {
  const payload = {
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
  };

  console.log('[SSCv2] Patching Case:', caseId, 'with payload:', JSON.stringify(payload));

  const response = await executeHttpRequest(
    { destinationName: SSCV2_DESTINATION },
    {
      method:  'PATCH',
      url:     `/sap/c4c/odata/v1/c4codataapi/CaseCollection('${encodeURIComponent(caseId)}')`,
      headers: {
        'Content-Type': 'application/json',
        'Accept':        'application/json'
      },
      data: payload
    }
  );

  console.log('[SSCv2] PATCH response status:', response.status);
  return response;
}

module.exports = { patchCaseLocation };
