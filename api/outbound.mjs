import routes from '../netlify/generated/outbound-routes.json' with {type: 'json'};
import {makeOutbound} from '../src/lib/commercial/vercel-handlers.mjs';

export default {fetch: makeOutbound({routeRows: routes})};
