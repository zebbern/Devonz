import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { vercelConnection } from '~/lib/stores/vercel';
import { vercelApi } from '~/lib/api/vercel-client';
import { chatId } from '~/lib/persistence/useChatHistory';
import { classNames } from '~/utils/classNames';
import { dialogBackdropVariants, dialogVariants } from '~/components/ui/Dialog';
import { IconButton } from '~/components/ui/IconButton';

interface VercelDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  currentUrl?: string;
}

interface Domain {
  name: string;
  verified: boolean;
}

export function VercelDomainModal({ isOpen, onClose, projectId: propProjectId, currentUrl }: VercelDomainModalProps) {
  const connection = useStore(vercelConnection);
  const currentChatId = useStore(chatId);

  const [domains, setDomains] = useState<Domain[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newSubdomain, setNewSubdomain] = useState('');
  const [error, setError] = useState<string | null>(null);

  const projectId = propProjectId || (currentChatId ? localStorage.getItem(`vercel-project-${currentChatId}`) : null);

  const fetchDomains = useCallback(async () => {
    if (!projectId || !connection.token) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await vercelApi.listDomains(projectId, connection.token);

      if (result.success && result.domains) {
        setDomains(result.domains);
      } else {
        setError(result.error || 'Failed to fetch domains');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch domains');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, connection.token]);

  useEffect(() => {
    if (isOpen) {
      fetchDomains();
    }
  }, [isOpen, fetchDomains]);

  const handleAddDomain = async () => {
    if (!projectId || !connection.token || !newSubdomain.trim()) {
      return;
    }

    const subdomainRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/i;

    if (!subdomainRegex.test(newSubdomain)) {
      setError('Invalid subdomain format. Use only letters, numbers, and hyphens.');
      return;
    }

    setIsSaving(true);
    setError(null);

    const fullDomain = `${newSubdomain}.vercel.app`;

    try {
      const result = await vercelApi.addDomain(projectId, fullDomain, connection.token);

      if (result.success) {
        toast.success(`Domain ${fullDomain} added successfully!`);
        setNewSubdomain('');
        await fetchDomains();
      } else {
        setError(result.error || 'Failed to add domain');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add domain');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveDomain = async (domain: string) => {
    if (!projectId || !connection.token) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await vercelApi.removeDomain(projectId, domain, connection.token);

      if (result.success) {
        toast.success(`Domain ${domain} removed successfully!`);
        await fetchDomains();
      } else {
        setError(result.error || 'Failed to remove domain');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove domain');
    } finally {
      setIsSaving(false);
    }
  };

  if (!projectId) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <RadixDialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
          <RadixDialog.Portal>
            <RadixDialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-[9999] dark"
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(4px)' }}
                initial="closed"
                animate="open"
                exit="closed"
                variants={dialogBackdropVariants}
              />
            </RadixDialog.Overlay>
            <RadixDialog.Content asChild>
              <motion.div
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-[520px] max-w-[90vw] focus:outline-none rounded-xl shadow-2xl dark"
                style={{ backgroundColor: '#1a1a1a', border: '1px solid #333333' }}
                initial="closed"
                animate="open"
                exit="closed"
                variants={dialogVariants}
              >
                <div
                  className="flex items-center justify-between px-6 py-4"
                  style={{ borderBottom: '1px solid #333333' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: '#2a2a2a' }}
                    >
                      <svg className="w-5 h-5" viewBox="0 0 76 65" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="#ffffff" />
                      </svg>
                    </div>
                    <div>
                      <RadixDialog.Title className="text-lg font-semibold" style={{ color: '#ffffff' }}>
                        Domain Settings
                      </RadixDialog.Title>
                      <RadixDialog.Description className="text-sm" style={{ color: '#9ca3af' }}>
                        Customize your Vercel deployment domain
                      </RadixDialog.Description>
                    </div>
                  </div>
                  <RadixDialog.Close asChild>
                    <IconButton icon="i-ph:x" className="text-[#9ca3af] hover:text-white" />
                  </RadixDialog.Close>
                </div>

                <div className="p-6 space-y-6">
                  <div>
                    <h3 className="text-sm font-medium mb-3" style={{ color: '#ffffff' }}>
                      Add Custom Subdomain
                    </h3>
                    <div className="flex items-center gap-2">
                      <div
                        className="flex items-center flex-1 rounded-lg overflow-hidden"
                        style={{ backgroundColor: '#141414', border: '1px solid #333333' }}
                      >
                        <input
                          type="text"
                          value={newSubdomain}
                          onChange={(e) => {
                            setNewSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                            setError(null);
                          }}
                          placeholder="my-custom-domain"
                          className="flex-1 px-4 py-2.5 bg-transparent text-sm focus:outline-none"
                          style={{ color: '#ffffff' }}
                          disabled={isSaving}
                        />
                        <span className="px-3 py-2.5 text-sm" style={{ color: '#6b7280', backgroundColor: '#0a0a0a' }}>
                          .vercel.app
                        </span>
                      </div>
                      <button
                        onClick={handleAddDomain}
                        disabled={isSaving || !newSubdomain.trim()}
                        className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                        style={{
                          backgroundColor: isSaving || !newSubdomain.trim() ? '#2a2a2a' : '#333333',
                          color: isSaving || !newSubdomain.trim() ? '#6b7280' : '#ffffff',
                          border: '1px solid #444444',
                          opacity: isSaving || !newSubdomain.trim() ? 0.5 : 1,
                          cursor: isSaving || !newSubdomain.trim() ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isSaving ? (
                          <span className="flex items-center gap-2">
                            <div className="i-svg-spinners90-ring-with-bg w-4 h-4" />
                            Saving...
                          </span>
                        ) : (
                          'Add'
                        )}
                      </button>
                    </div>
                    <p className="mt-2 text-xs" style={{ color: '#6b7280' }}>
                      Add a custom .vercel.app subdomain for your project
                    </p>
                  </div>

                  {error && (
                    <div
                      className="px-4 py-3 rounded-lg text-sm flex items-center gap-2"
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                      }}
                    >
                      <div className="i-ph:warning-circle text-red-400 w-5 h-5 flex-shrink-0" />
                      <span style={{ color: '#f87171' }}>{error}</span>
                    </div>
                  )}

                  <div>
                    <h3
                      className="text-sm font-medium mb-3 flex items-center justify-between"
                      style={{ color: '#ffffff' }}
                    >
                      Connected Domains
                      <button
                        onClick={fetchDomains}
                        disabled={isLoading}
                        className="text-xs px-2 py-1 rounded transition-colors"
                        style={{
                          color: '#9ca3af',
                          backgroundColor: '#2a2a2a',
                          border: '1px solid #444444',
                        }}
                      >
                        {isLoading ? (
                          <div className="i-svg-spinners:90-ring-with-bg w-3 h-3" />
                        ) : (
                          <div className="i-ph:arrows-clockwise w-3 h-3" />
                        )}
                      </button>
                    </h3>

                    {isLoading ? (
                      <div
                        className="flex items-center justify-center py-8 rounded-lg"
                        style={{ backgroundColor: '#141414' }}
                      >
                        <div className="i-svg-spinners:90-ring-with-bg w-6 h-6" style={{ color: '#9ca3af' }} />
                      </div>
                    ) : domains.length === 0 ? (
                      <div
                        className="text-center py-8 rounded-lg"
                        style={{ backgroundColor: '#141414', color: '#6b7280' }}
                      >
                        <div className="i-ph:globe-simple w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No domains configured</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {domains.map((domain) => (
                          <div
                            key={domain.name}
                            className="flex items-center justify-between px-4 py-3 rounded-lg group"
                            style={{ backgroundColor: '#141414' }}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={classNames(
                                  'w-2 h-2 rounded-full',
                                  domain.verified ? 'bg-green-500' : 'bg-yellow-500',
                                )}
                              />
                              <span className="text-sm" style={{ color: '#ffffff' }}>
                                {domain.name}
                              </span>
                              {domain.verified && (
                                <span
                                  className="text-xs px-2 py-0.5 rounded"
                                  style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}
                                >
                                  Verified
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href={`https://${domain.name}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#2a2a2a]"
                                style={{ color: '#9ca3af' }}
                              >
                                <div className="i-ph:arrow-square-out w-4 h-4" />
                              </a>
                              <button
                                onClick={() => handleRemoveDomain(domain.name)}
                                disabled={isSaving}
                                className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10"
                                style={{ color: '#ef4444' }}
                              >
                                <div className="i-ph:trash w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {currentUrl && (
                    <div className="pt-4" style={{ borderTop: '1px solid #333333' }}>
                      <h3 className="text-sm font-medium mb-2" style={{ color: '#ffffff' }}>
                        Current Deployment
                      </h3>
                      <a
                        href={currentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm hover:underline"
                        style={{ color: '#60a5fa' }}
                      >
                        <div className="i-ph:link w-4 h-4" />
                        {currentUrl}
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #333333' }}>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: '#2a2a2a',
                      color: '#ffffff',
                      border: '1px solid #444444',
                    }}
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        </RadixDialog.Root>
      )}
    </AnimatePresence>
  );
}
