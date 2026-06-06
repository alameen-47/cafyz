import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './Modal';
import { supportApi, type ApiSupportResponse } from '../services/api';
import { toastBus } from '../services/toastBus';
import './AISupportWidget.css';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

function messageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function AISupportWidget({
  open,
  onClose,
  screen,
}: {
  open: boolean;
  onClose: () => void;
  screen?: string;
}) {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: messageId(),
      role: 'assistant',
      text: 'Welcome to Cafyz AI Support. Ask me about printers, role access, billing, login, orders, menu, and reports.',
    },
  ]);
  const [lastResponse, setLastResponse] = useState<ApiSupportResponse | null>(null);

  const history = useMemo(
    () => messages.slice(-10).map((m) => ({ role: m.role, text: m.text })),
    [messages],
  );

  async function sendMessage(prefill?: string) {
    const text = (prefill ?? input).trim();
    if (!text || busy) return;

    setMessages((prev) => [...prev, { id: messageId(), role: 'user', text }]);
    setInput('');
    setBusy(true);

    try {
      const resp = await supportApi.ask({ message: text, screen, history });
      setLastResponse(resp);
      setMessages((prev) => [...prev, { id: messageId(), role: 'assistant', text: resp.reply }]);
    } catch (e) {
      const msg = (e as Error).message;
      toastBus.error(`Support request failed: ${msg}`);
      setMessages((prev) => [...prev, {
        id: messageId(),
        role: 'assistant',
        text: 'Sorry, I could not process this request. Please try again or contact support@cafyz.com.',
      }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Customer Support"
      title="Cafyz AI Support"
      subtitle="Fast guided help for every panel and workflow."
      size="lg"
      footer={(
        <>
          <button type="button" className="roles-cancel-btn" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="roles-save-btn"
            onClick={() => sendMessage()}
            disabled={busy || !input.trim()}
          >
            {busy ? 'Thinking…' : 'Ask AI Support'}
          </button>
        </>
      )}
    >
      <div className="ai-support-root">
        <div className="ai-support-chat">
          {messages.map((m) => (
            <div key={m.id} className={`ai-support-msg ${m.role}`}>
              <span className="ai-support-role">{m.role === 'assistant' ? 'AI' : 'You'}</span>
              <p>{m.text}</p>
            </div>
          ))}
        </div>

        <div className="ai-support-input-wrap">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your issue. Example: Kitchen printer test is not printing."
            className="ai-support-input"
            rows={3}
          />
        </div>

        {lastResponse?.suggestions?.length ? (
          <div className="ai-support-suggestions">
            {lastResponse.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="ai-support-chip"
                onClick={() => sendMessage(s)}
                disabled={busy}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {lastResponse?.quick_actions?.length ? (
          <div className="ai-support-actions">
            {lastResponse.quick_actions.map((a) => (
              <button
                key={`${a.path}-${a.label}`}
                type="button"
                className="ai-support-action"
                onClick={() => {
                  navigate(a.path);
                  onClose();
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

