import routes from '../netlify/generated/outbound-routes.json' with {type: 'json'};
import {makeRetention} from '../src/lib/commercial/vercel-handlers.mjs';

export default {fetch: makeRetention({routeRows: routes})};
