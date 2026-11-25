import { prisma } from '../lib/prisma.js';
import { enqueueDurable } from './durable.js';
import { cancelExpiredOrders } from '../services/order-lifecycle.js';

export async function processPaidOrder(orderId){
  return prisma.$transaction(async(tx)=>{
    const claimed=await tx.$queryRawUnsafe("UPDATE orders SET status='processing',updated_at=NOW() WHERE id=$1::uuid AND status='paid' RETURNING *",orderId);
    if(!claimed.length)return{status:'already_processed',order_id:orderId};
    const order=claimed[0];
    const items=await tx.$queryRawUnsafe('SELECT * FROM order_items WHERE order_id=$1::uuid',orderId);
    if(order.billing_email){
      await enqueueDurable('send_order_confirmation',{
        email:order.billing_email,
        name:order.billing_name||'Customer',
        order_id:String(order.id),
        total:String(order.total),
        items:items.map((item)=>({name:item.product_name,quantity:item.quantity,total:String(item.total_price)})),
      },{db:tx});
    }
    return{status:'processed',order_id:orderId};
  });
}
export function enqueuePaidOrder(orderId){return enqueueDurable('process_paid_order',{order_id:orderId},{maxAttempts:5});}
export async function cancelStaleOrders(){return{cancelled:await cancelExpiredOrders()};}
