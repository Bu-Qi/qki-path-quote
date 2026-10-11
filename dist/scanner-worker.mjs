import {optimize} from './optimizer.mjs';
self.onmessage=({data})=>{try{self.postMessage({result:optimize(data.pools,data.cap,512)})}catch(error){self.postMessage({error:error.message})}};
