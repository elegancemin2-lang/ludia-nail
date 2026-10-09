import fs from 'node:fs/promises';
import path from 'node:path';
import {parseCandidate} from './booking-reader.js';
export async function atomicJson(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',JSON.stringify(value,null,2),{encoding:'utf8',mode:0o600});await fs.rename(file+'.tmp',file)}
export function localExport(state,now=new Date().toISOString()){const bookings=Object.values(state.bookings||{}).map(x=>x.row).filter(Boolean);if(bookings.length>1000)throw Error('local_export_limit');return{schema:'ludia-naver-export/v1',parserVerified:true,exportedAt:now,sourceEvidence:'verified-rendered-dom',attachmentsSupported:false,bookings:bookings.map(r=>({bookingNo:r.bookingNo,date:r.date,time:r.time,status:r.status,phone:r.phone,customerName:r.customerName||null,serviceName:r.serviceName||null,staffName:r.staffName||null,duration:r.duration||null}))}}
export function enrichLocalRows(rows,state){const byId=new Map(rows.map(parseCandidate).filter(Boolean).map(r=>[r.bookingNo,r]));return{...state,bookings:Object.fromEntries(Object.entries(state.bookings||{}).map(([id,item])=>[id,{...item,row:{...item.row,...(byId.get(id)||{})}}]))}}
