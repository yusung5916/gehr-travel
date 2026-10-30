/* Road overlays are slices of returned paths, never independent straight lines. */
((root) => {
  'use strict';
  const point = p => ({lat: typeof p.lat === 'function' ? p.lat() : p.lat, lng: typeof p.lng === 'function' ? p.lng() : p.lng});
  function distance(a, b) {
    const x = (a.lng-b.lng)*111320*Math.cos((a.lat+b.lat)*Math.PI/360);
    const y = (a.lat-b.lat)*111320;
    return Math.hypot(x,y);
  }
  function measure(input) {
    const path = input.map(point), lengths = [0];
    for (let i=1;i<path.length;i++) lengths.push(lengths[i-1]+distance(path[i-1],path[i]));
    return {path,lengths,total:lengths[lengths.length-1] || 0};
  }
  function project(measured, anchor) {
    let best = {distance:Infinity,along:0};
    const {path,lengths} = measured;
    for(let i=1;i<path.length;i++) {
      const a=path[i-1], b=path[i];
      const scale=111320*Math.cos(anchor.lat*Math.PI/180);
      const ax=(a.lng-anchor.lng)*scale, ay=(a.lat-anchor.lat)*111320;
      const bx=(b.lng-anchor.lng)*scale, by=(b.lat-anchor.lat)*111320;
      const dx=bx-ax, dy=by-ay;
      const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy || 1)));
      const gap=Math.hypot(ax+t*dx,ay+t*dy);
      if(gap<best.distance) best={distance:gap,along:lengths[i-1]+t*(lengths[i]-lengths[i-1])};
    }
    return best;
  }
  function at(measured, along) {
    const {path,lengths,total}=measured;
    along=Math.max(0,Math.min(total,along));
    for(let i=1;i<path.length;i++) if(lengths[i]>=along) {
      const t=(along-lengths[i-1])/(lengths[i]-lengths[i-1] || 1);
      return {lat:path[i-1].lat+t*(path[i].lat-path[i-1].lat),lng:path[i-1].lng+t*(path[i].lng-path[i-1].lng)};
    }
    return path[path.length-1];
  }
  function slice(measured, start, end) {
    if(start>end) [start,end]=[end,start];
    start=Math.max(0,start);end=Math.min(measured.total,end);
    if(end-start<1) return [];
    return [at(measured,start),...measured.path.filter((_,i)=>measured.lengths[i]>start && measured.lengths[i]<end),at(measured,end)];
  }
  function mileageSlice(input, spec) {
    const measured=measure(input);
    if(measured.path.length<2 || !spec.anchors?.length) return [];
    const anchors=spec.anchors.map(([km,lat,lng])=>({km,...project(measured,{lat,lng})}));
    function locate(km) {
      const exact=anchors.find(a=>a.km===km);
      if(exact) return exact.distance<=160 ? exact.along : null;
      const a=anchors.filter(a=>a.km<km).sort((a,b)=>b.km-a.km)[0];
      const b=anchors.filter(a=>a.km>km).sort((a,b)=>a.km-b.km)[0];
      if(!a || !b || a.distance>160 || b.distance>160) return null;
      const expected=(b.km-a.km)*1000, actual=Math.abs(b.along-a.along);
      // Reject a nearby parallel road, closure detour, or ambiguous hairpin match.
      if(actual<expected*.55 || actual>expected*1.5) return null;
      return a.along+(b.along-a.along)*(km-a.km)/(b.km-a.km);
    }
    const a=locate(spec.from),b=locate(spec.to);
    if(a===null || b===null) return [];
    const expected=Math.abs(spec.to-spec.from)*1000;
    if(expected && (Math.abs(a-b)<expected*.55 || Math.abs(a-b)>expected*1.5)) return [];
    // Point worksites use a clearly labeled 160m vicinity, not a claimed boundary.
    return slice(measured,Math.min(a,b)-(a===b ? 80 : 0),Math.max(a,b)+(a===b ? 80 : 0));
  }
  const api={point,distance,measure,project,slice,mileageSlice};
  if(typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.RouteGeometry=api;
})(typeof window !== 'undefined' ? window : globalThis);
