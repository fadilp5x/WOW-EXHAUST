import { useState } from 'react';
import { CheckCircle2, Mail, Send, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Research & Open Audit');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error('Please fill in your name, email, and message.');
      return;
    }
    setSubmitted(true);
    toast.success('Inquiry prepared. Send directly to hello@unseen.platform.');
  };

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-16 sm:py-24 space-y-14">
      <section className="text-center max-w-3xl mx-auto space-y-5">
        <span className="inline-block px-4 py-1.5 rounded-full bg-[#08090B] text-[#CDF22B] font-mono text-[10px] font-bold tracking-[0.16em] uppercase">
          Contact & Collaborations
        </span>
        <h1 className="font-display text-4xl sm:text-6xl font-bold leading-[0.94] text-[#08090B]">
          Have something{' '}
          <span className="inline-block bg-[#08090B] text-[#CDF22B] px-3.5 py-1 rounded-2xl shadow-[0_4px_0_#000] -rotate-1">
            worth revealing?
          </span>
        </h1>
        <p className="font-sans text-base sm:text-lg text-[#525866] leading-relaxed">
          Reach out to Project WOW Unseen for digital privacy workshops, campus pilot deployments, or technical audits of the EXHAUST Forensic Mirror.
        </p>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-5xl mx-auto">
        <div className="lg:col-span-5 space-y-4">
          <div className="card-unseen p-6 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-[#ECFFB6] flex items-center justify-center text-[#08090B]">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#00545F] font-bold block">
                Direct Channel
              </span>
              <a
                href="mailto:hello@unseen.platform"
                className="font-display text-lg font-bold text-[#08090B] hover:underline"
              >
                hello@unseen.platform
              </a>
            </div>
            <p className="font-sans text-xs text-[#525866] leading-relaxed">
              For security disclosures, student workshops, or UNSEEN Intelligence System inquiries.
            </p>
          </div>

          <div className="card-unseen-dark p-6 space-y-2">
            <div className="flex items-center gap-2 font-mono text-[10px] text-[#CDF22B] font-bold uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4" />
              Platform Release Status
            </div>
            <p className="font-display text-lg font-bold text-white">
              UNSEEN v2.4.0 · EXHAUST V4 Engine
            </p>
            <p className="font-sans text-xs text-[#FAF8F3]/75">
              Client-first EXIF, PDF, and Text forensics active with optional MongoDB 2-hour TTL & consented Gemini API integration.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 card-unseen p-6 sm:p-8 space-y-4"
        >
          {submitted ? (
            <div className="bg-[#ECFFB6]/60 border border-[#95ba07]/40 rounded-2xl p-6 text-center space-y-3">
              <CheckCircle2 className="w-8 h-8 text-[#0F766E] mx-auto" />
              <h2 className="font-display text-xl font-bold text-[#08090B]">
                Inquiry Prepared
              </h2>
              <p className="font-sans text-xs text-[#525866]">
                Thank you, {name}. Send any relevant details to{' '}
                <strong className="text-[#08090B]">hello@unseen.platform</strong> under &ldquo;{subject}&rdquo;.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setMessage('');
                }}
                className="btn-tactile-secondary px-4 py-2 text-xs cursor-pointer"
              >
                Send Another Inquiry
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contact-name" className="block font-mono text-[11px] font-bold text-[#08090B] mb-1">
                    Full Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Rivera"
                    className="w-full bg-[#FAF8F3] border border-[#08090B]/15 rounded-xl px-3.5 py-2.5 text-sm font-sans focus:outline-none focus:border-[#08090B]"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="block font-mono text-[11px] font-bold text-[#08090B] mb-1">
                    Email Address
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.org"
                    className="w-full bg-[#FAF8F3] border border-[#08090B]/15 rounded-xl px-3.5 py-2.5 text-sm font-sans focus:outline-none focus:border-[#08090B]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contact-subject" className="block font-mono text-[11px] font-bold text-[#08090B] mb-1">
                  Topic
                </label>
                <select
                  id="contact-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-[#FAF8F3] border border-[#08090B]/15 rounded-xl px-3.5 py-2.5 text-sm font-sans focus:outline-none focus:border-[#08090B]"
                >
                  <option value="Research & Open Audit">Research & Open Audit</option>
                  <option value="Privacy Workshop">Privacy Workshop</option>
                  <option value="Product Feedback">Product Feedback</option>
                  <option value="Security Disclosure">Security Disclosure</option>
                </select>
              </div>

              <div>
                <label htmlFor="contact-message" className="block font-mono text-[11px] font-bold text-[#08090B] mb-1">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what you are exploring..."
                  className="w-full bg-[#FAF8F3] border border-[#08090B]/15 rounded-xl px-3.5 py-2.5 text-sm font-sans focus:outline-none focus:border-[#08090B]"
                />
              </div>

              <button
                type="submit"
                className="btn-tactile-dark px-6 py-3 text-sm inline-flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4 text-[#CDF22B]" />
                <span>Submit Inquiry</span>
              </button>
            </>
          )}
        </form>
      </section>
    </main>
  );
}
