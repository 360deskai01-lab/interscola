'use client';

import { CheckCircle2, Loader2, Mail, MapPin, Clock } from 'lucide-react';
import {
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

const SUBJECT_OPTIONS = [
  { value: 'general', label: 'Genel Bilgi' },
  { value: 'individual', label: 'Bireysel Hazırlık' },
  { value: 'corporate', label: 'Kurumsal Lisans / Demo' },
  { value: 'technical', label: 'Teknik Destek' },
] as const;

type SubjectValue = (typeof SUBJECT_OPTIONS)[number]['value'];

const MAP_EMBED_SRC =
  'https://www.google.com/maps?q=Nil%C3%BCfer,+Bursa,+T%C3%BCrkiye&hl=tr&z=12&output=embed';

export function ContactClient(): ReactNode {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState<SubjectValue>('general');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setSubmitting(false);
    setSent(true);
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-12">
      <section aria-labelledby="contact-form-title">
        <h1
          id="contact-form-title"
          className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl"
        >
          İletişim
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Sorularınız, demo talepleri ve teknik destek için formu doldurun. Mesajınız
          kayıt altına alınır (şu an demo gönderim; e-posta entegrasyonu sonraki faz).
        </p>

        {sent ? (
          <div
            role="status"
            className="mt-8 flex items-start gap-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100"
          >
            <CheckCircle2 className="size-5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">Mesajınız alındı</p>
              <p className="mt-1 text-emerald-200/90">
                En kısa sürede {email.trim() || 'belirttiğiniz e-posta'} adresine
                dönüş yapacağız.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block text-sm">
              <span className="text-slate-300">Ad Soyad</span>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-slate-100 outline-none focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/30"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">E-posta</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-slate-100 outline-none focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/30"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">Telefon (opsiyonel)</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-slate-100 outline-none focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/30"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">Konu</span>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value as SubjectValue)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-slate-100 outline-none focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/30"
              >
                {SUBJECT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">Mesaj</span>
              <textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-slate-100 outline-none focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/30"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60 sm:w-auto sm:px-8"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Gönderiliyor…
                </>
              ) : (
                'Mesajı Gönder'
              )}
            </button>
          </form>
        )}
      </section>

      <aside className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Kurumsal ofis
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li className="flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-indigo-300" aria-hidden />
              <span>
                Nilüfer / Bursa, Türkiye
                <span className="block text-xs text-slate-500">
                  Interscola EdTech merkez ofis
                </span>
              </span>
            </li>
            <li className="flex gap-2">
              <Mail className="mt-0.5 size-4 shrink-0 text-indigo-300" aria-hidden />
              <a
                href="mailto:info@interscola.com"
                className="text-indigo-200 hover:text-indigo-100"
              >
                info@interscola.com
              </a>
            </li>
            <li className="flex gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-indigo-300" aria-hidden />
              <span>
                Hafta içi 09:00 – 18:00 (TR)
                <span className="block text-xs text-slate-500">
                  Resmî tatillerde yanıt süresi uzayabilir
                </span>
              </span>
            </li>
          </ul>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-xl">
          <iframe
            title="Interscola ofis konumu — Nilüfer, Bursa"
            src={MAP_EMBED_SRC}
            className="aspect-[4/3] w-full min-h-[240px] border-0 grayscale-[0.35] contrast-[1.05] invert-[0.92] hue-rotate-180 sm:aspect-video"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </aside>
    </div>
  );
}
