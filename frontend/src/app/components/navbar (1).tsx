import { Link, useLocation, useNavigate } from 'react-router';
import { Menu, X, ShoppingCart, User, LogOut, Settings, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import { useAuthStore } from '../store/authStore';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const isAdmin = user?.is_admin === true;

  const navItems = [
    { name: 'Home', path: '/' },
    { name: 'Portfolio', path: '/portfolio' },
    { name: 'Gallery', path: '/gallery' },
    { name: 'Courses', path: '/courses' },
    { name: 'Store', path: '/store' },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    clearAuth();
    setUserMenuOpen(false);
    setIsOpen(false);
    navigate('/');
  };

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-white/90 border-b border-black/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white text-xl">GTech</span>
            </div>
            <span className="text-xl hidden sm:block">Gibson Technologies</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'transition-colors duration-200',
                  isActive(item.path)
                    ? 'text-primary'
                    : 'text-black/60 hover:text-black'
                )}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Right Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <Link to="/store/cart">
              <Button variant="ghost" size="icon">
                <ShoppingCart className="w-5 h-5" />
              </Button>
            </Link>

            {user ? (
              <div ref={userMenuRef} className="relative">
                <button
                  onClick={() => setUserMenuOpen((o) => !o)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md hover:bg-black/5 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-semibold">
                    {user.full_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm max-w-[100px] truncate">{user.full_name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-black/40" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-black/10 py-1 z-50">
                    <div className="px-3 py-2 border-b border-black/5">
                      <p className="text-xs text-black/40 truncate">{user.email}</p>
                    </div>
                    <Link
                      to="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-black/5 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Edit Profile</span>
                    </Link>
                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-black/5 transition-colors"
                      >
                        <User className="w-4 h-4" />
                        <span>Dashboard</span>
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="icon">
                    <User className="w-5 h-5" />
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden border-t border-black/10">
          <div className="px-4 py-4 space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={cn(
                  'block py-2 transition-colors duration-200',
                  isActive(item.path)
                    ? 'text-primary'
                    : 'text-black/60 hover:text-black'
                )}
              >
                {item.name}
              </Link>
            ))}
            <div className="flex items-center space-x-2 pt-2 border-t border-black/10">
              <Link to="/store/cart" onClick={() => setIsOpen(false)}>
                <Button variant="ghost" size="icon">
                  <ShoppingCart className="w-5 h-5" />
                </Button>
              </Link>
              {user ? (
                <>
                  <Link to="/profile" onClick={() => setIsOpen(false)}>
                    <Button variant="ghost" size="sm">
                      <Settings className="w-4 h-4 mr-1" /> Profile
                    </Button>
                  </Link>
                  {isAdmin && (
                    <Link to="/admin" onClick={() => setIsOpen(false)}>
                      <Button variant="default" size="sm">Dashboard</Button>
                    </Link>
                  )}
                  <Button variant="ghost" size="sm" onClick={handleLogout} className="text-red-600 hover:bg-red-50">
                    <LogOut className="w-4 h-4 mr-1" /> Logout
                  </Button>
                </>
              ) : (
                <Link to="/login" onClick={() => setIsOpen(false)}>
                  <Button variant="ghost" size="icon">
                    <User className="w-5 h-5" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
