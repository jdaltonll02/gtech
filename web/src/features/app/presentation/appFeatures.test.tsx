import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import type {ReactElement} from 'react';
import {MemoryRouter,Route,Routes} from 'react-router';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {Match,Message,Preferences,Product,Profile} from '../domain/models';
import {ChatThreadPage,ChatsPage} from './ChatsPage';
import {ExplorePage} from './ExplorePage';
import {LikesPage} from './LikesPage';
import {ProfilePage} from './ProfilePage';
import {SettingsPage} from './SettingsPage';
import {UpgradePage} from './UpgradePage';

const repository=vi.hoisted(()=>({
  likes:vi.fn(),matches:vi.fn(),messages:vi.fn(),sendMessage:vi.fn(),profile:vi.fn(),updateProfile:vi.fn(),preferences:vi.fn(),notificationPreferences:vi.fn(),updatePreferences:vi.fn(),updateNotifications:vi.fn(),products:vi.fn(),fakePurchase:vi.fn(),unmatch:vi.fn(),block:vi.fn(),report:vi.fn(),pause:vi.fn(),exportData:vi.fn(),deleteAccount:vi.fn(),
}));

vi.mock('../data/appRepository',()=>({appRepository:repository}));

const profile:Profile={user_id:'user-1',display_name:'Pepper Demo',bio:'Building something meaningful.',job_title:'Designer',school:'UL',county:'Montserrado',languages:['English'],relationship_goal:'long_term',completeness:90,is_verified:false,verification_status:'not_started'};
const preferences:Preferences={show_me:['woman'],age_min:21,age_max:40,max_distance_km:50,counties_filter:[],global_mode:false,is_discoverable:true};
const match:Match={id:'match-1',created_at:'2026-11-20T12:00:00.000Z',other_user:{id:'user-2',display_name:'Amina',blurhash:null},last_message:{kind:'text',body:'Hello there',created_at:'2026-11-21T12:00:00.000Z'},unread_count:2};
const message:Message={id:'message-1',match_id:'match-1',sender_id:'user-2',kind:'text',body:'Hello there',media_url:null,safety_warning:false,read_at:null,created_at:'2026-11-21T12:00:00.000Z'};
const products:Product[]=[{sku:'pepper_gold_month',kind:'subscription',tier:'gold',duration_days:30,prices:{USD:12.99,LRD:2470}}];

const renderPage=(element:ReactElement,path='/',route='*')=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={element}/></Routes></MemoryRouter></QueryClientProvider>);
};

describe('web feature parity',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    vi.spyOn(window,'alert').mockImplementation(()=>undefined);
    repository.matches.mockResolvedValue([match]);
    repository.messages.mockResolvedValue([message]);
    repository.profile.mockResolvedValue(profile);
    repository.preferences.mockResolvedValue(preferences);
    repository.notificationPreferences.mockResolvedValue({new_matches:true,messages:true,likes:true,promotions:false,message_previews:true});
    repository.updatePreferences.mockResolvedValue(preferences);
    repository.updateNotifications.mockResolvedValue({});
    repository.products.mockResolvedValue(products);
    repository.fakePurchase.mockResolvedValue({});
  });

  it('offers all Explore themes',()=>{
    renderPage(<ExplorePage/>,'/app/explore');
    expect(screen.getByRole('heading',{name:'Explore'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:/Ready for something real/i})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:/Building big things/i})).toBeInTheDocument();
  });

  it('shows the premium Likes gate without exposing profiles',async()=>{
    repository.likes.mockResolvedValue({count:7,blurred:[{blurhash:null}]});
    renderPage(<LikesPage/>);
    expect(await screen.findByRole('heading',{name:'7 people like you'})).toBeInTheDocument();
    expect(screen.getByRole('link',{name:'See upgrade options'})).toHaveAttribute('href','/app/upgrade');
  });

  it('renders conversations and unread counts',async()=>{
    renderPage(<ChatsPage/>);
    expect(await screen.findByRole('heading',{name:'Chats'})).toBeInTheDocument();
    expect(screen.getByText('Hello there')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('sends a message from a conversation',async()=>{
    const sent={...message,id:'message-2',sender_id:'user-1',body:'Nice to meet you'};
    repository.sendMessage.mockResolvedValue(sent);
    renderPage(<ChatThreadPage/>,'/app/chats/match-1','/app/chats/:matchId');
    const input=await screen.findByPlaceholderText('Write a message…');
    fireEvent.change(input,{target:{value:'Nice to meet you'}});
    fireEvent.submit(input.closest('form')!);
    await waitFor(()=>expect(repository.sendMessage).toHaveBeenCalledWith('match-1','Nice to meet you'));
    expect(await screen.findByText('Nice to meet you')).toBeInTheDocument();
  });

  it('edits and saves the profile',async()=>{
    repository.updateProfile.mockImplementation((value:Partial<Profile>)=>Promise.resolve({...profile,...value}));
    renderPage(<ProfilePage/>);
    fireEvent.click(await screen.findByRole('button',{name:/Edit profile/i}));
    const bio=screen.getByLabelText('About me');
    fireEvent.change(bio,{target:{value:'Ready for a real connection.'}});
    fireEvent.click(screen.getByRole('button',{name:'Save profile'}));
    await waitFor(()=>expect(repository.updateProfile).toHaveBeenCalledWith(expect.objectContaining({bio:'Ready for a real connection.'})));
  });

  it('persists discovery and notification settings',async()=>{
    renderPage(<SettingsPage/>);
    const distance=await screen.findByRole('slider',{name:/Maximum distance/i});
    fireEvent.change(distance,{target:{value:'80'}});
    fireEvent.click(screen.getByRole('checkbox',{name:'Promotions'}));
    fireEvent.click(screen.getByRole('button',{name:/Save settings/i}));
    await waitFor(()=>expect(repository.updatePreferences).toHaveBeenCalledWith(expect.objectContaining({max_distance_km:80})));
    expect(repository.updateNotifications).toHaveBeenCalledWith(expect.objectContaining({promotions:true}));
  });

  it('activates a development upgrade',async()=>{
    renderPage(<UpgradePage/>);
    expect(await screen.findByRole('heading',{name:'Pepper Gold'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Continue'}));
    await waitFor(()=>expect(repository.fakePurchase).toHaveBeenCalledWith('pepper_gold_month'));
  });
});
