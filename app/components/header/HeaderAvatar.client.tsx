import { useState } from 'react';
import { useStore } from '@nanostores/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { motion } from 'framer-motion';
import { profileStore } from '~/lib/stores/profile';
import { classNames } from '~/utils/classNames';
import { ControlPanel } from '~/components/@settings/core/ControlPanel';

export function HeaderAvatar() {
  const profile = useStore(profileStore);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
  };

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <motion.button
            className="w-8 h-8 rounded-full bg-transparent flex items-center justify-center focus:outline-none"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {profile?.avatar ? (
              <img
                src={profile.avatar}
                alt={profile?.username || 'Profile'}
                className="w-full h-full rounded-full object-cover ring-2 ring-bolt-elements-borderColor"
                loading="eager"
                decoding="sync"
              />
            ) : (
              <div className="w-full h-full rounded-full flex items-center justify-center bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary ring-2 ring-bolt-elements-borderColor">
                <div className="i-ph:user w-4 h-4" />
              </div>
            )}
          </motion.button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={classNames(
              'min-w-[180px] z-[9999]',
              'bg-bolt-elements-background-depth-2',
              'rounded-lg shadow-lg',
              'border border-bolt-elements-borderColor',
              'animate-in fade-in-0 zoom-in-95',
              'py-1',
            )}
            sideOffset={5}
            align="end"
          >
            <div className="px-3 py-2 border-b border-bolt-elements-borderColor">
              <p className="text-sm font-medium text-bolt-elements-textPrimary truncate">
                {profile?.username || 'Guest User'}
              </p>
            </div>

            <DropdownMenu.Item
              className={classNames(
                'flex items-center gap-2 px-3 py-2',
                'text-sm text-bolt-elements-textPrimary',
                'hover:bg-bolt-elements-item-backgroundActive',
                'cursor-pointer transition-colors',
                'outline-none',
              )}
              onClick={() => handleOpenSettings()}
            >
              <div className="i-ph:user-circle w-4 h-4 text-bolt-elements-textSecondary" />
              Edit Profile
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className={classNames(
                'flex items-center gap-2 px-3 py-2',
                'text-sm text-bolt-elements-textPrimary',
                'hover:bg-bolt-elements-item-backgroundActive',
                'cursor-pointer transition-colors',
                'outline-none',
              )}
              onClick={() => handleOpenSettings()}
            >
              <div className="i-ph:gear-six w-4 h-4 text-bolt-elements-textSecondary" />
              Settings
            </DropdownMenu.Item>

            <div className="my-1 border-t border-bolt-elements-borderColor" />

            <DropdownMenu.Item
              className={classNames(
                'flex items-center gap-2 px-3 py-2',
                'text-sm text-bolt-elements-textPrimary',
                'hover:bg-bolt-elements-item-backgroundActive',
                'cursor-pointer transition-colors',
                'outline-none',
              )}
              onClick={() =>
                window.open('https://github.com/stackblitz-labs/bolt.diy/issues/new?template=bug_report.yml', '_blank')
              }
            >
              <div className="i-ph:bug w-4 h-4 text-bolt-elements-textSecondary" />
              Report Bug
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <ControlPanel open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
