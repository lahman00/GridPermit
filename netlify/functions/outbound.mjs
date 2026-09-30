import {getStore} from '@netlify/blobs';
import routes from '../generated/outbound-routes.json' with {type:'json'};
import {createOutboundHandler} from '../../src/lib/commercial/outbound-service.mjs';
export default createOutboundHandler({routes,getStore:()=>getStore({name:'gridpermit-outbound-v1',consistency:'strong'})});
export const config={path:'/go/:partner',rateLimit:{windowLimit:10,windowSize:60,aggregateBy:['ip','domain']}};
