import { useEffect, useState } from 'react';
import { api } from '../api.js';

/**
 * The layer's properties, summarised for building filters (see
 * fieldSummaries in server/filter/fields.js). Fetched once per layer, and
 * again whenever its features are changed in place.
 *
 * @param {number} layerId
 * @param {number} [dataVersion] the layer's `data_version`; a new one fetches them again
 * @returns {{ fields: object[] | null, error: string | null }} `fields` is
 *   null until loaded; `error` says why loading failed.
 */
export function useFieldSummaries(layerId, dataVersion = 0) {
  const [state, setState] = useState({ fields: null, error: null });

  useEffect(() => {
    let current = true;
    setState({ fields: null, error: null });
    api.layerFields(layerId).then(
      (fields) => current && setState({ fields, error: null }),
      (error) => current && setState({ fields: null, error: error.message }),
    );
    return () => { current = false; };
  }, [layerId, dataVersion]);

  return state;
}
