/* Build OSM snapshots once so visitors do not depend on a live routing service. */
const fs=require('fs'),path=require('path'),vm=require('vm'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const client=require('../assets/open-route-client.js'),geo=require('../assets/route-geometry.js');
const scope={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'trips/2026/qiedigua/route-data.js'),'utf8'),scope);
const data=scope.window.TRIP_DATA,out=path.join(root,'trips/2026/qiedigua/road-routes.geojson');
const existing=JSON.parse(fs.readFileSync(out,'utf8'));
const groups=[];
for(const day of data.days){
 const nodes=day.mapPoints.map(p=>p.slice(0,2));if(day.meeting && data.meeting.coordinates)nodes.unshift(data.meeting.coordinates);
 groups.push({id:day.id,nodes});
 if(day.alternative)groups.push({id:day.id+'-alternative',nodes:day.alternative.mapPoints.map(p=>p.slice(0,2))});
}
groups.push({id:'day-1-western',nodes:data.controlMap.western.points});
(async()=>{
 let last=0,failed=0;
 for(const group of groups){
  const signature=JSON.stringify(group.nodes);
  if(existing.features.some(f=>f.properties.groupId===group.id && f.properties.signature===signature)){console.log(group.id+': snapshot already present');continue;}
  try{
   const parts=[];
   for(const batch of client.chunks(group.nodes)){
    const wait=1200-(Date.now()-last);if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));last=Date.now();
    const result=spawnSync('curl',['--fail','--silent','--show-error','--max-time','45','--get','-H','X-Client-Id: gehr-travel-personal-itinerary-build','--data-urlencode','json='+JSON.stringify(client.request(batch)),'https://valhalla1.openstreetmap.de/route'],{encoding:'utf8',maxBuffer:16*1024*1024});
    if(result.status!==0)throw new Error((result.stderr || 'Connection failed').trim());
    const received=client.parse(JSON.parse(result.stdout)),m=geo.measure(received.flatMap(p=>p.path));
    if(batch.some(([lat,lng])=>geo.project(m,{lat,lng}).distance>600))throw new Error('Waypoint mismatch');
    if(parts.length && geo.distance(parts.at(-1).path.at(-1),received[0].path[0])>50)throw new Error('Disconnected route');
    parts.push(...received);
   }
   existing.features=existing.features.filter(f=>f.properties.groupId!==group.id);
   existing.features.push({type:'Feature',properties:{groupId:group.id,signature,source:'OpenStreetMap / Valhalla',generatedAt:new Date().toISOString(),distanceKm:parts.reduce((n,p)=>n+p.distance,0)},geometry:{type:'LineString',coordinates:parts.flatMap(p=>p.path.map(p=>[p.lng,p.lat]))}});
   fs.writeFileSync(out,JSON.stringify(existing));console.log(group.id+': saved '+parts.reduce((n,p)=>n+p.path.length,0)+' road vertices');
  }catch(error){failed++;console.error(group.id+': '+error.message);}
 }
 if(failed)process.exitCode=1;
})();
