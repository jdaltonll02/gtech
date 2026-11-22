import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {App} from './App';

const renderApp=(path:string)=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={[path]}><App/></MemoryRouter></QueryClientProvider>);

describe('Pepper web',()=>{
  beforeEach(()=>{sessionStorage.clear();vi.unstubAllGlobals()});
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
    expect(screen.getByRole('link',{name:'Skip to main content'})).toHaveAttribute('href','#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('id','main-content');
    expect(screen.getAllByRole('navigation',{name:'Primary navigation'})).toHaveLength(2);
  });

  it('completes phone and OTP authentication',async()=>{
    const fetchMock=vi.fn(async(input:RequestInfo|URL)=>{
      const url=String(input);
      if(url.endsWith('/auth/otp/request'))return new Response(JSON.stringify({challenge_id:'01900000-0000-7000-8000-000000000001',expires_in:300}),{status:201,headers:{'Content-Type':'application/json'}});
      if(url.endsWith('/auth/otp/verify'))return new Response(JSON.stringify({access:'access-token',refresh:'refresh-token',is_new_user:false}),{status:200,headers:{'Content-Type':'application/json'}});
      if(url.includes('/matches'))return new Response(JSON.stringify({results:[]}),{status:200,headers:{'Content-Type':'application/json'}});
      return new Response(JSON.stringify({results:[]}),{status:200,headers:{'Content-Type':'application/json'}});
    });
    vi.stubGlobal('fetch',fetchMock);
    renderApp('/auth/phone');
    fireEvent.change(screen.getByLabelText('Mobile number'),{target:{value:'770000001'}});
    fireEvent.click(screen.getByRole('button',{name:/Continue/i}));
    expect(await screen.findByRole('heading',{name:'Enter your code'})).toBeInTheDocument();
    for(const [index,digit] of [...'000000'].entries())fireEvent.change(screen.getByLabelText(`Digit ${index+1}`),{target:{value:digit}});
    fireEvent.click(screen.getByRole('button',{name:'Verify'}));
    await waitFor(()=>expect(sessionStorage.getItem('pepper.access')).toBe('access-token'));
    expect(await screen.findByRole('heading',{name:'No one new around you'})).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/auth/otp/request'),expect.objectContaining({body:'{"phone":"+231770000001"}'}));
  });
});
