import {PrismaClient} from '@prisma/client';
import {mkdir,writeFile} from 'node:fs/promises';
const prisma=new PrismaClient();
try {
  const days=Number(process.env.PHOTO_RETENTION_REVIEW_DAYS);
  if(!Number.isInteger(days)||days<1) throw new Error('Set an owner-approved PHOTO_RETENTION_REVIEW_DAYS to produce a review inventory. This script never deletes data.');
  const cutoff=new Date(Date.now()-days*86400000);
  const summary={generatedAt:new Date().toISOString(),reviewAgeDays:days,bookingsReviewed:0,photosForReview:0,disputedBookingsHeld:0,financialRecordsDeleted:0,photosDeleted:0};
  let cursor;
  while(true) {
    const bookings=await prisma.booking.findMany({where:{completedAt:{lt:cutoff}},orderBy:{id:'asc'},take:200,...(cursor?{cursor:{id:cursor},skip:1}:{}),select:{id:true,disputedAt:true,serviceEvidence:true}});
    if(!bookings.length) break;
    for(const booking of bookings) {
      summary.bookingsReviewed++;
      if(booking.disputedAt) {summary.disputedBookingsHeld++;continue;}
      const evidence=Array.isArray(booking.serviceEvidence)?booking.serviceEvidence:[];
      summary.photosForReview+=evidence.length;
    }
    cursor=bookings.at(-1).id;
  }
  const evidenceDirectory = new URL('../reports/ci/data-lifecycle/', import.meta.url);
  await mkdir(evidenceDirectory,{recursive:true});
  await writeFile(new URL('inventory.json', evidenceDirectory),JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary));
} finally {await prisma.$disconnect();}
