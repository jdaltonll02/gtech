import { useEffect, useState } from 'react';
import { PackageCheck, RefreshCw, Truck } from 'lucide-react';
import { api } from '../utils/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { GlassCard } from './glass-card';

type OrderStatus='pending'|'payment_pending'|'paid'|'processing'|'shipped'|'delivered'|'completed'|'cancelled'|'refunded';
type OrderItem={id:string;product_name:string;quantity:number;unit_price:string;total_price:string};
type Order={id:string;status:OrderStatus;payment_status:string;payment_provider:string|null;billing_name:string|null;billing_email:string|null;phone_number:string|null;shipping_address:Record<string,string>|null;tracking_number:string|null;shipping_carrier:string|null;total:string;created_at:string;items:OrderItem[]};

const nextStatuses:Partial<Record<OrderStatus,OrderStatus[]>>={
  payment_pending:['cancelled'],pending:['cancelled'],paid:['processing'],processing:['shipped','completed'],shipped:['delivered'],delivered:['completed'],
};

export function AdminOrdersTab(){
  const [orders,setOrders]=useState<Order[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [filter,setFilter]=useState('all'),[saving,setSaving]=useState<string|null>(null);
  const [drafts,setDrafts]=useState<Record<string,{status:string;tracking_number:string;shipping_carrier:string}>>({});

  const load=async()=>{setLoading(true);setError('');try{setOrders(await api.get<Order[]>('/admin/orders?limit=200'));}catch(e:any){setError(e.message||'Unable to load orders.');}finally{setLoading(false);}};
  useEffect(()=>{load();},[]);

  const update=async(order:Order)=>{
    const draft=drafts[order.id],status=draft?.status as OrderStatus|undefined;
    if(!status)return;
    setSaving(order.id);setError('');
    try{
      const updated=await api.patch<Order>(`/admin/orders/${order.id}/status`,{status,tracking_number:draft.tracking_number||undefined,shipping_carrier:draft.shipping_carrier||undefined});
      setOrders((current)=>current.map((item)=>item.id===updated.id?updated:item));
      setDrafts((current)=>{const next={...current};delete next[order.id];return next;});
    }catch(e:any){setError(e.message||'Unable to update order.');}finally{setSaving(null);}
  };

  const visible=filter==='all'?orders:orders.filter((order)=>order.status===filter);
  return <div>
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div><h1 className="text-4xl">Orders & Fulfillment</h1><p className="text-black/50 mt-2">Process paid orders and record shipment tracking.</p></div>
      <div className="flex gap-2">
        <Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent>{['all','payment_pending','paid','processing','shipped','delivered','completed','cancelled'].map((status)=><SelectItem key={status} value={status}>{status.replace('_',' ')}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 mr-2 ${loading?'animate-spin':''}`}/>Refresh</Button>
      </div>
    </div>
    {error&&<p className="text-red-600 mb-4">{error}</p>}
    {!loading&&visible.length===0&&<GlassCard className="p-10 text-center text-black/50">No orders match this view.</GlassCard>}
    <div className="space-y-4">{visible.map((order)=>{
      const options=nextStatuses[order.status]||[],draft=drafts[order.id]||{status:'',tracking_number:order.tracking_number||'',shipping_carrier:order.shipping_carrier||''};
      return <GlassCard key={order.id} className="p-5">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3"><PackageCheck className="w-5 h-5 text-primary"/><span className="font-mono font-semibold">{order.id.slice(0,8).toUpperCase()}</span><span className="text-xs px-2 py-1 rounded-full bg-black/5 capitalize">{order.status.replace('_',' ')}</span><span className="text-xs text-black/50 capitalize">Payment: {order.payment_status}</span></div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-sm"><div><p className="text-black/40 text-xs">Customer</p><p>{order.billing_name||'—'}</p><p className="text-black/50 break-all">{order.billing_email||'—'}</p></div><div><p className="text-black/40 text-xs">Total</p><p className="font-semibold">${Number(order.total).toFixed(2)}</p><p className="text-black/50">{order.items.reduce((sum,item)=>sum+item.quantity,0)} item(s)</p></div><div><p className="text-black/40 text-xs">Ship to</p><p>{order.shipping_address?.address||'—'}</p><p className="text-black/50">{[order.shipping_address?.city,order.shipping_address?.country].filter(Boolean).join(', ')}</p></div><div><p className="text-black/40 text-xs">Tracking</p><p>{order.tracking_number||'Not assigned'}</p><p className="text-black/50">{order.shipping_carrier||''}</p></div></div>
          </div>
          {options.length>0&&<div className="w-full xl:w-80 space-y-2 border-t xl:border-t-0 xl:border-l border-black/10 pt-4 xl:pt-0 xl:pl-5">
            <Select value={draft.status} onValueChange={(status)=>setDrafts((current)=>({...current,[order.id]:{...draft,status}}))}><SelectTrigger><SelectValue placeholder="Next status"/></SelectTrigger><SelectContent>{options.map((status)=><SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select>
            {draft.status==='shipped'&&<><Input placeholder="Tracking number" value={draft.tracking_number} onChange={(event)=>setDrafts((current)=>({...current,[order.id]:{...draft,tracking_number:event.target.value}}))}/><Input placeholder="Shipping carrier" value={draft.shipping_carrier} onChange={(event)=>setDrafts((current)=>({...current,[order.id]:{...draft,shipping_carrier:event.target.value}}))}/></>}
            <Button className="w-full" onClick={()=>update(order)} disabled={!draft.status||saving===order.id||(draft.status==='shipped'&&!draft.tracking_number.trim())}><Truck className="w-4 h-4 mr-2"/>{saving===order.id?'Updating…':'Update order'}</Button>
          </div>}
        </div>
      </GlassCard>;
    })}</div>
  </div>;
}
