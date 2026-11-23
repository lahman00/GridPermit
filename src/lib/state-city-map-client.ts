// No map SDK, remote tiles, geolocation, scroll handlers or animation loop.
export function initCityMaps(){
 for(const root of document.querySelectorAll<HTMLElement>('[data-city-explorer]')){
  const canvas=root.querySelector<HTMLElement>('[data-map-canvas]')!;
  const points=root.querySelector<HTMLElement>('[data-map-points]')!;
  const input=root.querySelector<HTMLInputElement>('[data-map-search]')!;
  const reset=root.querySelector<HTMLButtonElement>('[data-map-reset]')!;
  const status=root.querySelector<HTMLElement>('[data-map-status]')!;
  const list=root.querySelector<HTMLElement>('[data-map-list]')!;
  const items=[...root.querySelectorAll<HTMLElement>('[data-map-city]')];
  let selected:Set<HTMLElement>|null=null;
  const normalize=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function filter(){const query=normalize(input.value.trim());let visible=0;for(const item of items){item.hidden=!(normalize(item.dataset.name!).includes(query)&&(!selected||selected.has(item)));if(!item.hidden)visible++}status.textContent=`${visible} of ${items.length} published city guides${selected?' in selected area':''}`;reset.hidden=!query&&!selected;root.querySelector<HTMLElement>('[data-map-empty]')!.hidden=visible!==0;list.scrollTop=0;}
  function render(){
   const size=canvas.clientWidth;if(!size)return;
   const groups:{x:number;y:number;items:HTMLElement[]}[]=[];
   for(const item of items.filter(i=>normalize(i.dataset.name!).includes(normalize(input.value.trim())))){
    const px=Number(item.dataset.x),py=Number(item.dataset.y);
    const x=(.90*px-.18*py+84)/600*size,y=(.18*px+.75*py+20)/600*size;
    // Fixed anchors keep every distinct 48px touch target apart.
    const group=groups.find(g=>Math.abs(g.x-x)<54&&Math.abs(g.y-y)<54);
    if(group)group.items.push(item);else groups.push({x,y,items:[item]});
   }
   points.replaceChildren();
   for(const group of groups){const b=document.createElement('button');b.type='button';b.className='map-point';b.style.left=`${group.x/size*100}%`;b.style.top=`${group.y/size*100}%`;b.textContent=String(group.items.length);b.setAttribute('aria-label',group.items.length===1?`Show ${group.items[0]!.dataset.name} guide`:`Show ${group.items.length} nearby city guides`);b.setAttribute('aria-pressed',String(!!selected&&group.items.every(i=>selected!.has(i))));b.addEventListener('click',()=>{selected=new Set(group.items);filter();for(const other of points.querySelectorAll('button'))other.setAttribute('aria-pressed',String(other===b));list.querySelector<HTMLAnchorElement>('li:not([hidden]) a')?.focus({preventScroll:true});list.scrollIntoView({block:'nearest',behavior:'instant'});});points.append(b);}
  }
  input.addEventListener('input',()=>{selected=null;filter();render()});reset.addEventListener('click',()=>{input.value='';selected=null;filter();render();input.focus()});
  canvas.hidden=false;root.querySelector<HTMLElement>('[data-map-help]')!.hidden=false;filter();render();new ResizeObserver(render).observe(canvas);
 }
}
