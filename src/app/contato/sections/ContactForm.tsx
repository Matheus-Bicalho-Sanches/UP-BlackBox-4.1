'use client';

import { useState } from 'react';

type ContactFormProps = {
  id?: string;
  privacyNotice: {
    consentLabel: string;
    description: string;
    policyLink: {
      label: string;
      href: string;
    };
  };
};

type FormData = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  consent: boolean;
};

const initialData: FormData = {
  name: '',
  email: '',
  phone: '',
  subject: 'Quero entender os serviços da UP',
  message: '',
  consent: false,
};

const subjects = [
  'Quero entender os serviços da UP',
  'Tenho uma dúvida sobre minha carteira',
  'Gostaria de agendar uma reunião de acompanhamento',
  'Solicitar material institucional',
];

const ContactForm = ({ id, privacyNotice }: ContactFormProps) => {
  const [formData, setFormData] = useState<FormData>(initialData);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleChange = (field: keyof FormData) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = field === 'consent' ? (event.target as HTMLInputElement).checked : event.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Limpar mensagens de erro quando o usuário começar a digitar
    if (status === 'error') {
      setStatus('idle');
      setErrorMessage('');
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!formData.consent) {
      setStatus('error');
      setErrorMessage('Confirme o consentimento para seguirmos com o atendimento.');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('/api/contato', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar mensagem');
      }

      setStatus('success');
      setFormData(initialData);
      setErrorMessage('');
      
      // Scroll suave para a mensagem de sucesso
      setTimeout(() => {
        const successMessage = document.querySelector('[aria-live="polite"]');
        if (successMessage) {
          successMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error.message || 'Erro ao enviar mensagem. Por favor, tente novamente ou entre em contato diretamente pelo WhatsApp.');
      console.error('Erro ao enviar formulário:', error);
    }
  };

  return (
    <section id={id} className="bg-white py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="grid gap-10 md:grid-cols-2">
          <div className="space-y-5">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-600">Formulário inteligente</p>
            <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">Conte-nos como podemos ajudar</h2>
            <p className="text-lg text-gray-600">
              Nossa equipe usa estas informações para montar o diagnóstico inicial e direcionar o especialista mais
              adequado. Inclua detalhes sobre seu patrimônio, horizonte e restrições se possível.
            </p>
            <ul className="space-y-3 text-sm text-gray-600">
              <li>
                • Resposta em até 1 dia útil com próximas etapas e materiais personalizados.
              </li>
              <li>
                • Podemos assinar NDA e/ou receber dados anonimizados, se necessário.
              </li>
              <li>
                • Para atendimento imediato, utilize o WhatsApp institucional.
              </li>
            </ul>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg"
            aria-live="polite"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col text-sm font-semibold text-gray-700">
                Nome completo
                <input
                  required
                  value={formData.name}
                  onChange={handleChange('name')}
                  placeholder="Seu nome"
                  className="mt-2 rounded-xl border border-slate-200 px-3 py-3 text-sm text-gray-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                />
              </label>
              <label className="flex flex-col text-sm font-semibold text-gray-700">
                E-mail
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={handleChange('email')}
                  placeholder="voce@empresa.com"
                  className="mt-2 rounded-xl border border-slate-200 px-3 py-3 text-sm text-gray-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col text-sm font-semibold text-gray-700">
                Telefone / WhatsApp
                <input
                  required
                  value={formData.phone}
                  onChange={handleChange('phone')}
                  placeholder="(11) 99999-0000"
                  className="mt-2 rounded-xl border border-slate-200 px-3 py-3 text-sm text-gray-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                />
              </label>
              <label className="flex flex-col text-sm font-semibold text-gray-700">
                Assunto
                <select
                  value={formData.subject}
                  onChange={(event) => setFormData((prev) => ({ ...prev, subject: event.target.value }))}
                  className="mt-2 rounded-xl border border-slate-200 px-3 py-3 text-sm text-gray-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                >
                  {subjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col text-sm font-semibold text-gray-700">
              Como podemos ajudar?
              <textarea
                required
                value={formData.message}
                onChange={handleChange('message')}
                rows={5}
                placeholder="Compartilhe seus objetivos, composição atual e dúvidas específicas."
                className="mt-2 rounded-xl border border-slate-200 px-3 py-3 text-sm text-gray-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
              />
            </label>

            <label className="flex items-start gap-3 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={formData.consent}
                onChange={handleChange('consent')}
                className="mt-1 h-5 w-5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              <span>
                <strong>{privacyNotice.consentLabel}</strong>
                <br />
                {privacyNotice.description}{' '}
                <a href={privacyNotice.policyLink.href} className="text-cyan-600 underline" target="_blank">
                  {privacyNotice.policyLink.label}
                </a>
                .
              </span>
            </label>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-cyan-500"
            >
              {status === 'loading' ? 'Enviando...' : 'Enviar mensagem'}
            </button>

            {status === 'success' && (
              <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                Mensagem recebida! Entraremos em contato em até 1 dia útil.
              </p>
            )}
            {status === 'error' && (
              <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {errorMessage || 'Erro ao enviar mensagem. Por favor, tente novamente ou entre em contato diretamente pelo WhatsApp.'}
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
};

export default ContactForm;

