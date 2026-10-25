import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { StoreProvider, useStore } from '../original-mobile/store'
import BottomNav from '../original-mobile/components/BottomNav'
import Splash from '../original-mobile/screens/Splash'
import Welcome from '../original-mobile/screens/Welcome'
import SignIn from '../original-mobile/screens/SignIn'
import Places from '../original-mobile/screens/Places'
import Feed from '../original-mobile/screens/Feed'
import Messages from '../original-mobile/screens/Messages'
import Chat from '../original-mobile/screens/Chat'
import Profile from '../original-mobile/screens/Profile'
import Add from '../original-mobile/screens/Add'
import './archive-scoped.css'
import './integration.css'

const TABBED = ['/places', '/feed', '/messages', '/profile', '/add']

export default function OriginalMobileApp() {
  return <StoreProvider><OriginalRoutes /></StoreProvider>
}

function OriginalRoutes() {
  const { authed } = useStore()
  const { pathname } = useLocation()
  const showNav = authed && TABBED.some((path) => pathname.startsWith(path))
  return (
    <div className="original-mobile">
      <div className="device">
        <div className="screen">
          <Routes>
            <Route path="/" element={<Splash />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/signin" element={<SignIn />} />
            {authed ? <>
              <Route path="/places" element={<Places />} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/messages/:id" element={<Chat />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/add" element={<Add />} />
              <Route path="*" element={<Navigate to="/places" replace />} />
            </> : <Route path="*" element={<Navigate to="/welcome" replace />} />}
          </Routes>
          {showNav && <BottomNav />}
        </div>
      </div>
    </div>
  )
}
