import {Navigate,Route,Routes} from 'react-router';
import {tokenStore} from './core/storage';
import {DiscoverPage} from './features/app/presentation/DiscoverPage';
import {ExplorePage} from './features/app/presentation/ExplorePage';
import {LikesPage} from './features/app/presentation/LikesPage';
import {ChatsPage,ChatThreadPage} from './features/app/presentation/ChatsPage';
import {ProfilePage} from './features/app/presentation/ProfilePage';
import {SettingsPage} from './features/app/presentation/SettingsPage';
import {UpgradePage} from './features/app/presentation/UpgradePage';
import {AuthPage} from './features/auth/presentation/AuthPage';
import {OtpPage} from './features/auth/presentation/OtpPage';
import {AppShell} from './features/shell/presentation/AppShell';

function ProtectedShell(){return tokenStore.access()?<AppShell/>:<Navigate to="/auth/phone" replace/>}

export function App(){return <Routes>
  <Route path="/auth/phone" element={<AuthPage/>}/><Route path="/auth/otp" element={<OtpPage/>}/>
  <Route path="/app" element={<ProtectedShell/>}>
    <Route index element={<Navigate to="discover" replace/>}/>
    <Route path="discover" element={<DiscoverPage/>}/><Route path="explore" element={<ExplorePage/>}/><Route path="likes" element={<LikesPage/>}/><Route path="chats" element={<ChatsPage/>}/><Route path="chats/:matchId" element={<ChatThreadPage/>}/><Route path="profile" element={<ProfilePage/>}/><Route path="settings" element={<SettingsPage/>}/><Route path="upgrade" element={<UpgradePage/>}/>
  </Route>
  <Route path="*" element={<Navigate to={tokenStore.access()?'/app/discover':'/auth/phone'} replace/>}/>
</Routes>}
