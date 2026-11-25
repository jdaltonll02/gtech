import { processPaidOrder } from './orders.js';
import { sendCourseCompletion,sendOrderConfirmation } from '../services/email.js';

export const durableJobHandlers={
  process_paid_order:({order_id})=>processPaidOrder(order_id),
  send_order_confirmation:({email,name,order_id,total,items})=>sendOrderConfirmation(email,name,order_id,total,items),
  send_course_completion:({email,name,course_title,certificate_number,certificate_url})=>sendCourseCompletion(email,name,course_title,certificate_number,certificate_url),
};
