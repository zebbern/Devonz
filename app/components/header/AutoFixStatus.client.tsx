/**
 * AutoFix Status Indicator
 *
 * Shows the current status of auto-fix in the header:
 * - Hidden when not active
 * - Pulsing animation when fixing
 * - Success/failure indicator after completion
 */

import { useStore } from '@nanostores/react';
import { motion, AnimatePresence } from 'framer-motion';
import { autoFixStore, isAutoFixing, autoFixRetryCount, resetAutoFix } from '~/lib/stores/autofix';
import { classNames } from '~/utils/classNames';

export function AutoFixStatus() {
  const store = useStore(autoFixStore);
  const fixing = useStore(isAutoFixing);
  const retryCount = useStore(autoFixRetryCount);

  // Don't show anything if auto-fix is not enabled or not active
  if (!store.settings.isEnabled) {
    return null;
  }

  // Only show when actively fixing or recently completed
  if (!fixing && store.fixHistory.length === 0) {
    return null;
  }

  // Determine status
  const lastAttempt = store.fixHistory[store.fixHistory.length - 1];
  const wasSuccessful = lastAttempt?.wasSuccessful;
  const maxRetries = store.settings.maxRetries;

  const handleClick = () => {
    if (!fixing) {
      // Reset the auto-fix state when clicked after completion
      resetAutoFix();
    }
  };

  return (
    <AnimatePresence>
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        onClick={handleClick}
        className={classNames(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
          fixing
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            : wasSuccessful
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30',
        )}
        title={
          fixing
            ? `Auto-fixing... Attempt ${retryCount}/${maxRetries}`
            : wasSuccessful
              ? 'Auto-fix successful! Click to dismiss'
              : `Auto-fix failed after ${retryCount} attempts. Click to dismiss`
        }
      >
        {/* Icon */}
        <motion.div
          className={classNames(
            'text-sm',
            fixing ? 'i-ph:wrench-duotone' : wasSuccessful ? 'i-ph:check-circle-duotone' : 'i-ph:x-circle-duotone',
          )}
          animate={fixing ? { rotate: [0, 15, -15, 0] } : {}}
          transition={fixing ? { duration: 0.5, repeat: Infinity } : {}}
        />

        {/* Text */}
        <span>
          {fixing ? (
            <>
              Fixing{' '}
              <span className="opacity-75">
                ({retryCount}/{maxRetries})
              </span>
            </>
          ) : wasSuccessful ? (
            'Fixed!'
          ) : (
            'Failed'
          )}
        </span>

        {/* Pulsing dot when active */}
        {fixing && (
          <motion.span
            className="w-1.5 h-1.5 rounded-full bg-amber-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </motion.button>
    </AnimatePresence>
  );
}
