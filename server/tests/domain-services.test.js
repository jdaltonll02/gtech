import { beforeEach,describe,expect,it,vi } from 'vitest';

process.env.SECRET_KEY='test-secret-key-that-is-at-least-thirty-two-characters';
process.env.DATABASE_URL='postgresql://test:test@localhost:5432/test';
process.env.ENVIRONMENT='test';

const db=vi.hoisted(()=>({$queryRawUnsafe:vi.fn(),$executeRawUnsafe:vi.fn(),$transaction:vi.fn()}));
vi.mock('../src/lib/prisma.js',()=>({prisma:db}));

const {calculateCouponDiscount,completeComplimentaryCoursePurchase}=await import('../src/services/course-coupons.js');
const {managedCourseIds,assertCourseManager}=await import('../src/services/course-access.js');
const {createOrderFromCart,markStripeOrderPaid}=await import('../src/services/order-lifecycle.js');
const {enqueueDurable}=await import('../src/jobs/durable.js');

describe('course coupon calculations',()=>{
  it('calculates percentage and fixed discounts without producing negative totals',()=>{
    expect(calculateCouponDiscount({discount_type:'percent',discount_value:25},100)).toEqual({discount:25,finalPrice:75});
    expect(calculateCouponDiscount({discount_type:'fixed',discount_value:200},100)).toEqual({discount:100,finalPrice:0});
  });
  it('redeems a full discount and enrolls without an external payment',async()=>{
    const tx={$queryRawUnsafe:vi.fn(),$executeRawUnsafe:vi.fn()};
    tx.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{id:'coupon-1',max_uses:10,max_uses_per_user:1}])
      .mockResolvedValueOnce([{total:0,user_total:0}])
      .mockResolvedValueOnce([{id:'enrollment-1',status:'active'}]);
    db.$transaction.mockImplementation((work)=>work(tx));
    await expect(completeComplimentaryCoursePurchase({couponId:'coupon-1',userId:'user-1',courseId:'course-1',discount:100})).resolves.toMatchObject({id:'enrollment-1'});
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('course_payments'),expect.any(String),'user-1','course-1',expect.stringMatching(/^complimentary:/),'coupon-1',100);
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('coupon_redemptions'),expect.any(String),'coupon-1','user-1','course-1',100);
  });
});

describe('course manager scope',()=>{
  beforeEach(()=>vi.clearAllMocks());
  it('combines role metadata and instructor assignments',async()=>{
    db.$queryRawUnsafe
      .mockResolvedValueOnce([{permissions:['manage_own_courses'],role_metadata:{course_ids:['course-a']}}])
      .mockResolvedValueOnce([{course_id:'course-b'}]);
    await expect(managedCourseIds({id:'user-1',role:'user'})).resolves.toEqual(['course-a','course-b']);
  });
  it('rejects access outside the assigned course scope',async()=>{
    db.$queryRawUnsafe.mockResolvedValueOnce([{permissions:['manage_own_courses'],role_metadata:{course_ids:['course-a']}}]).mockResolvedValueOnce([]);
    await expect(assertCourseManager({id:'user-1',role:'user'},'course-b')).rejects.toMatchObject({status:403});
  });
});

describe('order inventory lifecycle',()=>{
  beforeEach(()=>vi.clearAllMocks());
  it('rejects checkout before creating an order when stock is insufficient',async()=>{
    const tx={$queryRawUnsafe:vi.fn().mockResolvedValueOnce([{product_name:'Last item',product_id:'product-1',quantity:2,stock_quantity:1,in_stock:true,is_active:true}]),$executeRawUnsafe:vi.fn()};
    db.$transaction.mockImplementation((work)=>work(tx));
    await expect(createOrderFromCart({userId:'user-1',paymentProvider:'stripe',billingEmail:'buyer@example.com',billingName:'Buyer',shippingAddress:{address:'1 Main',city:'Monrovia',country:'Liberia'}})).rejects.toMatchObject({status:409});
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();
  });
  it('does not claim an already-paid Stripe order twice',async()=>{
    db.$transaction.mockImplementation((work)=>work(db));
    db.$queryRawUnsafe.mockResolvedValueOnce([]);
    await expect(markStripeOrderPaid('pi_duplicate')).resolves.toBeNull();
  });
});

describe('durable jobs',()=>{
  beforeEach(()=>vi.clearAllMocks());
  it('persists JSON payloads for restart-safe processing',async()=>{
    db.$executeRawUnsafe.mockResolvedValueOnce(1);
    await expect(enqueueDurable('send_order_confirmation',{order_id:'order-1'})).resolves.toMatch(/^[0-9a-f-]{36}$/);
    expect(db.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO background_jobs'),expect.any(String),'send_order_confirmation',JSON.stringify({order_id:'order-1'}),5,null);
  });
});
