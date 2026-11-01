function drawCompactRoad(canvas,ctx,packet,course){
 const w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 const me=packet?.me,s=me?.s||0,unit=Math.min(w/23,h/16),base=course.frame(s);
 const middle=y=>{
  const ahead=course.point(s+(h*.72-y)/unit);
  return w*.5+unit*((ahead.x-base.x)*base.nx+(ahead.z-base.z)*base.nz);
 };
 ctx.fillStyle='#50afb1';ctx.fillRect(0,0,w,h);
 for(let y=0;y<h;y+=4){const x=middle(y);ctx.fillStyle='#d4ba85';ctx.fillRect(x-7*unit,y,14*unit,4);ctx.fillStyle='#665e5d';ctx.fillRect(x-6*unit,y,12*unit,4);
 ctx.fillStyle=Math.floor((s+(h*.72-y)/unit)/2)%2?'#fff1cb':'#c55643';for(const side of [-1,1])ctx.fillRect(x+side*6*unit-unit*.16,y,unit*.32,4);}
 const lap=Math.floor(s/course.lapLength),tints={turbo:'#ffc653',wave:'#ff806f',shield:'#76e8ff',magnet:'#dd94ff'};
 for(const index of [lap,lap+1]){
  for(const [row,mark] of [0,...course.boxes].entries()){
   const y=h*.72-(index*course.lapLength+mark-s)*unit;if(y<0||y>h)continue;
   ctx.fillStyle=row?tints[course.pickupType(row-1,index)]:'white';
   for(const l of (row?course.lanes(row-1):[-4,-2,0,2,4]))ctx.fillRect(middle(y)+l*unit-unit*.4,y,unit*.8,unit*.55);
  }
 }
 function car(k,slot){const y=h*.72-(k.s-s)*unit,x=middle(y)+k.lat*unit;ctx.fillStyle='#24282b';ctx.fillRect(x-unit,y-unit,2*unit,unit*2);ctx.fillStyle=slot?'#24745b':'#c44233';ctx.fillRect(x-unit*.7,y-unit*1.4,unit*1.4,unit*2.8);ctx.font=unit*1.2+'px system-ui';ctx.textAlign='center';ctx.fillText(slot?'🐼':'🦊',x,y+unit*.3);}
 if(packet?.other)car(packet.other,1-packet.slot);car(me||{s:0,lat:0},packet?.slot||0);
}
