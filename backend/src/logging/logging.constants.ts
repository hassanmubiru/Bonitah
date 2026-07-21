/**
 * Header used to propagate a correlation/request id across services and back to
 * clients. Kept in a dependency-free module so it can be imported without
 * pulling in the logging module's configuration wiring.
 */
export const REQUEST_ID_HEADER = 'x-request-id';
