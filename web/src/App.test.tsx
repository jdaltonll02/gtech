import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {App} from './App';

const renderApp=(path:string)=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={[path]}><App/></MemoryRouter></QueryClientProvider>);

describe('Pepper web',()=>{
  beforeEach(()=>sessionStorage.clear());
  it('opens phone authentication',()=>{renderApp('/auth/phone');expect(screen.getByRole('heading',{name:"What's your number?"})).toBeInTheDocument()});
  it('renders an API-backed discovery card for an authenticated user',async()=>{
    sessionStorage.setItem('pepper.access','test-access');sessionStorage.setItem('pepper.refresh','test-refresh');
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
      const url=String(input);
      const body=url.includes('/matches')?{results:[]}:{results:[{id:'01900000-0000-7000-8000-000000000001',name:'Demo',age:29,distance_label:'5 km away',county:'Montserrado',job_title:'Designer',school:'',bio:'Hello',interests:[],photos:[],verified:true,superliked_you:false}]};
      return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
    }));
    renderApp('/app/discover');
    expect(await screen.findByRole('heading',{name:/Demo, 29/})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Like'})).toBeInTheDocument();
  });
});
