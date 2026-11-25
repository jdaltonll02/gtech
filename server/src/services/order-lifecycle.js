import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { HttpError } from '../lib/http-error.js';
import { prisma } from '../lib/prisma.js';
import { enqueueDurable } from '../jobs/durable.js';

const money=(value)=>Number(value).toFixed(2);

async function restoreInventory(tx,orderId){
  const items=await tx.$queryRawUnsafe('SELECT product_id,quantity FROM order_items WHERE order_id=$1::uuid',orderId);
  for(const item of items){
    await tx.$executeRawUnsafe('UPDATE products SET stock_quantity=stock_quantity+$1,in_stock=TRUE,updated_at=NOW() WHERE id=$2::uuid',item.quantity,String(item.product_id));
  }
}

export async function createOrderFromCart({userId,paymentProvider,billingEmail,billingName,phoneNumber,shippingAddress}){
  return prisma.$transaction(async(tx)=>{
    const cartRows=await tx.$queryRawUnsafe('SELECT ci.*,p.name product_name,p.price,p.discounted_price,p.stock_quantity,p.in_stock,p.is_active FROM cart_items ci JOIN products p ON p.id=ci.product_id WHERE ci.user_id=$1::uuid ORDER BY p.id FOR UPDATE OF p',userId);
    if(!cartRows.length)throw new HttpError(400,'Cart is empty');

    for(const item of cartRows){
      if(!item.is_active||!item.in_stock||item.stock_quantity<item.quantity)throw new HttpError(409,`${item.product_name} does not have enough stock`);
      const updated=await tx.$queryRawUnsafe('UPDATE products SET stock_quantity=stock_quantity-$1,in_stock=(stock_quantity-$1)>0,updated_at=NOW() WHERE id=$2::uuid AND is_active=TRUE AND in_stock=TRUE AND stock_quantity>=$1 RETURNING id',item.quantity,String(item.product_id));
      if(!updated.length)throw new HttpError(409,`${item.product_name} is no longer available in the requested quantity`);
    }

    const subtotal=cartRows.reduce((sum,item)=>sum+Number(item.discounted_price??item.price)*item.quantity,0);
    const tax=Math.round(subtotal*config.TAX_RATE*100)/100,total=subtotal+tax,orderId=randomUUID();
    await tx.$executeRawUnsafe("INSERT INTO orders(id,user_id,status,subtotal,tax,total,payment_provider,payment_status,billing_email,billing_name,phone_number,shipping_address,created_at,updated_at) VALUES($1::uuid,$2::uuid,'payment_pending',$3,$4,$5,$6,'pending',$7,$8,$9,$10::jsonb,NOW(),NOW())",orderId,userId,money(subtotal),money(tax),money(total),paymentProvider,billingEmail,billingName,phoneNumber??null,JSON.stringify(shippingAddress));
    for(const item of cartRows){
      const unit=Number(item.discounted_price??item.price);
      await tx.$executeRawUnsafe('INSERT INTO order_items(id,order_id,product_id,quantity,unit_price,total_price,product_name) VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7)',randomUUID(),orderId,String(item.product_id),item.quantity,money(unit),money(unit*item.quantity),item.product_name);
    }
    await tx.$executeRawUnsafe('DELETE FROM cart_items WHERE user_id=$1::uuid',userId);
    return (await tx.$queryRawUnsafe('SELECT * FROM orders WHERE id=$1::uuid',orderId))[0];
  });
}

export async function markStripeOrderPaid(paymentIntentId){
  return prisma.$transaction(async(tx)=>{const rows=await tx.$queryRawUnsafe("UPDATE orders SET payment_status='completed',status='paid',updated_at=NOW() WHERE payment_intent_id=$1 AND payment_status='pending' AND status='payment_pending' RETURNING id",paymentIntentId);if(rows.length)await enqueueDurable('process_paid_order',{order_id:String(rows[0].id)},{db:tx,maxAttempts:5});return rows[0]??null;});
}

export async function markReferenceOrderPaid(reference,userId=null){
  return prisma.$transaction(async(tx)=>{const rows=userId
    ?await tx.$queryRawUnsafe("UPDATE orders SET payment_status='completed',status='paid',updated_at=NOW() WHERE payment_reference=$1 AND user_id=$2::uuid AND payment_status='pending' AND status='payment_pending' RETURNING id",reference,userId)
    :await tx.$queryRawUnsafe("UPDATE orders SET payment_status='completed',status='paid',updated_at=NOW() WHERE payment_reference=$1 AND payment_status='pending' AND status='payment_pending' RETURNING id",reference);
  if(rows.length)await enqueueDurable('process_paid_order',{order_id:String(rows[0].id)},{db:tx,maxAttempts:5});return rows[0]??null;});
}

export async function failStripeOrder(paymentIntentId){
  return prisma.$transaction(async(tx)=>{
    const rows=await tx.$queryRawUnsafe("UPDATE orders SET payment_status='failed',status='cancelled',updated_at=NOW() WHERE payment_intent_id=$1 AND payment_status='pending' AND status='payment_pending' RETURNING id",paymentIntentId);
    if(rows.length)await restoreInventory(tx,String(rows[0].id));
    return rows[0]??null;
  });
}

export async function cancelExpiredOrders(){
  return prisma.$transaction(async(tx)=>{
    const rows=await tx.$queryRawUnsafe("UPDATE orders SET status='cancelled',updated_at=NOW() WHERE status='payment_pending' AND payment_status='pending' AND created_at<NOW()-INTERVAL '24 hours' RETURNING id");
    for(const order of rows)await restoreInventory(tx,String(order.id));
    return rows.length;
  });
}
