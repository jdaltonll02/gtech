import { Link, useLocation, useNavigate } from 'react-router';
import { Menu, X, ShoppingCart, User, LogOut, Settings, ChevronDown, ShoppingBag } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';

type Partner = { id: string; name: string; website_url: string };
type Business = { id: string; name: string; website_url: string };
type NavForm = { id: string; title: string; slug: string; nav_label: string | null };

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [partnersOpen, setPartnersOpen] = useState(false);
  const [businessesOpen, setBusinessesOpen] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [navForms, setNavForms] = useState<NavForm[]>([]);
  const [formsOpen, setFormsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const partnersRef = useRef<HTMLDivElement>(null);
  const businessesRef = useRef<HTMLDivElement>(null);
  const formsRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const isAdmin = user?.is_admin === true;

  const navItems = [
    { name: 'Home', path: '/' },
    { name: 'Our Team', path: '/team' },
    { name: 'Projects', path: '/projects' },
    { name: 'Courses', path: '/courses' },
    { name: 'Store', path: '/store' },
    { name: 'Blog', path: '/blog' },
    { name: 'Help', path: '/docs' },
    { name: 'Contact', path: '/contact' },
  ];

  const isActive = (path: string) => location.pathname === path;
  const desktopLink = (active: boolean) => cn(
    'relative py-2 transition-colors duration-200 whitespace-nowrap',
    'after:absolute after:left-0 after:right-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary after:transition-transform after:origin-left',
    active ? 'text-primary font-medium after:scale-x-100' : 'text-black/70 hover:text-black after:scale-x-0 hover:after:scale-x-100 hover:after:bg-black/20'
  );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = async () => {
    const refresh_token = localStorage.getItem('refresh_token');
    try {
      await api.post('/auth/logout', refresh_token ? { refresh_token } : {});
    } catch {
      // Best-effort — still clear the local session even if the request fails.
    }
    clearAuth();
    setUserMenuOpen(false);
    setIsOpen(false);
    navigate('/');
  };

  // Load partners, businesses, and published forms
  useEffect(() => {
    const loadData = async () => {
      try {
        const [p, b, f] = await Promise.all([
          api.get<Partner[]>('/partners'),
          api.get<Business[]>('/partners/businesses'),
          api.get<NavForm[]>('/forms'),
        ]);
        setPartners(p);
        setBusinesses(b);
        setNavForms(f);
      } catch (err) {
        console.error('Failed to load nav data:', err);
      }
    };
    loadData();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
      if (partnersRef.current && !partnersRef.current.contains(e.target as Node)) setPartnersOpen(false);
      if (businessesRef.current && !businessesRef.current.contains(e.target as Node)) setBusinessesOpen(false);
      if (formsRef.current && !formsRef.current.contains(e.target as Node)) setFormsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav
      aria-label="Main"
      className={cn(
        'fixed top-0 left-0 right-0 z-50 bg-white border-b transition-shadow duration-300',
        scrolled ? 'border-black/10 shadow-[0_4px_16px_-6px_rgba(20,22,26,0.12)]' : 'border-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0" aria-label="G-Tech home">
            <img src="/gtech_mark.svg" alt="" className="h-10 w-10" />
            <span className="font-heading text-xl font-bold tracking-tight text-black whitespace-nowrap">G-Tech</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive(item.path) ? 'page' : undefined}
                className={desktopLink(isActive(item.path))}
              >
                {item.name}
              </Link>
            ))}

            {/* Dynamic Forms — single link or dropdown */}
            {navForms.length === 1 && (
              <Link
                to={`/forms/${navForms[0].slug}`}
                aria-current={isActive(`/forms/${navForms[0].slug}`) ? 'page' : undefined}
                className={desktopLink(isActive(`/forms/${navForms[0].slug}`))}
              >
                {navForms[0].nav_label || navForms[0].title}
              </Link>
            )}
            {navForms.length > 1 && (
              <div ref={formsRef} className="relative">
                <button
                  onClick={() => setFormsOpen((o) => !o)}
                  className="flex items-center gap-1 py-2 whitespace-nowrap transition-colors duration-200 text-black/70 hover:text-black" aria-haspopup="true"
                >
                  <span>Apply</span>
                  <ChevronDown className={cn('w-4 h-4 transition-transform', formsOpen && 'rotate-180')} />
                </button>
                {formsOpen && (
                  <div className="absolute left-0 mt-2 w-52 bg-white rounded-lg shadow-lg border border-black/10 py-2 z-50">
                    {navForms.map((form) => (
                      <Link
                        key={form.id}
                        to={`/forms/${form.slug}`}
                        onClick={() => setFormsOpen(false)}
                        className="block px-4 py-2 text-sm text-black/70 hover:text-primary hover:bg-black/5 transition-colors"
                      >
                        {form.nav_label || form.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Partners Dropdown */}
            {partners.length > 0 && (
              <div ref={partnersRef} className="relative">
                <button
                  onClick={() => setPartnersOpen((o) => !o)}
                  className="flex items-center gap-1 py-2 whitespace-nowrap transition-colors duration-200 text-black/70 hover:text-black" aria-haspopup="true"
                >
                  <span>Partners</span>
                  <ChevronDown className={cn('w-4 h-4 transition-transform', partnersOpen && 'rotate-180')} />
                </button>
                {partnersOpen && (
                  <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-black/10 py-2 z-50">
                    {partners.map((partner) => (
                      <a
                        key={partner.id}
                        href={partner.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-4 py-2 text-sm text-black/70 hover:text-primary hover:bg-black/5 transition-colors"
                      >
                        {partner.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Businesses Dropdown */}
            {businesses.length > 0 && (
              <div ref={businessesRef} className="relative">
                <button
                  onClick={() => setBusinessesOpen((o) => !o)}
                  className="flex items-center gap-1 py-2 whitespace-nowrap transition-colors duration-200 text-black/70 hover:text-black" aria-haspopup="true"
                >
                  <span>Businesses</span>
                  <ChevronDown className={cn('w-4 h-4 transition-transform', businessesOpen && 'rotate-180')} />
                </button>
                {businessesOpen && (
                  <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-black/10 py-2 z-50">
                    {businesses.map((business) => (
                      <Link
                        key={business.id}
                        to={`/businesses/${business.id}`}
                        onClick={() => setBusinessesOpen(false)}
                        className="block px-4 py-2 text-sm text-black/70 hover:text-primary hover:bg-black/5 transition-colors"
                      >
                        {business.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Actions */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <Button asChild variant="ghost" size="icon" title="Cart">
              <Link to="/store/cart" aria-label="Cart">
                <ShoppingCart className="w-5 h-5" />
              </Link>
            </Button>

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
                    <Link
                      to="/store/orders"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-black/5 transition-colors"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>My Orders</span>
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
              <Button asChild variant="ghost" size="icon" title="Sign in">
                <Link to="/login" aria-label="Sign in">
                  <User className="w-5 h-5" />
                </Link>
              </Button>
            )}
            <Button asChild className="ml-2">
              <Link to="/courses">Get Started</Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
            className="lg:hidden h-11 w-11 -mr-2 flex items-center justify-center rounded-lg hover:bg-black/5"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="lg:hidden border-t border-black/10 bg-white max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="px-4 py-4 space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                aria-current={isActive(item.path) ? 'page' : undefined}
                className={cn(
                  'flex items-center min-h-11 py-2 pl-3 border-l-2 transition-colors duration-200',
                  isActive(item.path)
                    ? 'text-primary font-medium border-primary'
                    : 'text-black/70 border-transparent hover:text-black'
                )}
              >
                {item.name}
              </Link>
            ))}
            
            {/* Forms — mobile */}
            {navForms.length > 0 && (
              <div className="pt-2 border-t border-black/10 space-y-1">
                <span className="text-xs text-black/40 uppercase tracking-wider">Apply</span>
                {navForms.map((form) => (
                  <Link key={form.id} to={`/forms/${form.slug}`} onClick={() => setIsOpen(false)} className="block text-sm text-black/60 hover:text-primary py-1 transition-colors">
                    {form.nav_label || form.title}
                  </Link>
                ))}
              </div>
            )}

            {/* Partners Dropdown */}
            {partners.length > 0 && (
              <div className="flex items-center space-x-2 pt-2 border-t border-black/10">
                <span className="text-sm text-black/40">Partners:</span>
                {partners.slice(0, 3).map((partner) => (
                  <a
                    key={partner.id}
                    href={partner.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {partner.name}
                  </a>
                ))}
                {partners.length > 3 && <span className="text-sm text-black/40">+{partners.length - 3} more</span>}
              </div>
            )}
            
            {/* Businesses Dropdown */}
            {businesses.length > 0 && (
              <div className="flex items-center space-x-2 pt-2 border-t border-black/10">
                <span className="text-sm text-black/40">Businesses:</span>
                {businesses.slice(0, 3).map((business) => (
                  <Link
                    key={business.id}
                    to={`/businesses/${business.id}`}
                    onClick={() => setIsOpen(false)}
                    className="text-sm text-primary hover:underline"
                  >
                    {business.name}
                  </Link>
                ))}
                {businesses.length > 3 && <span className="text-sm text-black/40">+{businesses.length - 3} more</span>}
              </div>
            )}
            
            <Button asChild className="w-full">
              <Link to="/courses" onClick={() => setIsOpen(false)}>Get Started</Link>
            </Button>

            <div className="flex items-center space-x-2 pt-2 border-t border-black/10">
              <Button asChild variant="ghost" size="icon">
                <Link to="/store/cart" onClick={() => setIsOpen(false)} aria-label="Cart">
                  <ShoppingCart className="w-5 h-5" />
                </Link>
              </Button>
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
                <Button asChild variant="ghost" size="sm" className="h-11">
                  <Link to="/login" onClick={() => setIsOpen(false)}>
                    <User className="w-5 h-5" /> Sign in
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
