import { useState } from 'react';
import { motion } from 'motion/react';
import {
  User, ShoppingCart, BookOpen, Ticket, Lock, CreditCard,
  ShieldCheck, HelpCircle, ChevronDown, ChevronRight,
  Search, Package, Award, Mail,
} from 'lucide-react';
import { cn } from '../components/ui/utils';

type Section = {
  id: string;
  icon: React.ElementType;
  title: string;
  content: React.ReactNode;
};

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-black/10 rounded-lg overflow-hidden mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left font-medium text-sm hover:bg-black/[0.02] transition-colors"
      >
        {title}
        {open ? <ChevronDown className="w-4 h-4 text-black/40 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-black/40 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-black/70 space-y-2 border-t border-black/5 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 mb-3">
      <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{n}</div>
      <p className="text-sm text-black/70">{children}</p>
    </div>
  );
}

const SECTIONS: Section[] = [
  {
    id: 'account',
    icon: User,
    title: 'Account & Profile',
    content: (
      <div className="space-y-6">
        <div>
          <h3 className="font-semibold mb-3">Creating an Account</h3>
          <Step n={1}>Click <strong>Sign Up</strong> in the top navigation bar.</Step>
          <Step n={2}>Enter your full name, email address, and a password (minimum 8 characters).</Step>
          <Step n={3}>Check your inbox for a verification email and click the confirmation link.</Step>
          <Step n={4}>You can also sign in instantly with <strong>Continue with Google</strong>.</Step>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Signing In</h3>
          <Step n={1}>Click <strong>Sign In</strong> and enter your email and password.</Step>
          <Step n={2}>If you have two-factor authentication enabled, a 6-digit code will be emailed to you. Enter it to complete sign-in.</Step>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Editing Your Profile</h3>
          <Step n={1}>Go to <strong>Profile</strong> (click your name or the profile icon).</Step>
          <Step n={2}>Select the <strong>Profile</strong> tab to update your name or email address.</Step>
          <Step n={3}>Click <strong>Save Changes</strong>.</Step>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Changing Your Password</h3>
          <Step n={1}>Go to <strong>Profile → Security</strong>.</Step>
          <Step n={2}>Enter your current password, then your new password twice.</Step>
          <Step n={3}>Click <strong>Update Password</strong>.</Step>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Forgot Password</h3>
          <Step n={1}>Click <strong>Sign In → Forgot password?</strong></Step>
          <Step n={2}>Enter your email address and click <strong>Send Reset Link</strong>.</Step>
          <Step n={3}>Check your inbox for a reset link (valid for 1 hour) and follow it to set a new password.</Step>
        </div>
        <div className="bg-primary/5 rounded-lg p-4">
          <h3 className="font-semibold mb-3">Two-Factor Authentication (2FA)</h3>
          <Step n={1}>Go to <strong>Profile → Security</strong>.</Step>
          <Step n={2}>Toggle <strong>Two-Factor Authentication</strong> on.</Step>
          <Step n={3}>On future sign-ins, a one-time code will be sent to your email. Codes expire after 10 minutes.</Step>
        </div>
      </div>
    ),
  },
  {
    id: 'store',
    icon: ShoppingCart,
    title: 'Store & Shopping',
    content: (
      <div className="space-y-6">
        <div>
          <h3 className="font-semibold mb-3">Browsing Products</h3>
          <Step n={1}>Go to <strong>Store</strong> from the navigation.</Step>
          <Step n={2}>Browse by category or use the search bar to find products.</Step>
          <Step n={3}>Click any product to view full details, specifications, and images.</Step>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Adding to Cart</h3>
          <Step n={1}>On a product page, select your desired quantity.</Step>
          <Step n={2}>Click <strong>Add to Cart</strong>.</Step>
          <Step n={3}>View your cart at any time by clicking the cart icon in the navigation.</Step>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Checkout</h3>
          <Step n={1}>Open your cart and click <strong>Proceed to Checkout</strong>. You must be signed in.</Step>
          <Step n={2}>Review your order summary and applicable taxes.</Step>
          <Step n={3}>Choose a payment method and complete payment.</Step>
          <Step n={4}>You will receive an order confirmation email.</Step>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Payment Methods</h3>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { icon: CreditCard, title: 'Card (Stripe)', desc: 'Visa, Mastercard, Amex — secured by Stripe.' },
              { icon: Package, title: 'PayPal', desc: 'Redirected to PayPal to approve payment.' },
              { icon: Mail, title: 'MTN MoMo', desc: 'Enter your phone number and approve the USSD push.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="border border-black/10 rounded-lg p-3">
                <Icon className="w-5 h-5 text-primary mb-2" />
                <p className="font-medium text-sm">{title}</p>
                <p className="text-xs text-black/50 mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Order History</h3>
          <Step n={1}>Go to <strong>Profile</strong> or navigate to <strong>Store → My Orders</strong>.</Step>
          <Step n={2}>View all past orders with status, items, and totals.</Step>
        </div>
      </div>
    ),
  },
  {
    id: 'courses',
    icon: BookOpen,
    title: 'Courses & Learning',
    content: (
      <div className="space-y-6">
        <div>
          <h3 className="font-semibold mb-3">Finding Courses</h3>
          <Step n={1}>Go to <strong>Courses</strong> from the navigation.</Step>
          <Step n={2}>Browse the course catalog. Free preview lessons are available without enrolling.</Step>
          <Step n={3}>Click a course to see the full syllabus, instructor info, and pricing.</Step>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Enrolling in a Course</h3>
          <Step n={1}>On the course detail page, click <strong>Enroll</strong> (free courses) or <strong>Purchase</strong> (paid courses).</Step>
          <Step n={2}>For paid courses, complete the Stripe payment. Enrollment is granted automatically on payment confirmation.</Step>
          <Step n={3}>You'll be redirected to the course player to begin learning.</Step>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Taking a Course</h3>
          <Step n={1}>Open <strong>My Learning</strong> or navigate directly to your enrolled course.</Step>
          <Step n={2}>Work through sections and lessons in order. Progress is saved automatically.</Step>
          <Step n={3}>Completion rules: <strong>Videos</strong> require 70% watch time. <strong>Text/code/document</strong> lessons complete on visit. <strong>Quizzes</strong> require a passing score.</Step>
        </div>
        <div className="bg-primary/5 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Certificates</h3>
          </div>
          <p className="text-sm text-black/70">Complete 100% of a course to automatically receive a certificate. View and download your certificates from <strong>Profile → My Courses</strong> or <strong>My Learning</strong>.</p>
        </div>
      </div>
    ),
  },
  {
    id: 'support',
    icon: Ticket,
    title: 'Support Tickets',
    content: (
      <div className="space-y-6">
        <div>
          <h3 className="font-semibold mb-3">Submitting a Ticket</h3>
          <Step n={1}>Go to <strong>Contact</strong> in the navigation.</Step>
          <Step n={2}>Fill in your name, email, subject, and message.</Step>
          <Step n={3}>Click <strong>Send Message</strong>. You'll receive a confirmation email with your ticket number.</Step>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Tracking Your Tickets</h3>
          <Step n={1}>Sign in and go to <strong>My Tickets</strong>.</Step>
          <Step n={2}>View all your tickets and their current status.</Step>
          <Step n={3}>Click a ticket to read the full conversation thread.</Step>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Ticket Statuses</h3>
          <div className="space-y-2">
            {[
              { s: 'Open', c: 'bg-blue-100 text-blue-700', d: 'Your ticket has been received and is awaiting review.' },
              { s: 'In Progress', c: 'bg-yellow-100 text-yellow-700', d: 'The support team is actively working on your issue.' },
              { s: 'Waiting for User', c: 'bg-orange-100 text-orange-700', d: 'We replied and are awaiting your response.' },
              { s: 'Resolved', c: 'bg-green-100 text-green-700', d: 'Your issue has been resolved.' },
              { s: 'Closed', c: 'bg-gray-100 text-gray-600', d: 'The ticket has been closed.' },
            ].map(({ s, c, d }) => (
              <div key={s} className="flex items-start gap-3">
                <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 mt-0.5', c)}>{s}</span>
                <p className="text-sm text-black/60">{d}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Replying to a Ticket</h3>
          <Step n={1}>Open the ticket thread from <strong>My Tickets</strong>.</Step>
          <Step n={2}>Type your reply at the bottom of the thread and click <strong>Send Reply</strong>.</Step>
          <Step n={3}>You'll receive an email notification when the support team replies.</Step>
        </div>
      </div>
    ),
  },
  {
    id: 'security',
    icon: ShieldCheck,
    title: 'Privacy & Security',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-black/70">Your security is a top priority. Here's how your data is protected:</p>
        <ul className="space-y-3">
          {[
            { title: 'Passwords', desc: 'Passwords are hashed with bcrypt and never stored in plain text.' },
            { title: 'Payments', desc: 'Card payments are handled entirely by Stripe. Your card details never touch our servers.' },
            { title: 'Sessions', desc: 'Login sessions use short-lived JWT tokens (30 minutes) that automatically refresh in the background.' },
            { title: 'Two-Factor Auth', desc: 'Enable 2FA in Profile → Security for an extra layer of protection. Codes are valid for 10 minutes.' },
            { title: 'Password Reset', desc: 'Reset tokens expire after 1 hour and are single-use.' },
            { title: 'HTTPS', desc: 'All traffic is encrypted via TLS. The site will never load over plain HTTP.' },
          ].map(({ title, desc }) => (
            <li key={title} className="flex gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-2" />
              <div><span className="font-medium text-sm">{title}:</span> <span className="text-sm text-black/60">{desc}</span></div>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'faq',
    icon: HelpCircle,
    title: 'FAQ',
    content: (
      <div>
        <Accordion title="I didn't receive my verification email.">
          <p>Check your spam/junk folder. If it's not there, try signing in — you'll be prompted to resend the verification email. Make sure you entered the correct email address during registration.</p>
        </Accordion>
        <Accordion title="My payment failed. Was I charged?">
          <p>If the payment failed, no charge was applied. Your cart is preserved. Try again with a different card or payment method. If the issue persists, contact support.</p>
        </Accordion>
        <Accordion title="How do I access a course I've already paid for?">
          <p>Go to <strong>Courses → My Learning</strong> to see all enrolled courses. You can also find them under <strong>Profile → My Courses</strong>.</p>
        </Accordion>
        <Accordion title="Can I get a refund?">
          <p>Please submit a support ticket via the <strong>Contact</strong> page. Our team will review your request and respond within 1–2 business days.</p>
        </Accordion>
        <Accordion title="My 2FA code isn't working.">
          <p>Codes expire after 10 minutes. Click <strong>Resend code</strong> on the verification screen to get a fresh one. Also check your spam folder.</p>
        </Accordion>
        <Accordion title="How do I download my course certificate?">
          <p>Complete 100% of the course (all lessons, quizzes, and assignments). Your certificate will appear in <strong>Profile → My Courses</strong> and on the <strong>My Learning</strong> page. Click <strong>View Certificate</strong> to open and print/download it.</p>
        </Accordion>
        <Accordion title="Can I use the site without creating an account?">
          <p>Yes — the portfolio, gallery, store catalog, and course catalog are fully public. You only need an account to checkout, enroll in courses, or submit support tickets.</p>
        </Accordion>
      </div>
    ),
  },
];

export function Docs() {
  const [activeSection, setActiveSection] = useState('account');
  const [search, setSearch] = useState('');

  const filtered = search
    ? SECTIONS.filter(s => s.title.toLowerCase().includes(search.toLowerCase()))
    : SECTIONS;

  const current = SECTIONS.find(s => s.id === activeSection) ?? SECTIONS[0];

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Help & Documentation</h1>
            <p className="text-black/50">Everything you need to use Gibson Technologies.</p>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
            <input
              type="text"
              placeholder="Search topics…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-black/10 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            />
          </div>

          <div className="flex flex-col md:flex-row gap-6">

            {/* Sidebar */}
            <nav className="md:w-52 flex-shrink-0">
              <div className="bg-white border border-black/10 rounded-xl p-2 sticky top-24">
                {filtered.map(({ id, icon: Icon, title }) => (
                  <button
                    key={id}
                    onClick={() => { setActiveSection(id); setSearch(''); }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-left',
                      activeSection === id && !search
                        ? 'bg-primary text-white font-medium'
                        : 'text-black/60 hover:bg-black/5 hover:text-black',
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {title}
                  </button>
                ))}
              </div>
            </nav>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {search ? (
                <div className="space-y-4">
                  {filtered.length === 0 ? (
                    <p className="text-black/40 text-sm py-8 text-center">No topics match your search.</p>
                  ) : (
                    filtered.map(({ id, icon: Icon, title, content }) => (
                      <div key={id} className="bg-white border border-black/10 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Icon className="w-5 h-5 text-primary" />
                          <h2 className="text-lg font-semibold">{title}</h2>
                        </div>
                        {content}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18 }}
                  className="bg-white border border-black/10 rounded-xl p-6"
                >
                  <div className="flex items-center gap-2 mb-6">
                    <current.icon className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-semibold">{current.title}</h2>
                  </div>
                  {current.content}
                </motion.div>
              )}

              {/* Contact banner */}
              {!search && (
                <div className="mt-4 bg-primary/5 border border-primary/20 rounded-xl p-5 flex items-start gap-4">
                  <HelpCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Still need help?</p>
                    <p className="text-sm text-black/50 mt-0.5">
                      Submit a support ticket via the{' '}
                      <a href="/contact" className="text-primary hover:underline">Contact page</a>{' '}
                      and our team will get back to you.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
