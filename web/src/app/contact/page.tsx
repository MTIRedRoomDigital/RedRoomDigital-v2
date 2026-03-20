'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('general');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // For now, open the user's email client with the form data pre-filled
    const subjectLine = `[${subject}] ${name ? `from ${name}` : 'Contact Form'}`;
    const body = `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`;
    window.location.href = `mailto:support@redroomdigital.com?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`;

    setSubmitted(true);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">Contact Us</h1>
      <p className="text-slate-400 mb-8">
        Have a question, bug report, or feedback? We&apos;d love to hear from you.
      </p>

      {submitted ? (
        <div className="p-6 bg-green-900/20 border border-green-800/50 rounded-xl text-center">
          <div className="text-4xl mb-3">&#x2709;&#xFE0F;</div>
          <h2 className="text-xl font-semibold text-white mb-2">Message Sent!</h2>
          <p className="text-slate-400 text-sm mb-4">
            Thank you for reaching out. We&apos;ll get back to you as soon as possible.
          </p>
          <button
            onClick={() => { setSubmitted(false); setName(''); setEmail(''); setMessage(''); }}
            className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
          >
            Send another message
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Subject</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
            >
              <option value="general">General Question</option>
              <option value="bug">Bug Report</option>
              <option value="feature">Feature Request</option>
              <option value="billing">Billing / Subscription</option>
              <option value="account">Account Issue</option>
              <option value="report">Report a User</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Message *</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what's on your mind..."
              required
              rows={6}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={!email.trim() || !message.trim()}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            Send Message
          </button>
        </form>
      )}

      {/* Direct Contact Info */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl">
          <h3 className="text-sm font-semibold text-white mb-2">Email Us</h3>
          <p className="text-sm text-slate-400">support@redroomdigital.com</p>
          <p className="text-xs text-slate-500 mt-1">We typically respond within 24-48 hours</p>
        </div>
        <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl">
          <h3 className="text-sm font-semibold text-white mb-2">Community</h3>
          <p className="text-sm text-slate-400">
            Join the conversation on our{' '}
            <Link href="/forum" className="text-amber-400 hover:text-amber-300 transition-colors">
              Community Forum
            </Link>
          </p>
          <p className="text-xs text-slate-500 mt-1">Get help from other users and the team</p>
        </div>
      </div>
    </div>
  );
}
