// Checking the name of a property a request picks or makes.
import { MAX_PROPERTY_NAME } from '../../shared/limits.js';
import { badRequest } from '../errors.js';

/**
 * The property name `value`, as given: an existing property's name is
 * matched exactly, spaces and all. Throws a 400 unless it's text that isn't
 * blank and fits MAX_PROPERTY_NAME.
 */
export function parsePropertyName(value) {
  if (typeof value !== 'string' || !value.trim()) throw badRequest('Name a property.');
  if (value.length > MAX_PROPERTY_NAME) throw badRequest(`A property's name can be at most ${MAX_PROPERTY_NAME} characters.`);
  return value;
}
