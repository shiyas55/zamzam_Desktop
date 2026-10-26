import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Copy,
  Check,
  CheckCheck,
  MessageCircle,
  RefreshCw,
  Play,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
  Minimize2,
  ExternalLink,
} from 'lucide-react';
import { Customer } from '../types';
import { OrderRow } from '../pages/manager/CreateOrderPage';
import {
  whatsappService,
  WhatsAppConversationItem,
  WhatsAppMessageItem,
} from '../services/whatsappService';
import { cleanPhoneNumber } from '../utils/whatsappUtils';

interface RealWhatsAppWebViewProps {
  customer?: { id: string; name: string; phone?: string; route?: string } | null;
  targetCustomerId?: string | null;
  openChatTimestamp?: number;
  allCustomers?: Customer[];
  orderRows?: OrderRow[];
  onSelectCustomer?: (customerId: string) => void;
  onApplyQuantities?: (customerId: string, kubbus: string, romali: string) => void;
  onClose?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onHide?: () => void;
}

export const RealWhatsAppWebView: React.FC<RealWhatsAppWebViewProps> = ({
  customer,
  targetCustomerId,
  openChatTimestamp,
  allCustomers = [],
  orderRows = [],
  onSelectCustomer,
  onApplyQuantities,
  onClose,
  onHide,
}) => {
  // Navigation State: 'chat_list' | 'chat_screen' (Single fixed mobile viewport)
  const [activeScreen, setActiveScreen] = useState<'chat_list' | 'chat_screen'>('chat_list');
  const [activeConversation, setActiveConversation] = useState<WhatsAppConversationItem | null>(null);
  const [conversations, setConversations] = useState<WhatsAppConversationItem[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessageItem[]>([]);

  // Search & Filter State inside WhatsApp
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'orders'>('all');

  // Loading & Action States
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [appliedOrderNotice, setAppliedOrderNotice] = useState<string | null>(null);

  // Dedicated container ref for message list to prevent scroll displacement
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<any>(null);

  // 1. Fetch conversations from Django backend
  const loadConversations = useCallback(async (search?: string, silent = false) => {
    if (!silent) setLoadingList(true);
    try {
      const data = await whatsappService.getConversations(search);
      setConversations(data);
    } catch (err) {
      console.error('Failed to load WhatsApp conversations from Django:', err);
    } finally {
      if (!silent) setLoadingList(false);
      setRefreshing(false);
    }
  }, []);

  // Initial fetch and search listener
  useEffect(() => {
    const timer = setTimeout(() => {
      loadConversations(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, loadConversations]);

  // Periodic polling for real-time incoming messages from Meta Webhook
  useEffect(() => {
    pollTimerRef.current = setInterval(() => {
      loadConversations(searchQuery, true);
      if (activeConversation?.id) {
        whatsappService
          .getMessages(activeConversation.id)
          .then((freshMsgs) => {
            setMessages(freshMsgs);
          })
          .catch(() => {});
      }
    }, 8000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [searchQuery, activeConversation?.id, loadConversations]);

  // 2. Load conversation messages when an active conversation is opened
  const handleOpenConversation = useCallback(
    async (conv: WhatsAppConversationItem) => {
      setActiveConversation(conv);
      setActiveScreen('chat_screen');
      setLoadingMessages(true);

      if (conv.customer?.id) {
        onSelectCustomer?.(conv.customer.id);
      }

      try {
        const msgs = await whatsappService.getMessages(conv.id);
        setMessages(msgs);
      } catch (err) {
        console.error('Failed to load conversation messages:', err);
      } finally {
        setLoadingMessages(false);
      }
    },
    [onSelectCustomer]
  );

  // 3. Two-Way Connected Search: Automatically open customer's WhatsApp conversation when selected from search or table
  useEffect(() => {
    const custId = targetCustomerId || customer?.id;
    if (!custId) return;

    let isMounted = true;
    setLoadingMessages(true);
    setActiveScreen('chat_screen');

    whatsappService
      .getCustomerConversation(custId)
      .then((conv) => {
        if (!isMounted) return;
        setActiveConversation(conv);
        setMessages(conv.messages || []);
      })
      .catch((err) => {
        console.error('Failed to resolve customer WhatsApp conversation:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingMessages(false);
      });

    return () => {
      isMounted = false;
    };
  }, [targetCustomerId, openChatTimestamp, customer?.id]);

  // Safe inner auto-scroll: Scrolls ONLY the message container, NEVER the parent or page!
  useEffect(() => {
    if (activeScreen === 'chat_screen' && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [activeScreen, messages]);

  // Back Navigation: Return to Chat List Screen
  const handleBackToList = () => {
    setActiveScreen('chat_list');
    loadConversations(searchQuery, true);
  };

  // Filter conversations based on selected tab
  const displayedConversations = useMemo(() => {
    let list = conversations;
    if (filterTab === 'unread') {
      list = list.filter((c) => c.unread_count > 0);
    } else if (filterTab === 'orders') {
      list = list.filter(
        (c) =>
          /kubbus|romali|packet|pkt|\d+\s*ps/i.test(c.last_message || '')
      );
    }
    return list;
  }, [conversations, filterTab]);

  // Copy customer phone number
  const handleCopyPhone = () => {
    const phone = activeConversation?.customer?.phone || activeConversation?.whatsapp_phone;
    if (!phone) return;
    const digits = cleanPhoneNumber(phone);
    navigator.clipboard.writeText(digits || phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // 1-Click Apply Quantities into Billing Table
  const handleApplyQuantitiesFromMessage = (text: string) => {
    if (!activeConversation?.customer?.id) return;

    // Detect numbers following Kubbus/Romali keywords
    const kubbusMatch =
      text.match(/kubbus.*?(\d+)/i) ||
      text.match(/(\d+)\s*(?:pkt|pkts|packets|ps)?\s*kubbus/i);
    const romaliMatch =
      text.match(/romali.*?(\d+)/i) ||
      text.match(/(\d+)\s*(?:pkt|pkts|packets|ps)?\s*romali/i);

    const kQty = kubbusMatch ? kubbusMatch[1] : '';
    const rQty = romaliMatch ? romaliMatch[1] : '';

    if (kQty || rQty) {
      onApplyQuantities?.(activeConversation.customer.id, kQty, rQty);
      setAppliedOrderNotice(`${kQty ? `${kQty} Kubbus` : ''}${kQty && rQty ? ', ' : ''}${rQty ? `${rQty} Romali` : ''}`);
      setTimeout(() => setAppliedOrderNotice(null), 3000);
    }
  };

  // Format message time cleanly
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div
      className="billing-whatsapp-panel wa-mobile-viewport"
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
        background: '#111b21',
      }}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* ── Slide Navigation Track (200% width, translateX for smooth mobile slide) ── */}
      <div
        className={`wa-mobile-slider ${activeScreen === 'chat_screen' ? 'show-chat' : 'show-list'}`}
        style={{
          display: 'flex',
          width: '200%',
          height: '100%',
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* ========================================================================= */}
        {/* SCREEN 1: WHATSAPP CHAT LIST SCREEN                                       */}
        {/* ========================================================================= */}
        <div
          className="wa-screen-pane"
          style={{
            width: '50%',
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            background: '#111b21',
          }}
        >
          {/* WhatsApp Mobile Top App Bar */}
          <div
            style={{
              background: '#008069',
              color: '#ffffff',
              padding: '0.65rem 0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              zIndex: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: '#25d366',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
                }}
              >
                <MessageCircle size={19} />
              </div>
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '0.01em', lineHeight: 1.1 }}>
                  WhatsApp
                </div>
                <div
                  style={{
                    fontSize: '0.65rem',
                    color: '#d1fae5',
                    opacity: 0.95,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <span style={{ color: '#86efac' }}>● Cloud API</span>
                  <span>•</span>
                  <span>View-Only</span>
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button
                type="button"
                onClick={() => {
                  setRefreshing(true);
                  loadConversations(searchQuery);
                }}
                title="Refresh incoming messages"
                style={{
                  background: 'rgba(255, 255, 255, 0.16)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.3rem 0.5rem',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                <span>Sync</span>
              </button>

              {(onClose || onHide) && (
                <button
                  type="button"
                  onClick={onClose || onHide}
                  title="Minimize WhatsApp panel"
                  style={{
                    background: 'rgba(255, 255, 255, 0.16)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.3rem 0.45rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Minimize2 size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Search Box in Chat List */}
          <div
            style={{
              padding: '0.5rem 0.75rem',
              background: '#111b21',
              borderBottom: '1px solid #202c33',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#202c33',
                borderRadius: '8px',
                padding: '0.35rem 0.65rem',
                gap: '0.45rem',
              }}
            >
              <Search size={15} color="#8696a0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations, phones..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#e9edef',
                  fontSize: '0.82rem',
                  width: '100%',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#8696a0',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div
              style={{
                display: 'flex',
                gap: '0.35rem',
                marginTop: '0.45rem',
                alignItems: 'center',
              }}
            >
              {(
                [
                  { key: 'all', label: 'All Chats' },
                  { key: 'unread', label: 'Unread' },
                  { key: 'orders', label: '⚡ Orders' },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilterTab(key)}
                  style={{
                    background: filterTab === key ? '#00a884' : '#202c33',
                    color: filterTab === key ? '#111b21' : '#8696a0',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    padding: '0.22rem 0.65rem',
                    borderRadius: '16px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Conversations List */}
          <div
            className="wa-scroll-container"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              background: '#111b21',
              padding: '0.2rem 0',
            }}
          >
            {loadingList ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#8696a0', fontSize: '0.82rem' }}>
                <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 0.6rem auto', color: '#00a884' }} />
                <div>Loading WhatsApp messages...</div>
              </div>
            ) : displayedConversations.length === 0 ? (
              <div style={{ padding: '2.5rem 1.25rem', textAlign: 'center', color: '#8696a0', fontSize: '0.82rem' }}>
                <MessageCircle size={32} style={{ margin: '0 auto 0.6rem auto', opacity: 0.35 }} />
                <div style={{ fontWeight: 700, color: '#e9edef', marginBottom: '0.35rem' }}>
                  No WhatsApp messages yet
                </div>
                <div style={{ fontSize: '0.75rem', lineHeight: 1.4 }}>
                  When customers send wholesale orders or updates via WhatsApp, they will appear here automatically.
                </div>
              </div>
            ) : (
              displayedConversations.map((conv, idx) => {
                const isSelected = activeConversation?.id === conv.id;
                const contactTitle = conv.customer?.name || conv.contact_name || `+${conv.whatsapp_phone}`;
                const initials = contactTitle.slice(0, 2).toUpperCase() || 'WA';

                const avatarColors = ['#00a884', '#0284c7', '#7c3aed', '#db2777', '#ea580c', '#16a34a'];
                const avatarColor = avatarColors[idx % avatarColors.length];
                const hasOrder = /kubbus|romali|packet|pkt|\d+\s*ps/i.test(conv.last_message || '');

                return (
                  <div
                    key={conv.id}
                    onClick={() => handleOpenConversation(conv)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0.65rem 0.85rem',
                      cursor: 'pointer',
                      background: isSelected ? '#202c33' : 'transparent',
                      borderBottom: '1px solid #1c272e',
                      transition: 'background 0.12s ease',
                      gap: '0.75rem',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#1a2329';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = isSelected ? '#202c33' : 'transparent';
                    }}
                  >
                    {/* Avatar */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          background: avatarColor,
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.88rem',
                          boxShadow: '0 2px 5px rgba(0, 0, 0, 0.25)',
                        }}
                      >
                        {initials}
                      </div>
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 1,
                          right: 1,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: '#25d366',
                          border: '2px solid #111b21',
                        }}
                      />
                    </div>

                    {/* Chat Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '0.2rem',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.88rem',
                            fontWeight: 700,
                            color: '#e9edef',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {contactTitle}
                        </span>
                        <span
                          style={{
                            fontSize: '0.66rem',
                            color: conv.unread_count > 0 ? '#00a884' : '#8696a0',
                            fontWeight: 600,
                            flexShrink: 0,
                            marginLeft: '0.35rem',
                          }}
                        >
                          {formatTime(conv.last_message_at || conv.created_at)}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.4rem',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '0.74rem',
                            color: conv.unread_count > 0 ? '#e9edef' : '#8696a0',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                          }}
                        >
                          {hasOrder && (
                            <span
                              style={{
                                background: 'rgba(0, 168, 132, 0.2)',
                                color: '#25d366',
                                fontSize: '0.62rem',
                                padding: '1px 4px',
                                borderRadius: '4px',
                                fontWeight: 800,
                                flexShrink: 0,
                              }}
                            >
                              ORDER
                            </span>
                          )}
                          <span>{conv.last_message || 'Incoming message received'}</span>
                        </div>

                        {conv.unread_count > 0 && (
                          <span
                            style={{
                              background: '#25d366',
                              color: '#111b21',
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              borderRadius: '10px',
                              padding: '0.1rem 0.4rem',
                              flexShrink: 0,
                              minWidth: 16,
                              textAlign: 'center',
                            }}
                          >
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SCREEN 2: FULL CONVERSATION CHAT SCREEN (VIEW-ONLY MVP)                  */}
        {/* ========================================================================= */}
        <div
          className="wa-screen-pane"
          style={{
            width: '50%',
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            background: '#0b141a',
          }}
        >
          {/* Chat Top App Bar */}
          <div
            style={{
              background: '#075e54',
              color: '#ffffff',
              padding: '0.5rem 0.65rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.25)',
              zIndex: 10,
              gap: '0.35rem',
            }}
          >
            {/* Left: Back Button + Contact Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, flex: 1 }}>
              <button
                type="button"
                onClick={handleBackToList}
                title="Back to conversation list"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: '0.3rem',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ArrowLeft size={20} />
              </button>

              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#00a884',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  flexShrink: 0,
                }}
              >
                {(activeConversation?.customer?.name || activeConversation?.contact_name || 'WA')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    color: '#ffffff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.2,
                  }}
                >
                  {activeConversation?.customer?.name ||
                    activeConversation?.contact_name ||
                    `+${activeConversation?.whatsapp_phone}`}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: '#25d366',
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: '0.68rem', color: '#a7f3d0', fontWeight: 600, flexShrink: 0 }}>
                    online
                  </span>
                  {activeConversation?.customer?.route_name && (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        color: '#d1fae5',
                        background: 'rgba(0, 0, 0, 0.2)',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {activeConversation.customer.route_name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
              <button
                type="button"
                onClick={handleCopyPhone}
                title="Copy customer phone"
                style={{
                  background: copiedPhone ? '#10b981' : 'rgba(255, 255, 255, 0.18)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.32rem 0.5rem',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontWeight: 700,
                }}
              >
                {copiedPhone ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedPhone ? 'Copied' : 'Phone'}</span>
              </button>

              {(onClose || onHide) && (
                <button
                  type="button"
                  onClick={onClose || onHide}
                  title="Close WhatsApp"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    padding: '0.25rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Applied Order Feedback Toast Banner */}
          {appliedOrderNotice && (
            <div
              style={{
                background: '#10b981',
                color: '#ffffff',
                padding: '0.4rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
                zIndex: 15,
              }}
            >
              <Check size={14} />
              <span>Applied to Billing Table: {appliedOrderNotice}</span>
            </div>
          )}

          {/* Messages Body Area (VIEW-ONLY) - Safely Scrolled via messagesContainerRef */}
          <div
            ref={messagesContainerRef}
            className="wa-scroll-container wa-chat-wallpaper"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
              backgroundColor: '#0b141a',
            }}
          >
            {/* Encryption Notice */}
            <div
              style={{
                alignSelf: 'center',
                background: '#182229',
                color: '#ffd279',
                padding: '0.3rem 0.65rem',
                borderRadius: '8px',
                fontSize: '0.65rem',
                textAlign: 'center',
                maxWidth: '92%',
                lineHeight: 1.35,
                border: '1px solid #233138',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={13} color="#ffd279" />
              <span>Meta WhatsApp Cloud API • Official Business Channel</span>
            </div>

            {/* Date Tag */}
            <div
              style={{
                alignSelf: 'center',
                background: '#182229',
                color: '#8696a0',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                fontSize: '0.66rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Today
            </div>

            {loadingMessages ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#8696a0', fontSize: '0.8rem' }}>
                <RefreshCw size={18} className="animate-spin" style={{ margin: '0 auto 0.4rem auto', color: '#00a884' }} />
                <span>Loading message history...</span>
              </div>
            ) : messages.length === 0 ? (
              <div
                style={{
                  alignSelf: 'center',
                  background: '#202c33',
                  color: '#8696a0',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  textAlign: 'center',
                  maxWidth: '85%',
                  marginTop: '1.5rem',
                  lineHeight: 1.4,
                }}
              >
                No incoming messages in this conversation yet. Incoming messages sent from this customer's WhatsApp will appear here automatically.
              </div>
            ) : (
              messages.map((msg) => {
                const isInbound = msg.direction === 'inbound';
                const hasOrderKeywords =
                  /kubbus|romali|packet|pkt/i.test(msg.text) && /\d+/.test(msg.text);

                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignSelf: isInbound ? 'flex-start' : 'flex-end',
                      maxWidth: '84%',
                    }}
                  >
                    <div
                      className={isInbound ? 'wa-bubble-received' : 'wa-bubble-sent'}
                      style={{
                        padding: '0.55rem 0.75rem',
                        fontSize: '0.82rem',
                        lineHeight: 1.4,
                        wordBreak: 'break-word',
                      }}
                    >
                      {/* Media Badges */}
                      {msg.message_type === 'voice' || msg.message_type === 'audio' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '170px' }}>
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: '50%',
                              background: '#00a884',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Play size={14} fill="#ffffff" />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ height: 4, background: '#374248', borderRadius: 2 }}>
                              <div style={{ width: '40%', height: '100%', background: '#00a884' }} />
                            </div>
                            <div style={{ fontSize: '0.65rem', color: '#8696a0', marginTop: '0.2rem' }}>
                              Voice Note (0:24)
                            </div>
                          </div>
                        </div>
                      ) : msg.message_type === 'image' ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            color: '#00a884',
                            fontWeight: 600,
                            fontSize: '0.76rem',
                            marginBottom: '0.25rem',
                          }}
                        >
                          <ImageIcon size={15} />
                          <span>Photo Attachment</span>
                        </div>
                      ) : msg.message_type === 'document' ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            color: '#00a884',
                            fontWeight: 600,
                            fontSize: '0.76rem',
                            marginBottom: '0.25rem',
                          }}
                        >
                          <FileText size={15} />
                          <span>Document Attachment</span>
                        </div>
                      ) : null}

                      {/* Message Text */}
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>

                      {/* 1-Click Apply to Billing Chip if Wholesale order detected */}
                      {hasOrderKeywords && activeConversation?.customer?.id && (
                        <div
                          style={{
                            marginTop: '0.45rem',
                            paddingTop: '0.4rem',
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleApplyQuantitiesFromMessage(msg.text)}
                            style={{
                              width: '100%',
                              background: '#00a884',
                              color: '#111b21',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '0.36rem 0.5rem',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.35rem',
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                            }}
                          >
                            <FileSpreadsheet size={13} />
                            <span>Apply Quantities to Bill</span>
                          </button>
                        </div>
                      )}

                      {/* Timestamp & Read Receipt */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '0.25rem',
                          fontSize: '0.62rem',
                          color: '#8696a0',
                          marginTop: '0.25rem',
                        }}
                      >
                        <span>{formatTime(msg.timestamp)}</span>
                        {!isInbound && <CheckCheck size={13} color="#53bdeb" />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* VIEW-ONLY MVP FOOTER (No Composer / No Send Button) */}
          <div
            style={{
              background: '#202c33',
              padding: '0.6rem 0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              borderTop: '1px solid #2a3942',
              color: '#8696a0',
              fontSize: '0.74rem',
              textAlign: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={15} color="#00a884" />
            <span>
              <strong>View-Only WhatsApp Feed</strong> &bull; Meta WhatsApp Cloud API
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
