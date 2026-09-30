export function parseCommercialCsv(text) {
  if(typeof text!=='string'||text.length>10_000_000)throw new Error('CSV input too large or invalid');
  const rows=[];let row=[],field='',quoted=false,closed=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
    if(c==='"'){if(field||closed)throw new Error('Unexpected CSV quote');quoted=true;}
    else if(c===','||c==='\n'){row.push(field);field='';closed=false;if(c==='\n'){if(row.some(x=>x!==''))rows.push(row);row=[];}}
    else if(c==='\r'&&text[i+1]==='\n')continue;
    else {if(closed)throw new Error('Text after closing CSV quote');field+=c;}
  }
  if(quoted)throw new Error('Unterminated CSV quote');
  if(field||row.length||closed){row.push(field);rows.push(row);}
  if(!rows.length)throw new Error('Empty CSV');
  const headers=rows.shift().map((x,i)=>i===0?x.replace(/^\uFEFF/,'').trim():x.trim());
  if(headers.some(x=>!x)||new Set(headers).size!==headers.length)throw new Error('Empty or duplicate CSV headers');
  return rows.map((values,i)=>{if(values.length!==headers.length)throw new Error(`CSV column count mismatch row ${i+2}`);return Object.fromEntries(headers.map((h,j)=>[h,values[j]]));});
}
export function commercialCsv(rows,headers=Object.keys(rows[0]??{})){
  const esc=value=>{let s=String(value??'UNKNOWN');if(/^[=+@\t\r]/.test(s)||/^-[^0-9]/.test(s))s="'"+s;return /[",\n\r]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
  return [headers.map(esc).join(','),...rows.map(row=>headers.map(key=>esc(row[key])).join(','))].join('\n')+'\n';
}
