(() => {
  'use strict';
  const data=window.TRIP_DATA,geo=window.RouteGeometry,client=window.OpenRouteClient;
  const root=document.querySelector('#map'),toolbar=document.querySelector('#map-toolbar');
  if(!root || !data || !geo || !client)return;
  const status=document.querySelector('#map-status'),info=document.querySelector('#map-selection'),list=document.querySelector('#control-details');
  const esc=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const groups=[],models=[],cards=new Map();
  let map,light,selected=null,hovered=null,controlsVisible=true;
  let queue=Promise.resolve(),lastRequest=0;
  const setStatus=message=>{status.textContent=message;};
  const visible=m=>m.group.visible && (!m.control || controlsVisible);
  const sourceLinks=item=>`<p><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">官方管制公告 ↗</a>${item.geometry?.source ? ` · <a href="${esc(item.geometry.source)}" target="_blank" rel="noopener noreferrer">里程定位參考 ↗</a>` : ''}</p>`;
  function show(model) {info.hidden=false;info.querySelector('.map-selection-copy').innerHTML=model.html;}
  function repaint() {
    for(const m of models) {
      const active=m===selected || m===hovered;
      m.line.setStyle({color:active ? '#fff176' : m.color,weight:active ? m.weight+5 : m.weight,opacity:.95});
      m.halo.setStyle({color:active ? '#593c00' : '#fff',weight:active ? m.weight+10 : m.weight+3});
      for(const layer of [m.halo,m.line,m.hit]) {if(visible(m)){if(!map.hasLayer(layer))layer.addTo(map);}else map.removeLayer(layer);}
      if(active && visible(m)){m.halo.bringToFront();m.line.bringToFront();m.hit.bringToFront();}
    }
    const active=hovered || selected;
    if(active && visible(active)) {
      light.setLatLng(active.focusPoint || [active.path[Math.floor(active.path.length/2)].lat,active.path[Math.floor(active.path.length/2)].lng]);
      if(!map.hasLayer(light))light.addTo(map);light.bringToFront();
    }else map.removeLayer(light);
    for(const [id,card] of cards) {
      const matching=models.filter(m=>m.controlId===id && visible(m));
      card.classList.toggle('is-highlighted',matching.some(m=>m===selected || m===hovered));
      card.querySelector('.control-location-status').textContent=matching.length ? '已對齊目前顯示的道路路線 · '+card._item.geometry.note : '尚未載入對應路線／未匹配樁位；不繪製推測直線。';
    }
  }
  function clear(){selected=null;hovered=null;info.hidden=true;repaint();}
  function addLine(group,path,{title,html,color,controlId=null}) {
    const control=controlId!==null,weight=control ? 10 : 5;
    const points=path.map(p=>[p.lat,p.lng]);
    const halo=L.polyline(points,{color:'#fff',weight:weight+3,opacity:.95,interactive:false,smoothFactor:0,pane:control ? 'controlRoads' : 'baseRoads'});
    const line=L.polyline(points,{color,weight,opacity:.95,interactive:false,smoothFactor:0,pane:control ? 'controlRoads' : 'baseRoads'});
    const hit=L.polyline(points,{color,weight:26,opacity:0,smoothFactor:0,bubblingMouseEvents:false,pane:control ? 'controlHits' : 'roadHits'});
    const model={group,path,title,html,color,controlId,control,weight,halo,line,hit};
    models.push(model);group.models.push(model);
    hit.on('mouseover',event=>{model.focusPoint=event.latlng;hovered=model;repaint();show(model);});
    hit.on('mouseout',()=>{hovered=null;repaint();if(selected)show(selected);else info.hidden=true;});
    hit.on('click',event=>{model.focusPoint=event.latlng;selected=model;repaint();show(model);});
    return model;
  }
  function fit(group) {
    const points=(group ? group.models : models.filter(visible)).filter(m=>!m.control).flatMap(m=>m.path.map(p=>[p.lat,p.lng]));
    if(points.length)map.fitBounds(points,{padding:[28,28]});
  }
  function attachControls(group,path) {
    for(const item of data.controlMap.sections) {
      const spec=item.geometry;
      if(!spec || !spec.segments.some(code=>group.codes.includes(code)))continue;
      const slice=geo.mileageSlice(path,spec);
      if(slice.length<2)continue;
      const html=`<strong>${esc(item.title)}</strong><p>${esc(item.time)}</p><p>${esc(item.detail)}</p><p class="map-precision">${esc(spec.note)}</p><small>公告核對 ${esc(data.controlMap.checked)}；通行依現場指揮。</small>${sourceLinks(item)}`;
      addLine(group,slice,{title:item.title,html,color:{window:'#ce203d',mobile:'#bc5700',unknown:'#8055b5'}[item.kind],controlId:item.id});
    }
  }
  function renderControls() {
    list.innerHTML=`<p>橙：機動管制 · 紅：限時通行／夜間封閉 · 紫：待複核。管制粗線截取自相同道路路徑；小數里程依參考樁位推估，非測量界線。未匹配工區只保留清單。官方公告核對 ${esc(data.controlMap.checked)}。</p>`;
    for(const item of data.controlMap.sections) {
      const card=document.createElement('details');card.className='map-control-card';card._item=item;
      card.innerHTML=`<summary>${esc(item.title)}<span>${esc(item.time)}</span></summary><p class="control-location-status">尚未載入對應路線／未匹配樁位；不繪製推測直線。</p><p>${esc(item.detail)}</p>${sourceLinks(item)}`;
      const activate=pin=>{const m=models.find(m=>m.controlId===item.id && visible(m));if(!m)return;if(pin)selected=m;else hovered=m;repaint();show(m);};
      card.addEventListener('mouseenter',()=>activate(false));
      card.addEventListener('mouseleave',()=>{hovered=null;repaint();if(selected)show(selected);else info.hidden=true;});
      card.addEventListener('focusin',()=>activate(false));
      card.addEventListener('focusout',event=>{if(!card.contains(event.relatedTarget)){hovered=null;repaint();if(selected)show(selected);else info.hidden=true;}});
      card.querySelector('summary').addEventListener('click',()=>activate(true));
      cards.set(item.id,card);list.appendChild(card);
    }
  }
  async function queuedFetch(url,options={}) {
    const task=queue.then(async()=>{
      const wait=1200-(Date.now()-lastRequest);
      if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
      lastRequest=Date.now();
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
      try {
        const response=await fetch(url,{...options,signal:controller.signal,credentials:'omit'});
        if(!response.ok)throw new Error(response.status===429 ? 'RATE_LIMIT' : 'SERVICE_UNAVAILABLE');
        return await response.json();
      }finally{clearTimeout(timer);}
    });
    queue=task.catch(()=>{});return task;
  }
  // Same-origin OSM snapshots can replace network routing once the owner saves an export.
  const snapshots=fetch('road-routes.geojson',{credentials:'same-origin'}).then(r=>r.ok ? r.json() : {features:[]}).catch(()=>({features:[]}));
  function addRoadPart(group,part,index,total,source) {
    const html=`<strong>${esc(group.label)}｜第${index+1}/${total}段</strong><p>道路長度約${part.distance.toFixed(1)}公里 · ${esc(source)}</p><p>${esc(group.note)}</p><p>開放路網規劃，非Google導航，未核實所有機車限制與當日通阻；餐休、泡湯與管制停等仍依每日檢核點安排。</p>`;
    addLine(group,part.path,{title:group.label,html,color:group.color});
  }
  async function load(group) {
    if(group.loading || group.complete)return;
    group.loading=true;group.button.setAttribute('aria-busy','true');group.button.disabled=true;
    group.failed=false;group.errors.textContent='';group.errors.hidden=true;
    try {
      const snapshot=await snapshots;
      const signature=JSON.stringify(group.nodes);
      const saved=(snapshot.features || []).find(f=>f.properties?.groupId===group.id && f.properties?.signature===signature && f.geometry?.type==='LineString');
      if(saved && group.done.size===0) {
        const parts=client.parse({trip:{status:0,legs:[{shape:saved.geometry,summary:{length:saved.properties.distanceKm}}]}});
        group.parts=parts;group.complete=true;
        addRoadPart(group,parts[0],0,1,'本站保存的OpenStreetMap道路軌跡');
      }else {
        const batches=client.chunks(group.nodes);
        for(let i=0;i<batches.length;i++) {
          if(group.done.has(i))continue;
          setStatus(`正在載入${group.label}道路路線（${i+1}/${batches.length}）；免金鑰，不使用Google API。`);
          const payload=client.request(batches[i]);
          const url=new URL('https://valhalla1.openstreetmap.de/route');url.searchParams.set('json',JSON.stringify(payload));
          const response=await queuedFetch(url.toString(),{headers:{'X-Client-Id':'gehr-travel-personal-itinerary'}});
          const parts=client.parse(response);
          const path=parts.flatMap(p=>p.path);
          const measured=geo.measure(path);
          if(batches[i].some(([lat,lng])=>geo.project(measured,{lat,lng}).distance>600))throw new Error('WAYPOINT_MISMATCH');
          if(i && group.partsByBatch[i-1]) {
            const previous=group.partsByBatch[i-1].at(-1).path.at(-1);
            if(geo.distance(previous,path[0])>50)throw new Error('DISCONNECTED_ROUTE');
          }
          group.partsByBatch[i]=parts;group.done.add(i);
          parts.forEach((part,j)=>addRoadPart(group,part,j,parts.length,'Valhalla／OpenStreetMap即時計算'));
          repaint();
        }
        group.parts=group.partsByBatch.flat();group.complete=true;
      }
      const path=group.parts.flatMap(p=>p.path);attachControls(group,path);
      group.exportButton.hidden=false;
      group.summary.textContent=`${group.label}｜道路路線已載入 · ${group.parts.reduce((n,p)=>n+p.distance,0).toFixed(1)}公里`;
      setStatus(`${group.label}已載入。滑入或點擊線條查看；重複切換不重新查詢。${group.partialStart ? ' 新店集合點座標未核實，地圖由坪林起算；新店→坪林請用每日分段導航。' : ''}`);
    }catch(error){
      group.failed=true;group.errors.hidden=false;
      const code=['RATE_LIMIT','NO_ROUTE','INVALID_PATH','WAYPOINT_MISMATCH','DISCONNECTED_ROUTE'].includes(error.message) ? error.message : 'SERVICE_UNAVAILABLE';
      group.errors.textContent=`${group.label}未能完整載入（${code}）。${group.done.size ? '已取得路段仍顯示；' : ''}未以直線替代。請稍後點此路線按鈕重試，或使用每日導航。`;
      setStatus('開放路線服務暫時不可用或無法匹配途經點。行程與管制清單仍可查看；沒有Google API費用。');
      group.summary.textContent=`${group.label}｜${group.done.size ? '部分路段已載入' : '尚未取得道路軌跡'}`;
    }finally {
      group.loading=false;group.button.removeAttribute('aria-busy');group.button.disabled=false;repaint();if(group.visible)fit(group);
    }
  }
  function makeGroup(id,label,color,nodes,codes,note='',partialStart=false) {
    const button=document.createElement('button');button.type='button';button.className='map-toggle';button.textContent=label;button.style.setProperty('--day-color',color);button.setAttribute('aria-pressed','false');toolbar.appendChild(button);
    const row=document.createElement('div');row.className='map-route-result';
    const summary=document.createElement('p');summary.textContent=label+'｜點選後載入道路路線';
    const errors=document.createElement('p');errors.className='map-route-errors';errors.hidden=true;
    const exportButton=document.createElement('button');exportButton.type='button';exportButton.className='text-button';exportButton.textContent='匯出這條道路軌跡';exportButton.hidden=true;
    row.append(summary,errors,exportButton);document.querySelector('#map-route-results').appendChild(row);
    const group={id,label,color,nodes,codes,note,partialStart,button,summary,errors,exportButton,visible:false,models:[],parts:[],partsByBatch:[],done:new Set(),complete:false,loading:false,failed:false};groups.push(group);
    button.addEventListener('click',async()=>{
      if(group.loading)return;
      group.visible=group.failed ? true : !group.visible;button.setAttribute('aria-pressed',String(group.visible));button.classList.toggle('active',group.visible);
      if(!group.visible && (selected?.group===group || hovered?.group===group))clear();
      repaint();if(group.visible){await load(group);fit(group);}
    });
    exportButton.addEventListener('click',()=>{
      const collection={type:'FeatureCollection',features:[{type:'Feature',properties:{groupId:id,signature:JSON.stringify(nodes),source:'OpenStreetMap / Valhalla',generatedAt:new Date().toISOString(),distanceKm:group.parts.reduce((n,p)=>n+p.distance,0)},geometry:{type:'LineString',coordinates:group.parts.flatMap(p=>p.path.map(p=>[p.lng,p.lat]))}}]};
      const url=URL.createObjectURL(new Blob([JSON.stringify(collection)],{type:'application/geo+json'}));const a=document.createElement('a');a.href=url;a.download=id+'-road.geojson';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    return group;
  }
  renderControls();
  if(!window.L){setStatus('地圖元件未能載入；每日導航與官方管制清單仍可使用。');return;}
  map=L.map(root,{scrollWheelZoom:false}).setView([23.7,121],7);
  for(const [name,zIndex] of [['baseRoads',410],['roadHits',420],['controlRoads',430],['controlHits',440],['selectionLight',450]])map.createPane(name).style.zIndex=zIndex;
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
  light=L.circleMarker([23.7,121],{radius:9,color:'#704d00',weight:3,fillColor:'#fff176',fillOpacity:1,interactive:false,pane:'selectionLight'});
  map.on('click',clear);
  document.querySelector('#map-selection-close').addEventListener('click',clear);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')clear();});
  for(const day of data.days) {
    const nodes=day.mapPoints.map(p=>p.slice(0,2));
    if(day.meeting && data.meeting.coordinates)nodes.unshift(data.meeting.coordinates);
    makeGroup(day.id,day.day===1 ? 'Day 1 · 北宜主線' : `Day ${day.day} · ${day.date}`,day.color,nodes,day.segments.map(s=>s.code),day.focus,day.meeting && !data.meeting.coordinates);
    if(day.alternative)makeGroup(day.id+'-alternative',`Day ${day.day} · ${day.alternative.mapLabel}`,'#687d98',day.alternative.mapPoints.map(p=>p.slice(0,2)),day.alternative.segments.map(s=>s.code),day.alternative.note);
  }
  makeGroup('day-1-western','Day 1 · 西部備案','#8055b5',data.controlMap.western.points,['西1A'],data.controlMap.western.note+' 新店起點僅為地區參考，非碧興門市精確落點。');
  const controls=document.createElement('button');controls.type='button';controls.className='map-toggle active';controls.textContent='管制色帶';controls.setAttribute('aria-pressed','true');controls.addEventListener('click',()=>{controlsVisible=!controlsVisible;controls.setAttribute('aria-pressed',String(controlsVisible));controls.classList.toggle('active',controlsVisible);if(!controlsVisible && (selected?.control || hovered?.control))clear();repaint();});toolbar.appendChild(controls);
  const all=document.createElement('button');all.type='button';all.className='map-toggle';all.textContent='顯示已載入路線全貌';all.addEventListener('click',()=>fit());toolbar.appendChild(all);
  setStatus('請點選一天或備案載入道路路線。免Google金鑰；只有點選未載入的路線才會請求開放路線服務。');
})();
