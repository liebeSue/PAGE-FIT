import { PDFDocument, PDFName, PDFNumber, PDFObjectCopier, degrees } from './vendor/pdf-lib.mjs';

export function pageGeometry(page) {
  const media = page.getMediaBox(), crop = page.getCropBox();
  const left = Math.max(media.x, crop.x), bottom = Math.max(media.y, crop.y);
  const right = Math.min(media.x + media.width, crop.x + crop.width);
  const top = Math.min(media.y + media.height, crop.y + crop.height);
  const rawWidth = right - left, rawHeight = top - bottom;
  const unitObj = page.node.lookup(PDFName.of('UserUnit'));
  const unit = unitObj instanceof PDFNumber ? unitObj.asNumber() : 1;
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  if (![0,90,180,270].includes(rotation) || ![rawWidth,rawHeight,unit].every(n => Number.isFinite(n) && n > 0)) throw new Error('This PDF has an invalid page size or rotation. Please export a fresh copy and try again.');
  const sideways = rotation === 90 || rotation === 270;
  return {left,bottom,right,top,rawWidth,rawHeight,unit,rotation,width:(sideways?rawHeight:rawWidth)*unit,height:(sideways?rawWidth:rawHeight)*unit};
}

export async function openPdf(bytes) {
  let pdf;
  try { pdf = await PDFDocument.load(bytes, {updateMetadata:false, throwOnInvalidObject:true}); }
  catch (error) { if (/encrypt|password/i.test(String(error))) throw new Error('Password-protected PDFs are not supported. Save an unlocked copy using an approved PDF editor, then try again.'); throw new Error('This file could not be read as a PDF. Try exporting a fresh PDF and choosing it again.'); }
  if (!pdf.getPageCount()) throw new Error('This PDF has no pages.');
  if (pdf.getPageCount() > 1000) throw new Error('This PDF has more than 1,000 pages. Split it into smaller files before resizing.');
  const features = [];
  if (pdf.catalog.has(PDFName.of('AcroForm'))) features.push('forms');
  if (pdf.catalog.has(PDFName.of('Perms'))) features.push('signatures');
  if (pdf.catalog.has(PDFName.of('OCProperties'))) features.push('layers');
  const pages = pdf.getPages();
  for (const page of pages) {
    const annotations = page.node.Annots();
    if (annotations) for(let i=0;i<annotations.size();i++) {
      const annotation = annotations.lookup(i);
      if (annotation.get?.(PDFName.of('Subtype'))?.toString() !== '/Link' && !features.includes('annotations')) features.push('annotations');
    }
  }
  return {pdf, pages:pages.map(pageGeometry), visual:features.length>0, features};
}

export function targetSize(pages, mode, orientation='portrait') {
  if (!pages.length) throw new Error('Choose a PDF first.');
  let size;
  if(mode==='first') size=pages[0];
  else if(mode==='largest') size=pages.reduce((a,b)=>a.width*a.height >= b.width*b.height ? a:b);
  else if(mode==='a4') size={width:210/25.4*72,height:297/25.4*72};
  else if(mode==='letter') size={width:612,height:792};
  else throw new Error('Choose a valid page size.');
  if(!['portrait','landscape'].includes(orientation)) throw new Error('Choose a valid paper orientation.');
  const swapped=(mode==='a4'||mode==='letter')&&orientation==='landscape';
  const result={width:swapped?size.height:size.width,height:swapped?size.width:size.height};
  if(result.width>14400 || result.height>14400) throw new Error('The selected output size exceeds 200 inches. Choose A4 or US Letter instead.');
  return result;
}

export async function normalizePdf(pdf, pages, target, progress=()=>{}) {
  if (![target.width,target.height].every(n=>Number.isFinite(n)&&n>0&&n<=14400)) throw new Error('Invalid output dimensions.');
  const output=await PDFDocument.create();
  output.setCreator('Page Fit'); output.setProducer('Page Fit / pdf-lib');
  const sourcePages=pdf.getPages();
  const copier=PDFObjectCopier.for(pdf.context,output.context);
  for(let i=0;i<sourcePages.length;i++) {
    const g=pages[i], source=sourcePages[i];
    const page=output.addPage([target.width,target.height]);
    // Embed just the existing visible page box. Bake its existing display rotation
    // into the placement; never choose a new rotation to make it fit.
    if(source.node.Contents()) {
      const embedded=await output.embedPage(source,{left:g.left,bottom:g.bottom,right:g.right,top:g.top});
      await embedded.embed();
      // Preserve a transparency group when the source page declares one.
      const group=source.node.get(PDFName.of('Group'));
      if(group) output.context.lookup(embedded.ref).dict.set(PDFName.of('Group'),copier.copy(group));
      const fit=Math.min(target.width/g.width,target.height/g.height);
      const w=g.rawWidth*g.unit*fit,h=g.rawHeight*g.unit*fit;
      let x=(target.width-g.width*fit)/2,y=(target.height-g.height*fit)/2;
      if(g.rotation===90) y+=w;
      else if(g.rotation===180){x+=w;y+=h;}
      else if(g.rotation===270) x+=h;
      page.drawPage(embedded,{x,y,width:w,height:h,rotate:degrees(-g.rotation)});
    }
    progress(i+1,sourcePages.length);
  }
  return output.save();
}
