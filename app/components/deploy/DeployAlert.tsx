import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { classNames } from '~/utils/classNames';
import type { DeployAlert } from '~/types/actions';
import { VercelDomainModal } from './VercelDomainModal';

interface DeployAlertProps {
  alert: DeployAlert;
  clearAlert: () => void;
  postMessage: (message: string) => void;
}

export default function DeployChatAlert({ alert, clearAlert, postMessage }: DeployAlertProps) {
  const { type, title, description, content, url, stage, buildStatus, deployStatus, source } = alert;
  const [isDomainModalOpen, setIsDomainModalOpen] = useState(false);

  // Determine if we should show the deployment progress
  const showProgress = stage && (buildStatus || deployStatus);

  // Check if this is a Vercel deployment success
  const isVercelSuccess = type === 'success' && source === 'vercel';

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className={`rounded-lg border border-devonz-elements-borderColor bg-devonz-elements-background-depth-2 p-4 mb-2`}
        >
          <div className="flex items-start">
            {/* Icon */}
            <motion.div
              className="flex-shrink-0"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div
                className={classNames(
                  'text-xl',
                  type === 'success'
                    ? 'i-ph:check-circle-duotone text-devonz-elements-icon-success'
                    : type === 'error'
                      ? 'i-ph:warning-duotone text-devonz-elements-button-danger-text'
                      : 'i-ph:info-duotone text-devonz-elements-loader-progress',
                )}
              ></div>
            </motion.div>
            {/* Content */}
            <div className="ml-3 flex-1">
              <motion.h3
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className={`text-sm font-medium text-devonz-elements-textPrimary`}
              >
                {title}
              </motion.h3>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className={`mt-2 text-sm text-devonz-elements-textSecondary`}
              >
                <p>{description}</p>

                {/* Deployment Progress Visualization */}
                {showProgress && (
                  <div className="mt-4 mb-2">
                    <div className="flex items-center space-x-2 mb-3">
                      {/* Build Step */}
                      <div className="flex items-center">
                        <div
                          className={classNames(
                            'w-6 h-6 rounded-full flex items-center justify-center',
                            buildStatus === 'running'
                              ? 'bg-devonz-elements-loader-progress'
                              : buildStatus === 'complete'
                                ? 'bg-devonz-elements-icon-success'
                                : buildStatus === 'failed'
                                  ? 'bg-devonz-elements-button-danger-background'
                                  : 'bg-devonz-elements-textTertiary',
                          )}
                        >
                          {buildStatus === 'running' ? (
                            <div className="i-svg-spinners:90-ring-with-bg text-white text-xs"></div>
                          ) : buildStatus === 'complete' ? (
                            <div className="i-ph:check text-white text-xs"></div>
                          ) : buildStatus === 'failed' ? (
                            <div className="i-ph:x text-white text-xs"></div>
                          ) : (
                            <span className="text-white text-xs">1</span>
                          )}
                        </div>
                        <span className="ml-2">Build</span>
                      </div>

                      {/* Connector Line */}
                      <div
                        className={classNames(
                          'h-0.5 w-8',
                          buildStatus === 'complete'
                            ? 'bg-devonz-elements-icon-success'
                            : 'bg-devonz-elements-textTertiary',
                        )}
                      ></div>

                      {/* Deploy Step */}
                      <div className="flex items-center">
                        <div
                          className={classNames(
                            'w-6 h-6 rounded-full flex items-center justify-center',
                            deployStatus === 'running'
                              ? 'bg-devonz-elements-loader-progress'
                              : deployStatus === 'complete'
                                ? 'bg-devonz-elements-icon-success'
                                : deployStatus === 'failed'
                                  ? 'bg-devonz-elements-button-danger-background'
                                  : 'bg-devonz-elements-textTertiary',
                          )}
                        >
                          {deployStatus === 'running' ? (
                            <div className="i-svg-spinners:90-ring-with-bg text-white text-xs"></div>
                          ) : deployStatus === 'complete' ? (
                            <div className="i-ph:check text-white text-xs"></div>
                          ) : deployStatus === 'failed' ? (
                            <div className="i-ph:x text-white text-xs"></div>
                          ) : (
                            <span className="text-white text-xs">2</span>
                          )}
                        </div>
                        <span className="ml-2">Deploy</span>
                      </div>
                    </div>
                  </div>
                )}

                {content && (
                  <div className="text-xs text-devonz-elements-textSecondary p-2 bg-devonz-elements-background-depth-3 rounded mt-4 mb-4">
                    {content}
                  </div>
                )}
                {url && type === 'success' && (
                  <div className="mt-3 space-y-2">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-devonz-elements-item-contentAccent hover:underline flex items-center"
                    >
                      <span className="mr-1">View deployed site</span>
                      <div className="i-ph:arrow-square-out"></div>
                    </a>
                    {isVercelSuccess && (
                      <button
                        onClick={() => setIsDomainModalOpen(true)}
                        className={classNames(
                          'flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md',
                          'bg-devonz-elements-background-depth-3 border border-devonz-elements-borderColor',
                          'text-devonz-elements-textSecondary hover:text-devonz-elements-textPrimary',
                          'hover:bg-devonz-elements-background-depth-4 hover:border-accent-500/50',
                          'transition-all',
                        )}
                      >
                        <div className="i-ph:globe w-4 h-4" />
                        <span>Customize Domain</span>
                      </button>
                    )}
                  </div>
                )}
              </motion.div>

              {/* Actions */}
              <motion.div
                className="mt-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className={classNames('flex gap-2')}>
                  {type === 'error' && (
                    <button
                      onClick={() =>
                        postMessage(`*Fix this deployment error*\n\`\`\`\n${content || description}\n\`\`\`\n`)
                      }
                      className={classNames(
                        `px-2 py-1.5 rounded-md text-sm font-medium`,
                        'bg-devonz-elements-button-primary-background',
                        'hover:bg-devonz-elements-button-primary-backgroundHover',
                        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-devonz-elements-button-danger-background',
                        'text-devonz-elements-button-primary-text',
                        'flex items-center gap-1.5',
                      )}
                    >
                      <div className="i-ph:chat-circle-duotone"></div>
                      Ask Alinma Coder
                    </button>
                  )}
                  <button
                    onClick={clearAlert}
                    className={classNames(
                      `px-2 py-1.5 rounded-md text-sm font-medium`,
                      'bg-devonz-elements-button-secondary-background',
                      'hover:bg-devonz-elements-button-secondary-backgroundHover',
                      'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-devonz-elements-button-secondary-background',
                      'text-devonz-elements-button-secondary-text',
                    )}
                  >
                    Dismiss
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Vercel Domain Customization Modal */}
      {isVercelSuccess && (
        <VercelDomainModal isOpen={isDomainModalOpen} onClose={() => setIsDomainModalOpen(false)} currentUrl={url} />
      )}
    </>
  );
}
