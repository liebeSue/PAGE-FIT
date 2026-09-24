import {openPdf,targetSize,normalizePdf} from './pdf-core.mjs?v=20260924-2';
let documentState=null;
self.onmessage=async({data})=>{
  const {id,action}=data;
  try{
    if(action==='load'){
      documentState=null;
      documentState=await openPdf(data.bytes);
      self.postMessage({id,pages:documentState.pages,visual:documentState.visual,features:documentState.features});
    }else if(action==='resize'){
      if(!documentState) throw new Error('Choose a PDF first.');
      if(documentState.visual) throw new Error('Use visual-copy conversion for this PDF to include its fields and annotations.');
      const target=targetSize(documentState.pages,data.mode,data.orientation);
      const bytes=await normalizePdf(documentState.pdf,documentState.pages,target,(done,total)=>self.postMessage({id,progress:Math.round(done/total*95)}));
      self.postMessage({id,bytes:bytes.buffer,target},[bytes.buffer]);
    }else throw new Error('Unknown operation.');
  }catch(error){self.postMessage({id,error:error.message||'The PDF could not be processed.'});}
};
