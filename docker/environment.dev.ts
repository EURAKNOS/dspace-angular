/*
 * The contents of this file are subject to the license and copyright
 * detailed in the LICENSE and NOTICE files at the root of the source
 * tree and available online at
 *
 * http://www.dspace.org/license/
 */
import { GlobalConfig } from '../src/config/global-config.interface.ts';

export const environment: Partial<GlobalConfig> = {
  rest: {
    ssl: false,
    host: 'api.dspace.poc.euraknos.cf',
    port: 80,
    // NOTE: Space is capitalized because 'namespace' is a reserved string in TypeScript
    nameSpace: '/server/api'
  }
};
