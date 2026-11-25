import { randomUUID } from 'node:crypto';
import { HttpError } from '../lib/http-error.js';
import { prisma } from '../lib/prisma.js';

export function calculateCouponDiscount(coupon,price){const numericPrice=Number(price),rawDiscount=coupon.discount_type==='percent'?numericPrice*Number(coupon.discount_value)/100:Number(coupon.discount_value),discount=Math.min(numericPrice,Math.max(0,rawDiscount));return{discount:Number(discount.toFixed(2)),finalPrice:Number(Math.max(0,numericPrice-discount).toFixed(2))};}

export async function validateCourseCoupon({code,courseId,userId,price,db=prisma}){
  const rows=await db.$queryRawUnsafe("SELECT * FROM coupons WHERE UPPER(code)=UPPER($1) AND is_active=TRUE AND (course_id IS NULL OR course_id=$2::uuid) AND (expires_at IS NULL OR expires_at>NOW()) FOR UPDATE",code,courseId);
  if(!rows.length)throw new HttpError(400,'Coupon is invalid or expired');
  const coupon=rows[0],counts=(await db.$queryRawUnsafe("SELECT (SELECT COUNT(*)::int FROM coupon_redemptions WHERE coupon_id=$1::uuid)+(SELECT COUNT(*)::int FROM coupon_claims WHERE coupon_id=$1::uuid AND status='pending' AND expires_at>NOW()) total,(SELECT COUNT(*)::int FROM coupon_redemptions WHERE coupon_id=$1::uuid AND user_id=$2::uuid)+(SELECT COUNT(*)::int FROM coupon_claims WHERE coupon_id=$1::uuid AND user_id=$2::uuid AND status='pending' AND expires_at>NOW()) user_total",String(coupon.id),userId))[0];
  if(coupon.max_uses!=null&&counts.total>=coupon.max_uses)throw new HttpError(400,'Coupon usage limit reached');
  if(counts.user_total>=coupon.max_uses_per_user)throw new HttpError(400,'You have already used this coupon');
  return{coupon,...calculateCouponDiscount(coupon,price)};
}

export async function claimCoupon({couponId,userId,courseId,paymentIntentId,discount,db=prisma}){
  const rows=await db.$queryRawUnsafe('SELECT * FROM coupons WHERE id=$1::uuid AND is_active=TRUE AND (course_id IS NULL OR course_id=$2::uuid) AND (expires_at IS NULL OR expires_at>NOW()) FOR UPDATE',couponId,courseId);
  if(!rows.length)throw new HttpError(400,'Coupon is invalid or expired');
  const coupon=rows[0],counts=(await db.$queryRawUnsafe("SELECT (SELECT COUNT(*)::int FROM coupon_redemptions WHERE coupon_id=$1::uuid)+(SELECT COUNT(*)::int FROM coupon_claims WHERE coupon_id=$1::uuid AND status='pending' AND expires_at>NOW()) total,(SELECT COUNT(*)::int FROM coupon_redemptions WHERE coupon_id=$1::uuid AND user_id=$2::uuid)+(SELECT COUNT(*)::int FROM coupon_claims WHERE coupon_id=$1::uuid AND user_id=$2::uuid AND status='pending' AND expires_at>NOW()) user_total",couponId,userId))[0];
  if(coupon.max_uses!=null&&counts.total>=coupon.max_uses)throw new HttpError(400,'Coupon usage limit reached');
  if(counts.user_total>=coupon.max_uses_per_user)throw new HttpError(400,'You have already used this coupon');
  await db.$executeRawUnsafe("INSERT INTO coupon_claims(id,coupon_id,user_id,course_id,payment_intent_id,discount_applied,status,expires_at,created_at) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,'pending',NOW()+INTERVAL '30 minutes',NOW())",randomUUID(),couponId,userId,courseId,paymentIntentId,discount);
}

export async function redeemCouponForPayment(paymentIntentId){
  return prisma.$transaction(async(tx)=>{
    const rows=await tx.$queryRawUnsafe("UPDATE coupon_claims SET status='redeemed' WHERE payment_intent_id=$1 AND status='pending' RETURNING *",paymentIntentId);
    if(!rows.length)return false;
    const claim=rows[0];
    await tx.$executeRawUnsafe('INSERT INTO coupon_redemptions(id,coupon_id,user_id,course_id,discount_applied,created_at) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,NOW())',randomUUID(),String(claim.coupon_id),String(claim.user_id),String(claim.course_id),claim.discount_applied);
    return true;
  });
}

export async function failCouponClaim(paymentIntentId){await prisma.$executeRawUnsafe("UPDATE coupon_claims SET status='failed' WHERE payment_intent_id=$1 AND status='pending'",paymentIntentId);}

export async function completeComplimentaryCoursePurchase({couponId,userId,courseId,discount}){
  return prisma.$transaction(async(tx)=>{
    await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))',`${userId}:${courseId}`);
    const existing=await tx.$queryRawUnsafe('SELECT 1 FROM enrollments WHERE user_id=$1::uuid AND course_id=$2::uuid',userId,courseId);
    if(existing.length)throw new HttpError(409,'Already enrolled');
    const paymentIntentId=`complimentary:${randomUUID()}`;
    await claimCoupon({couponId,userId,courseId,paymentIntentId,discount,db:tx});
    await tx.$executeRawUnsafe("INSERT INTO course_payments(id,user_id,course_id,payment_intent_id,amount,status,coupon_id,discount_applied,created_at) VALUES($1::uuid,$2::uuid,$3::uuid,$4,0,'paid',$5::uuid,$6,NOW())",randomUUID(),userId,courseId,paymentIntentId,couponId,discount);
    await tx.$executeRawUnsafe("UPDATE coupon_claims SET status='redeemed' WHERE payment_intent_id=$1",paymentIntentId);
    await tx.$executeRawUnsafe('INSERT INTO coupon_redemptions(id,coupon_id,user_id,course_id,discount_applied,created_at) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,NOW())',randomUUID(),couponId,userId,courseId,discount);
    const rows=await tx.$queryRawUnsafe("INSERT INTO enrollments(id,user_id,course_id,status,progress_percent,enrolled_at) VALUES($1::uuid,$2::uuid,$3::uuid,'active',0,NOW()) RETURNING *",randomUUID(),userId,courseId);
    return rows[0];
  });
}
