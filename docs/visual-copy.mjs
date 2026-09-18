import {PDFDocument} from './vendor/pdf-lib.mjs';

// Same renderer is used for preview and export. ENABLE draws form appearances
// into the canvas; ENABLE_FORMS would omit widgets for a separate HTML layer.
export const renderOptions={intent:'display',annotationMode:1,background:'rgb(255,255,255)'};
export function fitBox(source,target){
  const scale=Math.min(target.width/source.width,target.height/source.height);
  return {width:source.width*scale,height:source.height*scale,x:(target.width-source.width*scale)/2,y:(target.height-source.height*scale)/2,scale};
}
export function rasterScale(source,target,dpi=300){
  const desired=fitBox(source,target).scale*dpi/72;
  // Keep one canvas below common mobile limits. Report reduced resolution.
  return Math.min(desired,4096/source.width,4096/source.height,Math.sqrt(14000000/(source.width*source.height)));
}
function aborted(signal){if(signal?.aborted)throw new DOMException('Conversion canceled.','AbortError');}
export async function createVisualCopy(source,pages,target,{createCanvas,encodeCanvas,signal,onProgress=()=>{}}={}){
  if(!createCanvas||!encodeCanvas)throw new Error('A canvas renderer is required.');
  const output=await PDFDocument.create();output.setCreator('Page Fit');output.setProducer('Page Fit — visual copy');
  let minDpi=300,encodedTotal=0;
  for(let index=0;index<pages.length;index++){
    aborted(signal);
    const page=await source.getPage(index+1),geometry=pages[index];
    const scale=rasterScale(geometry,target),viewport=page.getViewport({scale});
    const canvas=createCanvas(Math.max(1,Math.ceil(viewport.width)),Math.max(1,Math.ceil(viewport.height)));
    const context=canvas.getContext('2d');
    if(!context)throw new Error('Your browser could not create the page image. Try a smaller PDF.');
    const task=page.render({canvasContext:context,viewport,...renderOptions});
    const cancel=()=>task.cancel();signal?.addEventListener('abort',cancel,{once:true});
    try{
      await task.promise;aborted(signal);
      const bytes=await encodeCanvas(canvas);aborted(signal);
      encodedTotal+=bytes.byteLength;
      if(encodedTotal>180*1024*1024)throw new Error('The converted images exceed 180 MB. Split this PDF into smaller files and try again.');
      const image=await output.embedJpg(bytes),fitted=fitBox(geometry,target);
      output.addPage([target.width,target.height]).drawImage(image,{x:fitted.x,y:fitted.y,width:fitted.width,height:fitted.height});
      minDpi=Math.min(minDpi,scale/fitted.scale*72);
      onProgress(index+1,pages.length);
    }finally{signal?.removeEventListener('abort',cancel);canvas.width=1;canvas.height=1;}
  }
  aborted(signal);
  const bytes=await output.save();aborted(signal);
  return {bytes,target,minDpi:Math.floor(minDpi),visual:true};
}
