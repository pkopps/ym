import fs from 'node:fs/promises';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const root='/Users/patrickkopps/Documents/app',tmp=root+'/tmp/investor-deck-20260920/build';
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(root+'/outputs/investor-deck-20260920/YardMatch-Investor-Model.xlsx'));
const a=wb.worksheets.getItem('Assumptions');
for(const [cell,expected] of [['D3','Base'],['D4','Proposed'],['D70',0],['D114',.04],['D144',.02],['J38',.6]])if(a.getRange(cell).values[0][0]!==expected)throw Error('Saved control mismatch: '+cell);
const im=await wb.render({sheetName:'Unit economics',range:'C59:J69',scale:1.4,format:'png'});
await fs.writeFile(tmp+'/ach-breakeven-saved.png',new Uint8Array(await im.arrayBuffer()));
console.log('Reopened workbook controls verified.');
